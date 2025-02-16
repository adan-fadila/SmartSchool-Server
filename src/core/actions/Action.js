class Action {
    constructor(deviceId, state) {
        this.deviceId = deviceId;
        this.state = state;
    }

    async execute() {
        throw new Error('execute must be implemented by subclasses');
    }

    async rollback() {
        throw new Error('rollback must be implemented by subclasses');
    }
}

module.exports = Action; 