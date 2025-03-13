/**
 * Subject interface for the Observer pattern
 * This is implemented by classes that need to notify observers of state changes
 */
class Subject {
    constructor() {
        this.observers = [];
    }

    /**
     * Attach an observer to this subject
     * @param {Observer} observer - The observer to attach
     */
    attach(observer) {
        const isExist = this.observers.includes(observer);
        if (!isExist) {
            this.observers.push(observer);
        }
    }

    /**
     * Detach an observer from this subject
     * @param {Observer} observer - The observer to detach
     */
    detach(observer) {
        const observerIndex = this.observers.indexOf(observer);
        if (observerIndex !== -1) {
            this.observers.splice(observerIndex, 1);
        }
    }

    /**
     * Notify all observers about a state change
     */
    notify() {
        console.log(`[SUBJECT] Notifying ${this.observers.length} observers`);
        
        for (const observer of this.observers) {
            console.log(`[SUBJECT] Notifying observer: ${observer.toString ? observer.toString() : 'Unknown'}`);
            observer.update(this);
        }
    }
}

module.exports = Subject; 