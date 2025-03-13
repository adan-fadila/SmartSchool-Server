const BaseEvent = require('../core/BaseEvent');

/**
 * Event that triggers based on motion detection
 */
class MotionEvent extends BaseEvent {
    /**
     * @param {string} location - The location this event applies to
     * @param {boolean} expectedState - The expected motion state (true for motion detected, false for no motion)
     */
    constructor(location, expectedState = true) {
        super('motion', location);
        this.expectedState = expectedState;
        this.currentValue = null;
    }

    /**
     * Get a string representation of the condition
     * @returns {string} String representation of the condition
     */
    getConditionString() {
        return `motion in ${this.location} ${this.expectedState ? 'detected' : 'not detected'}`;
    }

    /**
     * Update the event with new sensor data
     * @param {Object} data - The new sensor data
     * @param {boolean} data.motion - The motion state (true for detected, false for not detected)
     * @param {string} data.location - The location the data is for
     */
    updateWithSensorData(data) {
        // Only process data for this event's location
        if (data.location !== this.location) {
            return;
        }

        // Update the current value
        this.currentValue = Boolean(data.motion);
        
        // Evaluate the condition and update the state
        // The condition is met if the current value matches the expected state
        const newState = this.currentValue === this.expectedState;
        
        // Update the state (will notify observers if changed)
        this.setState(newState);
    }

    /**
     * Get the current motion value
     * @returns {boolean|null} The current motion value, or null if not set
     */
    getCurrentValue() {
        return this.currentValue;
    }
}

module.exports = MotionEvent; 