<?php
// api/login.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

session_start();
require_once 'database.php';

$db = new Database();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

$email = $data['email'] ?? '';
$password = $data['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and password required']);
    exit();
}

// Get user from database
$users = $db->select("SELECT * FROM users WHERE email = ?", [$email]);

if (empty($users)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
    exit();
}

$user = $users[0];

// Verify password
if (password_verify($password, $user['password_hash'])) {
    // Update last login
    $db->update("UPDATE users SET last_login = NOW() WHERE user_id = ?", [$user['user_id']]);
    
    // Set session
    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['role'] = $user['role'];
    
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['user_id'],
            'email' => $user['email'],
            'fullName' => $user['full_name'],
            'role' => $user['role']
        ]
    ]);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
}
?>