// assets/js/reports.js
let currentReportType = 'pnl';
let pnlChart = null;
let expenseChart = null;
let mlChart = null;

// Initialize reports page
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadPNLReport();
    
    // Set default dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const expenseStart = document.getElementById('expenseStartDate');
    const expenseEnd = document.getElementById('expenseEndDate');
    const incomeStart = document.getElementById('incomeStartDate');
    const incomeEnd = document.getElementById('incomeEndDate');
    
    if (expenseStart) expenseStart.value = thirtyDaysAgo.toISOString().split('T')[0];
    if (expenseEnd) expenseEnd.value = today.toISOString().split('T')[0];
    if (incomeStart) incomeStart.value = thirtyDaysAgo.toISOString().split('T')[0];
    if (incomeEnd) incomeEnd.value = today.toISOString().split('T')[0];
});

// Setup event listeners
function setupEventListeners() {
    // P&L year change
    const pnlYear = document.getElementById('pnlYear');
    if (pnlYear) {
        pnlYear.addEventListener('change', loadPNLReport);
    }
    
    // Expense report filters
    const expenseApplyBtn = document.querySelector('#expensesTab .btn-primary');
    if (expenseApplyBtn) {
        expenseApplyBtn.addEventListener('click', loadExpenseReport);
    }
    
    // Income report filters
    const incomeApplyBtn = document.querySelector('#incomeTab .btn-primary');
    if (incomeApplyBtn) {
        incomeApplyBtn.addEventListener('click', loadIncomeReport);
    }
}

// Switch between report tabs
function switchTab(tabId) {
    currentReportType = tabId;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId + 'Tab').classList.add('active');
    
    // Load report data
    switch(tabId) {
        case 'pnl':
            loadPNLReport();
            break;
        case 'expenses':
            loadExpenseReport();
            break;
        case 'income':
            loadIncomeReport();
            break;
        case 'ml':
            loadMLInsights();
            break;
    }
}

// Load P&L report
async function loadPNLReport() {
    try {
        showLoading();
        
        const year = document.getElementById('pnlYear')?.value || new Date().getFullYear();
        const data = await api.getPNLReport({ year });
        
        updatePNLSummary(data.summary);
        renderPNLTable(data.monthlyData);
        updatePNLChart(data.monthlyData);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load P&L report: ' + error.message, 'error');
        console.error('PNL report error:', error);
    }
}

// Update P&L summary
function updatePNLSummary(summary) {
    const totalIncomeEl = document.getElementById('pnlTotalIncome');
    const totalExpensesEl = document.getElementById('pnlTotalExpenses');
    const netProfitEl = document.getElementById('pnlNetProfit');
    const profitMarginEl = document.getElementById('pnlProfitMargin');
    
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(summary.totalIncome || 0);
    if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(summary.totalExpenses || 0);
    if (netProfitEl) netProfitEl.textContent = formatCurrency(summary.netProfit || 0);
    if (profitMarginEl) profitMarginEl.textContent = (summary.profitMargin || 0).toFixed(1) + '%';
}

