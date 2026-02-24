// assets/js/timesheets.js
let currentTimesheetId = null;
let timesheetsData = [];

// Initialize timesheets page
document.addEventListener('DOMContentLoaded', async function() {
    await loadTimesheets();
    await loadEmployeeOptions();
    await loadJobOptions();
    setupEventListeners();
    
    // Set default week ending to this Friday
    const weekEnding = getWeekEndingDate();
    const weekEndingInput = document.getElementById('weekEnding');
    if (weekEndingInput) {
        weekEndingInput.value = weekEnding;
    }
});

// Get week ending date (Friday of current week)
function getWeekEndingDate() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const friday = new Date(today);
    friday.setDate(today.getDate() + daysUntilFriday);
    return friday.toISOString().split('T')[0];
}

// Setup event listeners
function setupEventListeners() {
    // Date filters
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate) {
        startDate.addEventListener('change', filterTimesheets);
    }
    if (endDate) {
        endDate.addEventListener('change', filterTimesheets);
    }
    
    // Employee filter
    const employeeFilter = document.getElementById('employeeFilter');
    if (employeeFilter) {
        employeeFilter.addEventListener('change', filterTimesheets);
    }
    
    // Job filter
    const jobFilter = document.getElementById('jobFilter');
    if (jobFilter) {
        jobFilter.addEventListener('change', filterTimesheets);
    }
    
    // Hours calculation
    const hoursWorked = document.getElementById('hoursWorked');
    const overtimeHours = document.getElementById('overtimeHours');
    
    if (hoursWorked) {
        hoursWorked.addEventListener('input', calculateOvertime);
    }
}

// Calculate overtime based on hours worked
function calculateOvertime() {
    const hoursWorked = parseFloat(document.getElementById('hoursWorked')?.value) || 0;
    const overtimeInput = document.getElementById('overtimeHours');
    
    if (overtimeInput) {
        if (hoursWorked > 40) {
            overtimeInput.value = (hoursWorked - 40).toFixed(1);
        } else {
            overtimeInput.value = '0';
        }
    }
}

// Load timesheets
async function loadTimesheets() {
    try {
        showLoading();
        
        const filters = {};
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const employeeId = document.getElementById('employeeFilter')?.value;
        const jobId = document.getElementById('jobFilter')?.value;
        
        if (startDate) filters.start_date = startDate;
        if (endDate) filters.end_date = endDate;
        if (employeeId) filters.employee_id = employeeId;
        if (jobId) filters.job_id = jobId;
        
        timesheetsData = await api.getTimesheets(filters);
        renderTimesheetsTable(timesheetsData);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load timesheets: ' + error.message, 'error');
        console.error('Load timesheets error:', error);
    }
}

// Load employee options for dropdowns
async function loadEmployeeOptions() {
    try {
        const employees = await api.getEmployees();
        
        // Form dropdown
        const employeeSelect = document.getElementById('employeeId');
        if (employeeSelect) {
            let options = '<option value="">Select Employee</option>';
            employees.forEach(emp => {
                options += `<option value="${emp.EmployeeID}">${escapeHtml(emp.Name)}</option>`;
            });
            employeeSelect.innerHTML = options;
        }
        
        // Filter dropdown
        const filterSelect = document.getElementById('employeeFilter');
        if (filterSelect) {
            let options = '<option value="">All Employees</option>';
            employees.forEach(emp => {
                options += `<option value="${emp.EmployeeID}">${escapeHtml(emp.Name)}</option>`;
            });
            filterSelect.innerHTML = options;
        }
    } catch (error) {
        console.error('Failed to load employees:', error);
    }
}

