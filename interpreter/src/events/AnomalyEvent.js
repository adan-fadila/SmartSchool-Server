const Event = require('./Event');
const { notifyAnomalyDetection } = require('../../../utils/notificationService');

/**
 * Anomaly Event class that extends the base Event
 * Handles different types of anomalies: pointwise, seasonality, and trend
 */
class AnomalyEvent extends Event {
    constructor(name, location, anomalyType, metricType) {
        super(name);
        this.location = location; // e.g. "living room"
        this.type = 'anomaly';
        this.anomalyType = anomalyType; // 'pointwise', 'seasonality', or 'trend'
        this.metricType = metricType; // 'temperature', 'humidity', etc.
        console.log(`Created AnomalyEvent: ${name} for location: ${location}, type: ${anomalyType}, metric: ${metricType}`);
        
        // Initialize with not detected state
        this.updateAnomalyState(false);
        
        // Track previous state to detect changes
        this.previouslyDetected = false;
    }

    /**
     * Update anomaly value (detected or not)
     * @param {boolean} detected - Whether the anomaly is detected or not
     * @param {Object} data - Additional anomaly data
     */
    updateAnomalyState(detected, data = {}) {
        console.log(`Updating anomaly state for ${this.name} to detected=${detected}`);
        const stateValue = {
            detected: detected,
            anomalyType: this.anomalyType,
            metricType: this.metricType,
            location: this.location,
            ...data,
            timestamp: Date.now()
        };
        
        // Check if state changed from not detected to detected
        const stateChanged = !this.previouslyDetected && detected;
        this.previouslyDetected = detected;
        
        // Log more details when anomaly is detected
        if (detected) {
            console.log(`ANOMALY DETECTED: ${this.name} (${this.anomalyType}) at ${this.location} for ${this.metricType}`);
            if (data && data.confidence) {
                console.log(`Confidence: ${data.confidence}`);
            }
            
            // If the state changed to detected, send a notification
            if (stateChanged) {
                this.sendAnomalyNotification(stateValue);
            }
        }
        
        this.update(stateValue);
    }

    /**
     * Get the current anomaly state
     * @returns {Object} The current anomaly state
     */
    getAnomalyState() {
        return this.currentValue;
    }
    
    /**
     * Check if the anomaly is currently detected
     * @returns {boolean} True if anomaly is detected, false otherwise
     */
    isDetected() {
        return this.currentValue && this.currentValue.detected === true;
    }
    
    /**
     * Send a notification about the detected anomaly
     * @param {Object} anomalyData - The anomaly data to include in the notification
     */
    async sendAnomalyNotification(anomalyData) {
        try {
            // Prepare notification data
            const notificationData = {
                name: this.name,
                location: this.location,
                metricType: this.metricType,
                anomalyType: this.anomalyType,
                confidence: anomalyData.confidence,
                timestamp: anomalyData.timestamp
            };
            
            // Send notification using the notification service
            console.log(`Sending notification for anomaly: ${this.name}`);
            await notifyAnomalyDetection(notificationData);
        } catch (error) {
            console.error('Failed to send anomaly notification:', error);
        }
    }
}

module.exports = AnomalyEvent; 