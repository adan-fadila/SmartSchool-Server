const Event = require('./Event');
const { notifyAnomalyDetection } = require('../../../utils/notificationService');
const AnomalyDescription = require('../../../models/AnomalyDescription');

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
        
        // Check if we have any descriptions for this anomaly event
        this.checkForDescriptions();
    }

    /**
     * Check if there are any user-provided descriptions for this anomaly
     */
    async checkForDescriptions() {
        try {
            const descriptions = await AnomalyDescription.find({ 
                rawEventName: this.name,
                isActive: true
            });
            
            if (descriptions && descriptions.length > 0) {
                console.log(`Found ${descriptions.length} descriptions for anomaly ${this.name}`);
                this.hasDescriptions = true;
                this.descriptions = descriptions;
            } else {
                console.log(`No descriptions found for anomaly ${this.name}`);
                this.hasDescriptions = false;
                this.descriptions = [];
            }
        } catch (error) {
            console.error(`Error checking for descriptions for ${this.name}:`, error);
            this.hasDescriptions = false;
            this.descriptions = [];
        }
    }

    /**
     * Update anomaly value (detected or not)
     * @param {boolean} detected - Whether the anomaly is detected or not
     * @param {Object} data - Additional anomaly data
     */
    async updateAnomalyState(detected, data = {}) {
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
            
            // If the state changed to detected, check if we have descriptions
            if (stateChanged) {
                // Refresh the descriptions
                await this.checkForDescriptions();
                
                // Check if we need to trigger rules based on description
                if (this.hasDescriptions) {
                    console.log(`Triggering rules for ${this.descriptions.length} descriptions`);
                    // In a real implementation, we would trigger the rules based on descriptions here
                    // This would require modifying the rule evaluation logic
                }
                
                // Send notification about the anomaly
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
     * Get all descriptions for this anomaly
     * @returns {Array} Array of description objects
     */
    async getDescriptions() {
        await this.checkForDescriptions();
        return this.descriptions;
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
                timestamp: anomalyData.timestamp,
                hasDescriptions: this.hasDescriptions,
                descriptionsCount: this.descriptions ? this.descriptions.length : 0
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