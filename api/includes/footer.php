<?php
// includes/footer.php
?>
    <!-- JavaScript Files -->
    <script src="/accounting-app/assets/js/api.js"></script>
    <script src="/accounting-app/assets/js/auth.js"></script>
    <script src="/accounting-app/assets/js/main.js"></script>
    
    <!-- Page Specific JavaScript -->
    <?php if (isset($page_script)): ?>
        <script src="/accounting-app/assets/js/<?php echo $page_script; ?>"></script>
    <?php endif; ?>
    
    <!-- Chart.js if needed -->
    <?php if (isset($include_charts) && $include_charts): ?>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <?php endif; ?>
    
    <script>
        // Global notification function
        function showNotification(message, type = 'info') {
            const container = document.getElementById('notificationContainer');
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                    type === 'error' ? 'exclamation-circle' : 
                                    type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            `;
            
            container.appendChild(notification);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 5000);
        }
        
        // Show/Hide loading overlay
        function showLoading() {
            document.getElementById('loadingOverlay').style.display = 'flex';
        }
        
        function hideLoading() {
            document.getElementById('loadingOverlay').style.display = 'none';
        }
        
        // Format currency
        function formatCurrency(amount) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(amount);
        }
        
        // Format date
        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    </script>
</body>
</html>