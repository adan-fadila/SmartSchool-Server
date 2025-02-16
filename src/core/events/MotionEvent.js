const Event = require('./Event');

class MotionEvent extends Event {
    constructor(spaceId, roomId, roomName, motionState) {
        super(spaceId, roomId, roomName);
        this.motionState = motionState;
    }

    getType() {
        return 'motion';
    }

    getMotionState() {
        return this.motionState;
    }
}

module.exports = MotionEvent; 