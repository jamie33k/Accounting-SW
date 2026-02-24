<?php
// api/endpoints/timesheets.php
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
            getTimesheet($db, $_GET['id']);
        } else if (isset($_GET['summary'])) {
            getTimesheetSummary($db);
        } else {
            getAllTimesheets($db);
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        createTimesheet($db, $data);
        break;
        
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($_GET['id'])) {
            if (isset($data['action'])) {
                switch($data['action']) {
                    case 'approve':
                        approveTimesheet($db, $_GET['id']);
                        break;
                    case 'reject':
                        rejectTimesheet($db, $_GET['id'], $data['reason'] ?? '');
                        break;
                    default:
                        updateTimesheet($db, $_GET['id'], $data);
                }
            } else {
                updateTimesheet($db, $_GET['id'], $data);
            }
        }
        break;
        
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteTimesheet($db, $_GET['id']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function getAllTimesheets($db) {
    $sql = "SELECT t.*, 
            e.Name as EmployeeName, e.PayRate,
            j.JobName, j.CompanyID,
            c.Name as CompanyName
            FROM timesheet t
            JOIN employee e ON t.EmployeeID = e.EmployeeID
            JOIN job j ON t.JobID = j.JobID
            LEFT JOIN company c ON j.CompanyID = c.CompanyID
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if (isset($_GET['start_date']) && !empty($_GET['start_date'])) {
        $sql .= " AND t.WeekEnding >= ?";
        $params[] = $_GET['start_date'];
    }
    
    if (isset($_GET['end_date']) && !empty($_GET['end_date'])) {
        $sql .= " AND t.WeekEnding <= ?";
        $params[] = $_GET['end_date'];
    }
    
    if (isset($_GET['employee_id']) && !empty($_GET['employee_id'])) {
        $sql .= " AND t.EmployeeID = ?";
        $params[] = $_GET['employee_id'];
    }
    
    if (isset($_GET['job_id']) && !empty($_GET['job_id'])) {
        $sql .= " AND t.JobID = ?";
        $params[] = $_GET['job_id'];
    }
    
    if (isset($_GET['status']) && !empty($_GET['status'])) {
        $sql .= " AND t.status = ?";
        $params[] = $_GET['status'];
    }
    
    $sql .= " ORDER BY t.WeekEnding DESC, e.Name";
    
    $timesheets = $db->select($sql, $params);
    
    // Add calculated fields
    foreach ($timesheets as &$ts) {
        $ts['regular_pay'] = $ts['HoursWorked'] * $ts['PayRate'];
        $ts['overtime_pay'] = $ts['OvertimeHours'] * $ts['PayRate'] * 1.5;
        $ts['total_pay'] = $ts['regular_pay'] + $ts['overtime_pay'];
        $ts['status'] = $ts['status'] ?? 'Pending';
    }
    
    echo json_encode([
        'success' => true,
        'data' => $timesheets
    ]);
}

function getTimesheet($db, $id) {
    $sql = "SELECT t.*, 
            e.Name as EmployeeName, e.PayRate,
            j.JobName, j.CompanyID,
            c.Name as CompanyName,
            u.full_name as approved_by_name
            FROM timesheet t
            JOIN employee e ON t.EmployeeID = e.EmployeeID
            JOIN job j ON t.JobID = j.JobID
            LEFT JOIN company c ON j.CompanyID = c.CompanyID
            LEFT JOIN users u ON t.approved_by = u.user_id
            WHERE t.TimesheetID = ?";
    
    $timesheet = $db->select($sql, [$id]);
    
    if (!empty($timesheet)) {
        $ts = $timesheet[0];
        $ts['regular_pay'] = $ts['HoursWorked'] * $ts['PayRate'];
        $ts['overtime_pay'] = $ts['OvertimeHours'] * $ts['PayRate'] * 1.5;
        $ts['total_pay'] = $ts['regular_pay'] + $ts['overtime_pay'];
        $ts['status'] = $ts['status'] ?? 'Pending';
        
        echo json_encode([
            'success' => true,
            'data' => $ts
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Timesheet not found']);
    }
}

function createTimesheet($db, $data) {
    // Validate required fields
    $required = ['EmployeeID', 'JobID', 'WeekEnding', 'HoursWorked'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "$field is required"]);
            return;
        }
    }
    
    // Validate hours
    if (!is_numeric($data['HoursWorked']) || $data['HoursWorked'] <= 0 || $data['HoursWorked'] > 168) {
        http_response_code(400);
        echo json_encode(['error' => 'Hours worked must be between 0 and 168']);
        return;
    }
    
    // Check for duplicate
    $existing = $db->select(
        "SELECT * FROM timesheet WHERE EmployeeID = ? AND JobID = ? AND WeekEnding = ?",
        [$data['EmployeeID'], $data['JobID'], $data['WeekEnding']]
    );
    
    if (!empty($existing)) {
        http_response_code(400);
        echo json_encode(['error' => 'Timesheet already exists for this employee, job, and week']);
        return;
    }
    
    // Auto-calculate overtime
    $overtime = $data['OvertimeHours'] ?? 0;
    if ($data['HoursWorked'] > 40 && $overtime == 0) {
        $overtime = $data['HoursWorked'] - 40;
    }
    
    $sql = "INSERT INTO timesheet (EmployeeID, JobID, WeekEnding, HoursWorked, OvertimeHours, status, created_at) 
            VALUES (?, ?, ?, ?, ?, 'Pending', NOW())";
    
    $timesheetId = $db->insert($sql, [
        $data['EmployeeID'],
        $data['JobID'],
        $data['WeekEnding'],
        $data['HoursWorked'],
        $overtime
    ]);
    
    if ($timesheetId) {
        // Log activity
        logActivity($_SESSION['user_id'], 'create', "Created timesheet ID: $timesheetId");
        
        echo json_encode([
            'success' => true,
            'message' => 'Timesheet created successfully',
            'id' => $timesheetId
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create timesheet']);
    }
}

function updateTimesheet($db, $id, $data) {
    // Check if timesheet exists and is pending
    $existing = $db->select(
        "SELECT * FROM timesheet WHERE TimesheetID = ?", 
        [$id]
    );
    
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Timesheet not found']);
        return;
    }
    
    if ($existing[0]['status'] != 'Pending') {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot update non-pending timesheet']);
        return;
    }
    
    $updates = [];
    $params = [];
    
    $allowed = ['EmployeeID', 'JobID', 'WeekEnding', 'HoursWorked', 'OvertimeHours'];
    foreach ($allowed as $field) {
        if (isset($data[$field])) {
            // Validate hours if provided
            if ($field == 'HoursWorked' && (!is_numeric($data[$field]) || $data[$field] <= 0 || $data[$field] > 168)) {
                http_response_code(400);
                echo json_encode(['error' => 'Hours worked must be between 0 and 168']);
                return;
            }
            
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
    $sql = "UPDATE timesheet SET " . implode(', ', $updates) . " WHERE TimesheetID = ?";
    
    $affected = $db->update($sql, $params);
    
    if ($affected !== false) {
        logActivity($_SESSION['user_id'], 'update', "Updated timesheet ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Timesheet updated successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update timesheet']);
    }
}

function approveTimesheet($db, $id) {
    // Check if timesheet exists
    $existing = $db->select(
        "SELECT * FROM timesheet WHERE TimesheetID = ?", 
        [$id]
    );
    
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Timesheet not found']);
        return;
    }
    
    $sql = "UPDATE timesheet SET status = 'Approved', approved_by = ?, approved_date = NOW() WHERE TimesheetID = ?";
    $affected = $db->update($sql, [$_SESSION['user_id'], $id]);
    
    if ($affected) {
        logActivity($_SESSION['user_id'], 'approve', "Approved timesheet ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Timesheet approved successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to approve timesheet']);
    }
}

function rejectTimesheet($db, $id, $reason) {
    if (empty($reason)) {
        http_response_code(400);
        echo json_encode(['error' => 'Rejection reason is required']);
        return;
    }
    
    // Check if timesheet exists
    $existing = $db->select(
        "SELECT * FROM timesheet WHERE TimesheetID = ?", 
        [$id]
    );
    
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Timesheet not found']);
        return;
    }
    
    $sql = "UPDATE timesheet SET status = 'Rejected', rejection_reason = ?, rejected_by = ?, rejected_date = NOW() WHERE TimesheetID = ?";
    $affected = $db->update($sql, [$reason, $_SESSION['user_id'], $id]);
    
    if ($affected) {
        logActivity($_SESSION['user_id'], 'reject', "Rejected timesheet ID: $id. Reason: $reason");
        
        echo json_encode([
            'success' => true,
            'message' => 'Timesheet rejected successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reject timesheet']);
    }
}

function deleteTimesheet($db, $id) {
    // Check if timesheet exists
    $existing = $db->select(
        "SELECT * FROM timesheet WHERE TimesheetID = ?", 
        [$id]
    );
    
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Timesheet not found']);
        return;
    }
    
    // Only allow deletion of pending timesheets
    if ($existing[0]['status'] != 'Pending') {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete approved or rejected timesheet']);
        return;
    }
    
    $sql = "DELETE FROM timesheet WHERE TimesheetID = ?";
    $affected = $db->delete($sql, [$id]);
    
    if ($affected > 0) {
        logActivity($_SESSION['user_id'], 'delete', "Deleted timesheet ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Timesheet deleted successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete timesheet']);
    }
}

function getTimesheetSummary($db) {
    $start = $_GET['start'] ?? date('Y-m-01');
    $end = $_GET['end'] ?? date('Y-m-t');
    
    $sql = "SELECT 
            COUNT(*) as total_timesheets,
            SUM(HoursWorked) as total_hours,
            SUM(OvertimeHours) as total_overtime,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected_count
            FROM timesheet
            WHERE WeekEnding BETWEEN ? AND ?";
    
    $summary = $db->select($sql, [$start, $end]);
    
    // Get payroll total
    $payrollSql = "SELECT SUM(
                        (t.HoursWorked * e.PayRate) + 
                        (t.OvertimeHours * e.PayRate * 1.5)
                    ) as total_payroll
                    FROM timesheet t
                    JOIN employee e ON t.EmployeeID = e.EmployeeID
                    WHERE t.WeekEnding BETWEEN ? AND ? AND t.status = 'Approved'";
    
    $payroll = $db->select($payrollSql, [$start, $end]);
    
    echo json_encode([
        'success' => true,
        'data' => [
            'summary' => $summary[0],
            'total_payroll' => $payroll[0]['total_payroll'] ?? 0,
            'period' => ['start' => $start, 'end' => $end]
        ]
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