const EventRegistry = require('./registry/EventRegistry');
const ActionRegistry = require('./registry/ActionRegistry');
const RuleRegistry = require('./registry/RuleRegistry');
const Rule = require('./core/Rule');
const { getSensiboSensors } = require('../../../api/sensibo');
const Room = require('../../../models/Room');
const Device = require('../../../models/Device');
const RoomDevice = require('../../../models/RoomDevice');

/**
 * Main interpreter class that manages the entire system
 */
class Interpreter {
    constructor() {
        this.deviceMap = {}; // Map of location names to device information
        this.initialized = false;
    }

    /**
     * Initialize the interpreter
     * Loads device information from the database
     */
    async initialize() {
        try {
            // Load rooms and devices from the database
            await this.loadDeviceMap();
            this.initialized = true;
            console.log('Interpreter initialized successfully');
        } catch (error) {
            console.error('Error initializing interpreter:', error);
            throw error;
        }
    }

    /**
     * Load device information from the database
     */
    async loadDeviceMap() {
        try {
            // Get all rooms from the database
            const rooms = await Room.find({});
            
            // Initialize the device map
            this.deviceMap = {};
            
            // Process each room
            for (const room of rooms) {
                // Get all devices for this room
                const roomDevices = await RoomDevice.find({ room_id: room._id });
                
                // Skip if no devices found
                if (!roomDevices || roomDevices.length === 0) {
                    console.log(`No devices found for room: ${room.name}`);
                    continue;
                }
                
                // Get device details for each room device
                const devices = [];
                for (const roomDevice of roomDevices) {
                    const device = await Device.findById(roomDevice.device_id);
                    if (device) {
                        devices.push({
                            type: device.type.toLowerCase(),
                            deviceId: device._id.toString(),
                            raspberryPiIP: device.raspberryPiIP,
                            name: device.name
                        });
                    }
                }
                
                // Add devices to the map if any were found
                if (devices.length > 0) {
                    this.deviceMap[room.name.toLowerCase()] = devices;
                }
            }
            
            console.log('Device map loaded:', this.deviceMap);
        } catch (error) {
            console.error('Error loading device map:', error);
            throw error;
        }
    }

