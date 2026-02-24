// assets/js/invoices.js
let currentInvoiceId = null;
let invoicesData = [];
let lineItems = [];

// Initialize invoices page
document.addEventListener('DOMContentLoaded', async function() {
    await loadInvoices();
    await loadJobOptions();
    await loadClientOptions();
    await loadInvoiceStats();
    setupEventListeners();
    
    // Set default invoice date
    const today = new Date().toISOString().split('T')[0];
    const invoiceDateInput = document.getElementById('invoiceDate');
    const dueDateInput = document.getElementById('dueDate');
    
    if (invoiceDateInput) {
        invoiceDateInput.value = today;
    }
    
    if (dueDateInput) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        dueDateInput.value = dueDate.toISOString().split('T')[0];
    }
    
    // Generate invoice number
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.value = generateInvoiceNumber();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', debounce(filterInvoices, 300));
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterInvoices);
    }
    
    // Job filter
    const jobFilter = document.getElementById('jobFilter');
    if (jobFilter) {
        jobFilter.addEventListener('change', filterInvoices);
    }
    
    // Retainage percent change
    const retainagePercent = document.getElementById('retainagePercent');
    if (retainagePercent) {
        retainagePercent.addEventListener('input', calculateTotals);
    }
    
    // Job selection change
    const jobSelect = document.getElementById('jobId');
    if (jobSelect) {
        jobSelect.addEventListener('change', loadJobDetails);
    }
}

// Load invoices
async function loadInvoices() {
    try {
        showLoading();
        
        const filters = {};
        const statusFilter = document.getElementById('statusFilter')?.value;
        const jobFilter = document.getElementById('jobFilter')?.value;
        
        if (statusFilter) filters.status = statusFilter;
        if (jobFilter) filters.job_id = jobFilter;
        
        invoicesData = await api.getInvoices(filters);
        renderInvoicesTable(invoicesData);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load invoices: ' + error.message, 'error');
        console.error('Load invoices error:', error);
    }
}

// Load invoice statistics
async function loadInvoiceStats() {
    try {
        const stats = await api.getInvoiceStats();
        updateInvoiceStats(stats);
    } catch (error) {
        console.error('Failed to load invoice stats:', error);
    }
}

// Update invoice statistics
function updateInvoiceStats(stats) {
    const totalInvoicedEl = document.getElementById('totalInvoiced');
    if (totalInvoicedEl) {
        totalInvoicedEl.textContent = formatCurrency(stats.total_invoiced || 0);
    }
    
    const totalPaidEl = document.getElementById('totalPaid');
    if (totalPaidEl) {
        totalPaidEl.textContent = formatCurrency(stats.total_paid || 0);
    }
    
    const totalDueEl = document.getElementById('totalDue');
    if (totalDueEl) {
        totalDueEl.textContent = formatCurrency(stats.total_due || 0);
    }
    
    const totalRetainageEl = document.getElementById('totalRetainage');
    if (totalRetainageEl) {
        totalRetainageEl.textContent = formatCurrency(stats.total_retainage || 0);
    }
}

// Load job options for dropdown
async function loadJobOptions() {
    try {
        const jobs = await api.getJobs({ status: 'Active' });
        const select = document.getElementById('jobId');
        if (!select) return;
        
        let options = '<option value="">Select Job</option>';
        jobs.forEach(job => {
            options += `<option value="${job.JobID}">${escapeHtml(job.JobName)}</option>`;
        });
        
        select.innerHTML = options;
        
        // Also populate filter dropdown
        const filterSelect = document.getElementById('jobFilter');
        if (filterSelect) {
            let filterOptions = '<option value="">All Jobs</option>';
            jobs.forEach(job => {
                filterOptions += `<option value="${job.JobID}">${escapeHtml(job.JobName)}</option>`;
            });
            filterSelect.innerHTML = filterOptions;
        }
    } catch (error) {
        console.error('Failed to load jobs:', error);
    }
}

