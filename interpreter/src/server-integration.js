const { initialize } = require('./index');
const EventRegistry = require('./events/EventRegistry');
const RuleManager = require('./rules/RuleManager');
const fs = require('fs').promises;
const path = require('path');
const Rule = require('../../models/Rule'); // Import the MongoDB Rule model
const ActionRegistry = require('./actions/ActionRegistry');
const sensorLoggingService = require('../../services/sensor-logging.service');

let interpreterInitialized = false;
let sensorPollingInterval = null;

/**
 * Initialize the interpreter when the server starts
 * @returns {Promise<boolean>} True if initialization successful, false otherwise
 */
async function initializeInterpreter() {
    try {
        if (interpreterInitialized) {
            console.log('Interpreter already initialized');
            return true;
        }

        console.log('Initializing interpreter on server start...');
        await initialize();
        
        // After the interpreter initializes, initialize the action registry
        console.log('Initializing actions registry...');
        await ActionRegistry.initializeActions();
        
        // Then load existing rules from MongoDB
        await loadRulesFromDatabase();
        
        // Initialize sensor logging service
        await initializeSensorLogging();
        
        interpreterInitialized = true;
        console.log('Interpreter initialized successfully');
        
        // Try to start sensor polling automatically
        await startSensorPolling();
        
        return true;
    } catch (error) {
        console.error('Failed to initialize interpreter:', error);
        return false;
    }
}

/**
 * Initialize the sensor logging service
 * @returns {Promise<Object>} Result of the initialization
 */
