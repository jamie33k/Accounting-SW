<?php
// api/endpoints/invoices.php
require_once '../database.php';
require_once '../auth_check.php';

$db = new Database();
$method = $_SERVER['REQUEST_METHOD'];

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

switch($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            getInvoice($db, $_GET['id']);
        } else if (isset($_GET['stats'])) {
            getInvoiceStats($db);
        } else if (isset($_GET['download'])) {
            downloadInvoice($db, $_GET['id'], $_GET['format'] ?? 'pdf');
        } else {
            getAllInvoices($db);
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($data['action'])) {
            switch($data['action']) {
                case 'send':
                    sendInvoice($db, $_GET['id'], $data);
                    break;
                case 'mark_paid':
                    markInvoiceAsPaid($db, $_GET['id'], $data);
                    break;
                default:
                    createInvoice($db, $data);
            }
        } else {
            createInvoice($db, $data);
        }
        break;
        
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($_GET['id'])) {
            updateInvoice($db, $_GET['id'], $data);
        }
        break;
        
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteInvoice($db, $_GET['id']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function getAllInvoices($db) {
    $sql = "SELECT i.*, 
            j.JobName, j.CompanyID,
            c.Name as ClientName, c.Email as ClientEmail,
            cl.Name as CompanyName
            FROM invoice i
            LEFT JOIN job j ON i.JobID = j.JobID
            LEFT JOIN client c ON i.ClientID = c.ClientID
            LEFT JOIN company cl ON j.CompanyID = cl.CompanyID
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if (isset($_GET['status']) && !empty($_GET['status'])) {
        $sql .= " AND i.Status = ?";
        $params[] = $_GET['status'];
    }
    
    if (isset($_GET['job_id']) && !empty($_GET['job_id'])) {
        $sql .= " AND i.JobID = ?";
        $params[] = $_GET['job_id'];
    }
    
    if (isset($_GET['client_id']) && !empty($_GET['client_id'])) {
        $sql .= " AND i.ClientID = ?";
        $params[] = $_GET['client_id'];
    }
    
    if (isset($_GET['start_date']) && !empty($_GET['start_date'])) {
        $sql .= " AND i.InvoiceDate >= ?";
        $params[] = $_GET['start_date'];
    }
    
    if (isset($_GET['end_date']) && !empty($_GET['end_date'])) {
        $sql .= " AND i.InvoiceDate <= ?";
        $params[] = $_GET['end_date'];
    }
    
    $sql .= " ORDER BY i.InvoiceDate DESC";
    
    $invoices = $db->select($sql, $params);
    
    // Calculate retainage amounts
    foreach ($invoices as &$inv) {
        $inv['RetainageAmount'] = $inv['TotalAmount'] * ($inv['RetainagePercent'] / 100);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $invoices
    ]);
}

