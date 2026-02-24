<?php
// api/endpoints/vendors.php
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
            getVendor($db, $_GET['id']);
        } else if (isset($_GET['insurance_check'])) {
            checkInsuranceExpiry($db);
        } else if (isset($_GET['transactions'])) {
            getVendorTransactions($db, $_GET['vendor_id'], $_GET['start'] ?? null, $_GET['end'] ?? null);
        } else {
            getAllVendors($db);
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        createVendor($db, $data);
        break;
        
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($_GET['id'])) {
            updateVendor($db, $_GET['id'], $data);
        }
        break;
        
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteVendor($db, $_GET['id']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function getAllVendors($db) {
    $sql = "SELECT v.*,
            (SELECT SUM(li.Amount) FROM line_item li 
             JOIN invoice i ON li.InvoiceID = i.InvoiceID 
             WHERE i.VendorID = v.VendorID) as total_spent,
            (SELECT COUNT(*) FROM line_item li 
             JOIN invoice i ON li.InvoiceID = i.InvoiceID 
             WHERE i.VendorID = v.VendorID) as transaction_count,
            (SELECT MAX(i.InvoiceDate) FROM invoice i 
             WHERE i.VendorID = v.VendorID) as last_transaction
            FROM vendor v
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if (isset($_GET['is_subcontractor'])) {
        $sql .= " AND v.IsSubcontractor = ?";
        $params[] = $_GET['is_subcontractor'];
    }
    
    if (isset($_GET['insurance_expiring'])) {
        $sql .= " AND v.InsuranceExpiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)";
    }
    
    $sql .= " ORDER BY v.Name";
    
    $vendors = $db->select($sql, $params);
    
    echo json_encode([
        'success' => true,
        'data' => $vendors
    ]);
}

function getVendor($db, $id) {
    $sql = "SELECT v.*,
            (SELECT SUM(li.Amount) FROM line_item li 
             JOIN invoice i ON li.InvoiceID = i.InvoiceID 
             WHERE i.VendorID = v.VendorID) as total_spent,
            (SELECT COUNT(*) FROM line_item li 
             JOIN invoice i ON li.InvoiceID = i.InvoiceID 
             WHERE i.VendorID = v.VendorID) as transaction_count,
            (SELECT MAX(i.InvoiceDate) FROM invoice i 
             WHERE i.VendorID = v.VendorID) as last_transaction,
            (SELECT MIN(i.InvoiceDate) FROM invoice i 
             WHERE i.VendorID = v.VendorID) as first_transaction
            FROM vendor v
            WHERE v.VendorID = ?";
    
    $vendor = $db->select($sql, [$id]);
    
    if (!empty($vendor)) {
        echo json_encode([
            'success' => true,
            'data' => $vendor[0]
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Vendor not found']);
    }
}

function createVendor($db, $data) {
    // Validate required fields
    if (!isset($data['Name']) || empty($data['Name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Vendor name is required']);
        return;
    }
    
    // Check for duplicate Tax ID if provided
    if (isset($data['TaxID']) && !empty($data['TaxID'])) {
        $existing = $db->select(
            "SELECT * FROM vendor WHERE TaxID = ?",
            [$data['TaxID']]
        );
        
        if (!empty($existing)) {
            http_response_code(400);
            echo json_encode(['error' => 'Vendor with this Tax ID already exists']);
            return;
        }
    }
    
    $sql = "INSERT INTO vendor (Name, TaxID, IsSubcontractor, InsuranceExpiry) 
            VALUES (?, ?, ?, ?)";
    
    $vendorId = $db->insert($sql, [
        $data['Name'],
        $data['TaxID'] ?? null,
        $data['IsSubcontractor'] ?? 0,
        $data['InsuranceExpiry'] ?? null
    ]);
    
    if ($vendorId) {
        logActivity($_SESSION['user_id'], 'create', "Created vendor: {$data['Name']}");
        
        echo json_encode([
            'success' => true,
            'message' => 'Vendor created successfully',
            'id' => $vendorId
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create vendor']);
    }
}

function updateVendor($db, $id, $data) {
    // Check if vendor exists
    $existing = $db->select("SELECT * FROM vendor WHERE VendorID = ?", [$id]);
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Vendor not found']);
        return;
    }
    
    // Check for duplicate Tax ID if changed
    if (isset($data['TaxID']) && !empty($data['TaxID']) && $data['TaxID'] != $existing[0]['TaxID']) {
        $duplicate = $db->select(
            "SELECT * FROM vendor WHERE TaxID = ? AND VendorID != ?",
            [$data['TaxID'], $id]
        );
        
        if (!empty($duplicate)) {
            http_response_code(400);
            echo json_encode(['error' => 'Vendor with this Tax ID already exists']);
            return;
        }
    }
    
    $updates = [];
    $params = [];
    
    $allowed = ['Name', 'TaxID', 'IsSubcontractor', 'InsuranceExpiry'];
    foreach ($allowed as $field) {
        if (isset($data[$field])) {
            $updates[] = "$field = ?";
            $params[] = $data[$field];
        }
    }
    
    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        return;
    }
    
    $params[] = $id;
    $sql = "UPDATE vendor SET " . implode(', ', $updates) . " WHERE VendorID = ?";
    
    $affected = $db->update($sql, $params);
    
    if ($affected !== false) {
        logActivity($_SESSION['user_id'], 'update', "Updated vendor ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Vendor updated successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update vendor']);
    }
}

function deleteVendor($db, $id) {
    // Check if vendor has transactions
    $transactions = $db->select(
        "SELECT COUNT(*) as count FROM invoice WHERE VendorID = ?",
        [$id]
    );
    
    if ($transactions[0]['count'] > 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete vendor with existing transactions']);
        return;
    }
    
    $sql = "DELETE FROM vendor WHERE VendorID = ?";
    $affected = $db->delete($sql, [$id]);
    
    if ($affected > 0) {
        logActivity($_SESSION['user_id'], 'delete', "Deleted vendor ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Vendor deleted successfully'
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Vendor not found']);
    }
}

function checkInsuranceExpiry($db) {
    $sql = "SELECT v.*,
            DATEDIFF(v.InsuranceExpiry, CURDATE()) as days_until_expiry
            FROM vendor v
            WHERE v.InsuranceExpiry IS NOT NULL
            AND v.InsuranceExpiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
            ORDER BY v.InsuranceExpiry";
    
    $expiring = $db->select($sql);
    
    echo json_encode([
        'success' => true,
        'data' => $expiring
    ]);
}

function getVendorTransactions($db, $vendorId, $startDate, $endDate) {
    if (!$vendorId) {
        http_response_code(400);
        echo json_encode(['error' => 'Vendor ID required']);
        return;
    }
    
    $sql = "SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.TotalAmount,
            li.Description, li.Quantity, li.UnitPrice, li.Amount, li.CostCode
            FROM invoice i
            JOIN line_item li ON i.InvoiceID = li.InvoiceID
            WHERE i.VendorID = ?";
    
    $params = [$vendorId];
    
    if ($startDate) {
        $sql .= " AND i.InvoiceDate >= ?";
        $params[] = $startDate;
    }
    
    if ($endDate) {
        $sql .= " AND i.InvoiceDate <= ?";
        $params[] = $endDate;
    }
    
    $sql .= " ORDER BY i.InvoiceDate DESC";
    
    $transactions = $db->select($sql, $params);
    
    echo json_encode([
        'success' => true,
        'data' => $transactions
    ]);
}

function logActivity($userId, $action, $details) {
    global $db;
    $sql = "INSERT INTO activity_log (user_id, action, details, ip_address, created_at) 
            VALUES (?, ?, ?, ?, NOW())";
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $db->insert($sql, [$userId, $action, $details, $ip]);
}
?>