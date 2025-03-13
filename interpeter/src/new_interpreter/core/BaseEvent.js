const Subject = require('./Subject');

/**
 * Base class for all events in the system
 * Events observe sensor data and notify actions when conditions are met
 */
class BaseEvent extends Subject {
    /**
     * @param {string} type - The type of event (e.g., 'temperature', 'motion')
     * @param {string} location - The location this event applies to (e.g., 'living room')
     */
    constructor(type, location) {
        super();
        this.type = type;
        this.location = location;
        this.state = false; // Whether the condition is currently met
        this.lastUpdated = new Date();
    }

    /**
     * Get a unique identifier for this event
     * @returns {string} A unique identifier
     */
    getId() {
        return `${this.type}_${this.location}_${this.getConditionString()}`;
    }

    /**
     * Get a string representation of the condition
     * Must be implemented by subclasses
     * @returns {string} String representation of the condition
     */
    getConditionString() {
        throw new Error('Method getConditionString() must be implemented by subclasses');
    }

    /**
     * Update the event with new sensor data
     * Must be implemented by subclasses
     * @param {any} data - The new sensor data
     */
    updateWithSensorData(data) {
        throw new Error('Method updateWithSensorData() must be implemented by subclasses');
    }

    /**
     * Set the state of the event and notify observers if it changed
     * @param {boolean} newState - The new state
     */
    setState(newState) {
        if (this.state !== newState) {
            console.log(`[EVENT] Event state changed for ${this.type} in ${this.location}: ${this.state} -> ${newState}`);
            this.state = newState;
            this.lastUpdated = new Date();
            
            if (newState) {
                console.log(`[EVENT] Event triggered: ${this.getConditionString()}`);
                console.log(`[EVENT] Notifying ${this.observers.length} observers`);
                
                // Log each observer
                this.observers.forEach((observer, index) => {
                    console.log(`[EVENT] Observer ${index + 1}: ${observer.toString ? observer.toString() : 'Unknown'}`);
                });
            } else {
                console.log(`[EVENT] Event condition no longer met: ${this.getConditionString()}`);
            }
            
            this.notify();
        }
    }

    /**
     * Get the current state of the event
     * @returns {boolean} The current state
     */
    getState() {
        return this.state;
    }

    /**
     * Check if this event can handle the given sensor type
     * @param {string} sensorType - The type of sensor data
     * @returns {boolean} Whether this event can handle the sensor type
     */
    canHandleSensorType(sensorType) {
        return this.type === sensorType;
    }
}

module.exports = BaseEvent; 