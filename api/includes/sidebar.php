<?php
// includes/sidebar.php
// Get current page for active state
$current_page = basename($_SERVER['PHP_SELF']);
?>
<aside class="sidebar">
    <div class="logo">
        <i class="fas fa-calculator"></i>
        <span>AccuFlow</span>
    </div>
    
    <nav class="nav-menu">
        <a href="/accounting-app/pages/dashboard.php" 
           class="nav-item <?php echo $current_page == 'dashboard.php' ? 'active' : ''; ?>">
            <i class="fas fa-home"></i>
            <span>Dashboard</span>
        </a>
        
        <a href="/accounting-app/pages/employees.php" 
           class="nav-item <?php echo $current_page == 'employees.php' ? 'active' : ''; ?>">
            <i class="fas fa-users"></i>
            <span>Employees</span>
        </a>
        
        <a href="/accounting-app/pages/timesheets.php" 
           class="nav-item <?php echo $current_page == 'timesheets.php' ? 'active' : ''; ?>">
            <i class="fas fa-clock"></i>
            <span>Timesheets</span>
        </a>
        
        <a href="/accounting-app/pages/jobs.php" 
           class="nav-item <?php echo $current_page == 'jobs.php' ? 'active' : ''; ?>">
            <i class="fas fa-briefcase"></i>
            <span>Jobs</span>
        </a>
        
        <a href="/accounting-app/pages/invoices.php" 
           class="nav-item <?php echo $current_page == 'invoices.php' ? 'active' : ''; ?>">
            <i class="fas fa-file-invoice"></i>
            <span>Invoices</span>
        </a>
        
        <a href="/accounting-app/pages/vendors.php" 
           class="nav-item <?php echo $current_page == 'vendors.php' ? 'active' : ''; ?>">
            <i class="fas fa-truck"></i>
            <span>Vendors</span>
        </a>
        
        <a href="/accounting-app/pages/reports.php" 
           class="nav-item <?php echo $current_page == 'reports.php' ? 'active' : ''; ?>">
            <i class="fas fa-chart-bar"></i>
            <span>Reports</span>
        </a>
        
        <?php if ($_SESSION['user_role'] == 'admin'): ?>
        <div class="nav-divider"></div>
        
        <a href="/accounting-app/pages/admin/users.php" 
           class="nav-item <?php echo $current_page == 'users.php' ? 'active' : ''; ?>">
            <i class="fas fa-user-cog"></i>
            <span>User Management</span>
        </a>
        
        <a href="/accounting-app/pages/admin/settings.php" 
           class="nav-item <?php echo $current_page == 'settings.php' ? 'active' : ''; ?>">
            <i class="fas fa-cog"></i>
            <span>Settings</span>
        </a>
        <?php endif; ?>
    </nav>
    
    <div class="sidebar-footer">
        <div class="user-info">
            <i class="fas fa-user-circle"></i>
            <div class="user-details">
                <span class="user-name"><?php echo htmlspecialchars($_SESSION['user_name'] ?? 'User'); ?></span>
                <span class="user-role"><?php echo ucfirst($_SESSION['user_role'] ?? 'employee'); ?></span>
            </div>
        </div>
        <button class="logout-btn" onclick="logout()" title="Logout">
            <i class="fas fa-sign-out-alt"></i>
        </button>
    </div>
</aside>

<!-- Mobile Menu Toggle -->
<button class="mobile-menu-toggle" onclick="toggleMobileMenu()">
    <i class="fas fa-bars"></i>
</button>

<script>
function toggleMobileMenu() {
    document.querySelector('.sidebar').classList.toggle('show');
}
</script>