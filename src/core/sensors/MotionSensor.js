const Sensor = require('./Sensor');

class MotionSensor extends Sensor {
    constructor(spaceId, roomId) {
        super(spaceId, roomId);
        this.motionDetected = false;
    }

    updateState(event) {
        // ... can be simplified
    }
}

module.exports = MotionSensor; 