// Load client options for dropdown
async function loadClientOptions() {
    try {
        const clients = await api.getClients();
        const select = document.getElementById('clientId');
        if (!select) return;
        
        let options = '<option value="">Select Client</option>';
        clients.forEach(client => {
            options += `<option value="${client.ClientID}">${escapeHtml(client.Name)}</option>`;
        });
        
        select.innerHTML = options;
    } catch (error) {
        console.error('Failed to load clients:', error);
    }
}

// Load job details when job is selected
async function loadJobDetails() {
    const jobId = document.getElementById('jobId')?.value;
    if (!jobId) return;
    
    try {
        const job = await api.getJob(jobId);
        
        // Pre-fill client if available
        if (job.CompanyID) {
            const clientSelect = document.getElementById('clientId');
            if (clientSelect) {
                // Find client option by company name
                Array.from(clientSelect.options).forEach(option => {
                    if (option.text.includes(job.CompanyName)) {
                        option.selected = true;
                    }
                });
            }
        }
    } catch (error) {
        console.error('Failed to load job details:', error);
    }
}

// Render invoices table
function renderInvoicesTable(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;
    
    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No invoices found</td></tr>';
        return;
    }
    
    let html = '';
    invoices.forEach(invoice => {
        const statusClass = getStatusClass(invoice.Status);
        
        html += `
            <tr>
                <td>${escapeHtml(invoice.InvoiceNumber || '')}</td>
                <td>${escapeHtml(invoice.JobName || '')}</td>
                <td>${escapeHtml(invoice.ClientName || '')}</td>
                <td>${formatDate(invoice.InvoiceDate)}</td>
                <td>${formatDate(invoice.DueDate)}</td>
                <td>${formatCurrency(invoice.TotalAmount || 0)}</td>
                <td>${formatCurrency(invoice.AmountDue || 0)}</td>
                <td><span class="badge badge-${statusClass}">${escapeHtml(invoice.Status || '')}</span></td>
                <td class="actions">
                    <button class="action-btn edit" onclick="openEditInvoiceModal(${invoice.InvoiceID})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn view" onclick="viewInvoice(${invoice.InvoiceID})" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn send" onclick="openSendModal(${invoice.InvoiceID})" title="Send">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="action-btn download" onclick="downloadInvoice(${invoice.InvoiceID})" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn delete" onclick="openDeleteModal(${invoice.InvoiceID})" title="Delete">
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
        'Draft': 'warning',
        'Sent': 'info',
        'Partial': 'primary',
        'Paid': 'success'
    };
    return classes[status] || 'secondary';
}

// Filter invoices
function filterInvoices() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const jobFilter = document.getElementById('jobFilter')?.value || '';
    
    const filtered = invoicesData.filter(inv => {
        const matchesSearch = !searchTerm || 
            (inv.InvoiceNumber && inv.InvoiceNumber.toLowerCase().includes(searchTerm)) ||
            (inv.JobName && inv.JobName.toLowerCase().includes(searchTerm)) ||
            (inv.ClientName && inv.ClientName.toLowerCase().includes(searchTerm));
        
        const matchesStatus = !statusFilter || inv.Status === statusFilter;
        const matchesJob = !jobFilter || inv.JobID == jobFilter;
        
        return matchesSearch && matchesStatus && matchesJob;
    });
    
    renderInvoicesTable(filtered);
}

// Open add invoice modal
function openAddInvoiceModal() {
    currentInvoiceId = null;
    lineItems = [];
    
    document.getElementById('modalTitle').textContent = 'Create Invoice';
    document.getElementById('invoiceId').value = '';
    document.getElementById('invoiceNumber').value = generateInvoiceNumber();
    document.getElementById('jobId').value = '';
    document.getElementById('clientId').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    document.getElementById('dueDate').value = dueDate.toISOString().split('T')[0];
    
    document.getElementById('retainagePercent').value = '0';
    document.getElementById('status').value = 'Draft';
    
    renderLineItems();
    calculateTotals();
    
    openModal('invoiceModal');
}

// Open edit invoice modal
async function openEditInvoiceModal(id) {
    try {
        showLoading();
        
        const invoice = await api.getInvoice(id);
        const lineItems = await api.getLineItems(id);
        
        currentInvoiceId = id;
        this.lineItems = lineItems || [];
        
        document.getElementById('modalTitle').textContent = 'Edit Invoice';
        document.getElementById('invoiceId').value = invoice.InvoiceID;
        document.getElementById('invoiceNumber').value = invoice.InvoiceNumber || '';
        document.getElementById('jobId').value = invoice.JobID || '';
        document.getElementById('clientId').value = invoice.ClientID || '';
        document.getElementById('invoiceDate').value = invoice.InvoiceDate || '';
        document.getElementById('dueDate').value = invoice.DueDate || '';
        document.getElementById('retainagePercent').value = invoice.RetainagePercent || 0;
        document.getElementById('status').value = invoice.Status || 'Draft';
        
        renderLineItems();
        calculateTotals();
        
        hideLoading();
        openModal('invoiceModal');
    } catch (error) {
        hideLoading();
        showNotification('Failed to load invoice details: ' + error.message, 'error');
    }
}

// View invoice
async function viewInvoice(id) {
    try {
        showLoading();
        
        const invoice = await api.getInvoice(id);
        const lineItems = await api.getLineItems(id);
        
        // Create modal content
        let itemsHtml = '';
        lineItems.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${escapeHtml(item.Description || '')}</td>
                    <td>${item.Quantity || 0}</td>
                    <td>${formatCurrency(item.UnitPrice || 0)}</td>
                    <td>${formatCurrency(item.Amount || 0)}</td>
                    <td>${escapeHtml(item.CostCode || '')}</td>
                </tr>
            `;
        });
        
        const content = `
            <div class="invoice-view">
                <div class="invoice-header">
                    <div class="company-info">
                        <h2>${escapeHtml(invoice.CompanyName || 'Your Company')}</h2>
                        <p>${escapeHtml(invoice.CompanyAddress || '')}</p>
                        <p>Tax ID: ${escapeHtml(invoice.CompanyTaxID || '')}</p>
                    </div>
                    <div class="invoice-info">
                        <h1>INVOICE</h1>
                        <p><strong>Invoice #:</strong> ${escapeHtml(invoice.InvoiceNumber || '')}</p>
                        <p><strong>Date:</strong> ${formatDate(invoice.InvoiceDate)}</p>
                        <p><strong>Due Date:</strong> ${formatDate(invoice.DueDate)}</p>
                        <p><strong>Status:</strong> <span class="badge badge-${getStatusClass(invoice.Status)}">${invoice.Status}</span></p>
                    </div>
                </div>
                
                <div class="bill-to">
                    <h3>Bill To:</h3>
                    <p><strong>${escapeHtml(invoice.ClientName || '')}</strong></p>
                    <p>${escapeHtml(invoice.ClientAddress || '')}</p>
                    <p>${escapeHtml(invoice.ClientEmail || '')}</p>
                </div>
                
                <div class="invoice-items">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Amount</th>
                                <th>Cost Code</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml || '<tr><td colspan="5" class="text-center">No line items</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <div class="invoice-summary">
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(invoice.Subtotal || 0)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Retainage (${invoice.RetainagePercent || 0}%):</span>
                        <span>${formatCurrency(invoice.RetainageAmount || 0)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span>${formatCurrency(invoice.TotalAmount || 0)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Amount Due:</span>
                        <span>${formatCurrency(invoice.AmountDue || 0)}</span>
                    </div>
                </div>
                
                <div class="invoice-footer">
                    <p>Thank you for your business!</p>
                </div>
            </div>
        `;
        
        // Show in modal
        const modal = document.createElement('div');
        modal.className = 'modal show modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Invoice Details</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn-primary" onclick="downloadInvoice(${id}); this.closest('.modal').remove()">Download PDF</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to load invoice details: ' + error.message, 'error');
    }
}

