// assets/js/api.js
const API_BASE_URL = '/accounting-app/api';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                // Token expired or invalid
                this.clearToken();
                window.location.href = '/accounting-app/pages/login.html';
                throw new Error('Session expired');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        const data = await this.request('/auth.php', {
            method: 'POST',
            body: JSON.stringify({
                action: 'login',
                email,
                password
            })
        });
        
        if (data.token) {
            this.setToken(data.token);
        }
        
        return data;
    }

    async register(userData) {
        const data = await this.request('/auth.php', {
            method: 'POST',
            body: JSON.stringify({
                action: 'register',
                ...userData
            })
        });
        
        return data;
    }

    async logout() {
        await this.request('/auth.php', {
            method: 'POST',
            body: JSON.stringify({ action: 'logout' })
        });
        this.clearToken();
        window.location.href = '/accounting-app/pages/login.html';
    }

    // CRUD Operations for Employees
    async getEmployees() {
        return this.request('/endpoints/employees.php');
    }

    async getEmployee(id) {
        return this.request(`/endpoints/employees.php?id=${id}`);
    }

    async createEmployee(employeeData) {
        return this.request('/endpoints/employees.php', {
            method: 'POST',
            body: JSON.stringify(employeeData)
        });
    }

    async updateEmployee(id, employeeData) {
        return this.request(`/endpoints/employees.php?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(employeeData)
        });
    }

    async deleteEmployee(id) {
        return this.request(`/endpoints/employees.php?id=${id}`, {
            method: 'DELETE'
        });
    }

    // Timesheets
    async getTimesheets(filters = {}) {
        let query = '/endpoints/timesheets.php?';
        const params = new URLSearchParams(filters).toString();
        return this.request(`/endpoints/timesheets.php?${params}`);
    }

    async createTimesheet(data) {
        return this.request('/endpoints/timesheets.php', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateTimesheet(id, data) {
        return this.request(`/endpoints/timesheets.php?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteTimesheet(id) {
        return this.request(`/endpoints/timesheets.php?id=${id}`, {
            method: 'DELETE'
        });
    }

    // Jobs
    async getJobs() {
        return this.request('/endpoints/jobs.php');
    }

    async getJob(id) {
        return this.request(`/endpoints/jobs.php?id=${id}`);
    }

    async createJob(data) {
        return this.request('/endpoints/jobs.php', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateJob(id, data) {
        return this.request(`/endpoints/jobs.php?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteJob(id) {
        return this.request(`/endpoints/jobs.php?id=${id}`, {
            method: 'DELETE'
        });
    }

    // Invoices
    async getInvoices() {
        return this.request('/endpoints/invoices.php');
    }

    async getInvoice(id) {
        return this.request(`/endpoints/invoices.php?id=${id}`);
    }

    async createInvoice(data) {
        return this.request('/endpoints/invoices.php', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateInvoice(id, data) {
        return this.request(`/endpoints/invoices.php?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteInvoice(id) {
        return this.request(`/endpoints/invoices.php?id=${id}`, {
            method: 'DELETE'
        });
    }

    // Vendors
    async getVendors() {
        return this.request('/endpoints/vendors.php');
    }

    async getVendor(id) {
        return this.request(`/endpoints/vendors.php?id=${id}`);
    }

    async createVendor(data) {
        return this.request('/endpoints/vendors.php', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateVendor(id, data) {
        return this.request(`/endpoints/vendors.php?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteVendor(id) {
        return this.request(`/endpoints/vendors.php?id=${id}`, {
            method: 'DELETE'
        });
    }

    // Reports
    async getExpenseReport(startDate, endDate, category) {
        let query = `/endpoints/reports.php?type=expenses`;
        if (startDate) query += `&startDate=${startDate}`;
        if (endDate) query += `&endDate=${endDate}`;
        if (category) query += `&category=${category}`;
        return this.request(query);
    }

    async getIncomeReport(startDate, endDate) {
        let query = `/endpoints/reports.php?type=income`;
        if (startDate) query += `&startDate=${startDate}`;
        if (endDate) query += `&endDate=${endDate}`;
        return this.request(query);
    }

    async getPNLReport(year) {
        let query = `/endpoints/reports.php?type=pnl`;
        if (year) query += `&year=${year}`;
        return this.request(query);
    }

    async getMLInsights() {
        return this.request('/endpoints/reports.php?type=insights');
    }
}

// Create global instance
const api = new ApiClient();