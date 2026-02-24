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
</head>
<body>
    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay" style="display: none;">
        <div class="spinner"></div>
    </div>
    
    <!-- Notification Container -->
    <div id="notificationContainer" class="notification-container"></div>