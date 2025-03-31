const Event = require('./Event');

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
            ...data,
            timestamp: Date.now()
        };
        this.update(stateValue);
    }

    /**
     * Get the current anomaly state
     * @returns {Object} The current anomaly state
     */
    getAnomalyState() {
        return this.currentValue;
    }
}

module.exports = AnomalyEvent; 