class EventValidator {
    static validateMotionEvent(event) {
        const required = ['lightState', 'roomId', 'roomName', 'spaceId'];
        for (const field of required) {
            if (!event[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
    }

    static validateTemperatureEvent(event) {
        const required = ['temperature', 'humidity', 'roomId', 'roomName', 'spaceId'];
        for (const field of required) {
            if (!event[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
    }
}

// Export the class
module.exports = EventValidator; 