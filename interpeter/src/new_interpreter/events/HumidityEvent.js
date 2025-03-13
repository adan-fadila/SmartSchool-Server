const BaseEvent = require('../core/BaseEvent');

/**
 * Event that triggers based on humidity conditions
 */
class HumidityEvent extends BaseEvent {
    /**
     * @param {string} location - The location this event applies to
     * @param {string} operator - The comparison operator ('>', '<', '>=', '<=', '==')
     * @param {number} threshold - The humidity threshold value
     */
    constructor(location, operator, threshold) {
        super('humidity', location);
        this.operator = operator;
        this.threshold = parseFloat(threshold);
        this.currentValue = null;
    }

    /**
     * Get a string representation of the condition
     * @returns {string} String representation of the condition
     */
    getConditionString() {
        const operatorMap = {
            '>': 'is above',
            '<': 'is below',
            '>=': 'is above or equal to',
            '<=': 'is below or equal to',
            '==': 'is equal to'
        };
        
        const readableOperator = operatorMap[this.operator] || this.operator;
        return `humidity in ${this.location} ${readableOperator} ${this.threshold}`;
    }

    /**
     * Update the event with new sensor data
     * @param {Object} data - The new sensor data
     * @param {number} data.humidity - The humidity value
     * @param {string} data.location - The location the data is for
     */
    updateWithSensorData(data) {
        // Only process data for this event's location
        if (data.location !== this.location) {
            return;
        }

        // Update the current value
        this.currentValue = parseFloat(data.humidity);
        
        // Evaluate the condition and update the state
        let newState = false;
        
        switch (this.operator) {
            case '>':
                newState = this.currentValue > this.threshold;
                break;
            case '<':
                newState = this.currentValue < this.threshold;
                break;
            case '>=':
                newState = this.currentValue >= this.threshold;
                break;
            case '<=':
                newState = this.currentValue <= this.threshold;
                break;
            case '==':
                newState = this.currentValue === this.threshold;
                break;
            default:
                console.error(`Unknown operator: ${this.operator}`);
        }
        
        // Update the state (will notify observers if changed)
        this.setState(newState);
    }

    /**
     * Get the current humidity value
     * @returns {number|null} The current humidity value, or null if not set
     */
    getCurrentValue() {
        return this.currentValue;
    }
}

module.exports = HumidityEvent; 