// Load job options for dropdowns
async function loadJobOptions() {
    try {
        const jobs = await api.getJobs({ status: 'Active' });
        
        // Form dropdown
        const jobSelect = document.getElementById('jobId');
        if (jobSelect) {
            let options = '<option value="">Select Job</option>';
            jobs.forEach(job => {
                options += `<option value="${job.JobID}">${escapeHtml(job.JobName)}</option>`;
            });
            jobSelect.innerHTML = options;
        }
        
        // Filter dropdown
        const filterSelect = document.getElementById('jobFilter');
        if (filterSelect) {
            let options = '<option value="">All Jobs</option>';
            jobs.forEach(job => {
                options += `<option value="${job.JobID}">${escapeHtml(job.JobName)}</option>`;
            });
            filterSelect.innerHTML = options;
        }
    } catch (error) {
        console.error('Failed to load jobs:', error);
    }
}

// Render timesheets table
function renderTimesheetsTable(timesheets) {
    const tbody = document.getElementById('timesheetsTableBody');
    if (!tbody) return;
    
    if (!timesheets || timesheets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No timesheets found</td></tr>';
        return;
    }
    
    let html = '';
    timesheets.forEach(ts => {
        const totalPay = calculateTotalPay(ts);
        const statusClass = getStatusClass(ts.status);
        
        html += `
            <tr>
                <td>${ts.TimesheetID}</td>
                <td><strong>${escapeHtml(ts.EmployeeName || '')}</strong></td>
                <td>${escapeHtml(ts.JobName || '')}</td>
                <td>${formatDate(ts.WeekEnding)}</td>
                <td>${ts.HoursWorked || 0}</td>
                <td>${ts.OvertimeHours || 0}</td>
                <td>${formatCurrency(totalPay)}</td>
                <td><span class="badge badge-${statusClass}">${escapeHtml(ts.status || 'Pending')}</span></td>
                <td class="actions">
                    <button class="action-btn edit" onclick="openEditTimesheetModal(${ts.TimesheetID})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn view" onclick="viewTimesheet(${ts.TimesheetID})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${ts.status === 'Pending' ? `
                        <button class="action-btn approve" onclick="approveTimesheet(${ts.TimesheetID})" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn reject" onclick="rejectTimesheet(${ts.TimesheetID})" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" onclick="openDeleteModal(${ts.TimesheetID})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Calculate total pay for timesheet
function calculateTotalPay(timesheet) {
    if (!timesheet) return 0;
    
    const regularHours = timesheet.HoursWorked || 0;
    const overtimeHours = timesheet.OvertimeHours || 0;
    const payRate = timesheet.PayRate || 0;
    
    // Overtime is typically 1.5x regular rate
    const regularPay = regularHours * payRate;
    const overtimePay = overtimeHours * payRate * 1.5;
    
    return regularPay + overtimePay;
}

// Get status class for badge
function getStatusClass(status) {
    const classes = {
        'Approved': 'success',
        'Pending': 'warning',
        'Rejected': 'danger',
        'Paid': 'primary'
    };
    return classes[status] || 'secondary';
}

// Filter timesheets
function filterTimesheets() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const employeeId = document.getElementById('employeeFilter')?.value;
    const jobId = document.getElementById('jobFilter')?.value;
    
    const filtered = timesheetsData.filter(ts => {
        let matches = true;
        
        if (startDate && ts.WeekEnding < startDate) matches = false;
        if (endDate && ts.WeekEnding > endDate) matches = false;
        if (employeeId && ts.EmployeeID != employeeId) matches = false;
        if (jobId && ts.JobID != jobId) matches = false;
        
        return matches;
    });
    
    renderTimesheetsTable(filtered);
}

// Open add timesheet modal
function openAddTimesheetModal() {
    currentTimesheetId = null;
    
    document.getElementById('modalTitle').textContent = 'Add Timesheet';
    document.getElementById('timesheetId').value = '';
    document.getElementById('employeeId').value = '';
    document.getElementById('jobId').value = '';
    document.getElementById('weekEnding').value = getWeekEndingDate();
    document.getElementById('hoursWorked').value = '';
    document.getElementById('overtimeHours').value = '0';
    
    openModal('timesheetModal');
}

// Open edit timesheet modal
async function openEditTimesheetModal(id) {
    try {
        showLoading();
        
        const timesheet = await api.getTimesheet(id);
        
        currentTimesheetId = id;
        document.getElementById('modalTitle').textContent = 'Edit Timesheet';
        document.getElementById('timesheetId').value = timesheet.TimesheetID;
        document.getElementById('employeeId').value = timesheet.EmployeeID || '';
        document.getElementById('jobId').value = timesheet.JobID || '';
        document.getElementById('weekEnding').value = timesheet.WeekEnding || '';
        document.getElementById('hoursWorked').value = timesheet.HoursWorked || '';
        document.getElementById('overtimeHours').value = timesheet.OvertimeHours || '0';
        
        hideLoading();
        openModal('timesheetModal');
    } catch (error) {
        hideLoading();
        showNotification('Failed to load timesheet details: ' + error.message, 'error');
    }
}

// View timesheet details
async function viewTimesheet(id) {
    try {
        showLoading();
        
        const timesheet = await api.getTimesheet(id);
        
        // Create modal content
        const content = `
            <div class="timesheet-details">
                <div class="detail-row">
                    <label>Employee:</label>
                    <span><strong>${escapeHtml(timesheet.EmployeeName)}</strong></span>
                </div>
                <div class="detail-row">
                    <label>Job:</label>
                    <span>${escapeHtml(timesheet.JobName)}</span>
                </div>
                <div class="detail-row">
                    <label>Week Ending:</label>
                    <span>${formatDate(timesheet.WeekEnding)}</span>
                </div>
                <div class="detail-row">
                    <label>Hours Worked:</label>
                    <span>${timesheet.HoursWorked || 0}</span>
                </div>
                <div class="detail-row">
                    <label>Overtime Hours:</label>
                    <span>${timesheet.OvertimeHours || 0}</span>
                </div>
                <div class="detail-row">
                    <label>Pay Rate:</label>
                    <span>${formatCurrency(timesheet.PayRate || 0)}/hr</span>
                </div>
                <div class="detail-row">
                    <label>Total Pay:</label>
                    <span><strong>${formatCurrency(calculateTotalPay(timesheet))}</strong></span>
                </div>
                <div class="detail-row">
                    <label>Status:</label>
                    <span><span class="badge badge-${getStatusClass(timesheet.status)}">${timesheet.status || 'Pending'}</span></span>
                </div>
                ${timesheet.approved_by ? `
                <div class="detail-row">
                    <label>Approved By:</label>
                    <span>${escapeHtml(timesheet.approved_by)} on ${formatDate(timesheet.approved_date)}</span>
                </div>
                ` : ''}
                ${timesheet.rejection_reason ? `
                <div class="detail-row">
                    <label>Rejection Reason:</label>
                    <span class="text-danger">${escapeHtml(timesheet.rejection_reason)}</span>
                </div>
                ` : ''}
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>Timesheet Details</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    ${timesheet.status === 'Pending' ? `
                        <button class="btn-success" onclick="approveTimesheet(${id}); this.closest('.modal').remove()">Approve</button>
                        <button class="btn-danger" onclick="rejectTimesheet(${id}); this.closest('.modal').remove()">Reject</button>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load timesheet details: ' + error.message, 'error');
    }
}

// Save timesheet
async function saveTimesheet(event) {
    event.preventDefault();
    
    const formData = {
        EmployeeID: document.getElementById('employeeId').value,
        JobID: document.getElementById('jobId').value,
        WeekEnding: document.getElementById('weekEnding').value,
        HoursWorked: parseFloat(document.getElementById('hoursWorked').value) || 0,
        OvertimeHours: parseFloat(document.getElementById('overtimeHours').value) || 0
    };
    
    // Validate
    if (!formData.EmployeeID) {
        showNotification('Please select an employee', 'error');
        return;
    }
    
    if (!formData.JobID) {
        showNotification('Please select a job', 'error');
        return;
    }
    
    if (!formData.WeekEnding) {
        showNotification('Please select week ending date', 'error');
        return;
    }
    
    if (formData.HoursWorked <= 0) {
        showNotification('Hours worked must be greater than 0', 'error');
        return;
    }
    
    if (formData.HoursWorked > 168) { // Max hours in a week
        showNotification('Hours worked cannot exceed 168 hours per week', 'error');
        return;
    }
    
    // Auto-calculate overtime if not set
    if (formData.HoursWorked > 40 && formData.OvertimeHours === 0) {
        formData.OvertimeHours = formData.HoursWorked - 40;
    }
    
    try {
        showLoading();
        
        if (currentTimesheetId) {
            await api.updateTimesheet(currentTimesheetId, formData);
            showNotification('Timesheet updated successfully', 'success');
        } else {
            await api.createTimesheet(formData);
            showNotification('Timesheet created successfully', 'success');
        }
        
        closeModal(document.getElementById('timesheetModal'));
        await loadTimesheets();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to save timesheet: ' + error.message, 'error');
    }
}

// Approve timesheet
async function approveTimesheet(id) {
    try {
        showLoading();
        
        await api.approveTimesheet(id);
        showNotification('Timesheet approved successfully', 'success');
        
        await loadTimesheets();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to approve timesheet: ' + error.message, 'error');
    }
}

// Reject timesheet
async function rejectTimesheet(id) {
    const reason = prompt('Please enter reason for rejection:');
    if (!reason) return;
    
    try {
        showLoading();
        
        await api.rejectTimesheet(id, reason);
        showNotification('Timesheet rejected', 'success');
        
        await loadTimesheets();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to reject timesheet: ' + error.message, 'error');
    }
}

// Open delete confirmation modal
function openDeleteModal(id) {
    currentTimesheetId = id;
    openModal('deleteModal');
}

// Confirm delete
async function confirmDelete() {
    if (!currentTimesheetId) return;
    
    try {
        showLoading();
        
        await api.deleteTimesheet(currentTimesheetId);
        showNotification('Timesheet deleted successfully', 'success');
        
        closeDeleteModal();
        await loadTimesheets();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to delete timesheet: ' + error.message, 'error');
    }
}

// Close delete modal
function closeDeleteModal() {
    closeModal(document.getElementById('deleteModal'));
    currentTimesheetId = null;
}

// Export timesheets
async function exportTimesheets() {
    try {
        showLoading();
        
        const data = timesheetsData.map(ts => ({
            'Employee': ts.EmployeeName,
            'Job': ts.JobName,
            'Week Ending': ts.WeekEnding,
            'Hours Worked': ts.HoursWorked,
            'Overtime Hours': ts.OvertimeHours,
            'Total Pay': calculateTotalPay(ts),
            'Status': ts.status || 'Pending'
        }));
        
        exportToCSV(data, 'timesheets.csv');
        
        hideLoading();
        showNotification('Timesheets exported successfully', 'success');
    } catch (error) {
        hideLoading();
        showNotification('Failed to export timesheets: ' + error.message, 'error');
    }
}

// Get timesheet summary
async function loadTimesheetSummary() {
    try {
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        
        if (startDate && endDate) {
            const summary = await api.getTimesheetSummary(startDate, endDate);
            displayTimesheetSummary(summary);
        }
    } catch (error) {
        console.error('Failed to load timesheet summary:', error);
    }
}

// Display timesheet summary
function displayTimesheetSummary(summary) {
    const summaryEl = document.getElementById('timesheetSummary');
    if (!summaryEl) return;
    
    summaryEl.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card">
                <h4>Total Hours</h4>
                <p class="summary-value">${summary.total_hours || 0}</p>
            </div>
            <div class="summary-card">
                <h4>Regular Hours</h4>
                <p class="summary-value">${summary.regular_hours || 0}</p>
            </div>
            <div class="summary-card">
                <h4>Overtime Hours</h4>
                <p class="summary-value">${summary.overtime_hours || 0}</p>
            </div>
            <div class="summary-card">
                <h4>Total Payroll</h4>
                <p class="summary-value">${formatCurrency(summary.total_pay || 0)}</p>
            </div>
        </div>
    `;
}