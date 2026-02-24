// assets/ml/expensePredictor.js
// Machine Learning module for expense prediction using TensorFlow.js

class ExpensePredictor {
    constructor() {
        this.model = null;
        this.isTrained = false;
        this.trainingData = [];
        this.seasonalPatterns = {};
        this.anomalyThresholds = {};
    }

    // Initialize the model
    async initialize() {
        console.log('Initializing ML model...');
        
        // Create a sequential model
        this.model = tf.sequential({
            layers: [
                // Input layer (5 features: month, day, year, previous expense, job count)
                tf.layers.dense({ 
                    units: 16, 
                    activation: 'relu', 
                    inputShape: [5],
                    kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
                }),
                // Dropout layer to prevent overfitting
                tf.layers.dropout({ rate: 0.2 }),
                // Hidden layer
                tf.layers.dense({ 
                    units: 8, 
                    activation: 'relu',
                    kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
                }),
                // Output layer (single value: predicted expense)
                tf.layers.dense({ units: 1 })
            ]
        });

        // Compile the model
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        console.log('ML model initialized');
    }

    // Prepare data for training
    prepareFeatures(historicalData) {
        return historicalData.map((item, index) => {
            const date = new Date(item.date);
            const month = date.getMonth() / 11; // Normalize 0-11 to 0-1
            const day = date.getDate() / 31; // Normalize 1-31 to 0-1
            const year = (date.getFullYear() - 2000) / 50; // Normalize relative to 2000
            
            // Previous expense (or 0 for first item)
            const prevExpense = index > 0 ? historicalData[index - 1].amount / 1000000 : 0;
            
            // Number of active jobs at that time
            const jobCount = (item.activeJobs || 10) / 100; // Normalize

            return [month, day, year, prevExpense, jobCount];
        });
    }

    // Train the model with historical data
    async trainModel(historicalData) {
        if (!this.model) {
            await this.initialize();
        }

        if (!historicalData || historicalData.length < 10) {
            console.log('Insufficient data for training. Need at least 10 data points.');
            return false;
        }

        try {
            console.log('Training model with', historicalData.length, 'data points');

            // Prepare features and labels
            const features = this.prepareFeatures(historicalData);
            const labels = historicalData.map(item => item.amount / 1000000); // Normalize

            // Convert to tensors
            const xs = tf.tensor2d(features);
            const ys = tf.tensor2d(labels, [labels.length, 1]);

            // Train the model
            const history = await this.model.fit(xs, ys, {
                epochs: 100,
                batchSize: 8,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (epoch % 10 === 0) {
                            console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
                        }
                    }
                }
            });

            this.isTrained = true;
            this.trainingData = historicalData;
            
            // Analyze patterns after training
            this.analyzePatterns(historicalData);
            