    /**
     * Create a new rule from a rule string
     * @param {string} ruleString - The rule string to parse
     * @returns {Rule} The created rule
     */
    createRule(ruleString) {
        if (!this.initialized) {
            throw new Error('Interpreter not initialized. Call initialize() first.');
        }
        
        try {
            // Since RuleParser is removed, we need to handle rule creation directly
            // Basic parsing of rule string (if [event] then [action])
            const rulePattern = /if\s+(.+?)\s+then\s+(.+)/i;
            const match = ruleString.match(rulePattern);
            
            if (!match) {
                throw new Error(`Invalid rule format: ${ruleString}`);
            }
            
            const eventStr = match[1].trim();
            const actionStr = match[2].trim();
            
            // Generate a unique rule ID
            const ruleId = `rule_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            // Parse the event
            const event = this.parseEvent(eventStr);
            
            // Parse the action
            const action = this.parseAction(actionStr);
            
            // Create a new rule
            const rule = new Rule(ruleId, event, action, ruleString);
            
            // Register the rule
            RuleRegistry.register(rule);
            
            console.log(`Rule created: ${rule.toString()}`);
            
            return rule;
        } catch (error) {
            console.error('Error creating rule:', error);
            throw error;
        }
    }
    
    /**
     * Parse an event string into an Event object
     * @param {string} eventStr - The event string to parse
     * @returns {Event} The parsed event
     */
    parseEvent(eventStr) {
        // Check for temperature condition
        const tempPattern = /temperature\s+in\s+(.+?)\s+([><]=?|==|!=)\s+(\d+)/i;
        const tempMatch = eventStr.match(tempPattern);
        
        if (tempMatch) {
            const location = tempMatch[1].trim().toLowerCase();
            const operator = tempMatch[2].trim();
            const threshold = parseInt(tempMatch[3].trim(), 10);
            
            // Get the temperature event from the registry
            const event = EventRegistry.getAll().find(e => 
                e.type === 'temperature' && 
                e.location === location
            );
            
            if (!event) {
                // Create a new temperature event
                const TemperatureEvent = require('./events/TemperatureEvent');
                const newEvent = new TemperatureEvent(location, operator, threshold);
                EventRegistry.register(newEvent);
                
                return newEvent;
            }
            
            // Set the condition
            event.operator = operator;
            event.threshold = threshold;
            
            return event;
        }
        
        // Add more event types as needed
        
        throw new Error(`Unsupported event: ${eventStr}`);
    }
    
    /**
     * Parse an action string into an Action object
     * @param {string} actionStr - The action string to parse
     * @returns {Action} The parsed action
     */
    parseAction(actionStr) {
        // Check for AC action
        const acPattern = /ac\s+in\s+(.+?)\s+(on|off)(?:\s+(\d+))?(?:\s+(cool|heat|fan|auto))?/i;
        const acMatch = actionStr.match(acPattern);
        
        if (acMatch) {
            const location = acMatch[1].trim().toLowerCase();
            const state = acMatch[2].trim().toLowerCase();
            const temperature = acMatch[3] ? parseInt(acMatch[3].trim(), 10) : undefined;
            const mode = acMatch[4] ? acMatch[4].trim().toLowerCase() : undefined;
            
            // Find the device in the device map
            if (!this.deviceMap[location]) {
                throw new Error(`No devices found for location: ${location}`);
            }
            
            // Find an AC device in the location
            const acDevice = this.deviceMap[location].find(device => device.type === 'ac');
            
            if (!acDevice) {
                throw new Error(`No AC device found for location: ${location}`);
            }
            
            console.log(`Found AC device for ${location}:`, acDevice);
            
            // Create AC action with device information
            const ACAction = require('./actions/ACAction');
            return new ACAction(location, state, acDevice.deviceId, acDevice.raspberryPiIP, temperature, mode);
        }
        
        // Check for light action
        const lightPattern = /light\s+in\s+(.+?)\s+(on|off)/i;
        const lightMatch = actionStr.match(lightPattern);
        
        if (lightMatch) {
            const location = lightMatch[1].trim().toLowerCase();
            const state = lightMatch[2].trim().toLowerCase();
            
            // Find the device in the device map
            if (!this.deviceMap[location]) {
                throw new Error(`No devices found for location: ${location}`);
            }
            
            // Find a light device in the location
            const lightDevice = this.deviceMap[location].find(device => device.type === 'light');
            
            if (!lightDevice) {
                throw new Error(`No light device found for location: ${location}`);
            }
            
            console.log(`Found light device for ${location}:`, lightDevice);
            
            // Create light action with device information
            const LightAction = require('./actions/LightAction');
            return new LightAction(location, state, lightDevice.deviceId, lightDevice.raspberryPiIP);
        }
        
        // Add more action types as needed
        
        throw new Error(`Unsupported action: ${actionStr}`);
    }

    /**
     * Process sensor data and update events
     * @param {Object} data - The sensor data
     */
    processSensorData(data) {
        if (!this.initialized) {
            console.warn('Interpreter not initialized. Ignoring sensor data.');
            return;
        }
        
        try {
            // Get all events that can handle this sensor type
            const events = EventRegistry.getAll().filter(event => 
                event.canHandleSensorType(data.type) && 
                event.location === data.location
            );
            
            if (events.length === 0) {
                console.log(`No events found for sensor type ${data.type} in location ${data.location}`);
                return;
            }
            
            // Update each event with the sensor data
            for (const event of events) {
                event.updateWithSensorData(data);
            }
            
            console.log(`Updated ${events.length} events with sensor data`);
        } catch (error) {
            console.error('Error processing sensor data:', error);
        }
    }

    /**
     * Process temperature data from Sensibo
     * @param {string} raspberryPiIP - The IP address of the Raspberry Pi
     * @param {string} location - The location the data is for
     */
    async processTemperatureData(raspberryPiIP, location) {
        try {
            // Get sensor data from Sensibo
            const sensorData = await getSensiboSensors(raspberryPiIP);
            
            if (sensorData && sensorData.temperature !== undefined) {
                // Process temperature data
                this.processSensorData({
                    type: 'temperature',
                    location: location.toLowerCase(),
                    temperature: sensorData.temperature
                });
                
                // Process humidity data if available
                if (sensorData.humidity !== undefined) {
                    this.processSensorData({
                        type: 'humidity',
                        location: location.toLowerCase(),
                        humidity: sensorData.humidity
                    });
                }
            }
        } catch (error) {
            console.error('Error processing temperature data:', error);
        }
    }

    /**
     * Process motion data
     * @param {boolean} motionDetected - Whether motion was detected
     * @param {string} location - The location the data is for
     */
    processMotionData(motionDetected, location) {
        try {
            this.processSensorData({
                type: 'motion',
                location: location.toLowerCase(),
                motion: motionDetected
            });
        } catch (error) {
            console.error('Error processing motion data:', error);
        }
    }

    /**
     * Get all rules
     * @returns {Rule[]} Array of all rules
     */
    getAllRules() {
        return RuleRegistry.getAll();
    }

    /**
     * Get a rule by its ID
     * @param {string} ruleId - The ID of the rule to get
     * @returns {Rule|null} The rule, or null if not found
     */
    getRuleById(ruleId) {
        return RuleRegistry.getById(ruleId);
    }

    /**
     * Delete a rule
     * @param {string} ruleId - The ID of the rule to delete
     * @returns {boolean} Whether the rule was deleted
     */
    deleteRule(ruleId) {
        return RuleRegistry.remove(ruleId);
    }

    /**
     * Activate a rule
     * @param {string} ruleId - The ID of the rule to activate
     * @returns {boolean} Whether the rule was activated
     */
    activateRule(ruleId) {
        const rule = RuleRegistry.getById(ruleId);
        if (rule) {
            console.log(`[INTERPRETER] Activating rule: ${rule.toString()}`);
            rule.activate();
            return true;
        }
        console.log(`[INTERPRETER] Rule not found: ${ruleId}`);
        return false;
    }

    /**
     * Deactivate a rule
     * @param {string} ruleId - The ID of the rule to deactivate
     * @returns {boolean} Whether the rule was deactivated
     */
    deactivateRule(ruleId) {
        const rule = RuleRegistry.getById(ruleId);
        if (rule) {
            console.log(`[INTERPRETER] Deactivating rule: ${rule.toString()}`);
            rule.deactivate();
            return true;
        }
        console.log(`[INTERPRETER] Rule not found: ${ruleId}`);
        return false;
    }

    /**
     * Reset all event registrations
     * This is useful when rules are added or removed
     */
    resetEventRegistrations() {
        console.log('[INTERPRETER] Resetting all event registrations...');
        
        // Get all active rules
        const allRules = RuleRegistry.getAll();
        
        // Clear all event registrations
        console.log('[INTERPRETER] Clearing all event registrations...');
        const allEvents = EventRegistry.getAll();
        
        // Detach all observers from all events
        for (const event of allEvents) {
            // Create a copy of the observers array to avoid modification during iteration
            const observers = [...event.observers];
            
            // Detach each observer
            for (const observer of observers) {
                console.log(`[INTERPRETER] Detaching observer ${observer.toString()} from event ${event.getConditionString()}`);
                event.detach(observer);
            }
        }
        
        // Re-register all actions with their events
        console.log('[INTERPRETER] Re-registering all actions with their events...');
        for (const rule of allRules) {
            if (rule.active) {
                console.log(`[INTERPRETER] Re-attaching action for rule: ${rule.toString()}`);
                rule.event.attach(rule.action);
            } else {
                console.log(`[INTERPRETER] Skipping inactive rule: ${rule.toString()}`);
            }
        }
        
        console.log('[INTERPRETER] Event registrations reset complete.');
    }
    
    /**
     * Clear all rules and events
     * This is useful when reloading rules from the database
     */
    clearAll() {
        console.log('[INTERPRETER] Clearing all rules and events...');
        RuleRegistry.clear();
        EventRegistry.clear();
        console.log('[INTERPRETER] All rules and events cleared.');
    }
}

// Create a singleton instance
const instance = new Interpreter();

module.exports = instance; 