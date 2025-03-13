const EventRegistry = require('./registry/EventRegistry');
const ActionRegistry = require('./registry/ActionRegistry');
const RuleRegistry = require('./registry/RuleRegistry');
const RuleParser = require('./parser/RuleParser');
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
            // Parse the rule string
            const { ruleId, event, action, ruleString: parsedRuleString } = RuleParser.parseRule(ruleString, this.deviceMap);
            
            // Create a new rule
            const rule = new Rule(ruleId, event, action, parsedRuleString);
            
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
            rule.activate();
            return true;
        }
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
            rule.deactivate();
            return true;
        }
        return false;
    }
}

// Create a singleton instance
const instance = new Interpreter();

module.exports = instance; 