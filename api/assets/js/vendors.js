// assets/js/vendors.js
let currentVendorId = null;
let vendorsData = [];

// Initialize vendors page
document.addEventListener('DOMContentLoaded', async function() {
    await loadVendors();
    await checkInsuranceExpiry();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce(filterVendors, 300));
    }
    
    // Subcontractor filter
    const subFilter = document.getElementById('subcontractorFilter');
    if (subFilter) {
        subFilter.addEventListener('change', filterVendors);
    }
}

// Load vendors
async function loadVendors() {
    try {
        showLoading();
        
        const filters = {};
        const subFilter = document.getElementById('subcontractorFilter')?.value;
        
        if (subFilter !== '') {
            filters.is_subcontractor = subFilter === '1';
        }
        
        vendorsData = await api.getVendors(filters);
        renderVendorsTable(vendorsData);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load vendors: ' + error.message, 'error');
        console.error('Load vendors error:', error);
    }
}

// Check insurance expiry
async function checkInsuranceExpiry() {
    try {
        const expiring = await api.checkInsuranceExpiry();
        const alertEl = document.getElementById('insuranceAlert');
        
        if (alertEl && expiring && expiring.length > 0) {
            alertEl.style.display = 'flex';
            alertEl.querySelector('span').textContent = 
                `${expiring.length} vendor(s) have insurance expiring within 30 days`;
        }
    } catch (error) {
        console.error('Failed to check insurance expiry:', error);
    }
}

