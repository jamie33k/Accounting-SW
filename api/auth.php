<?php
// api/auth.php
require_once 'database.php';

$db = new Database();
$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (isset($data['action'])) {
            switch($data['action']) {
                case 'login':
                    login($db, $data);
                    break;
                case 'register':
                    register($db, $data);
                    break;
                case 'logout':
                    logout();
                    break;
                default:
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid action']);
            }
        }
        break;
        
    case 'GET':
        if (isset($_GET['action']) && $_GET['action'] == 'verify') {
            verifyToken();
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function login($db, $data) {
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password required']);
        return;
    }
    
    $result = $db->select(
        "SELECT * FROM users WHERE email = ?",
        [$email]
    );
    
    if (empty($result)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }
    
    $user = $result[0];
    
    if (password_verify($password, $user['password_hash'])) {
        // Update last login
        $db->update(
            "UPDATE users SET last_login = NOW() WHERE user_id = ?",
            [$user['user_id']]
        );
        
        // Create session
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role'] = $user['role'];
        
        // Generate simple token (in production, use JWT)
        $token = bin2hex(random_bytes(32));
        
        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'user' => [
                'id' => $user['user_id'],
                'email' => $user['email'],
                'fullName' => $user['full_name'],
                'role' => $user['role']
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
    }
}

function register($db, $data) {
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';
    $fullName = $data['fullName'] ?? '';
    $role = $data['role'] ?? 'employee';
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password required']);
        return;
    }
    
    // Check if user exists
    $existing = $db->select(
        "SELECT * FROM users WHERE email = ?",
        [$email]
    );
    
    if (!empty($existing)) {
        http_response_code(400);
        echo json_encode(['error' => 'User already exists']);
        return;
    }
    
    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // Create user
    $userId = $db->insert(
        "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
        [$email, $hashedPassword, $fullName, $role]
    );
    
    if ($userId) {
        echo json_encode([
            'success' => true,
            'message' => 'User created successfully',
            'user' => [
                'id' => $userId,
                'email' => $email,
                'fullName' => $fullName,
                'role' => $role
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create user']);
    }
}

function logout() {
    $_SESSION = array();
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Logged out']);
}

function verifyToken() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Check session
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'valid' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'email' => $_SESSION['email'],
                'role' => $_SESSION['role']
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['valid' => false]);
    }
}
?>