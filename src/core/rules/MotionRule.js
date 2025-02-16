const Rule = require('./Rule');

class MotionRule extends Rule {
    constructor(roomName, actions) {
        // The condition here is just "motion detected in room"
        super(`motion in ${roomName}`, actions);
        this.roomName = roomName;
    }

    evaluate(sensorState) {
        // sensorState will be the motion detected boolean from MotionSensor
        return sensorState === true;
    }
}

module.exports = MotionRule; 