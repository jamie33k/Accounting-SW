<?php
// api/endpoints/reports.php
require_once '../database.php';
require_once '../auth_check.php';

$db = new Database();
$method = $_SERVER['REQUEST_METHOD'];

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

switch($method) {
    case 'GET':
        $type = $_GET['type'] ?? '';
        
        switch($type) {
            case 'expenses':
                getExpenseReport($db);
                break;
            case 'income':
                getIncomeReport($db);
                break;
            case 'pnl':
                getPNLReport($db);
                break;
            case 'insights':
                getMLInsights($db);
                break;
            case 'cashflow':
                getCashFlowReport($db);
                break;
            case 'aging':
                getAgingReport($db);
                break;
            default:
                http_response_code(400);
                echo json_encode(['error' => 'Invalid report type']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function getExpenseReport($db) {
    $startDate = $_GET['startDate'] ?? date('Y-m-01', strtotime('-1 year'));
    $endDate = $_GET['endDate'] ?? date('Y-m-d');
    $category = $_GET['category'] ?? '';
    
    $sql = "SELECT 
            DATE_FORMAT(t.TransactionDate, '%Y-%m') as month,
            j.JobID,
            j.JobName,
            li.CostCode,
            SUM(t.Debit) as total_expense,
            COUNT(DISTINCT t.TransactionID) as transaction_count
            FROM transaction t
            JOIN invoice i ON t.InvoiceID = i.InvoiceID
            JOIN job j ON i.JobID = j.JobID
            JOIN line_item li ON i.InvoiceID = li.InvoiceID
            WHERE t.Debit > 0
            AND t.TransactionDate BETWEEN ? AND ?";
    
    $params = [$startDate, $endDate];
    
    if (!empty($category)) {
        $sql .= " AND li.CostCode = ?";
        $params[] = $category;
    }
    
    $sql .= " GROUP BY month, j.JobID, j.JobName, li.CostCode 
              ORDER BY month DESC, total_expense DESC";
    
    $expenses = $db->select($sql, $params);
    
    // Calculate totals
    $total = 0;
    $byCategory = [];
    $byJob = [];
    
    foreach ($expenses as $exp) {
        $total += $exp['total_expense'];
        
        if (!isset($byCategory[$exp['CostCode']])) {
            $byCategory[$exp['CostCode']] = 0;
        }
        $byCategory[$exp['CostCode']] += $exp['total_expense'];
        
        if (!isset($byJob[$exp['JobName']])) {
            $byJob[$exp['JobName']] = 0;
        }
        $byJob[$exp['JobName']] += $exp['total_expense'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'expenses' => $expenses,
            'summary' => [
                'total' => $total,
                'by_category' => $byCategory,
                'by_job' => $byJob,
                'period' => ['start' => $startDate, 'end' => $endDate]
            ]
        ]
    ]);
}

function getIncomeReport($db) {
    $startDate = $_GET['startDate'] ?? date('Y-m-01', strtotime('-1 year'));
    $endDate = $_GET['endDate'] ?? date('Y-m-d');
    $status = $_GET['status'] ?? '';
    
    $sql = "SELECT 
            i.InvoiceID,
            i.InvoiceNumber,
            i.InvoiceDate,
            i.TotalAmount,
            i.AmountDue,
            i.Status,
            j.JobName,
            c.Name as ClientName
            FROM invoice i
            JOIN job j ON i.JobID = j.JobID
            JOIN client c ON i.ClientID = c.ClientID
            WHERE i.InvoiceDate BETWEEN ? AND ?";
    
    $params = [$startDate, $endDate];
    
    if (!empty($status)) {
        $sql .= " AND i.Status = ?";
        $params[] = $status;
    }
    
    $sql .= " ORDER BY i.InvoiceDate DESC";
    
    $invoices = $db->select($sql, $params);
    
    // Calculate summary
    $totalInvoiced = 0;
    $totalPaid = 0;
    $totalDue = 0;
    $byStatus = [];
    
    foreach ($invoices as $inv) {
        $totalInvoiced += $inv['TotalAmount'];
        
        if ($inv['Status'] == 'Paid') {
            $totalPaid += $inv['TotalAmount'];
        } else {
            $totalDue += $inv['AmountDue'];
        }
        
        if (!isset($byStatus[$inv['Status']])) {
            $byStatus[$inv['Status']] = 0;
        }
        $byStatus[$inv['Status']] += $inv['TotalAmount'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'invoices' => $invoices,
            'summary' => [
                'totalInvoiced' => $totalInvoiced,
                'totalPaid' => $totalPaid,
                'totalDue' => $totalDue,
                'byStatus' => $byStatus
            ]
        ]
    ]);
}

function getPNLReport($db) {
    $year = $_GET['year'] ?? date('Y');
    
    $sql = "SELECT 
            DATE_FORMAT(t.TransactionDate, '%Y-%m') as month,
            SUM(CASE WHEN t.Credit > 0 THEN t.Credit ELSE 0 END) as income,
            SUM(CASE WHEN t.Debit > 0 THEN t.Debit ELSE 0 END) as expenses
            FROM transaction t
            WHERE YEAR(t.TransactionDate) = ?
            GROUP BY DATE_FORMAT(t.TransactionDate, '%Y-%m')
            ORDER BY month";
    
    $monthlyData = $db->select($sql, [$year]);
    
    // Calculate totals
    $totalIncome = 0;
    $totalExpenses = 0;
    
    foreach ($monthlyData as $data) {
        $totalIncome += $data['income'];
        $totalExpenses += $data['expenses'];
    }
    
    $netProfit = $totalIncome - $totalExpenses;
    $profitMargin = $totalIncome > 0 ? ($netProfit / $totalIncome * 100) : 0;
    
    echo json_encode([
        'success' => true,
        'data' => [
            'monthlyData' => $monthlyData,
            'summary' => [
                'totalIncome' => $totalIncome,
                'totalExpenses' => $totalExpenses,
                'netProfit' => $netProfit,
                'profitMargin' => $profitMargin
            ]
        ]
    ]);
}

function getCashFlowReport($db) {
    $startDate = $_GET['start'] ?? date('Y-m-01', strtotime('-6 months'));
    $endDate = $_GET['end'] ?? date('Y-m-d');
    
    $sql = "SELECT 
            DATE_FORMAT(t.TransactionDate, '%Y-%m-%d') as date,
            SUM(t.Credit) as inflows,
            SUM(t.Debit) as outflows,
            SUM(t.Credit) - SUM(t.Debit) as net
            FROM transaction t
            WHERE t.TransactionDate BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(t.TransactionDate, '%Y-%m-%d')
            ORDER BY date";
    
    $daily = $db->select($sql, [$startDate, $endDate]);
    
    // Calculate running balance
    $balance = 0;
    foreach ($daily as &$day) {
        $balance += ($day['inflows'] - $day['outflows']);
        $day['balance'] = $balance;
    }
    
    // Calculate monthly summary
    $monthlySql = "SELECT 
                  DATE_FORMAT(t.TransactionDate, '%Y-%m') as month,
                  SUM(t.Credit) as inflows,
                  SUM(t.Debit) as outflows
                  FROM transaction t
                  WHERE t.TransactionDate BETWEEN ? AND ?
                  GROUP BY DATE_FORMAT(t.TransactionDate, '%Y-%m')
                  ORDER BY month";
    
    $monthly = $db->select($monthlySql, [$startDate, $endDate]);
    
    echo json_encode([
        'success' => true,
        'data' => [
            'daily' => $daily,
            'monthly' => $monthly,
            'summary' => [
                'totalInflows' => array_sum(array_column($daily, 'inflows')),
                'totalOutflows' => array_sum(array_column($daily, 'outflows')),
                'netCashFlow' => array_sum(array_column($daily, 'net'))
            ]
        ]
    ]);
}

function getAgingReport($db) {
    $sql = "SELECT 
            i.InvoiceID,
            i.InvoiceNumber,
            i.InvoiceDate,
            i.DueDate,
            i.TotalAmount,
            i.AmountDue,
            i.Status,
            c.Name as ClientName,
            DATEDIFF(CURDATE(), i.DueDate) as days_overdue
            FROM invoice i
            JOIN client c ON i.ClientID = c.ClientID
            WHERE i.Status != 'Paid'
            AND i.AmountDue > 0
            ORDER BY 
                CASE 
                    WHEN DATEDIFF(CURDATE(), i.DueDate) <= 0 THEN 1
                    WHEN DATEDIFF(CURDATE(), i.DueDate) <= 30 THEN 2
                    WHEN DATEDIFF(CURDATE(), i.DueDate) <= 60 THEN 3
                    WHEN DATEDIFF(CURDATE(), i.DueDate) <= 90 THEN 4
                    ELSE 5
                END DESC,
                i.DueDate";
    
    $invoices = $db->select($sql);
    
    // Group by aging buckets
    $aging = [
        'current' => ['total' => 0, 'count' => 0, 'invoices' => []],
        '1-30' => ['total' => 0, 'count' => 0, 'invoices' => []],
        '31-60' => ['total' => 0, 'count' => 0, 'invoices' => []],
        '61-90' => ['total' => 0, 'count' => 0, 'invoices' => []],
        '90+' => ['total' => 0, 'count' => 0, 'invoices' => []]
    ];
    
    foreach ($invoices as $inv) {
        $days = $inv['days_overdue'];
        
        if ($days <= 0) {
            $aging['current']['total'] += $inv['AmountDue'];
            $aging['current']['count']++;
            $aging['current']['invoices'][] = $inv;
        } elseif ($days <= 30) {
            $aging['1-30']['total'] += $inv['AmountDue'];
            $aging['1-30']['count']++;
            $aging['1-30']['invoices'][] = $inv;
        } elseif ($days <= 60) {
            $aging['31-60']['total'] += $inv['AmountDue'];
            $aging['31-60']['count']++;
            $aging['31-60']['invoices'][] = $inv;
        } elseif ($days <= 90) {
            $aging['61-90']['total'] += $inv['AmountDue'];
            $aging['61-90']['count']++;
            $aging['61-90']['invoices'][] = $inv;
        } else {
            $aging['90+']['total'] += $inv['AmountDue'];
            $aging['90+']['count']++;
            $aging['90+']['invoices'][] = $inv;
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'aging' => $aging,
            'total_outstanding' => array_sum(array_column($aging, 'total')),
            'total_invoices' => count($invoices)
        ]
    ]);
}

