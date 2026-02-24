<?php
// includes/header.php
// Start session if not started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Check if user is logged in for protected pages
$public_pages = ['login.php', 'register.php'];
$current_page = basename($_SERVER['PHP_SELF']);

if (!in_array($current_page, $public_pages) && !isset($_SESSION['user_id'])) {
    header('Location: /accounting-app/pages/login.php');
    exit();
}

// Get user info
$user_name = $_SESSION['user_name'] ?? 'User';
$user_role = $_SESSION['user_role'] ?? 'employee';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $page_title ?? 'AccuFlow - Accounting Software'; ?></title>
    
    <!-- CSS Files -->
    <link rel="stylesheet" href="/accounting-app/assets/css/style.css">
    <link rel="stylesheet" href="/accounting-app/assets/css/dashboard.css">
    
    <!-- Fonts and Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    
    <!-- Meta Tags -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="AccuFlow - Smart Accounting with AI Predictions">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/accounting-app/assets/images/favicon.ico">
    
    <style>
        /* New Logo Styles */
        .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 24px;
            font-weight: 700;
            cursor: pointer;
        }
        
        .logo-icon {
            font-size: 28px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 8px;
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            transition: all 0.3s ease;
        }
        
        .logo-text {
            color: #333;
        }
        
        .logo-highlight {
            color: #667eea;
            font-weight: 800;
            position: relative;
        }
        
        .logo-highlight::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 2px;
        }
        
        .logo:hover .logo-icon {
            transform: scale(1.05);
            box-shadow: 0 6px 15px rgba(102, 126, 234, 0.4);
        }
        
        .logo:hover .logo-highlight {
            color: #764ba2;
            transition: color 0.3s ease;
        }
    </style>
</head>
<body>
    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay" style="display: none;">
        <div class="spinner"></div>
    </div>
    
    <!-- Notification Container -->
    <div id="notificationContainer" class="notification-container"></div>