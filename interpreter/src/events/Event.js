/**
 * Base Event class for the new interpreter
 * All specific event types will inherit from this class
 */
class Event {
    constructor(name) {
        this.name = name;
        this.observers = []; // Rules that are watching this event
        this.currentValue = null;
    }

    /**
     * Add a rule as an observer to this event
     * @param {Rule} rule - The rule that will observe this event
     */
    addObserver(rule) {
        if (!this.observers.includes(rule)) {
            this.observers.push(rule);
            console.log(`Rule added as observer to event ${this.name}`);
        }
    }

    /**
     * Remove a rule from observers
     * @param {Rule} rule - The rule to remove
     */
    removeObserver(rule) {
        const index = this.observers.indexOf(rule);
        if (index !== -1) {
            this.observers.splice(index, 1);
            console.log(`Rule removed as observer from event ${this.name}`);
        }
    }

    /**
     * Update the current value of the event and notify all observers
     * @param {any} value - The new value of the event
     */
    update(value) {
        this.currentValue = value;
        this.notifyObservers();
    }

    /**
     * Notify all observers (rules) that the event has been updated
     */
    notifyObservers() {
        console.log(`Event ${this.name} notifying ${this.observers.length} observers with value: ${this.currentValue}`);
        this.observers.forEach(rule => {
            rule.evaluate();
        });
    }
}

module.exports = Event; 