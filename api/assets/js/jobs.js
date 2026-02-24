// assets/js/jobs.js
let currentJobId = null;
let jobsData = [];

// Initialize jobs page
document.addEventListener('DOMContentLoaded', async function() {
    await loadJobs();
    await loadCompanyOptions();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce(filterJobs, 300));
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterJobs);
    }
    
    // Company filter
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
        companyFilter.addEventListener('change', filterJobs);
    }
}

// Load jobs
async function loadJobs() {
    try {
        showLoading();
        
        const filters = {};
        const statusFilter = document.getElementById('statusFilter')?.value;
        const companyFilter = document.getElementById('companyFilter')?.value;
        
        if (statusFilter) filters.status = statusFilter;
        if (companyFilter) filters.company_id = companyFilter;
        
        jobsData = await api.getJobs(filters);
        renderJobsTable(jobsData);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load jobs: ' + error.message, 'error');
        console.error('Load jobs error:', error);
    }
}

// Load company options for dropdown
async function loadCompanyOptions() {
    try {
        const companies = await api.getCompanies();
        
        // Job form dropdown
        const jobSelect = document.getElementById('companyId');
        if (jobSelect) {
            let options = '<option value="">Select Company</option>';
            companies.forEach(company => {
                options += `<option value="${company.CompanyID}">${escapeHtml(company.Name)}</option>`;
            });
            jobSelect.innerHTML = options;
        }
        
        // Filter dropdown
        const filterSelect = document.getElementById('companyFilter');
        if (filterSelect) {
            let filterOptions = '<option value="">All Companies</option>';
            companies.forEach(company => {
                filterOptions += `<option value="${company.CompanyID}">${escapeHtml(company.Name)}</option>`;
            });
            filterSelect.innerHTML = filterOptions;
        }
    } catch (error) {
        console.error('Failed to load companies:', error);
    }
}

