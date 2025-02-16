class Sensor {
    constructor(spaceId, roomId) {
        this.spaceId = spaceId;
        this.roomId = roomId;
        this.rules = [];
        this.currentState = null;
    }

    updateState(event) {
        throw new Error('updateState must be implemented by subclasses');
    }

    checkRules() {
        this.rules.forEach(rule => {
            if (rule.evaluate(this.currentState)) {
                rule.executeActions();
            }
        });
    }

    addRule(rule) {
        this.rules.push(rule);
    }
}

module.exports = Sensor; 