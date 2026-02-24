// assets/js/auth.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.querySelector('input[name="remember"]')?.checked || false;
    
    try {
        showLoading('loginForm');
        
        const result = await api.login(email, password);
        
        if (result.success) {
            // Store user data
            localStorage.setItem('user', JSON.stringify(result.user));
            if (remember) {
                localStorage.setItem('remember_email', email);
            }
            
            showAlert('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/accounting-app/pages/dashboard.html';
            }, 1500);
        }
    } catch (error) {
        hideLoading('loginForm');
        showAlert(error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const userData = {
        fullName: document.getElementById('reg-fullname').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        role: document.getElementById('reg-role').value
    };
    
    try {
        showLoading('registerForm');
        
        const result = await api.register(userData);
        
        if (result.success) {
            showAlert('Registration successful! Please login.', 'success');
            
            // Switch to login form after 2 seconds
            setTimeout(() => {
                showLogin();
            }, 2000);
        }
    } catch (error) {
        hideLoading('registerForm');
        showAlert(error.message, 'error');
    }
}

function showLoading(formId) {
    const form = document.getElementById(formId);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
}

function hideLoading(formId) {
    const form = document.getElementById(formId);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = false;
    button.innerHTML = formId === 'loginForm' ? 
        '<i class="fas fa-sign-in-alt"></i> Sign In' : 
        '<i class="fas fa-user-plus"></i> Sign Up';
}

function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    const form = document.querySelector('.auth-form');
    form.parentNode.insertBefore(alertDiv, form);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showLogin() {
    document.querySelector('.auth-card').style.display = 'block';
    document.getElementById('registerCard').style.display = 'none';
}

function showRegister() {
    document.querySelector('.auth-card').style.display = 'none';
    document.getElementById('registerCard').style.display = 'block';
}

// Check if user is logged in
async function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const currentPath = window.location.pathname;
    
    // Public pages that don't require auth
    const publicPages = ['/accounting-app/pages/login.html', '/accounting-app/index.html'];
    
    if (!token && !publicPages.includes(currentPath)) {
        window.location.href = '/accounting-app/pages/login.html';
        return false;
    }
    
    if (token && currentPath === '/accounting-app/pages/login.html') {
        window.location.href = '/accounting-app/pages/dashboard.html';
        return true;
    }
    
    return true;
}

// Logout function
async function logout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('user');
        window.location.href = '/accounting-app/pages/login.html';
    }
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}