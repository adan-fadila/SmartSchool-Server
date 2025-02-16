class Rule {
    constructor(condition, actions) {
        this.condition = condition;
        this.actions = Array.isArray(actions) ? actions : [actions];
    }

    evaluate(sensorState) {
        throw new Error('evaluate must be implemented by subclasses');
    }

    async executeActions() {
        for (const action of this.actions) {
            try {
                await action.execute();
            } catch (error) {
                console.error(`Failed to execute action: ${error.message}`);
                // Attempt rollback of previously executed actions
                this.rollbackActions();
            }
        }
    }

    async rollbackActions() {
        for (const action of this.actions) {
            try {
                await action.rollback();
            } catch (error) {
                console.error(`Failed to rollback action: ${error.message}`);
            }
        }
    }
}

module.exports = Rule; 