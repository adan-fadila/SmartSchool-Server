const Event = require('./Event');
const logger = require('../../../logger'); // Import your logger

/**
 * Motion Event class that extends the base Event
 * Specific for handling motion detection related events
 */
class MotionEvent extends Event {
    constructor(name, location) {
        super(name);
        this.location = location; // e.g. "Front Door"
        this.type = 'motion';
        logger.info(`Created MotionEvent: ${name} for location: ${location}`);
    }

    /**
     * Update motion detection state
     * @param {boolean} motionDetected - True if motion detected, false otherwise
     */
    updateMotion(motionDetected) {
        const stateText = motionDetected ? 'Detected' : 'Not Detected';
        logger.info(`Updating motion state for ${this.name}: ${stateText}`);
        this.update(motionDetected);
    }

    /**
     * Get the current motion detection state
     * @returns {boolean} Current motion detected state
     */
    getMotionState() {
        logger.debug(`Retrieving motion state for ${this.name}: ${this.currentValue}`);
        return this.currentValue;
    }
}

module.exports = MotionEvent;