async function initializeSensorLogging() {
    try {
        console.log('Initializing sensor logging service...');
        
        // Get all event names from the registry
        const events = EventRegistry.getAllEvents();
        const eventNames = events.map(event => event.name);
        
        console.log(`Initializing logging for ${eventNames.length} events:`, eventNames);
        
        // Initialize the logging service with these event names
        const result = await sensorLoggingService.initialize(eventNames);
        
        if (result.success) {
            console.log('Sensor logging service initialized successfully');
        } else {
            console.error('Failed to initialize sensor logging service:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('Error initializing sensor logging service:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Load existing rules from MongoDB and add them to the interpreter
 */
async function loadRulesFromDatabase() {
    try {
        console.log('Loading rules from database...');
        
        // Fetch all active rules from the database
        const dbRules = await Rule.find({ isActive: true });
        console.log(`Found ${dbRules.length} active rules in database`);
        
        // Rules that were successfully loaded
        const loadedRules = [];
        // Rules that could not be parsed
        const failedRules = [];
        
        // Process each rule
        for (const dbRule of dbRules) {
            try {
                // Try to use description first, then condition if description is empty
                const ruleString = dbRule.description || dbRule.condition;
                
                if (!ruleString) {
                    console.log(`Skipping rule ID ${dbRule.id}: No rule text found`);
                    failedRules.push({ id: dbRule.id, reason: 'No rule text found' });
                    continue;
                }
                
                console.log(`Processing rule: ${ruleString}`);
                
                // Try to parse the rule to check if it matches our format
                if (isValidRuleFormat(ruleString)) {
                    // Create rule in our interpreter
                    const ruleId = RuleManager.createRule(ruleString);
                    
                    // Update the database record with the interpreter rule ID
                    await Rule.updateOne(
                        { _id: dbRule._id },
                        { 
                            $set: { 
                                interpreterId: ruleId,
                                ruleString: ruleString
                            }
                        }
                    );
                    
                    console.log(`Loaded rule from database: ${ruleString} (ID: ${ruleId})`);
                    loadedRules.push({ id: dbRule.id, ruleId, ruleString });
                } else {
                    console.log(`Rule rejected - does not match required format: ${ruleString}`);
                    failedRules.push({ id: dbRule.id, reason: 'Invalid format', ruleString });
                }
            } catch (error) {
                console.error(`Error processing rule ${dbRule.id}:`, error);
                failedRules.push({ id: dbRule.id, reason: error.message, ruleString: dbRule.description || dbRule.condition });
            }
        }
        
        console.log(`Successfully loaded ${loadedRules.length} rules into interpreter`);
        if (failedRules.length > 0) {
            console.log(`Failed to load ${failedRules.length} rules:`);
            failedRules.forEach(fail => {
                console.log(`- Rule ${fail.id}: ${fail.reason} (${fail.ruleString || 'no text'})`);
            });
        }
        
        return { loadedRules, failedRules };
    } catch (error) {
        console.error('Error loading rules from database:', error);
        throw error;
    }
}

/**
 * Check if a rule string matches our required format: [event][condition] then [action]
 * @param {string} ruleString - The rule string to check
 * @returns {boolean} True if the rule matches our format, false otherwise
 */
function isValidRuleFormat(ruleString) {
    if (!ruleString) return false;
    
    // Normalize rule string to lowercase for consistent matching
    const normalizedRule = ruleString.toLowerCase();
    
    // Basic check for "if" and "then" keywords - case insensitive
    const ifThenPattern = /if\s+(.+?)\s+then\s+(.+)/i;
    const ifThenMatch = normalizedRule.match(ifThenPattern);
    
    if (!ifThenMatch) return false;
    
    // Check that condition part has an operator
    const conditionPart = ifThenMatch[1].trim();
    const operatorPattern = /(.+?)\s+([<>=!]+)\s+(.+)/;
    const operatorMatch = conditionPart.match(operatorPattern);
    
    return !!operatorMatch;
}

/**
 * Start polling sensors to update events
 * @param {number} interval - Polling interval in milliseconds (default: 30000)
 * @returns {boolean} True if polling started successfully, false otherwise
 */
async function startSensorPolling(interval = 30000) {
    try {
        if (!interpreterInitialized) {
            console.warn('Cannot start sensor polling: Interpreter not initialized');
            return false;
        }
        
        // Stop any existing polling
        stopSensorPolling();
        
        // Load Raspberry Pi configuration
        const configPath = path.join(__dirname, '../../api/endpoint/rasp_pi.json');
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        const raspPiIPs = Object.keys(config);
        if (raspPiIPs.length === 0) {
            console.warn('No Raspberry Pi IPs found in configuration');
            return false;
        }
        
        // For simplicity, use the first Raspberry Pi IP
        const raspPiIP = raspPiIPs[0];
        
        console.log(`Starting sensor polling for Raspberry Pi at ${raspPiIP} with interval ${interval}ms`);
        
        // Import the service here to avoid circular dependencies
        const interpreterSensorService = require('../../services/interpreter-sensor.service');
        
        interpreterSensorService.startSensorPolling(raspPiIP, interval);
        return true;
    } catch (error) {
        console.error('Error starting sensor polling:', error);
        return false;
    }
}

/**
 * Stop sensor polling
 * @returns {boolean} True if polling was stopped, false otherwise
 */
function stopSensorPolling() {
    // Import the service here to avoid circular dependencies
    const interpreterSensorService = require('../../services/interpreter-sensor.service');
    
    const result = interpreterSensorService.stopSensorPolling();
    return result.success;
}

/**
 * Create a new rule
 * @param {string} ruleString - The rule string in natural language format
 * @returns {Object} Object with rule ID and success status
 */
function createRule(ruleString) {
    try {
        if (!interpreterInitialized) {
            return { success: false, error: 'Interpreter not initialized' };
        }

        const ruleId = RuleManager.createRule(ruleString);
        return { success: true, ruleId };
    } catch (error) {
        console.error('Error creating rule:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all available events
 * @returns {Array} Array of event objects
 */
function getAvailableEvents() {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const events = EventRegistry.getAllEvents();
    const eventInfoList = events.map(event => ({
        name: event.name,
        type: event.type,
        location: event.location,
        currentValue: event.currentValue
    }));

    return { success: true, events: eventInfoList };
}

/**
 * Get all rules
 * @returns {Array} Array of rule objects
 */
function getAllRules() {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const rules = RuleManager.getAllRules();
    const ruleInfoList = rules.map(rule => ({
        id: rule.id,
        ruleString: rule.ruleString,
        active: rule.active,
        eventName: rule.eventName,
        condition: rule.condition,
        actionString: rule.actionString
    }));

    return { success: true, rules: ruleInfoList };
}

/**
 * Delete a rule
 * @param {string} ruleId - The ID of the rule to delete
 * @returns {Object} Object with success status
 */
function deleteRule(ruleId) {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const success = RuleManager.deleteRule(ruleId);
    return { success };
}

/**
 * Activate or deactivate a rule
 * @param {string} ruleId - The ID of the rule
 * @param {boolean} active - True to activate, false to deactivate
 * @returns {Object} Object with success status
 */
function setRuleActive(ruleId, active) {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const success = active 
        ? RuleManager.activateRule(ruleId) 
        : RuleManager.deactivateRule(ruleId);
    
    return { success };
}

/**
 * Update an event value (for testing or manual triggering)
 * @param {string} eventName - The name of the event to update
 * @param {any} value - The new value for the event
 * @returns {Object} Object with success status
 */
function updateEventValue(eventName, value) {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const event = EventRegistry.getEvent(eventName);
    if (!event) {
        return { success: false, error: `Event ${eventName} not found` };
    }

    if (event.type === 'temperature') {
        event.updateTemperature(value);
    } else if (event.type === 'humidity') {
        event.updateHumidity(value);
    } else {
        event.update(value);
    }

    return { 
        success: true, 
        eventName, 
        type: event.type, 
        newValue: value 
    };
}

/**
 * Test an action string without creating a rule
 * @param {string} actionString - The action string to test
 * @returns {Promise<Object>} Result of the action execution
 */
async function testAction(actionString) {
    try {
        if (!interpreterInitialized) {
            return { success: false, error: 'Interpreter not initialized' };
        }

        console.log(`Testing action: ${actionString}`);
        
        const result = await ActionRegistry.testExecuteAction(actionString);
        return { success: true, result };
    } catch (error) {
        console.error('Error testing action:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all available actions
 * @returns {Array} Array of action objects
 */
function getAvailableActions() {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const actions = ActionRegistry.getAllActions();
    const actionInfoList = actions.map(action => ({
        name: action.name,
        type: action.type,
        location: action.location
    }));

    return { success: true, actions: actionInfoList };
}

/**
 * Get the current states of all devices
 * @returns {Object} Object with device states
 */
function getDeviceStates() {
    if (!interpreterInitialized) {
        return { success: false, error: 'Interpreter not initialized' };
    }

    const deviceStates = {};
    
    // Convert Map to an object for API response
    ActionRegistry.deviceStates.forEach((state, key) => {
        deviceStates[key] = state;
    });
    
    return { 
        success: true, 
        deviceStates,
        count: ActionRegistry.deviceStates.size 
    };
}

/**
 * Check if the interpreter is initialized
 * @returns {boolean} True if initialized, false otherwise
 */
function isInterpreterInitialized() {
    return interpreterInitialized;
}

/**
 * Stop the interpreter
 * @returns {boolean} True if stopped, false otherwise
 */
function stopInterpreter() {
    if (!interpreterInitialized) {
        return false;
    }
    
    // Stop sensor polling
    stopSensorPolling();
    
    // Reset state
    interpreterInitialized = false;
    console.log('Interpreter stopped');
    
    return true;
}

module.exports = {
    initializeInterpreter,
    isInterpreterInitialized,
    stopInterpreter,
    startSensorPolling,
    stopSensorPolling,
    getEvents: getAvailableEvents,
    getActions: getAvailableActions,
    getRules: getAllRules,
    createRule,
    deleteRule,
    setRuleActive,
    testExecuteAction: testAction,
    updateEventValue,
    getDeviceStates
}; 