// Render jobs table
function renderJobsTable(jobs) {
    const tbody = document.getElementById('jobsTableBody');
    if (!tbody) return;
    
    if (!jobs || jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No jobs found</td></tr>';
        return;
    }
    
    let html = '';
    jobs.forEach(job => {
        const statusClass = getStatusClass(job.Status);
        const budgetStatus = getBudgetStatus(job.BudgetTotal, job.ActualCost);
        
        html += `
            <tr>
                <td>${job.JobID}</td>
                <td><strong>${escapeHtml(job.JobName || '')}</strong></td>
                <td>${escapeHtml(job.CompanyName || '')}</td>
                <td>${escapeHtml(job.Location || '—')}</td>
                <td>${formatDate(job.StartDate)}</td>
                <td>${formatDate(job.EndDate)}</td>
                <td>${formatCurrency(job.BudgetTotal || 0)}</td>
                <td><span class="badge badge-${statusClass}">${escapeHtml(job.Status || '')}</span></td>
                <td class="actions">
                    <button class="action-btn edit" onclick="openEditJobModal(${job.JobID})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn view" onclick="viewJob(${job.JobID})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn costs" onclick="viewJobCosts(${job.JobID})" title="View Costs">
                        <i class="fas fa-chart-pie"></i>
                    </button>
                    <button class="action-btn delete" onclick="openDeleteModal(${job.JobID})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Get status class for badge
function getStatusClass(status) {
    const classes = {
        'Active': 'success',
        'Completed': 'primary',
        'Retainage': 'warning'
    };
    return classes[status] || 'secondary';
}

// Get budget status
function getBudgetStatus(budget, actual) {
    if (!budget || !actual) return 'normal';
    const percentage = (actual / budget) * 100;
    if (percentage > 100) return 'over';
    if (percentage > 90) return 'warning';
    return 'normal';
}

// Filter jobs
function filterJobs() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const companyFilter = document.getElementById('companyFilter')?.value || '';
    
    const filtered = jobsData.filter(job => {
        const matchesSearch = !searchTerm || 
            (job.JobName && job.JobName.toLowerCase().includes(searchTerm)) ||
            (job.CompanyName && job.CompanyName.toLowerCase().includes(searchTerm)) ||
            (job.Location && job.Location.toLowerCase().includes(searchTerm));
        
        const matchesStatus = !statusFilter || job.Status === statusFilter;
        const matchesCompany = !companyFilter || job.CompanyID == companyFilter;
        
        return matchesSearch && matchesStatus && matchesCompany;
    });
    
    renderJobsTable(filtered);
}

// Open add job modal
function openAddJobModal() {
    currentJobId = null;
    
    document.getElementById('modalTitle').textContent = 'Add Job';
    document.getElementById('jobId').value = '';
    document.getElementById('jobName').value = '';
    document.getElementById('companyId').value = '';
    document.getElementById('location').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('budgetTotal').value = '';
    document.getElementById('status').value = 'Active';
    
    openModal('jobModal');
}

// Open edit job modal
async function openEditJobModal(id) {
    try {
        showLoading();
        
        const job = await api.getJob(id);
        
        currentJobId = id;
        document.getElementById('modalTitle').textContent = 'Edit Job';
        document.getElementById('jobId').value = job.JobID;
        document.getElementById('jobName').value = job.JobName || '';
        document.getElementById('companyId').value = job.CompanyID || '';
        document.getElementById('location').value = job.Location || '';
        document.getElementById('startDate').value = job.StartDate || '';
        document.getElementById('endDate').value = job.EndDate || '';
        document.getElementById('budgetTotal').value = job.BudgetTotal || '';
        document.getElementById('status').value = job.Status || 'Active';
        
        hideLoading();
        openModal('jobModal');
    } catch (error) {
        hideLoading();
        showNotification('Failed to load job details: ' + error.message, 'error');
    }
}

// View job details
async function viewJob(id) {
    try {
        showLoading();
        
        const job = await api.getJob(id);
        const costs = await api.getJobCosts(id);
        
        // Create modal content
        const content = `
            <div class="job-details">
                <div class="detail-row">
                    <label>Job Name:</label>
                    <span><strong>${escapeHtml(job.JobName)}</strong></span>
                </div>
                <div class="detail-row">
                    <label>Company:</label>
                    <span>${escapeHtml(job.CompanyName)}</span>
                </div>
                <div class="detail-row">
                    <label>Location:</label>
                    <span>${escapeHtml(job.Location || '—')}</span>
                </div>
                <div class="detail-row">
                    <label>Date Range:</label>
                    <span>${formatDate(job.StartDate)} - ${formatDate(job.EndDate)}</span>
                </div>
                <div class="detail-row">
                    <label>Budget:</label>
                    <span>${formatCurrency(job.BudgetTotal || 0)}</span>
                </div>
                <div class="detail-row">
                    <label>Actual Cost:</label>
                    <span>${formatCurrency(costs.actual || 0)}</span>
                </div>
                <div class="detail-row">
                    <label>Variance:</label>
                    <span class="${(job.BudgetTotal - costs.actual) >= 0 ? 'positive' : 'negative'}">
                        ${formatCurrency(job.BudgetTotal - costs.actual)}
                    </span>
                </div>
                <div class="detail-row">
                    <label>Status:</label>
                    <span><span class="badge badge-${getStatusClass(job.Status)}">${job.Status}</span></span>
                </div>
                
                <h3 style="margin-top: 20px;">Cost Breakdown</h3>
                <div class="cost-breakdown">
                    <div class="cost-item">
                        <span>Labor:</span>
                        <span>${formatCurrency(costs.labor || 0)}</span>
                    </div>
                    <div class="cost-item">
                        <span>Materials:</span>
                        <span>${formatCurrency(costs.materials || 0)}</span>
                    </div>
                    <div class="cost-item">
                        <span>Equipment:</span>
                        <span>${formatCurrency(costs.equipment || 0)}</span>
                    </div>
                    <div class="cost-item">
                        <span>Subcontractors:</span>
                        <span>${formatCurrency(costs.subcontractors || 0)}</span>
                    </div>
                    <div class="cost-item total">
                        <span>Total:</span>
                        <span>${formatCurrency(costs.actual || 0)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Job Details</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn-primary" onclick="openEditJobModal(${id}); this.closest('.modal').remove()">Edit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load job details: ' + error.message, 'error');
    }
}

// View job costs
async function viewJobCosts(id) {
    try {
        showLoading();
        
        const costs = await api.getJobCosts(id);
        const profitability = await api.getJobProfitability(id);
        
        // Create modal content
        const content = `
            <div class="job-costs">
                <h3>Cost Analysis</h3>
                <div class="cost-summary">
                    <div class="summary-item">
                        <label>Budget:</label>
                        <span>${formatCurrency(profitability.budget || 0)}</span>
                    </div>
                    <div class="summary-item">
                        <label>Actual Cost:</label>
                        <span>${formatCurrency(profitability.actual_cost || 0)}</span>
                    </div>
                    <div class="summary-item">
                        <label>Revenue:</label>
                        <span>${formatCurrency(profitability.revenue || 0)}</span>
                    </div>
                    <div class="summary-item">
                        <label>Profit:</label>
                        <span class="${profitability.profit >= 0 ? 'positive' : 'negative'}">
                            ${formatCurrency(profitability.profit || 0)}
                        </span>
                    </div>
                    <div class="summary-item">
                        <label>Margin:</label>
                        <span class="${profitability.margin >= 0 ? 'positive' : 'negative'}">
                            ${(profitability.margin || 0).toFixed(1)}%
                        </span>
                    </div>
                </div>
                
                <h3>Cost Breakdown</h3>
                <div class="cost-breakdown-detailed">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Labor</td>
                                <td>${formatCurrency(costs.labor || 0)}</td>
                                <td>${calculatePercentage(costs.labor, costs.actual)}%</td>
                            </tr>
                            <tr>
                                <td>Materials</td>
                                <td>${formatCurrency(costs.materials || 0)}</td>
                                <td>${calculatePercentage(costs.materials, costs.actual)}%</td>
                            </tr>
                            <tr>
                                <td>Equipment</td>
                                <td>${formatCurrency(costs.equipment || 0)}</td>
                                <td>${calculatePercentage(costs.equipment, costs.actual)}%</td>
                            </tr>
                            <tr>
                                <td>Subcontractors</td>
                                <td>${formatCurrency(costs.subcontractors || 0)}</td>
                                <td>${calculatePercentage(costs.subcontractors, costs.actual)}%</td>
                            </tr>
                            <tr>
                                <td>Other</td>
                                <td>${formatCurrency(costs.other || 0)}</td>
                                <td>${calculatePercentage(costs.other, costs.actual)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <h3>Timesheet Summary</h3>
                <div class="timesheet-summary">
                    <div class="summary-item">
                        <label>Total Hours:</label>
                        <span>${costs.total_hours || 0}</span>
                    </div>
                    <div class="summary-item">
                        <label>Regular Hours:</label>
                        <span>${costs.regular_hours || 0}</span>
                    </div>
                    <div class="summary-item">
                        <label>Overtime Hours:</label>
                        <span>${costs.overtime_hours || 0}</span>
                    </div>
                    <div class="summary-item">
                        <label>Average Rate:</label>
                        <span>${formatCurrency(costs.average_rate || 0)}/hr</span>
                    </div>
                </div>
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Job Cost Analysis</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn-primary" onclick="exportJobCosts(${id})">Export Report</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load job costs: ' + error.message, 'error');
    }
}

// Calculate percentage
function calculatePercentage(value, total) {
    if (!total) return '0';
    return ((value / total) * 100).toFixed(1);
}

// Export job costs
async function exportJobCosts(id) {
    try {
        showLoading();
        
        const costs = await api.getJobCosts(id);
        const data = [{
            'Job ID': id,
            'Labor': costs.labor || 0,
            'Materials': costs.materials || 0,
            'Equipment': costs.equipment || 0,
            'Subcontractors': costs.subcontractors || 0,
            'Other': costs.other || 0,
            'Total': costs.actual || 0,
            'Total Hours': costs.total_hours || 0,
            'Regular Hours': costs.regular_hours || 0,
            'Overtime Hours': costs.overtime_hours || 0
        }];
        
        exportToCSV(data, `job_${id}_costs.csv`);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to export job costs: ' + error.message, 'error');
    }
}

// Save job
async function saveJob(event) {
    event.preventDefault();
    
    const formData = {
        JobName: document.getElementById('jobName').value.trim(),
        CompanyID: document.getElementById('companyId').value,
        Location: document.getElementById('location').value.trim(),
        StartDate: document.getElementById('startDate').value,
        EndDate: document.getElementById('endDate').value,
        BudgetTotal: parseFloat(document.getElementById('budgetTotal').value) || 0,
        Status: document.getElementById('status').value
    };
    
    // Validate
    if (!formData.JobName) {
        showNotification('Job name is required', 'error');
        return;
    }
    
    if (!formData.CompanyID) {
        showNotification('Please select a company', 'error');
        return;
    }
    
    if (formData.StartDate && formData.EndDate) {
        if (new Date(formData.StartDate) > new Date(formData.EndDate)) {
            showNotification('End date must be after start date', 'error');
            return;
        }
    }
    
    try {
        showLoading();
        
        if (currentJobId) {
            await api.updateJob(currentJobId, formData);
            showNotification('Job updated successfully', 'success');
        } else {
            await api.createJob(formData);
            showNotification('Job created successfully', 'success');
        }
        
        closeModal(document.getElementById('jobModal'));
        await loadJobs();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to save job: ' + error.message, 'error');
    }
}

// Open delete confirmation modal
function openDeleteModal(id) {
    currentJobId = id;
    openModal('deleteModal');
}

// Confirm delete
async function confirmDelete() {
    if (!currentJobId) return;
    
    try {
        showLoading();
        
        await api.deleteJob(currentJobId);
        showNotification('Job deleted successfully', 'success');
        
        closeDeleteModal();
        await loadJobs();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to delete job: ' + error.message, 'error');
    }
}

// Close delete modal
function closeDeleteModal() {
    closeModal(document.getElementById('deleteModal'));
    currentJobId = null;
}

// Update job status
async function updateJobStatus(id, status) {
    try {
        await api.updateJobStatus(id, status);
        showNotification(`Job status updated to ${status}`, 'success');
        await loadJobs();
    } catch (error) {
        showNotification('Failed to update job status: ' + error.message, 'error');
    }
}