function getInvoice($db, $id) {
    $sql = "SELECT i.*, 
            j.JobName, j.CompanyID,
            c.Name as ClientName, c.Email as ClientEmail, c.Address as ClientAddress, c.Phone as ClientPhone,
            cl.Name as CompanyName, cl.Address as CompanyAddress, cl.TaxID as CompanyTaxID
            FROM invoice i
            LEFT JOIN job j ON i.JobID = j.JobID
            LEFT JOIN client c ON i.ClientID = c.ClientID
            LEFT JOIN company cl ON j.CompanyID = cl.CompanyID
            WHERE i.InvoiceID = ?";
    
    $invoice = $db->select($sql, [$id]);
    
    if (!empty($invoice)) {
        // Get line items
        $lineItems = $db->select(
            "SELECT * FROM line_item WHERE InvoiceID = ? ORDER BY LineItemID",
            [$id]
        );
        
        $inv = $invoice[0];
        $inv['line_items'] = $lineItems;
        $inv['RetainageAmount'] = $inv['TotalAmount'] * ($inv['RetainagePercent'] / 100);
        
        // Calculate subtotal
        $subtotal = 0;
        foreach ($lineItems as $item) {
            $subtotal += $item['Amount'];
        }
        $inv['Subtotal'] = $subtotal;
        
        echo json_encode([
            'success' => true,
            'data' => $inv
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
    }
}

function createInvoice($db, $data) {
    // Validate required fields
    $required = ['InvoiceNumber', 'JobID', 'ClientID', 'InvoiceDate', 'DueDate'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "$field is required"]);
            return;
        }
    }
    
    // Check for duplicate invoice number
    $existing = $db->select(
        "SELECT * FROM invoice WHERE InvoiceNumber = ?",
        [$data['InvoiceNumber']]
    );
    
    if (!empty($existing)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invoice number already exists']);
        return;
    }
    
    // Begin transaction
    $db->getConnection()->begin_transaction();
    
    try {
        // Calculate totals from line items
        $subtotal = 0;
        if (isset($data['line_items']) && is_array($data['line_items'])) {
            foreach ($data['line_items'] as $item) {
                $subtotal += $item['Amount'] ?? 0;
            }
        }
        
        $retainagePercent = $data['RetainagePercent'] ?? 0;
        $retainageAmount = $subtotal * ($retainagePercent / 100);
        $totalAmount = $subtotal - $retainageAmount;
        
        // Insert invoice
        $sql = "INSERT INTO invoice (InvoiceNumber, JobID, ClientID, InvoiceDate, DueDate, 
                TotalAmount, RetainagePercent, AmountDue, Status, created_by, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $invoiceId = $db->insert($sql, [
            $data['InvoiceNumber'],
            $data['JobID'],
            $data['ClientID'],
            $data['InvoiceDate'],
            $data['DueDate'],
            $totalAmount,
            $retainagePercent,
            $totalAmount, // Amount due initially equals total
            $data['Status'] ?? 'Draft',
            $_SESSION['user_id']
        ]);
        
        if (!$invoiceId) {
            throw new Exception('Failed to create invoice');
        }
        
        // Insert line items
        if (isset($data['line_items']) && is_array($data['line_items'])) {
            foreach ($data['line_items'] as $item) {
                $itemSql = "INSERT INTO line_item (InvoiceID, Description, Quantity, UnitPrice, Amount, CostCode) 
                           VALUES (?, ?, ?, ?, ?, ?)";
                $db->insert($itemSql, [
                    $invoiceId,
                    $item['Description'] ?? '',
                    $item['Quantity'] ?? 1,
                    $item['UnitPrice'] ?? 0,
                    $item['Amount'] ?? 0,
                    $item['CostCode'] ?? null
                ]);
            }
        }
        
        $db->getConnection()->commit();
        
        logActivity($_SESSION['user_id'], 'create', "Created invoice: {$data['InvoiceNumber']}");
        
        echo json_encode([
            'success' => true,
            'message' => 'Invoice created successfully',
            'id' => $invoiceId
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create invoice: ' . $e->getMessage()]);
    }
}

function updateInvoice($db, $id, $data) {
    // Check if invoice exists
    $existing = $db->select("SELECT * FROM invoice WHERE InvoiceID = ?", [$id]);
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        return;
    }
    
    // Don't allow editing of paid invoices
    if ($existing[0]['Status'] == 'Paid') {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot edit paid invoice']);
        return;
    }
    
    $db->getConnection()->begin_transaction();
    
    try {
        // Update invoice details
        $updates = [];
        $params = [];
        
        $allowed = ['InvoiceNumber', 'JobID', 'ClientID', 'InvoiceDate', 'DueDate', 
                   'RetainagePercent', 'Status'];
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        
        if (!empty($updates)) {
            $params[] = $id;
            $sql = "UPDATE invoice SET " . implode(', ', $updates) . " WHERE InvoiceID = ?";
            $db->update($sql, $params);
        }
        
        // Update line items (delete old, insert new)
        if (isset($data['line_items'])) {
            // Delete existing line items
            $db->delete("DELETE FROM line_item WHERE InvoiceID = ?", [$id]);
            
            // Insert new line items
            foreach ($data['line_items'] as $item) {
                $itemSql = "INSERT INTO line_item (InvoiceID, Description, Quantity, UnitPrice, Amount, CostCode) 
                           VALUES (?, ?, ?, ?, ?, ?)";
                $db->insert($itemSql, [
                    $id,
                    $item['Description'] ?? '',
                    $item['Quantity'] ?? 1,
                    $item['UnitPrice'] ?? 0,
                    $item['Amount'] ?? 0,
                    $item['CostCode'] ?? null
                ]);
            }
        }
        
        // Recalculate totals
        $lineItems = $db->select("SELECT SUM(Amount) as total FROM line_item WHERE InvoiceID = ?", [$id]);
        $subtotal = $lineItems[0]['total'] ?? 0;
        
        $retainagePercent = $data['RetainagePercent'] ?? $existing[0]['RetainagePercent'];
        $retainageAmount = $subtotal * ($retainagePercent / 100);
        $totalAmount = $subtotal - $retainageAmount;
        
        $db->update(
            "UPDATE invoice SET TotalAmount = ?, AmountDue = ? WHERE InvoiceID = ?",
            [$totalAmount, $totalAmount, $id]
        );
        
        $db->getConnection()->commit();
        
        logActivity($_SESSION['user_id'], 'update', "Updated invoice ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Invoice updated successfully'
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update invoice: ' . $e->getMessage()]);
    }
}

function deleteInvoice($db, $id) {
    // Check if invoice exists
    $existing = $db->select("SELECT * FROM invoice WHERE InvoiceID = ?", [$id]);
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        return;
    }
    
    // Don't allow deletion of paid or sent invoices
    if (in_array($existing[0]['Status'], ['Paid', 'Sent'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete paid or sent invoice']);
        return;
    }
    
    $db->getConnection()->begin_transaction();
    
    try {
        // Delete line items first
        $db->delete("DELETE FROM line_item WHERE InvoiceID = ?", [$id]);
        
        // Delete invoice
        $db->delete("DELETE FROM invoice WHERE InvoiceID = ?", [$id]);
        
        $db->getConnection()->commit();
        
        logActivity($_SESSION['user_id'], 'delete', "Deleted invoice ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Invoice deleted successfully'
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete invoice: ' . $e->getMessage()]);
    }
}

function sendInvoice($db, $id, $data) {
    // Validate email data
    if (empty($data['to']) || empty($data['subject'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Recipient email and subject are required']);
        return;
    }
    
    // Get invoice details
    $invoice = getInvoice($db, $id);
    $invoiceData = json_decode($invoice, true);
    
    if (!$invoiceData['success']) {
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        return;
    }
    
    // Here you would integrate with an email service
    // For now, we'll just log it and update status
    
    $db->update(
        "UPDATE invoice SET Status = 'Sent' WHERE InvoiceID = ?",
        [$id]
    );
    
    logActivity($_SESSION['user_id'], 'send', "Sent invoice ID: $id to {$data['to']}");
    
    echo json_encode([
        'success' => true,
        'message' => 'Invoice sent successfully'
    ]);
}

function markInvoiceAsPaid($db, $id, $data) {
    // Validate payment data
    if (empty($data['payment_date'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Payment date is required']);
        return;
    }
    
    // Check if invoice exists
    $existing = $db->select("SELECT * FROM invoice WHERE InvoiceID = ?", [$id]);
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Invoice not found']);
        return;
    }
    
    $db->getConnection()->begin_transaction();
    
    try {
        // Update invoice status
        $db->update(
            "UPDATE invoice SET Status = 'Paid', AmountDue = 0 WHERE InvoiceID = ?",
            [$id]
        );
        
        // Create payment transaction
        $transactionSql = "INSERT INTO transaction (InvoiceID, TransactionDate, Description, Credit, AccountCode) 
                          VALUES (?, ?, ?, ?, ?)";
        $db->insert($transactionSql, [
            $id,
            $data['payment_date'],
            'Payment received for invoice ' . $existing[0]['InvoiceNumber'],
            $existing[0]['TotalAmount'],
            'ACCOUNTS_RECEIVABLE'
        ]);
        
        $db->getConnection()->commit();
        
        logActivity($_SESSION['user_id'], 'mark_paid', "Marked invoice ID: $id as paid");
        
        echo json_encode([
            'success' => true,
            'message' => 'Invoice marked as paid'
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to mark invoice as paid: ' . $e->getMessage()]);
    }
}

function getInvoiceStats($db) {
    $sql = "SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as draft_count,
            SUM(CASE WHEN Status = 'Sent' THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN Status = 'Partial' THEN 1 ELSE 0 END) as partial_count,
            SUM(CASE WHEN Status = 'Paid' THEN 1 ELSE 0 END) as paid_count,
            SUM(TotalAmount) as total_invoiced,
            SUM(CASE WHEN Status = 'Paid' THEN TotalAmount ELSE 0 END) as total_paid,
            SUM(CASE WHEN Status != 'Paid' THEN AmountDue ELSE 0 END) as total_due,
            SUM(TotalAmount * (RetainagePercent / 100)) as total_retainage
            FROM invoice";
    
    $stats = $db->select($sql);
    
    echo json_encode([
        'success' => true,
        'data' => $stats[0]
    ]);
}

function downloadInvoice($db, $id, $format) {
    // This would generate PDF/Excel file
    // For now, just return JSON
    $invoice = getInvoice($db, $id);
    header('Content-Type: application/json');
    echo $invoice;
}

function logActivity($userId, $action, $details) {
    global $db;
    $sql = "INSERT INTO activity_log (user_id, action, details, ip_address, created_at) 
            VALUES (?, ?, ?, ?, NOW())";
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $db->insert($sql, [$userId, $action, $details, $ip]);
}
?>