// Render vendors table
function renderVendorsTable(vendors) {
    const tbody = document.getElementById('vendorsTableBody');
    if (!tbody) return;
    
    if (!vendors || vendors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No vendors found</td></tr>';
        return;
    }
    
    let html = '';
    vendors.forEach(vendor => {
        const insuranceStatus = getInsuranceStatus(vendor.InsuranceExpiry);
        const statusClass = insuranceStatus.status;
        
        html += `
            <tr>
                <td>${vendor.VendorID}</td>
                <td><strong>${escapeHtml(vendor.Name || '')}</strong></td>
                <td>${escapeHtml(vendor.TaxID || '—')}</td>
                <td>
                    <span class="badge badge-${vendor.IsSubcontractor ? 'primary' : 'secondary'}">
                        ${vendor.IsSubcontractor ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>
                    ${vendor.InsuranceExpiry ? formatDate(vendor.InsuranceExpiry) : '—'}
                    ${vendor.InsuranceExpiry ? `<br><small class="text-${statusClass}">${insuranceStatus.message}</small>` : ''}
                </td>
                <td>
                    <span class="badge badge-${statusClass}">${insuranceStatus.status}</span>
                </td>
                <td class="actions">
                    <button class="action-btn edit" onclick="openEditVendorModal(${vendor.VendorID})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn view" onclick="viewVendor(${vendor.VendorID})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn transactions" onclick="viewVendorTransactions(${vendor.VendorID})" title="Transactions">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="action-btn delete" onclick="openDeleteModal(${vendor.VendorID})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Get insurance status
function getInsuranceStatus(expiryDate) {
    if (!expiryDate) {
        return { status: 'secondary', message: 'No insurance on file' };
    }
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
        return { status: 'danger', message: 'Expired' };
    } else if (daysUntilExpiry <= 30) {
        return { status: 'warning', message: `Expires in ${daysUntilExpiry} days` };
    } else if (daysUntilExpiry <= 90) {
        return { status: 'info', message: `Expires in ${daysUntilExpiry} days` };
    } else {
        return { status: 'success', message: 'Valid' };
    }
}

// Filter vendors
function filterVendors() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const subFilter = document.getElementById('subcontractorFilter')?.value || '';
    
    const filtered = vendorsData.filter(vendor => {
        const matchesSearch = !searchTerm || 
            (vendor.Name && vendor.Name.toLowerCase().includes(searchTerm)) ||
            (vendor.TaxID && vendor.TaxID.toLowerCase().includes(searchTerm));
        
        const matchesSub = subFilter === '' || 
            (subFilter === '1' && vendor.IsSubcontractor) ||
            (subFilter === '0' && !vendor.IsSubcontractor);
        
        return matchesSearch && matchesSub;
    });
    
    renderVendorsTable(filtered);
}

// Open add vendor modal
function openAddVendorModal() {
    currentVendorId = null;
    
    document.getElementById('modalTitle').textContent = 'Add Vendor';
    document.getElementById('vendorId').value = '';
    document.getElementById('name').value = '';
    document.getElementById('taxId').value = '';
    document.getElementById('isSubcontractor').checked = false;
    document.getElementById('insuranceExpiry').value = '';
    
    openModal('vendorModal');
}

// Open edit vendor modal
async function openEditVendorModal(id) {
    try {
        showLoading();
        
        const vendor = await api.getVendor(id);
        
        currentVendorId = id;
        document.getElementById('modalTitle').textContent = 'Edit Vendor';
        document.getElementById('vendorId').value = vendor.VendorID;
        document.getElementById('name').value = vendor.Name || '';
        document.getElementById('taxId').value = vendor.TaxID || '';
        document.getElementById('isSubcontractor').checked = vendor.IsSubcontractor == 1;
        document.getElementById('insuranceExpiry').value = vendor.InsuranceExpiry || '';
        
        hideLoading();
        openModal('vendorModal');
    } catch (error) {
        hideLoading();
        showNotification('Failed to load vendor details: ' + error.message, 'error');
    }
}

// View vendor details
async function viewVendor(id) {
    try {
        showLoading();
        
        const vendor = await api.getVendor(id);
        
        // Create modal content
        const content = `
            <div class="vendor-details">
                <div class="detail-row">
                    <label>Name:</label>
                    <span><strong>${escapeHtml(vendor.Name)}</strong></span>
                </div>
                <div class="detail-row">
                    <label>Tax ID:</label>
                    <span>${escapeHtml(vendor.TaxID || '—')}</span>
                </div>
                <div class="detail-row">
                    <label>Subcontractor:</label>
                    <span><span class="badge badge-${vendor.IsSubcontractor ? 'primary' : 'secondary'}">
                        ${vendor.IsSubcontractor ? 'Yes' : 'No'}
                    </span></span>
                </div>
                <div class="detail-row">
                    <label>Insurance Expiry:</label>
                    <span>
                        ${vendor.InsuranceExpiry ? formatDate(vendor.InsuranceExpiry) : '—'}
                        ${vendor.InsuranceExpiry ? `<br><small>${getInsuranceStatus(vendor.InsuranceExpiry).message}</small>` : ''}
                    </span>
                </div>
                <div class="detail-row">
                    <label>Total Spent:</label>
                    <span>${formatCurrency(vendor.total_spent || 0)}</span>
                </div>
                <div class="detail-row">
                    <label>Transaction Count:</label>
                    <span>${vendor.transaction_count || 0}</span>
                </div>
                <div class="detail-row">
                    <label>Last Transaction:</label>
                    <span>${vendor.last_transaction ? formatDate(vendor.last_transaction) : '—'}</span>
                </div>
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>Vendor Details</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn-primary" onclick="openEditVendorModal(${id}); this.closest('.modal').remove()">Edit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load vendor details: ' + error.message, 'error');
    }
}

// View vendor transactions
async function viewVendorTransactions(id) {
    try {
        showLoading();
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
        
        const transactions = await api.getVendorTransactions(
            id, 
            thirtyDaysAgo.toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        );
        
        // Create modal content
        let transactionsHtml = '';
        if (transactions && transactions.length > 0) {
            transactions.forEach(t => {
                transactionsHtml += `
                    <tr>
                        <td>${formatDate(t.transaction_date)}</td>
                        <td>${escapeHtml(t.description || '')}</td>
                        <td>${escapeHtml(t.invoice_number || '')}</td>
                        <td>${formatCurrency(t.amount || 0)}</td>
                    </tr>
                `;
            });
        } else {
            transactionsHtml = '<tr><td colspan="4" class="text-center">No transactions found</td></tr>';
        }
        
        const content = `
            <div class="vendor-transactions">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Invoice #</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactionsHtml}
                    </tbody>
                </table>
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Vendor Transactions</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn-primary" onclick="exportVendorTransactions(${id})">Export</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load vendor transactions: ' + error.message, 'error');
    }
}

// Export vendor transactions
async function exportVendorTransactions(id) {
    try {
        showLoading();
        
        const vendor = await api.getVendor(id);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
        
        const transactions = await api.getVendorTransactions(
            id,
            thirtyDaysAgo.toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        );
        
        const data = transactions.map(t => ({
            'Date': t.transaction_date,
            'Description': t.description,
            'Invoice Number': t.invoice_number,
            'Amount': t.amount
        }));
        
        exportToCSV(data, `vendor_${id}_transactions.csv`);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to export transactions: ' + error.message, 'error');
    }
}

// Save vendor
async function saveVendor(event) {
    event.preventDefault();
    
    const formData = {
        Name: document.getElementById('name').value.trim(),
        TaxID: document.getElementById('taxId').value.trim(),
        IsSubcontractor: document.getElementById('isSubcontractor').checked ? 1 : 0,
        InsuranceExpiry: document.getElementById('insuranceExpiry').value || null
    };
    
    // Validate
    if (!formData.Name) {
        showNotification('Vendor name is required', 'error');
        return;
    }
    
    try {
        showLoading();
        
        if (currentVendorId) {
            await api.updateVendor(currentVendorId, formData);
            showNotification('Vendor updated successfully', 'success');
        } else {
            await api.createVendor(formData);
            showNotification('Vendor created successfully', 'success');
        }
        
        closeModal(document.getElementById('vendorModal'));
        await loadVendors();
        await checkInsuranceExpiry();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to save vendor: ' + error.message, 'error');
    }
}

// Open delete confirmation modal
function openDeleteModal(id) {
    currentVendorId = id;
    openModal('deleteModal');
}

// Confirm delete
async function confirmDelete() {
    if (!currentVendorId) return;
    
    try {
        showLoading();
        
        await api.deleteVendor(currentVendorId);
        showNotification('Vendor deleted successfully', 'success');
        
        closeDeleteModal();
        await loadVendors();
        await checkInsuranceExpiry();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to delete vendor: ' + error.message, 'error');
    }
}

// Close delete modal
function closeDeleteModal() {
    closeModal(document.getElementById('deleteModal'));
    currentVendorId = null;
}