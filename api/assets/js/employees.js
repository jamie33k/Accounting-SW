// assets/js/employees.js
let currentEmployeeId = null;
let employeesData = [];

// Initialize employees page
document.addEventListener('DOMContentLoaded', async function() {
    await loadEmployees();
    await loadUserOptions();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce(filterEmployees, 300));
    }
    
    // Type filter
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', filterEmployees);
    }
    
    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportEmployees);
    }
    
    // Bulk actions
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', toggleSelectAll);
    }
    
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', bulkDelete);
    }
}

// Load employees
async function loadEmployees() {
    try {
        showLoading();
        
        const filters = {};
        const typeFilter = document.getElementById('typeFilter')?.value;
        if (typeFilter) {
            filters.type = typeFilter;
        }
        
        employeesData = await api.getEmployees(filters);
        renderEmployeesTable(employeesData);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load employees: ' + error.message, 'error');
        console.error('Load employees error:', error);
    }
}

// Load user options for dropdown
async function loadUserOptions() {
    try {
        const users = await api.getUsers();
        const select = document.getElementById('userId');
        if (!select) return;
        
        let options = '<option value="">Select User (Optional)</option>';
        users.forEach(user => {
            options += `<option value="${user.user_id}">${escapeHtml(user.email)}</option>`;
        });
        
        select.innerHTML = options;
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Render employees table
function renderEmployeesTable(employees) {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    
    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No employees found</td></tr>';
        return;
    }
    
    let html = '';
    employees.forEach(employee => {
        const status = employee.user_id ? 'active' : 'inactive';
        
        html += `
            <tr>
                <td>
                    <input type="checkbox" class="row-select" value="${employee.EmployeeID}">
                </td>
                <td>${escapeHtml(employee.Name || '')}</td>
                <td>${formatCurrency(employee.PayRate || 0)}</td>
                <td><span class="badge badge-${employee.Type === 'Hourly' ? 'info' : 'primary'}">${escapeHtml(employee.Type || '')}</span></td>
                <td>${escapeHtml(employee.email || '—')}</td>
                <td><span class="badge badge-${status === 'active' ? 'success' : 'secondary'}">${status}</span></td>
                <td class="actions">
                    <button class="action-btn edit" onclick="openEditEmployeeModal(${employee.EmployeeID})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn view" onclick="viewEmployee(${employee.EmployeeID})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn delete" onclick="openDeleteModal(${employee.EmployeeID})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Update select all state
    updateSelectAllState();
}

// Filter employees
function filterEmployees() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    
    const filtered = employeesData.filter(emp => {
        const matchesSearch = !searchTerm || 
            (emp.Name && emp.Name.toLowerCase().includes(searchTerm)) ||
            (emp.email && emp.email.toLowerCase().includes(searchTerm));
        
        const matchesType = !typeFilter || emp.Type === typeFilter;
        
        return matchesSearch && matchesType;
    });
    
    renderEmployeesTable(filtered);
}

// Open add employee modal
function openAddEmployeeModal() {
    currentEmployeeId = null;
    
    document.getElementById('modalTitle').textContent = 'Add Employee';
    document.getElementById('employeeId').value = '';
    document.getElementById('name').value = '';
    document.getElementById('payRate').value = '';
    document.getElementById('type').value = 'Hourly';
    document.getElementById('userId').value = '';
    
    openModal('employeeModal');
}

// Open edit employee modal
async function openEditEmployeeModal(id) {
    try {
        showLoading();
        
        const employee = await api.getEmployee(id);
        
        currentEmployeeId = id;
        document.getElementById('modalTitle').textContent = 'Edit Employee';
        document.getElementById('employeeId').value = employee.EmployeeID;
        document.getElementById('name').value = employee.Name || '';
        document.getElementById('payRate').value = employee.PayRate || '';
        document.getElementById('type').value = employee.Type || 'Hourly';
        document.getElementById('userId').value = employee.user_id || '';
        
        hideLoading();
        openModal('employeeModal');
    } catch (error) {
        hideLoading();
        showNotification('Failed to load employee details: ' + error.message, 'error');
    }
}

// View employee details
async function viewEmployee(id) {
    try {
        showLoading();
        
        const employee = await api.getEmployee(id);
        
        // Create modal content
        const content = `
            <div class="employee-details">
                <div class="detail-row">
                    <label>Name:</label>
                    <span>${escapeHtml(employee.Name)}</span>
                </div>
                <div class="detail-row">
                    <label>Pay Rate:</label>
                    <span>${formatCurrency(employee.PayRate)}</span>
                </div>
                <div class="detail-row">
                    <label>Type:</label>
                    <span><span class="badge badge-${employee.Type === 'Hourly' ? 'info' : 'primary'}">${employee.Type}</span></span>
                </div>
                <div class="detail-row">
                    <label>Email:</label>
                    <span>${escapeHtml(employee.email || '—')}</span>
                </div>
                <div class="detail-row">
                    <label>Status:</label>
                    <span><span class="badge badge-${employee.user_id ? 'success' : 'secondary'}">${employee.user_id ? 'Active' : 'Inactive'}</span></span>
                </div>
                <div class="detail-row">
                    <label>Timesheets:</label>
                    <span>${employee.timesheet_count || 0}</span>
                </div>
                <div class="detail-row">
                    <label>Total Hours:</label>
                    <span>${employee.total_hours || 0}</span>
                </div>
                <div class="detail-row">
                    <label>Total Pay:</label>
                    <span>${formatCurrency(employee.total_pay || 0)}</span>
                </div>
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>Employee Details</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn-primary" onclick="openEditEmployeeModal(${id}); this.closest('.modal').remove()">Edit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load employee details: ' + error.message, 'error');
    }
}

// Save employee
async function saveEmployee(event) {
    event.preventDefault();
    
    const formData = {
        Name: document.getElementById('name').value.trim(),
        PayRate: parseFloat(document.getElementById('payRate').value) || 0,
        Type: document.getElementById('type').value,
        user_id: document.getElementById('userId').value || null
    };
    
    // Validate
    if (!formData.Name) {
        showNotification('Name is required', 'error');
        return;
    }
    
    if (formData.PayRate <= 0) {
        showNotification('Pay rate must be greater than 0', 'error');
        return;
    }
    
    try {
        showLoading();
        
        if (currentEmployeeId) {
            await api.updateEmployee(currentEmployeeId, formData);
            showNotification('Employee updated successfully', 'success');
        } else {
            await api.createEmployee(formData);
            showNotification('Employee created successfully', 'success');
        }
        
        closeModal(document.getElementById('employeeModal'));
        await loadEmployees();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to save employee: ' + error.message, 'error');
    }
}

// Open delete confirmation modal
function openDeleteModal(id) {
    currentEmployeeId = id;
    openModal('deleteModal');
}

// Confirm delete
async function confirmDelete() {
    if (!currentEmployeeId) return;
    
    try {
        showLoading();
        
        await api.deleteEmployee(currentEmployeeId);
        showNotification('Employee deleted successfully', 'success');
        
        closeDeleteModal();
        await loadEmployees();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to delete employee: ' + error.message, 'error');
    }
}

// Close delete modal
function closeDeleteModal() {
    closeModal(document.getElementById('deleteModal'));
    currentEmployeeId = null;
}

// Close modal
function closeModal(modal) {
    if (modal) {
        modal.classList.remove('show');
    }
}

// Toggle select all checkboxes
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-select');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
}

// Update select all state
function updateSelectAllState() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-select');
    
    if (selectAll) {
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAll.checked = allChecked;
    }
}

// Bulk delete
async function bulkDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.row-select:checked'))
        .map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showNotification('Please select employees to delete', 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} employees?`)) {
        return;
    }
    
    try {
        showLoading();
        
        await api.bulkDeleteEmployees(selectedIds);
        showNotification(`${selectedIds.length} employees deleted successfully`, 'success');
        
        await loadEmployees();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to delete employees: ' + error.message, 'error');
    }
}

// Export employees
async function exportEmployees() {
    try {
        showLoading();
        
        const format = document.getElementById('exportFormat')?.value || 'csv';
        const data = await api.exportEmployees(format);
        
        if (format === 'csv') {
            exportToCSV(data, 'employees.csv');
        } else {
            // Handle other formats
            window.location.href = `/accounting-app/api/endpoints/employees.php?export=1&format=${format}`;
        }
        
        hideLoading();
        showNotification('Employees exported successfully', 'success');
    } catch (error) {
        hideLoading();
        showNotification('Failed to export employees: ' + error.message, 'error');
    }
}