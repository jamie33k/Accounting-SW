// assets/js/main.js

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    initializeTooltips();
    initializeModals();
    initializeDropdowns();
    initializeTabs();
    initializeCharts();
    loadUserPreferences();
});

// Initialize application
function initializeApp() {
    console.log('AccuFlow Accounting System initialized');
    
    // Set current year in footer
    const yearElements = document.querySelectorAll('.current-year');
    yearElements.forEach(el => {
        el.textContent = new Date().getFullYear();
    });
    
    // Check for URL parameters
    checkUrlParams();
    
    // Load saved theme preference
    loadTheme();
}

// Setup global event listeners
function setupEventListeners() {
    // Mobile menu toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Window resize handler
    window.addEventListener('resize', debounce(handleResize, 250));
    
    // Escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Click outside dropdown to close
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
}

// Initialize tooltips
function initializeTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

// Initialize modals
function initializeModals() {
    const modalTriggers = document.querySelectorAll('[data-modal]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            const modalId = this.dataset.modal;
            openModal(modalId);
        });
    });
    
    // Close modal buttons
    const closeButtons = document.querySelectorAll('[data-close-modal]');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });
}

// Initialize dropdowns
function initializeDropdowns() {
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = this.closest('.dropdown');
            toggleDropdown(dropdown);
        });
    });
}

// Initialize tabs
function initializeTabs() {
    const tabContainers = document.querySelectorAll('.tabs');
    tabContainers.forEach(container => {
        const tabs = container.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.dataset.tab;
                switchTab(container, tabId);
            });
        });
    });
}

// Initialize charts (placeholder - actual charts initialized in page-specific JS)
function initializeCharts() {
    // Charts are initialized in individual page scripts
}

// Load user preferences from localStorage
function loadUserPreferences() {
    // Load sidebar state
    const sidebarCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (sidebarCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    }
    
    // Load font size preference
    const fontSize = localStorage.getItem('font_size') || 'normal';
    document.body.classList.add(`font-${fontSize}`);
}

// Toggle mobile menu
function toggleMobileMenu() {
    document.body.classList.toggle('mobile-menu-open');
}

// Toggle sidebar
function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.body.dataset.theme || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Set theme
function setTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    
    // Update theme toggle icon
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
}

// Load theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Focus trap
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length) {
        focusableElements[0].focus();
    }
    
    // Trigger event
    modal.dispatchEvent(new CustomEvent('modalopen'));
}

// Close modal
function closeModal(modal) {
    if (!modal) return;
    
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Trigger event
    modal.dispatchEvent(new CustomEvent('modalclose'));
}

// Close all modals
function closeAllModals() {
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => closeModal(modal));
}

// Toggle dropdown
function toggleDropdown(dropdown) {
    if (!dropdown) return;
    
    const isOpen = dropdown.classList.contains('show');
    closeAllDropdowns();
    
    if (!isOpen) {
        dropdown.classList.add('show');
        
        // Position dropdown
        const menu = dropdown.querySelector('.dropdown-menu');
        if (menu) {
            const rect = dropdown.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            
            if (spaceBelow < menu.offsetHeight) {
                menu.style.top = 'auto';
                menu.style.bottom = '100%';
            } else {
                menu.style.top = '100%';
                menu.style.bottom = 'auto';
            }
        }
    }
}

// Close all dropdowns
function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown.show');
    dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
}

// Switch tab
function switchTab(container, tabId) {
    // Update tab buttons
    const tabs = container.querySelectorAll('.tab');
    tabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update tab content
    const contents = container.querySelectorAll('.tab-content');
    contents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // Trigger event
    container.dispatchEvent(new CustomEvent('tabchange', { detail: { tabId } }));
}

// Show tooltip
function showTooltip(e) {
    const element = e.target;
    const text = element.dataset.tooltip;
    
    if (!text) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
    
    element.tooltip = tooltip;
}

// Hide tooltip
function hideTooltip(e) {
    const element = e.target;
    if (element.tooltip) {
        element.tooltip.remove();
        delete element.tooltip;
    }
}

// Handle window resize
function handleResize() {
    // Close mobile menu on resize above breakpoint
    if (window.innerWidth > 768) {
        document.body.classList.remove('mobile-menu-open');
    }
    
    // Reposition any open dropdowns
    const openDropdowns = document.querySelectorAll('.dropdown.show');
    openDropdowns.forEach(dropdown => {
        const menu = dropdown.querySelector('.dropdown-menu');
        if (menu) {
            const rect = dropdown.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            
            if (spaceBelow < menu.offsetHeight) {
                menu.style.top = 'auto';
                menu.style.bottom = '100%';
            } else {
                menu.style.top = '100%';
                menu.style.bottom = 'auto';
            }
        }
    });
}

// Check URL parameters
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Show notification from URL parameter
    const message = urlParams.get('message');
    const type = urlParams.get('type') || 'info';
    
    if (message) {
        showNotification(decodeURIComponent(message), type);
    }
    
    // Handle specific actions
    const action = urlParams.get('action');
    if (action === 'print') {
        const id = urlParams.get('id');
        if (id) {
            setTimeout(() => printElement(id), 500);
        }
    }
}

// Show notification (re-export from auth.js)
function showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    }
}

// Export utility functions
window.utils = {
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    formatNumber: formatNumber,
    debounce: debounce,
    exportToCSV: exportToCSV,
    printElement: printElement,
    openModal: openModal,
    closeModal: closeModal,
    showNotification: showNotification,
    toggleSidebar: toggleSidebar,
    setTheme: setTheme
};

// Add CSS for tooltips if not present
const style = document.createElement('style');
style.textContent = `
    .tooltip {
        position: fixed;
        background: var(--gray-900);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        pointer-events: none;
        animation: fadeIn 0.2s ease;
    }
    
    .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: var(--gray-900) transparent transparent transparent;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    body.modal-open {
        overflow: hidden;
    }
    
    .sidebar-collapsed .sidebar {
        width: var(--sidebar-collapsed-width);
    }
    
    .sidebar-collapsed .sidebar .logo span,
    .sidebar-collapsed .sidebar .nav-item span,
    .sidebar-collapsed .sidebar .user-details {
        display: none;
    }
    
    .sidebar-collapsed .main-content {
        margin-left: var(--sidebar-collapsed-width);
    }
    
    @media (max-width: 768px) {
        .sidebar-collapsed .sidebar {
            width: var(--sidebar-width);
        }
        
        .sidebar-collapsed .sidebar .logo span,
        .sidebar-collapsed .sidebar .nav-item span,
        .sidebar-collapsed .sidebar .user-details {
            display: block;
        }
    }
`;
document.head.appendChild(style);