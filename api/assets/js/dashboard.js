// assets/js/dashboard.js
let incomeExpenseChart = null;
let predictionChart = null;
let categoryChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
    await loadDashboardData();
    await loadRecentActivity();
    await loadMLInsights();
    await loadNotifications();
    
    // Set default date range
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput) {
        startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (endDateInput) {
        endDateInput.value = today.toISOString().split('T')[0];
    }
    
    // Setup event listeners
    const chartPeriod = document.getElementById('chartPeriod');
    if (chartPeriod) {
        chartPeriod.addEventListener('change', loadDashboardData);
    }
    
    const refreshBtn = document.querySelector('[onclick="refreshData()"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
});

// Load all dashboard data
async function loadDashboardData() {
    try {
        showLoading();
        
        const period = document.getElementById('chartPeriod')?.value || 12;
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - parseInt(period));
        
        // Fetch dashboard stats
        const stats = await api.getDashboardStats();
        updateKPICards(stats);
        
        // Fetch chart data
        const chartData = await api.getChartData(period);
        updateCharts(chartData);
        
        // Fetch recent transactions
        const transactions = await api.getTransactions({
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate,
            limit: 10
        });
        updateRecentTransactions(transactions);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load dashboard data: ' + error.message, 'error');
        console.error('Dashboard data error:', error);
    }
}

// Update KPI cards with stats
function updateKPICards(stats) {
    // Total Income
    const totalIncomeEl = document.getElementById('totalIncome');
    if (totalIncomeEl) {
        totalIncomeEl.textContent = formatCurrency(stats.total_income || 0);
    }
    
    const incomeTrendEl = document.getElementById('incomeTrend');
    if (incomeTrendEl) {
        const trend = stats.income_trend || 0;
        incomeTrendEl.textContent = formatPercentage(trend);
        incomeTrendEl.className = trend >= 0 ? 'positive' : 'negative';
    }
    
    // Total Expenses
    const totalExpensesEl = document.getElementById('totalExpenses');
    if (totalExpensesEl) {
        totalExpensesEl.textContent = formatCurrency(stats.total_expenses || 0);
    }
    
    const expenseTrendEl = document.getElementById('expenseTrend');
    if (expenseTrendEl) {
        const trend = stats.expense_trend || 0;
        expenseTrendEl.textContent = formatPercentage(trend);
        expenseTrendEl.className = trend <= 0 ? 'positive' : 'negative';
    }
    
    // Net Profit
    const netProfitEl = document.getElementById('netProfit');
    if (netProfitEl) {
        const netProfit = (stats.total_income || 0) - (stats.total_expenses || 0);
        netProfitEl.textContent = formatCurrency(netProfit);
    }
    
    const profitMarginEl = document.getElementById('profitMargin');
    if (profitMarginEl) {
        const margin = stats.total_income ? 
            ((stats.total_income - stats.total_expenses) / stats.total_income * 100) : 0;
        profitMarginEl.querySelector('span').textContent = `Margin: ${formatPercentage(margin)}`;
    }
    
    // Due Invoices
    const dueInvoicesEl = document.getElementById('dueInvoices');
    if (dueInvoicesEl) {
        dueInvoicesEl.textContent = stats.due_invoices_count || 0;
    }
    
    const dueAmountEl = document.getElementById('dueAmount');
    if (dueAmountEl) {
        dueAmountEl.textContent = formatCurrency(stats.due_invoices_amount || 0) + ' due';
    }
}

// Update charts with data
function updateCharts(data) {
    updateIncomeExpenseChart(data.income_expense);
    updatePredictionChart(data.predictions);
    updateCategoryChart(data.expense_categories);
}

