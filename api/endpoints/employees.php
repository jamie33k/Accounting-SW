<?php
// api/endpoints/employees.php
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
            getEmployee($db, $_GET['id']);
        } else if (isset($_GET['export'])) {
            exportEmployees($db);
        } else {
            getAllEmployees($db);
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($data['action']) && $data['action'] == 'bulk_delete') {
            bulkDeleteEmployees($db, $data['ids']);
        } else {
            createEmployee($db, $data);
        }
        break;
        
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($_GET['id'])) {
            updateEmployee($db, $_GET['id'], $data);
        }
        break;
        
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteEmployee($db, $_GET['id']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function getAllEmployees($db) {
    $sql = "SELECT e.*, u.email, u.full_name as user_name,
            (SELECT COUNT(*) FROM timesheet WHERE EmployeeID = e.EmployeeID) as timesheet_count,
            (SELECT SUM(HoursWorked) FROM timesheet WHERE EmployeeID = e.EmployeeID) as total_hours
            FROM employee e 
            LEFT JOIN users u ON e.user_id = u.user_id 
            ORDER BY e.Name";
    
    $employees = $db->select($sql);
    
    echo json_encode([
        'success' => true,
        'data' => $employees
    ]);
}

function getEmployee($db, $id) {
    $sql = "SELECT e.*, u.email, u.full_name as user_name,
            (SELECT COUNT(*) FROM timesheet WHERE EmployeeID = e.EmployeeID) as timesheet_count,
            (SELECT SUM(HoursWorked) FROM timesheet WHERE EmployeeID = e.EmployeeID) as total_hours,
            (SELECT SUM(HoursWorked * PayRate) FROM timesheet t 
             JOIN employee e2 ON t.EmployeeID = e2.EmployeeID 
             WHERE t.EmployeeID = e.EmployeeID) as total_pay
            FROM employee e 
            LEFT JOIN users u ON e.user_id = u.user_id 
            WHERE e.EmployeeID = ?";
    
    $employee = $db->select($sql, [$id]);
    
    if (!empty($employee)) {
        echo json_encode([
            'success' => true,
            'data' => $employee[0]
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Employee not found']);
    }
}

function createEmployee($db, $data) {
    // Validate required fields
    $required = ['Name', 'PayRate', 'Type'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "$field is required"]);
            return;
        }
    }
    
    // Validate pay rate
    if (!is_numeric($data['PayRate']) || $data['PayRate'] <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Pay rate must be a positive number']);
        return;
    }
    
    // Validate type
    if (!in_array($data['Type'], ['Hourly', 'Salary'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid employee type']);
        return;
    }
    
    $sql = "INSERT INTO employee (Name, PayRate, Type, user_id) VALUES (?, ?, ?, ?)";
    
    $employeeId = $db->insert($sql, [
        $data['Name'],
        $data['PayRate'],
        $data['Type'],
        $data['user_id'] ?? null
    ]);
    
    if ($employeeId) {
        // Log activity
        logActivity($_SESSION['user_id'], 'create', "Created employee: {$data['Name']}");
        
        echo json_encode([
            'success' => true,
            'message' => 'Employee created successfully',
            'id' => $employeeId
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create employee']);
    }
}

function updateEmployee($db, $id, $data) {
    // Check if employee exists
    $existing = $db->select("SELECT * FROM employee WHERE EmployeeID = ?", [$id]);
    if (empty($existing)) {
        http_response_code(404);
        echo json_encode(['error' => 'Employee not found']);
        return;
    }
    
    $updates = [];
    $params = [];
    
    $allowed = ['Name', 'PayRate', 'Type', 'user_id'];
    foreach ($allowed as $field) {
        if (isset($data[$field])) {
            // Validate
            if ($field == 'PayRate' && (!is_numeric($data[$field]) || $data[$field] <= 0)) {
                http_response_code(400);
                echo json_encode(['error' => 'Pay rate must be a positive number']);
                return;
            }
            
            if ($field == 'Type' && !in_array($data[$field], ['Hourly', 'Salary'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid employee type']);
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
    $sql = "UPDATE employee SET " . implode(', ', $updates) . " WHERE EmployeeID = ?";
    
    $affected = $db->update($sql, $params);
    
    if ($affected !== false) {
        // Log activity
        logActivity($_SESSION['user_id'], 'update', "Updated employee ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Employee updated successfully',
            'affected' => $affected
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update employee']);
    }
}

function deleteEmployee($db, $id) {
    // Check if employee has timesheets
    $timesheets = $db->select(
        "SELECT COUNT(*) as count FROM timesheet WHERE EmployeeID = ?",
        [$id]
    );
    
    if ($timesheets[0]['count'] > 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete employee with existing timesheets']);
        return;
    }
    
    $sql = "DELETE FROM employee WHERE EmployeeID = ?";
    $affected = $db->delete($sql, [$id]);
    
    if ($affected > 0) {
        // Log activity
        logActivity($_SESSION['user_id'], 'delete', "Deleted employee ID: $id");
        
        echo json_encode([
            'success' => true,
            'message' => 'Employee deleted successfully'
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Employee not found']);
    }
}

function bulkDeleteEmployees($db, $ids) {
    if (empty($ids) || !is_array($ids)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid employee IDs']);
        return;
    }
    
    // Check for timesheets
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $timesheets = $db->select(
        "SELECT EmployeeID, COUNT(*) as count FROM timesheet WHERE EmployeeID IN ($placeholders) GROUP BY EmployeeID",
        $ids
    );
    
    if (!empty($timesheets)) {
        $employeesWithTimesheets = array_column($timesheets, 'EmployeeID');
        http_response_code(400);
        echo json_encode([
            'error' => 'Cannot delete employees with existing timesheets',
            'employees' => $employeesWithTimesheets
        ]);
        return;
    }
    
    $sql = "DELETE FROM employee WHERE EmployeeID IN ($placeholders)";
    $affected = $db->delete($sql, $ids);
    
    // Log activity
    logActivity($_SESSION['user_id'], 'bulk_delete', "Deleted $affected employees");
    
    echo json_encode([
        'success' => true,
        'message' => "$affected employees deleted successfully",
        'count' => $affected
    ]);
}

function exportEmployees($db) {
    $format = $_GET['format'] ?? 'csv';
    $employees = $db->select("
        SELECT e.EmployeeID, e.Name, e.PayRate, e.Type, u.email 
        FROM employee e 
        LEFT JOIN users u ON e.user_id = u.user_id 
        ORDER BY e.Name
    ");
    
    if ($format == 'csv') {
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="employees.csv"');
        
        $output = fopen('php://output', 'w');
        
        // Add headers
        fputcsv($output, ['ID', 'Name', 'Pay Rate', 'Type', 'Email']);
        
        // Add data
        foreach ($employees as $emp) {
            fputcsv($output, [
                $emp['EmployeeID'],
                $emp['Name'],
                $emp['PayRate'],
                $emp['Type'],
                $emp['email'] ?? ''
            ]);
        }
        
        fclose($output);
    } else {
        echo json_encode($employees);
    }
}

// Helper function for logging
function logActivity($userId, $action, $details) {
    global $db;
    $sql = "INSERT INTO activity_log (user_id, action, details, ip_address, created_at) 
            VALUES (?, ?, ?, ?, NOW())";
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $db->insert($sql, [$userId, $action, $details, $ip]);
}
?>