function getMLInsights($db) {
    // Get expense patterns
    $expenseSql = "SELECT 
                  DATE_FORMAT(TransactionDate, '%Y-%m') as month,
                  SUM(Debit) as total_expense,
                  COUNT(DISTINCT Category) as category_count
                  FROM transaction
                  WHERE Debit > 0
                  AND TransactionDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                  GROUP BY DATE_FORMAT(TransactionDate, '%Y-%m')
                  ORDER BY month";
    
    $expensePatterns = $db->select($expenseSql);
    
    // Calculate trends
    $trends = [];
    if (count($expensePatterns) >= 3) {
        $recent = array_slice($expensePatterns, -3);
        $avgRecent = array_sum(array_column($recent, 'total_expense')) / 3;
        $avgOlder = array_sum(array_column(array_slice($expensePatterns, 0, 3), 'total_expense')) / 3;
        
        $trends['expense_trend'] = $avgRecent > $avgOlder ? 'increasing' : 'decreasing';
        $trends['expense_change'] = (($avgRecent - $avgOlder) / $avgOlder) * 100;
    }
    
    // Generate insights
    $insights = [];
    
    // Seasonal patterns
    $monthlyAvg = [];
    foreach ($expensePatterns as $exp) {
        $month = date('n', strtotime($exp['month'] . '-01'));
        if (!isset($monthlyAvg[$month])) {
            $monthlyAvg[$month] = ['total' => 0, 'count' => 0];
        }
        $monthlyAvg[$month]['total'] += $exp['total_expense'];
        $monthlyAvg[$month]['count']++;
    }
    
    $currentMonth = date('n');
    if (isset($monthlyAvg[$currentMonth])) {
        $avgForMonth = $monthlyAvg[$currentMonth]['total'] / $monthlyAvg[$currentMonth]['count'];
        $overallAvg = array_sum(array_column($monthlyAvg, 'total')) / 12;
        
        if ($avgForMonth > $overallAvg * 1.2) {
            $insights[] = [
                'type' => 'warning',
                'title' => 'Seasonal Spending Pattern',
                'description' => 'Expenses typically increase this month. Consider budgeting accordingly.'
            ];
        }
    }
    
    // Anomaly detection
    $anomalySql = "SELECT 
                  TransactionDate,
                  Debit as amount,
                  Description
                  FROM transaction
                  WHERE Debit > (SELECT AVG(Debit) + 2*STDDEV(Debit) FROM transaction WHERE Debit > 0)
                  AND TransactionDate >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
                  ORDER BY Debit DESC
                  LIMIT 5";
    
    $anomalies = $db->select($anomalySql);
    
    if (!empty($anomalies)) {
        $insights[] = [
            'type' => 'critical',
            'title' => 'Unusual Transactions Detected',
            'description' => count($anomalies) . ' unusually large transactions found. Review for accuracy.'
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'patterns' => $expensePatterns,
            'trends' => $trends,
            'insights' => $insights,
            'anomalies' => $anomalies
        ]
    ]);
}

function logActivity($userId, $action, $details) {
    global $db;
    $sql = "INSERT INTO activity_log (user_id, action, details, ip_address, created_at) 
            VALUES (?, ?, ?, ?, NOW())";
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $db->insert($sql, [$userId, $action, $details, $ip]);
}
?>