// Save invoice
async function saveInvoice(event) {
    event.preventDefault();
    
    const formData = {
        InvoiceNumber: document.getElementById('invoiceNumber').value.trim(),
        JobID: document.getElementById('jobId').value,
        ClientID: document.getElementById('clientId').value,
        InvoiceDate: document.getElementById('invoiceDate').value,
        DueDate: document.getElementById('dueDate').value,
        RetainagePercent: parseFloat(document.getElementById('retainagePercent').value) || 0,
        Status: document.getElementById('status').value,
        line_items: lineItems
    };
    
    // Validate
    if (!formData.InvoiceNumber) {
        showNotification('Invoice number is required', 'error');
        return;
    }
    
    if (!formData.JobID) {
        showNotification('Please select a job', 'error');
        return;
    }
    
    if (!formData.ClientID) {
        showNotification('Please select a client', 'error');
        return;
    }
    
    if (!formData.InvoiceDate || !formData.DueDate) {
        showNotification('Invoice date and due date are required', 'error');
        return;
    }
    
    if (lineItems.length === 0) {
        showNotification('Please add at least one line item', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + (item.Amount || 0), 0);
        const retainageAmount = subtotal * (formData.RetainagePercent / 100);
        formData.TotalAmount = subtotal - retainageAmount;
        formData.AmountDue = formData.TotalAmount;
        
        if (currentInvoiceId) {
            await api.updateInvoice(currentInvoiceId, formData);
            showNotification('Invoice updated successfully', 'success');
        } else {
            await api.createInvoice(formData);
            showNotification('Invoice created successfully', 'success');
        }
        
        closeModal(document.getElementById('invoiceModal'));
        await loadInvoices();
        await loadInvoiceStats();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to save invoice: ' + error.message, 'error');
    }
}

