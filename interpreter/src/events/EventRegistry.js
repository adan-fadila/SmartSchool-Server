const axios = require('axios');
const TemperatureEvent = require('./TemperatureEvent');
const HumidityEvent = require('./HumidityEvent');

/**
 * Registry for managing all events in the system
 */
class EventRegistry {
    constructor() {
        this.events = new Map(); // Map of event name to event instance
        this.raspiEndpoints = new Map(); // Map of Raspberry Pi IPs to their endpoints
        
        // Map of event types to their corresponding classes
        this.eventTypes = new Map([
            ['temperature', TemperatureEvent],
            ['humidity', HumidityEvent]
            // Add more event types here as they are implemented
        ]);
    }

    /**
     * Load Raspberry Pi endpoints from configuration
     * @param {Object} config - Configuration object with Raspberry Pi IP to endpoint mapping
     */
    loadRaspiEndpoints(config) {
        Object.entries(config).forEach(([ip, endpoint]) => {
            this.raspiEndpoints.set(ip, endpoint);
            console.log(`Loaded Raspberry Pi endpoint: ${ip} -> ${endpoint}`);
        });
    }

    /**
     * Initialize events by fetching them from all connected Raspberry Pis
     */
    async initializeEvents() {
        try {
            for (const [ip, endpoint] of this.raspiEndpoints.entries()) {
                console.log(`Fetching events from Raspberry Pi at ${ip} (${endpoint})`);
                await this.fetchEventsFromRaspberryPi(endpoint);
            }
            console.log('All events initialized successfully');
        } catch (error) {
            console.error('Error initializing events:', error);
        }
    }

    /**
     * Fetch events from a specific Raspberry Pi
     * @param {string} endpoint - The endpoint URL of the Raspberry Pi
     */
    async fetchEventsFromRaspberryPi(endpoint) {
        try {
            const response = await axios.get(`${endpoint}/api-sensors/get_events`, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.data.success && Array.isArray(response.data.events)) {
                this.createEventInstances(response.data.events);
            } else {
                console.error('Failed to get events, response:', response.data);
            }
        } catch (error) {
            console.error(`Error fetching events from ${endpoint}:`, error);
        }
    }

    /**
     * Create event instances based on fetched event names
     * @param {Array<string>} eventNames - List of event names from Raspberry Pi
     */
    createEventInstances(eventNames) {
        eventNames.forEach(eventName => {
            // Parse event name to extract location and type
            const parts = this.parseEventName(eventName);
            
            if (!parts) {
                console.warn(`Could not parse event name: ${eventName}`);
                return;
            }

            const { location, type } = parts;
            const lowerType = type.toLowerCase();
            
            // Create appropriate event instance based on type using the map
            const EventClass = this.eventTypes.get(lowerType);
            
            if (EventClass) {
                const event = new EventClass(eventName, location);
                this.registerEvent(event);
            } else {
                console.warn(`Unknown event type: ${type} for event ${eventName}`);
            }
        });
    }

    /**
     * Parse event name to extract location and type
     * @param {string} eventName - Raw event name from Raspberry Pi (e.g. "Living Room Temperature")
     * @returns {Object|null} Object with location and type, or null if parsing failed
     */
    parseEventName(eventName) {
        // Simple parsing that assumes format like "Living Room Temperature" or "Kitchen Humidity"
        const lastSpace = eventName.lastIndexOf(' ');
        if (lastSpace === -1) return null;

        const location = eventName.substring(0, lastSpace);
        const type = eventName.substring(lastSpace + 1);

        return { location, type };
    }

    /**
     * Register an event in the registry
     * @param {Event} event - Event instance to register
     */
    registerEvent(event) {
        if (!this.events.has(event.name)) {
            this.events.set(event.name, event);
            console.log(`Registered event: ${event.name}`);
        } else {
            console.warn(`Event ${event.name} already registered`);
        }
    }

    /**
     * Get an event by name
     * @param {string} eventName - Name of the event to retrieve
     * @returns {Event|undefined} The event instance or undefined if not found
     */
    getEvent(eventName) {
        // Try exact match first
        if (this.events.has(eventName)) {
            return this.events.get(eventName);
        }
        
        // Try case-insensitive match if exact match fails
        const lowerCaseEventName = eventName.toLowerCase();
        for (const [key, event] of this.events.entries()) {
            if (key.toLowerCase() === lowerCaseEventName) {
                console.log(`Case-insensitive match found for event: ${eventName} -> ${key}`);
                return event;
            }
        }
        
        return undefined;
    }

    /**
     * Get all registered events
     * @returns {Array<Event>} Array of all event instances
     */
    getAllEvents() {
        return Array.from(this.events.values());
    }
}

module.exports = new EventRegistry(); // Export a singleton instance 