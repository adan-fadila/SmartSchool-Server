/**
 * Registry for events in the system
 * Ensures that events are reused when possible
 */
class EventRegistry {
    constructor() {
        this.events = new Map();
    }

    /**
     * Register an event in the registry
     * @param {BaseEvent} event - The event to register
     * @returns {BaseEvent} The registered event (may be a pre-existing one)
     */
    register(event) {
        const eventId = event.getId();
        
        // If an event with this ID already exists, return it
        if (this.events.has(eventId)) {
            return this.events.get(eventId);
        }
        
        // Otherwise, register the new event
        this.events.set(eventId, event);
        return event;
    }

    /**
     * Get an event by its ID
     * @param {string} eventId - The ID of the event to get
     * @returns {BaseEvent|null} The event, or null if not found
     */
    getById(eventId) {
        return this.events.get(eventId) || null;
    }

    /**
     * Get all events of a specific type
     * @param {string} type - The type of events to get
     * @returns {BaseEvent[]} Array of events of the specified type
     */
    getByType(type) {
        return Array.from(this.events.values())
            .filter(event => event.type === type);
    }

    /**
     * Get all events for a specific location
     * @param {string} location - The location to get events for
     * @returns {BaseEvent[]} Array of events for the specified location
     */
    getByLocation(location) {
        return Array.from(this.events.values())
            .filter(event => event.location === location);
    }

    /**
     * Get all registered events
     * @returns {BaseEvent[]} Array of all registered events
     */
    getAll() {
        return Array.from(this.events.values());
    }

    /**
     * Remove an event from the registry
     * @param {string} eventId - The ID of the event to remove
     * @returns {boolean} Whether the event was removed
     */
    remove(eventId) {
        return this.events.delete(eventId);
    }

    /**
     * Clear the registry
     */
    clear() {
        this.events.clear();
    }
}

// Singleton instance
const instance = new EventRegistry();

module.exports = instance; 