// Add line item
function addLineItem() {
    lineItems.push({
        Description: '',
        Quantity: 1,
        UnitPrice: 0,
        Amount: 0,
        CostCode: ''
    });
    
    renderLineItems();
}

// Remove line item
function removeLineItem(index) {
    lineItems.splice(index, 1);
    renderLineItems();
    calculateTotals();
}

// Render line items
function renderLineItems() {
    const container = document.getElementById('lineItems');
    if (!container) return;
    
    if (lineItems.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No line items added yet</p>';
        return;
    }
    
    let html = '';
    lineItems.forEach((item, index) => {
        html += `
            <div class="line-item">
                <div class="form-row">
                    <div class="form-group" style="flex: 3;">
                        <input type="text" 
                               placeholder="Description" 
                               value="${escapeHtml(item.Description || '')}"
                               onchange="updateLineItem(${index}, 'Description', this.value)">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" 
                               placeholder="Qty" 
                               value="${item.Quantity || 1}"
                               min="0" 
                               step="0.01"
                               onchange="updateLineItem(${index}, 'Quantity', parseFloat(this.value) || 0); calculateLineItemAmount(${index})">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" 
                               placeholder="Unit Price" 
                               value="${item.UnitPrice || 0}"
                               min="0" 
                               step="0.01"
                               onchange="updateLineItem(${index}, 'UnitPrice', parseFloat(this.value) || 0); calculateLineItemAmount(${index})">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" 
                               placeholder="Amount" 
                               value="${item.Amount || 0}"
                               readonly
                               class="readonly">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <select onchange="updateLineItem(${index}, 'CostCode', this.value)">
                            <option value="">Cost Code</option>
                            <option value="Materials" ${item.CostCode === 'Materials' ? 'selected' : ''}>Materials</option>
                            <option value="Labor" ${item.CostCode === 'Labor' ? 'selected' : ''}>Labor</option>
                            <option value="Equipment" ${item.CostCode === 'Equipment' ? 'selected' : ''}>Equipment</option>
                            <option value="Subcontractor" ${item.CostCode === 'Subcontractor' ? 'selected' : ''}>Subcontractor</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 0 0 40px;">
                        <button type="button" class="btn-danger btn-small" onclick="removeLineItem(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Update line item field
function updateLineItem(index, field, value) {
    if (lineItems[index]) {
        lineItems[index][field] = value;
    }
}

// Calculate line item amount
function calculateLineItemAmount(index) {
    const item = lineItems[index];
    if (item) {
        item.Amount = (item.Quantity || 0) * (item.UnitPrice || 0);
        renderLineItems();
        calculateTotals();
    }
}

// Calculate invoice totals
function calculateTotals() {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.Amount || 0), 0);
    const retainagePercent = parseFloat(document.getElementById('retainagePercent')?.value) || 0;
    const retainageAmount = subtotal * (retainagePercent / 100);
    const total = subtotal - retainageAmount;
    
    const subtotalEl = document.getElementById('subtotal');
    const totalAmountEl = document.getElementById('totalAmount');
    const amountDueEl = document.getElementById('amountDue');
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (totalAmountEl) totalAmountEl.textContent = formatCurrency(total);
    if (amountDueEl) amountDueEl.textContent = formatCurrency(total);
}

// Open send invoice modal
function openSendModal(id) {
    currentInvoiceId = id;
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content modal-small">
            <div class="modal-header">
                <h2>Send Invoice</h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <form id="sendInvoiceForm" onsubmit="sendInvoice(event)">
                    <div class="form-group">
                        <label for="recipientEmail">Recipient Email</label>
                        <input type="email" id="recipientEmail" required>
                    </div>
                    <div class="form-group">
                        <label for="emailSubject">Subject</label>
                        <input type="text" id="emailSubject" value="Invoice from AccuFlow" required>
                    </div>
                    <div class="form-group">
                        <label for="emailMessage">Message</label>
                        <textarea id="emailMessage" rows="4">Please find attached invoice for your review. Thank you for your business!</textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn-primary">Send Invoice</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Send invoice
async function sendInvoice(event) {
    event.preventDefault();
    
    const emailData = {
        to: document.getElementById('recipientEmail').value,
        subject: document.getElementById('emailSubject').value,
        message: document.getElementById('emailMessage').value
    };
    
    try {
        showLoading();
        
        await api.sendInvoice(currentInvoiceId, emailData);
        showNotification('Invoice sent successfully', 'success');
        
        event.target.closest('.modal').remove();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to send invoice: ' + error.message, 'error');
    }
}

// Download invoice
async function downloadInvoice(id) {
    try {
        await api.downloadInvoice(id, 'pdf');
    } catch (error) {
        showNotification('Failed to download invoice: ' + error.message, 'error');
    }
}

// Mark invoice as paid
async function markAsPaid(id) {
    if (!confirm('Mark this invoice as paid?')) return;
    
    try {
        showLoading();
        
        await api.markInvoiceAsPaid(id, {
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'Bank Transfer'
        });
        
        showNotification('Invoice marked as paid', 'success');
        await loadInvoices();
        await loadInvoiceStats();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to mark invoice as paid: ' + error.message, 'error');
    }
}

// Open delete confirmation modal
function openDeleteModal(id) {
    currentInvoiceId = id;
    openModal('deleteModal');
}

// Confirm delete
async function confirmDelete() {
    if (!currentInvoiceId) return;
    
    try {
        showLoading();
        
        await api.deleteInvoice(currentInvoiceId);
        showNotification('Invoice deleted successfully', 'success');
        
        closeDeleteModal();
        await loadInvoices();
        await loadInvoiceStats();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showNotification('Failed to delete invoice: ' + error.message, 'error');
    }
}

// Close delete modal
function closeDeleteModal() {
    closeModal(document.getElementById('deleteModal'));
    currentInvoiceId = null;
}

// Generate invoice number
function generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `INV-${year}${month}-${random}`;
}