// Update income vs expense chart
function updateIncomeExpenseChart(data) {
    const ctx = document.getElementById('incomeExpenseChart')?.getContext('2d');
    if (!ctx || !data) return;
    
    // Destroy existing chart
    if (incomeExpenseChart) {
        incomeExpenseChart.destroy();
    }
    
    // Prepare data
    const labels = data.map(item => item.month);
    const incomeData = data.map(item => item.income);
    const expenseData = data.map(item => item.expense);
    
    // Create chart
    incomeExpenseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update prediction chart
function updatePredictionChart(data) {
    const ctx = document.getElementById('predictionChart')?.getContext('2d');
    if (!ctx || !data) return;
    
    // Destroy existing chart
    if (predictionChart) {
        predictionChart.destroy();
    }
    
    // Prepare data
    const labels = data.map(item => item.month);
    const actualData = data.map(item => item.actual);
    const predictedData = data.map(item => item.predicted);
    
    // Create chart
    predictionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual',
                    data: actualData,
                    backgroundColor: '#4361ee',
                    borderRadius: 6
                },
                {
                    label: 'Predicted',
                    data: predictedData,
                    backgroundColor: '#f39c12',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update expense category chart
function updateCategoryChart(data) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx || !data) return;
    
    // Destroy existing chart
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    // Prepare data
    const labels = data.map(item => item.category);
    const values = data.map(item => item.amount);
    const colors = generateColors(data.length);
    
    // Create chart
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrency(context.raw);
                            const percentage = ((context.raw / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const activities = await api.getRecentActivity(10);
        updateRecentActivity(activities);
    } catch (error) {
        console.error('Failed to load recent activity:', error);
    }
}

// Update recent activity list
function updateRecentActivity(activities) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="recent-item">No recent activity</div>';
        return;
    }
    
    let html = '';
    activities.forEach(activity => {
        const icon = getActivityIcon(activity.type);
        const colorClass = getActivityColor(activity.type);
        
        html += `
            <div class="recent-item">
                <i class="fas ${icon} ${colorClass}"></i>
                <div class="recent-details">
                    <div class="recent-title">${escapeHtml(activity.description)}</div>
                    <div class="recent-meta">
                        <span class="recent-time">${formatDate(activity.created_at, 'time')}</span>
                        <span class="recent-amount ${activity.amount >= 0 ? 'positive' : 'negative'}">
                            ${formatCurrency(activity.amount)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load ML insights
async function loadMLInsights() {
    try {
        const insights = await api.getMLInsights();
        updateMLInsights(insights);
    } catch (error) {
        console.error('Failed to load ML insights:', error);
    }
}

// Update ML insights
function updateMLInsights(insights) {
    const container = document.getElementById('mlInsights');
    if (!container) return;
    
    if (!insights || insights.length === 0) {
        container.innerHTML = '<div class="insight-item">No insights available</div>';
        return;
    }
    
    let html = '';
    insights.forEach(insight => {
        const icon = getInsightIcon(insight.type);
        const colorClass = getInsightColor(insight.type);
        
        html += `
            <div class="insight-item ${colorClass}">
                <i class="fas ${icon}"></i>
                <div class="insight-content">
                    <div class="insight-title">${escapeHtml(insight.title)}</div>
                    <div class="insight-description">${escapeHtml(insight.description)}</div>
                    ${insight.value ? `<div class="insight-value">${formatCurrency(insight.value)}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load notifications
async function loadNotifications() {
    try {
        const notifications = await api.getNotifications();
        updateNotifications(notifications);
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

// Update notifications
function updateNotifications(notifications) {
    const container = document.getElementById('notifications');
    if (!container) return;
    
    const count = notifications?.length || 0;
    const badge = document.getElementById('notificationCount');
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Refresh dashboard data
async function refreshData() {
    await loadDashboardData();
    await loadRecentActivity();
    await loadMLInsights();
    showNotification('Dashboard data refreshed', 'success');
}

// Get icon for activity type
function getActivityIcon(type) {
    const icons = {
        'invoice_created': 'fa-file-invoice',
        'invoice_paid': 'fa-check-circle',
        'timesheet_submitted': 'fa-clock',
        'expense_added': 'fa-money-bill-wave',
        'job_created': 'fa-briefcase',
        'employee_added': 'fa-user-plus',
        'vendor_added': 'fa-truck',
        'payment_received': 'fa-hand-holding-usd',
        'default': 'fa-history'
    };
    return icons[type] || icons.default;
}

// Get color class for activity
function getActivityColor(type) {
    const colors = {
        'invoice_created': 'text-primary',
        'invoice_paid': 'text-success',
        'timesheet_submitted': 'text-info',
        'expense_added': 'text-danger',
        'job_created': 'text-warning',
        'employee_added': 'text-success',
        'vendor_added': 'text-info',
        'payment_received': 'text-success',
        'default': 'text-secondary'
    };
    return colors[type] || colors.default;
}

// Get icon for insight type
function getInsightIcon(type) {
    const icons = {
        'warning': 'fa-exclamation-triangle',
        'opportunity': 'fa-lightbulb',
        'trend': 'fa-chart-line',
        'prediction': 'fa-robot',
        'anomaly': 'fa-exclamation-circle',
        'default': 'fa-info-circle'
    };
    return icons[type] || icons.default;
}

// Get color class for insight
function getInsightColor(type) {
    const colors = {
        'warning': 'warning',
        'opportunity': 'success',
        'trend': 'info',
        'prediction': 'primary',
        'anomaly': 'danger',
        'default': 'secondary'
    };
    return colors[type] || colors.default;
}

// Generate colors for charts
function generateColors(count) {
    const colors = [
        '#4361ee', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6',
        '#3498db', '#1abc9c', '#e67e22', '#95a5a6', '#34495e'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}

// Format percentage
function formatPercentage(value) {
    return (value || 0).toFixed(1) + '%';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}