<?php
// api/endpoints/jobs.php
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
            getJob($db, $_GET['id']);
        } else if (isset($_GET['costs'])) {
            getJobCosts($db, $_GET['job_id']);
        } else if (isset($_GET['profitability'])) {
            getJobProfitability($db, $_GET['job_id']);
        } else {
            getAllJobs($db);
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        createJob($db, $data);
        break;
        
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($_GET['id'])) {
            updateJob($db, $_GET['id'], $data);
        }
        break;
        
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteJob($db, $_GET['id']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function getAllJobs($db) {
    $sql = "SELECT j.*, c.Name as CompanyName, c.TaxID as CompanyTaxID,
            (SELECT COUNT(*) FROM timesheet WHERE JobID = j.JobID) as timesheet_count,
            (SELECT SUM(HoursWorked) FROM timesheet WHERE JobID = j.JobID) as total_hours,
            (SELECT SUM(TotalAmount) FROM invoice WHERE JobID = j.JobID AND Status = 'Paid') as revenue,
            (SELECT SUM(Amount) FROM line_item li 
             JOIN invoice i ON li.InvoiceID = i.InvoiceID 
             WHERE i.JobID = j.JobID AND li.CostCode = 'Labor') as labor_cost,
            (SELECT SUM(Amount) FROM line_item li 
             JOIN invoice i ON li.InvoiceID = i.InvoiceID 
             WHERE i.JobID = j.JobID AND li.CostCode = 'Materials') as material_cost
            FROM job j
            LEFT JOIN company c ON j.CompanyID = c.CompanyID
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if (isset($_GET['status']) && !empty($_GET['status'])) {
        $sql .= " AND j.Status = ?";
        $params[] = $_GET['status'];
    }
    
    if (isset($_GET['company_id']) && !empty($_GET['company_id'])) {
        $sql .= " AND j.CompanyID = ?";
        $params[] = $_GET['company_id'];
    }
    
    $sql .= " ORDER BY j.StartDate DESC";
    
    $jobs = $db->select($sql, $params);
    
    // Calculate profit/loss
    foreach ($jobs as &$job) {
        $job['total_cost'] = ($job['labor_cost'] ?? 0) + ($job['material_cost'] ?? 0);
        $job['profit'] = ($job['revenue'] ?? 0) - $job['total_cost'];
        $job['profit_margin'] = $job['revenue'] > 0 ? ($job['profit'] / $job['revenue'] * 100) : 0;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $jobs
    ]);
}

