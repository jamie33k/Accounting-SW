-- database/schema.sql
CREATE DATABASE IF NOT EXISTS accounting_app;
USE accounting_app;

-- Users table for authentication
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('admin', 'accountant', 'manager', 'employee') DEFAULT 'employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Employee table
CREATE TABLE employee (
    EmployeeID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    PayRate DECIMAL(10,2),
    Type ENUM('Hourly', 'Salary') NOT NULL,
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Company table
CREATE TABLE company (
    CompanyID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Address TEXT,
    TaxID VARCHAR(50) UNIQUE,
    INDEX idx_name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Job table
CREATE TABLE job (
    JobID INT PRIMARY KEY AUTO_INCREMENT,
    CompanyID INT,
    JobName VARCHAR(100) NOT NULL,
    Location VARCHAR(200),
    StartDate DATE,
    EndDate DATE,
    BudgetTotal DECIMAL(15,2),
    Status ENUM('Active', 'Completed', 'Retainage') DEFAULT 'Active',
    FOREIGN KEY (CompanyID) REFERENCES company(CompanyID) ON DELETE CASCADE,
    INDEX idx_status (Status),
    INDEX idx_dates (StartDate, EndDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Timesheet table
CREATE TABLE timesheet (
    TimesheetID INT PRIMARY KEY AUTO_INCREMENT,
    EmployeeID INT,
    JobID INT,
    WeekEnding DATE,
    HoursWorked DECIMAL(5,2),
    OvertimeHours DECIMAL(5,2),
    FOREIGN KEY (EmployeeID) REFERENCES employee(EmployeeID) ON DELETE CASCADE,
    FOREIGN KEY (JobID) REFERENCES job(JobID) ON DELETE CASCADE,
    INDEX idx_week (WeekEnding),
    UNIQUE KEY unique_timesheet (EmployeeID, JobID, WeekEnding)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vendor table
CREATE TABLE vendor (
    VendorID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    TaxID VARCHAR(50),
    IsSubcontractor BOOLEAN DEFAULT FALSE,
    InsuranceExpiry DATE,
    INDEX idx_name (Name),
    INDEX idx_insurance (InsuranceExpiry)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Client table
CREATE TABLE client (
    ClientID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100),
    Phone VARCHAR(20),
    Address TEXT,
    TaxID VARCHAR(50),
    INDEX idx_name (Name),
    INDEX idx_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invoice table
CREATE TABLE invoice (
    InvoiceID INT PRIMARY KEY AUTO_INCREMENT,
    JobID INT,
    ClientID INT,
    InvoiceNumber VARCHAR(50) UNIQUE,
    InvoiceDate DATE,
    DueDate DATE,
    TotalAmount DECIMAL(15,2),
    RetainagePercent DECIMAL(5,2),
    AmountDue DECIMAL(15,2),
    Status ENUM('Draft', 'Sent', 'Partial', 'Paid') DEFAULT 'Draft',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (JobID) REFERENCES job(JobID) ON DELETE SET NULL,
    FOREIGN KEY (ClientID) REFERENCES client(ClientID) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_status (Status),
    INDEX idx_dates (InvoiceDate, DueDate),
    INDEX idx_invoice_number (InvoiceNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Line Item table
CREATE TABLE line_item (
    LineItemID INT PRIMARY KEY AUTO_INCREMENT,
    InvoiceID INT,
    Description TEXT,
    Quantity DECIMAL(10,2),
    UnitPrice DECIMAL(10,2),
    Amount DECIMAL(15,2),
    CostCode VARCHAR(50),
    FOREIGN KEY (InvoiceID) REFERENCES invoice(InvoiceID) ON DELETE CASCADE,
    INDEX idx_costcode (CostCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transaction table for general ledger
CREATE TABLE transaction (
    TransactionID INT PRIMARY KEY AUTO_INCREMENT,
    InvoiceID INT,
    TransactionDate DATE,
    Description TEXT,
    Debit DECIMAL(15,2),
    Credit DECIMAL(15,2),
    AccountCode VARCHAR(20),
    FOREIGN KEY (InvoiceID) REFERENCES invoice(InvoiceID) ON DELETE SET NULL,
    INDEX idx_date (TransactionDate),
    INDEX idx_account (AccountCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ML Predictions table
CREATE TABLE expense_predictions (
    prediction_id INT PRIMARY KEY AUTO_INCREMENT,
    prediction_date DATE,
    category VARCHAR(50),
    predicted_amount DECIMAL(15,2),
    confidence_score DECIMAL(5,2),
    actual_amount DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (prediction_date),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create indexes for performance
CREATE INDEX idx_invoice_status ON invoice(Status);
CREATE INDEX idx_job_status ON job(Status);
CREATE INDEX idx_timesheet_week ON timesheet(WeekEnding);
CREATE INDEX idx_transaction_date ON transaction(TransactionDate);

-- Insert sample data
INSERT INTO users (email, password_hash, full_name, role) VALUES 
('admin@example.com', '$2y$10$YourHashedPasswordHere', 'Admin User', 'admin'),
('accountant@example.com', '$2y$10$YourHashedPasswordHere', 'Accountant User', 'accountant');

INSERT INTO company (Name, Address, TaxID) VALUES 
('ABC Construction', '123 Main St, City, State 12345', '12-3456789'),
('XYZ Developers', '456 Oak Ave, Town, State 67890', '98-7654321');

INSERT INTO client (Name, Email, Phone, Address, TaxID) VALUES 
('Client A', 'clienta@email.com', '555-0101', '789 Pine St, City, State 12345', '11-1111111'),
('Client B', 'clientb@email.com', '555-0202', '321 Elm St, Town, State 67890', '22-2222222');

INSERT INTO vendor (Name, TaxID, IsSubcontractor, InsuranceExpiry) VALUES 
('Supply Co', '33-3333333', FALSE, '2024-12-31'),
('Subcontractor Inc', '44-4444444', TRUE, '2024-06-30');