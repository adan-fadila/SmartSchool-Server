/**
 * Observer interface for the Observer pattern
 * This is implemented by classes that need to be notified of changes in subjects they observe
 */
class Observer {
    /**
     * Method called when the observed subject changes state
     * @param {Subject} subject - The subject that changed state
     */
    update(subject) {
        throw new Error('Method update() must be implemented by subclasses');
    }
}

module.exports = Observer; 