function getJob($db, $id) {
    $sql = "SELECT j.*, c.Name as CompanyName, c.Address as CompanyAddress, c.TaxID as CompanyTaxID,
            (SELECT COUNT(*) FROM timesheet WHERE JobID = j.JobID) as timesheet_count,
            (SELECT SUM(HoursWorked) FROM timesheet WHERE JobID = j.JobID) as total_hours,
            (SELECT SUM(TotalAmount) FROM invoice WHERE JobID = j.JobID) as total_invoiced,
            (SELECT SUM(TotalAmount) FROM invoice WHERE JobID = j.JobID AND Status = 'Paid') as paid_amount,
            (SELECT SUM(AmountDue) FROM invoice WHERE JobID = j.JobID AND Status != 'Paid') as outstanding_amount
            FROM job j
            LEFT JOIN company c ON j.CompanyID = c.CompanyID
            WHERE j.JobID = ?";
    
    $job = $db->select($sql, [$id]);
    
    if (!empty($job)) {
        echo json_encode([
            'success' => true,
            'data' => $job[0]
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Job not found']);
    }
}

function createJob($db, $data) {
    // Validate required fields
    $required = ['JobName', 'CompanyID'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "$field is required"]);
            return;
        }
    }
    
    // Validate dates if provided
    if (isset($data['StartDate']) && isset($data['EndDate'])) {
        if (strtotime($data['StartDate']) > strtotime($data['EndDate'])) {
            http_response_code(400);
            echo json_encode(['error' => 'End date must be after start date']);
            return;
        }
    }
    
    $sql = "INSERT INTO job (JobName, CompanyID, Location, StartDate, EndDate, BudgetTotal, Status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    $jobId = $db->insert($sql, [
        $data['JobName'],
        $data['CompanyID'],
        $data['Location'] ?? null,
        $data['StartDate'] ?? null,
        $data['EndDate'] ?? null,
        $data['BudgetTotal'] ?? 0,
        $data['Status'] ?? 'Active'
    ]);
    
    if ($jobId) {
        logActivity($_SESSION['user_id'], 'create', "Created job: {$data['JobName']}");
        
        echo json_encode([
            'success' => true,
            'message' => 'Job created successfully',
            'id' => $jobId
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create job']);
    }
}

function updateJob($db, $id, $data) {
    // Check if job exists
    $existing = $db->select("SELECT * FROM job WHERE JobID = ?", [$id]);
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Job not found']);
        return;
    }
    
    // Validate dates if both provided
    if (isset($data['StartDate']) && isset($data['EndDate'])) {
        if (strtotime($data['StartDate']) > strtotime($data['EndDate'])) {
            http_response_code(400);
            echo json_encode(['error' => 'End date must be after start date']);
            return;
        }
    }
    
    $updates = [];
    $params = [];
    
    $allowed = ['JobName', 'CompanyID', 'Location', 'StartDate', 'EndDate', 'BudgetTotal', 'Status'];
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
    $sql = "UPDATE job SET " . implode(', ', $updates) . " WHERE JobID = ?";
    
    $affected = $db->update($sql, $params);
    
    if ($affected !== false) {
        logActivity($_SESSION['user_id'], 'update', "Updated job ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Job updated successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update job']);
    }
}

function deleteJob($db, $id) {
    // Check if job has timesheets or invoices
    $dependencies = $db->select(
        "SELECT 
            (SELECT COUNT(*) FROM timesheet WHERE JobID = ?) as timesheet_count,
            (SELECT COUNT(*) FROM invoice WHERE JobID = ?) as invoice_count",
        [$id, $id]
    );
    
    if ($dependencies[0]['timesheet_count'] > 0 || $dependencies[0]['invoice_count'] > 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete job with existing timesheets or invoices']);
        return;
    }
    
    $sql = "DELETE FROM job WHERE JobID = ?";
    $affected = $db->delete($sql, [$id]);
    
    if ($affected > 0) {
        logActivity($_SESSION['user_id'], 'delete', "Deleted job ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Job deleted successfully'
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Job not found']);
    }
}

function getJobCosts($db, $jobId) {
    if (!$jobId) {
        http_response_code(400);
        echo json_encode(['error' => 'Job ID required']);
        return;
    }
    
    // Get labor costs from timesheets
    $laborSql = "SELECT 
                SUM(t.HoursWorked * e.PayRate) as regular_labor,
                SUM(t.OvertimeHours * e.PayRate * 1.5) as overtime_labor,
                SUM(t.HoursWorked) as total_hours,
                SUM(t.OvertimeHours) as total_overtime,
                AVG(e.PayRate) as avg_rate
                FROM timesheet t
                JOIN employee e ON t.EmployeeID = e.EmployeeID
                WHERE t.JobID = ? AND t.status = 'Approved'";
    
    $labor = $db->select($laborSql, [$jobId]);
    
    // Get material costs from line items
    $materialSql = "SELECT 
                   SUM(li.Amount) as materials,
                   COUNT(DISTINCT li.InvoiceID) as invoice_count
                   FROM line_item li
                   JOIN invoice i ON li.InvoiceID = i.InvoiceID
                   WHERE i.JobID = ? AND li.CostCode = 'Materials'";
    
    $material = $db->select($materialSql, [$jobId]);
    
    // Get equipment costs
    $equipmentSql = "SELECT SUM(li.Amount) as equipment
                    FROM line_item li
                    JOIN invoice i ON li.InvoiceID = i.InvoiceID
                    WHERE i.JobID = ? AND li.CostCode = 'Equipment'";
    
    $equipment = $db->select($equipmentSql, [$jobId]);
    
    // Get subcontractor costs
    $subSql = "SELECT SUM(li.Amount) as subcontractors
              FROM line_item li
              JOIN invoice i ON li.InvoiceID = i.InvoiceID
              WHERE i.JobID = ? AND li.CostCode = 'Subcontractor'";
    
    $subcontractors = $db->select($subSql, [$jobId]);
    
    $result = [
        'labor' => $labor[0]['regular_labor'] ?? 0,
        'overtime_labor' => $labor[0]['overtime_labor'] ?? 0,
        'total_labor' => ($labor[0]['regular_labor'] ?? 0) + ($labor[0]['overtime_labor'] ?? 0),
        'materials' => $material[0]['materials'] ?? 0,
        'equipment' => $equipment[0]['equipment'] ?? 0,
        'subcontractors' => $subcontractors[0]['subcontractors'] ?? 0,
        'total_hours' => $labor[0]['total_hours'] ?? 0,
        'total_overtime' => $labor[0]['total_overtime'] ?? 0,
        'avg_rate' => $labor[0]['avg_rate'] ?? 0,
        'actual' => ($labor[0]['regular_labor'] ?? 0) + 
                    ($labor[0]['overtime_labor'] ?? 0) + 
                    ($material[0]['materials'] ?? 0) + 
                    ($equipment[0]['equipment'] ?? 0) + 
                    ($subcontractors[0]['subcontractors'] ?? 0)
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
}

function getJobProfitability($db, $jobId) {
    if (!$jobId) {
        http_response_code(400);
        echo json_encode(['error' => 'Job ID required']);
        return;
    }
    
    // Get job details
    $job = $db->select("SELECT * FROM job WHERE JobID = ?", [$jobId]);
    if (empty($job)) {
        http_response_code(404);
        echo json_encode(['error' => 'Job not found']);
        return;
    }
    
    // Get costs
    $costs = getJobCosts($db, $jobId);
    $costsData = json_decode($costs, true);
    
    // Get revenue
    $revenueSql = "SELECT 
                  SUM(TotalAmount) as total_revenue,
                  SUM(CASE WHEN Status = 'Paid' THEN TotalAmount ELSE 0 END) as paid_revenue,
                  SUM(CASE WHEN Status != 'Paid' THEN AmountDue ELSE 0 END) as outstanding
                  FROM invoice
                  WHERE JobID = ?";
    
    $revenue = $db->select($revenueSql, [$jobId]);
    
    $budget = $job[0]['BudgetTotal'] ?? 0;
    $actualCost = $costsData['data']['actual'] ?? 0;
    $revenue_amount = $revenue[0]['total_revenue'] ?? 0;
    $profit = $revenue_amount - $actualCost;
    $margin = $revenue_amount > 0 ? ($profit / $revenue_amount * 100) : 0;
    
    $result = [
        'job_id' => $jobId,
        'job_name' => $job[0]['JobName'],
        'budget' => $budget,
        'actual_cost' => $actualCost,
        'variance' => $budget - $actualCost,
        'variance_percentage' => $budget > 0 ? (($budget - $actualCost) / $budget * 100) : 0,
        'revenue' => $revenue_amount,
        'paid_revenue' => $revenue[0]['paid_revenue'] ?? 0,
        'outstanding' => $revenue[0]['outstanding'] ?? 0,
        'profit' => $profit,
        'margin' => $margin
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $result
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