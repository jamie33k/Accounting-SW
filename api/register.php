<?php
// api/register.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once 'database.php';

$db = new Database();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

$fullName = $data['fullName'] ?? '';
$email = $data['email'] ?? '';
$phone = $data['phone'] ?? '';
$password = $data['password'] ?? '';

// Validate input
if (empty($fullName) || empty($email) || empty($phone) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit();
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit();
}

// Check if email already exists
$checkEmail = $db->select("SELECT * FROM users WHERE email = ?", [$email]);
if (!empty($checkEmail)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email already registered']);
    exit();
}

// Hash password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Insert user into database
$sql = "INSERT INTO users (email, password_hash, full_name, phone, role, created_at) 
        VALUES (?, ?, ?, ?, 'employee', NOW())";

$userId = $db->insert($sql, [$email, $hashedPassword, $fullName, $phone]);

if ($userId) {
    echo json_encode([
        'success' => true,
        'message' => 'Registration successful',
        'user_id' => $userId
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration failed']);
}
?>