            console.log('Model training completed');
            return true;

        } catch (error) {
            console.error('Training error:', error);
            return false;
        }
    }

    // Predict next month's expenses
    async predictNextMonth(currentData) {
        if (!this.isTrained || !this.model) {
            console.log('Model not trained yet');
            return null;
        }

        try {
            // Prepare input features for next month
            const nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1);
            
            const features = [[
                nextDate.getMonth() / 11,
                nextDate.getDate() / 31,
                (nextDate.getFullYear() - 2000) / 50,
                currentData.lastExpense / 1000000 || 0,
                (currentData.activeJobs || 10) / 100
            ]];

            const input = tf.tensor2d(features);
            const prediction = this.model.predict(input);
            const predictedValue = prediction.dataSync()[0] * 1000000; // Denormalize

            // Calculate confidence based on training data variance
            const confidence = this.calculateConfidence(predictedValue);

            return {
                amount: predictedValue,
                month: nextDate.getMonth() + 1,
                year: nextDate.getFullYear(),
                confidence: confidence,
                formattedAmount: this.formatCurrency(predictedValue)
            };

        } catch (error) {
            console.error('Prediction error:', error);
            return null;
        }
    }

    // Predict for multiple months ahead
    async predictMultipleMonths(currentData, months = 3) {
        const predictions = [];
        let tempData = { ...currentData };

        for (let i = 0; i < months; i++) {
            const prediction = await this.predictNextMonth(tempData);
            if (prediction) {
                predictions.push(prediction);
                // Use prediction as lastExpense for next iteration
                tempData.lastExpense = prediction.amount;
            }
        }

        return predictions;
    }

    // Calculate confidence score for prediction
    calculateConfidence(predictedValue) {
        if (!this.trainingData || this.trainingData.length === 0) {
            return 0.5;
        }

        // Calculate variance in training data
        const amounts = this.trainingData.map(d => d.amount);
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);

        // Higher confidence when prediction is within 1 standard deviation of historical mean
        const deviation = Math.abs(predictedValue - mean);
        const confidence = Math.max(0, Math.min(1, 1 - (deviation / (mean * 2))));

        return confidence;
    }

    // Analyze seasonal patterns
    analyzePatterns(historicalData) {
        const monthlyTotals = {};

        historicalData.forEach(item => {
            const date = new Date(item.date);
            const month = date.getMonth();
            
            if (!monthlyTotals[month]) {
                monthlyTotals[month] = [];
            }
            monthlyTotals[month].push(item.amount);
        });

        // Calculate average for each month
        Object.keys(monthlyTotals).forEach(month => {
            const amounts = monthlyTotals[month];
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            this.seasonalPatterns[month] = avg;
        });

        // Detect anomalies
        this.detectAnomalies(historicalData);
    }

    // Detect anomalies in expense data
    detectAnomalies(data) {
        const amounts = data.map(d => d.amount);
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length);

        this.anomalyThresholds = {
            upper: mean + 2 * stdDev,
            lower: Math.max(0, mean - 2 * stdDev)
        };

        // Flag anomalies in the data
        return data.map(item => ({
            ...item,
            isAnomaly: item.amount > this.anomalyThresholds.upper || 
                       item.amount < this.anomalyThresholds.lower
        }));
    }

    // Get expense trends
    getTrends() {
        if (!this.trainingData || this.trainingData.length < 2) {
            return {
                direction: 'stable',
                percentage: 0,
                description: 'Insufficient data for trend analysis'
            };
        }

        // Split data into first half and second half
        const midPoint = Math.floor(this.trainingData.length / 2);
        const firstHalf = this.trainingData.slice(0, midPoint);
        const secondHalf = this.trainingData.slice(midPoint);

        const firstAvg = firstHalf.reduce((a, b) => a + b.amount, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b.amount, 0) / secondHalf.length;

        const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

        let direction = 'stable';
        if (percentChange > 5) direction = 'increasing';
        if (percentChange < -5) direction = 'decreasing';

        return {
            direction: direction,
            percentage: percentChange,
            description: `Expenses are ${direction} by ${Math.abs(percentChange).toFixed(1)}%`
        };
    }

    // Get seasonal insights
    getSeasonalInsights() {
        const insights = [];
        const currentMonth = new Date().getMonth();

        // Compare current month with historical average
        if (this.seasonalPatterns[currentMonth]) {
            const currentMonthAvg = this.seasonalPatterns[currentMonth];
            const overallAvg = Object.values(this.seasonalPatterns).reduce((a, b) => a + b, 0) / 12;

            const ratio = currentMonthAvg / overallAvg;

            if (ratio > 1.2) {
                insights.push({
                    type: 'warning',
                    message: `This month typically has ${Math.round((ratio - 1) * 100)}% higher expenses than average`
                });
            } else if (ratio < 0.8) {
                insights.push({
                    type: 'info',
                    message: `This month typically has ${Math.round((1 - ratio) * 100)}% lower expenses than average`
                });
            }
        }

        return insights;
    }

    // Get budget recommendations
    getBudgetRecommendations(currentBudget, actualSpent) {
        const recommendations = [];

        if (!currentBudget || !actualSpent) return recommendations;

        const ratio = actualSpent / currentBudget;

        if (ratio > 1.1) {
            recommendations.push({
                type: 'critical',
                title: 'Budget Overrun',
                message: `Expenses are ${Math.round((ratio - 1) * 100)}% over budget. Review cost control measures.`,
                action: 'Review Expenses'
            });
        } else if (ratio > 0.9) {
            recommendations.push({
                type: 'warning',
                title: 'Approaching Budget Limit',
                message: `You've used ${Math.round(ratio * 100)}% of your budget. Monitor spending closely.`,
                action: 'View Details'
            });
        } else if (ratio < 0.7) {
            recommendations.push({
                type: 'opportunity',
                title: 'Under Budget',
                message: `You're ${Math.round((1 - ratio) * 100)}% under budget. Consider reallocating funds.`,
                action: 'Reallocate Budget'
            });
        }

        return recommendations;
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Save model to localStorage
    saveModel() {
        if (!this.model) return;

        this.model.save('localstorage://expense-predictor-model');
        localStorage.setItem('ml_training_data', JSON.stringify(this.trainingData));
        localStorage.setItem('ml_seasonal_patterns', JSON.stringify(this.seasonalPatterns));
        
        console.log('Model saved to localStorage');
    }

    // Load model from localStorage
    async loadModel() {
        try {
            const models = await tf.io.listModels();
            if (models['localstorage://expense-predictor-model']) {
                this.model = await tf.loadLayersModel('localstorage://expense-predictor-model');
                
                // Load training data
                const savedData = localStorage.getItem('ml_training_data');
                if (savedData) {
                    this.trainingData = JSON.parse(savedData);
                }
                
                // Load seasonal patterns
                const savedPatterns = localStorage.getItem('ml_seasonal_patterns');
                if (savedPatterns) {
                    this.seasonalPatterns = JSON.parse(savedPatterns);
                }

                this.isTrained = true;
                console.log('Model loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('Error loading model:', error);
        }
        return false;
    }
}

// Create global instance
window.expensePredictor = new ExpensePredictor();