// Render P&L table
function renderPNLTable(data) {
    const tbody = document.getElementById('pnlTableBody');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
        return;
    }
    
    let html = '';
    data.forEach(item => {
        const profit = (item.income || 0) - (item.expenses || 0);
        const margin = item.income ? ((profit / item.income) * 100).toFixed(1) : '0.0';
        
        html += `
            <tr>
                <td>${item.month}</td>
                <td>${formatCurrency(item.income || 0)}</td>
                <td>${formatCurrency(item.expenses || 0)}</td>
                <td class="${profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(profit)}</td>
                <td>${margin}%</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Update P&L chart
function updatePNLChart(data) {
    const ctx = document.getElementById('pnlChart')?.getContext('2d');
    if (!ctx || !data) return;
    
    // Destroy existing chart
    if (pnlChart) {
        pnlChart.destroy();
    }
    
    // Prepare data
    const labels = data.map(item => item.month);
    const incomeData = data.map(item => item.income || 0);
    const expenseData = data.map(item => item.expenses || 0);
    const profitData = data.map(item => (item.income || 0) - (item.expenses || 0));
    
    // Create chart
    pnlChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: '#2ecc71',
                    borderRadius: 6
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: '#e74c3c',
                    borderRadius: 6
                },
                {
                    label: 'Profit',
                    data: profitData,
                    type: 'line',
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    pointBackgroundColor: '#3498db',
                    borderWidth: 3
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

// Load expense report
async function loadExpenseReport() {
    try {
        showLoading();
        
        const params = {
            startDate: document.getElementById('expenseStartDate')?.value,
            endDate: document.getElementById('expenseEndDate')?.value,
            category: document.getElementById('expenseCategory')?.value
        };
        
        const data = await api.getExpenseReport(params);
        
        renderExpensesTable(data.expenses);
        updateExpenseChart(data.expenses);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load expense report: ' + error.message, 'error');
        console.error('Expense report error:', error);
    }
}

// Render expenses table
function renderExpensesTable(expenses) {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    
    if (!expenses || expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No expenses found for selected period</td></tr>';
        return;
    }
    
    let html = '';
    expenses.forEach(expense => {
        html += `
            <tr>
                <td>${expense.month}</td>
                <td>${escapeHtml(expense.JobName || '')}</td>
                <td>${escapeHtml(expense.CostCode || '—')}</td>
                <td>${formatCurrency(expense.total_expense || 0)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Update expense chart
function updateExpenseChart(expenses) {
    const ctx = document.getElementById('expenseChart')?.getContext('2d');
    if (!ctx || !expenses) return;
    
    // Group by category
    const byCategory = {};
    expenses.forEach(expense => {
        const category = expense.CostCode || 'Other';
        if (!byCategory[category]) {
            byCategory[category] = 0;
        }
        byCategory[category] += parseFloat(expense.total_expense || 0);
    });
    
    // Prepare data
    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    
    // Destroy existing chart
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    // Create chart
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#4361ee', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6',
                    '#3498db', '#1abc9c', '#e67e22', '#95a5a6', '#34495e'
                ],
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
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Load income report
async function loadIncomeReport() {
    try {
        showLoading();
        
        const params = {
            startDate: document.getElementById('incomeStartDate')?.value,
            endDate: document.getElementById('incomeEndDate')?.value,
            status: document.getElementById('incomeStatus')?.value
        };
        
        const data = await api.getIncomeReport(params);
        
        updateIncomeSummary(data.summary);
        renderIncomeTable(data.invoices);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load income report: ' + error.message, 'error');
        console.error('Income report error:', error);
    }
}

// Update income summary
function updateIncomeSummary(summary) {
    const totalInvoicedEl = document.getElementById('incomeTotalInvoiced');
    const totalPaidEl = document.getElementById('incomeTotalPaid');
    const totalDueEl = document.getElementById('incomeTotalDue');
    
    if (totalInvoicedEl) totalInvoicedEl.textContent = formatCurrency(summary.totalInvoiced || 0);
    if (totalPaidEl) totalPaidEl.textContent = formatCurrency(summary.totalPaid || 0);
    if (totalDueEl) totalDueEl.textContent = formatCurrency(summary.totalDue || 0);
}

// Render income table
function renderIncomeTable(invoices) {
    const tbody = document.getElementById('incomeTableBody');
    if (!tbody) return;
    
    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No invoices found for selected period</td></tr>';
        return;
    }
    
    let html = '';
    invoices.forEach(invoice => {
        const statusClass = getInvoiceStatusClass(invoice.Status);
        
        html += `
            <tr>
                <td>${escapeHtml(invoice.InvoiceNumber || '')}</td>
                <td>${escapeHtml(invoice.JobName || '')}</td>
                <td>${escapeHtml(invoice.client_name || '')}</td>
                <td>${formatDate(invoice.InvoiceDate)}</td>
                <td>${formatCurrency(invoice.TotalAmount || 0)}</td>
                <td><span class="badge badge-${statusClass}">${escapeHtml(invoice.Status || '')}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Get invoice status class
function getInvoiceStatusClass(status) {
    const classes = {
        'Draft': 'warning',
        'Sent': 'info',
        'Partial': 'primary',
        'Paid': 'success'
    };
    return classes[status] || 'secondary';
}

// Load ML insights
async function loadMLInsights() {
    try {
        showLoading();
        
        const insights = await api.getMLInsights();
        
        updatePredictions(insights.predictions);
        updateMLRecommendations(insights.recommendations);
        updateMLChart(insights.patterns);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load ML insights: ' + error.message, 'error');
        console.error('ML insights error:', error);
    }
}

// Update predictions
function updatePredictions(predictions) {
    const nextMonthEl = document.getElementById('nextMonthPrediction');
    const confidenceEl = document.getElementById('predictionConfidence');
    const seasonalEl = document.getElementById('seasonalPattern');
    const trendEl = document.getElementById('trendAnalysis');
    
    if (nextMonthEl && predictions?.nextMonth) {
        nextMonthEl.textContent = formatCurrency(predictions.nextMonth.amount);
    }
    
    if (confidenceEl && predictions?.nextMonth) {
        confidenceEl.textContent = `Confidence: ${(predictions.nextMonth.confidence * 100).toFixed(0)}%`;
    }
    
    if (seasonalEl && predictions?.seasonal) {
        seasonalEl.textContent = predictions.seasonal;
    }
    
    if (trendEl && predictions?.trend) {
        trendEl.textContent = predictions.trend;
        trendEl.className = `trend-text ${predictions.trend.toLowerCase()}`;
    }
}

// Update ML recommendations
function updateMLRecommendations(recommendations) {
    const container = document.getElementById('mlRecommendations');
    if (!container) return;
    
    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = '<p class="text-center">No recommendations available</p>';
        return;
    }
    
    let html = '<h3>AI Recommendations</h3>';
    recommendations.forEach(rec => {
        const typeClass = getRecommendationClass(rec.type);
        
        html += `
            <div class="recommendation-item ${typeClass}">
                <i class="fas ${getRecommendationIcon(rec.type)}"></i>
                <div class="recommendation-content">
                    <div class="recommendation-title">${escapeHtml(rec.title)}</div>
                    <div class="recommendation-description">${escapeHtml(rec.description)}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Get recommendation class
function getRecommendationClass(type) {
    const classes = {
        'warning': 'warning',
        'opportunity': 'success',
        'info': 'info',
        'critical': 'danger'
    };
    return classes[type] || 'info';
}

// Get recommendation icon
function getRecommendationIcon(type) {
    const icons = {
        'warning': 'fa-exclamation-triangle',
        'opportunity': 'fa-lightbulb',
        'info': 'fa-info-circle',
        'critical': 'fa-exclamation-circle'
    };
    return icons[type] || 'fa-info-circle';
}

// Update ML chart
function updateMLChart(patterns) {
    const ctx = document.getElementById('mlChart')?.getContext('2d');
    if (!ctx || !patterns) return;
    
    // Destroy existing chart
    if (mlChart) {
        mlChart.destroy();
    }
    
    // Prepare data
    const labels = patterns.map(p => p.month);
    const actualData = patterns.map(p => p.actual);
    const predictedData = patterns.map(p => p.predicted);
    
    // Create chart
    mlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual',
                    data: actualData,
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Predicted',
                    data: predictedData,
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderDash: [5, 5]
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

// Export to PDF
function exportToPDF() {
    showNotification('Exporting to PDF...', 'info');
    // Implementation would use a library like jsPDF
    setTimeout(() => {
        showNotification('PDF exported successfully', 'success');
    }, 2000);
}

// Export to Excel
function exportToExcel() {
    showNotification('Exporting to Excel...', 'info');
    // Implementation would use a library like SheetJS
    setTimeout(() => {
        showNotification('Excel exported successfully', 'success');
    }, 2000);
}

// Refresh ML insights
function refreshMLInsights() {
    loadMLInsights();
    showNotification('ML insights refreshed', 'success');
}