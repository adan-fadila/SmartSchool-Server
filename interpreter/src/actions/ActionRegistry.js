const ACAction = require('./ACAction');
const LightAction = require('./LightAction');
const SMSAction = require('./SMSAction');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Registry for all available action types and instances
 */
class ActionRegistry {
    constructor() {
        // Map of action types by name
        this.actionTypes = new Map([
            ['ac', ACAction],
            ['light', LightAction],
            ['sms', SMSAction]
            // Add more action types here as they are implemented
        ]);
        
        // Map of action instances by name
        this.actions = new Map();
        
        // Map to track device states
        this.deviceStates = new Map();
        
        console.log('Active devices found:', this.deviceStates.size);
        console.log('Devices state map:', this.deviceStates);
    }

    /**
     * Get the current state of a device
     * @param {string} deviceId - The ID of the device
     * @param {string} [deviceType='ac'] - The type of device
     * @returns {Object|null} The current state or null if not found
     */
    getDeviceState(deviceId, deviceType = 'ac') {
        const key = `${deviceType}_${deviceId}`;
        return this.deviceStates.get(key) || null;
    }
    
    /**
     * Update the state of a device
     * @param {string} deviceId - The ID of the device
     * @param {Object} state - The new state object
     * @param {string} [deviceType='ac'] - The type of device
     */
    updateDeviceState(deviceId, state, deviceType = 'ac') {
        const key = `${deviceType}_${deviceId}`;
        const currentTime = new Date().toISOString();
        
        // If there's an existing state, merge with it
        const currentState = this.deviceStates.get(key) || {};
        const newState = {
            ...currentState,
            ...state,
            lastUpdated: currentTime
        };
        
        this.deviceStates.set(key, newState);
        console.log(`[ACTION REGISTRY] Updated state for ${deviceType} ${deviceId}:`, newState);
    }
    
    /**
     * Check if a state change is needed
     * @param {string} deviceId - The ID of the device
     * @param {Object} targetState - The desired state
     * @param {string} [deviceType='ac'] - The type of device
     * @returns {boolean} True if state change is needed, false if states match
     */
    isStateChangeNeeded(deviceId, targetState, deviceType = 'ac') {
        const currentState = this.getDeviceState(deviceId, deviceType);
        
        // If no current state, change is needed
        if (!currentState) {
            console.log(`[ACTION REGISTRY] No current state for ${deviceType} ${deviceId}, change needed`);
            return true;
        }
        
        // For AC: compare power state, temperature and mode
        if (deviceType === 'ac') {
            const powerChanged = currentState.state !== targetState.state;
            
            // Check temperature only if a target temperature is specified
            const tempChanged = targetState.temperature !== null && 
                               currentState.temperature !== targetState.temperature;
            
            // Check mode only if a target mode is specified
            const modeChanged = targetState.mode !== null && 
                               currentState.mode !== targetState.mode;
            
            console.log(`[ACTION REGISTRY] State comparison for ${deviceType} ${deviceId}:`, {
                current: {
                    power: currentState.state,
                    temp: currentState.temperature,
                    mode: currentState.mode
                },
                target: {
                    power: targetState.state,
                    temp: targetState.temperature,
                    mode: targetState.mode
                },
                changes: {
                    power: powerChanged,
                    temp: tempChanged,
                    mode: modeChanged
                }
            });
            
            return powerChanged || tempChanged || modeChanged;
        }
        
        // For other devices: simple state comparison
        return currentState.state !== targetState.state;
    }

    /**
     * Initialize the ActionRegistry by loading action instances from all Raspberry Pis
     * @returns {Promise<Array>} Array of loaded actions
     */
    async initializeActions() {
        try {
            console.log('[ACTION REGISTRY] Initializing actions...');
            
            // Load Raspberry Pi configuration - temp config till we have a proper config
            const configPath = path.join(__dirname, '../../../api/endpoint/rasp_pi.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            const raspPiIPs = Object.keys(config);
            
            // Fetch actions from each Raspberry Pi
            const actionPromises = raspPiIPs.map(ip => this.fetchActionsFromRaspberryPi(ip, config[ip]));
            const actionResults = await Promise.allSettled(actionPromises);
            
            // Process results
            let totalActions = 0;
            actionResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    totalActions += result.value.length;
                }
            });
            
            console.log(`[ACTION REGISTRY] Initialized ${this.actions.size} actions from ${raspPiIPs.length} Raspberry Pis`);
            
            // Log all registered actions
            this.actions.forEach(action => {
                console.log(`[ACTION REGISTRY] - ${action.name} (${action.type}) in ${action.location}`);
            });
            
            // Fetch current device states
            await this.fetchCurrentDeviceStates(raspPiIPs, config);
            
            return Array.from(this.actions.values());
        } catch (error) {
            console.error('[ACTION REGISTRY] Error initializing actions:', error);
            throw error;
        }
    }
    
    /**
     * Fetch current states of all devices from Raspberry Pis
     * @param {Array<string>} raspPiIPs - Array of Raspberry Pi IP addresses
     * @param {Object} config - Configuration mapping IPs to endpoints
     */
    async fetchCurrentDeviceStates(raspPiIPs, config) {
        try {
            console.log('[ACTION REGISTRY] Fetching current device states...');
            
            // For each Raspberry Pi, fetch the state of devices
            for (const ip of raspPiIPs) {
                const endpoint = config[ip];
                
                try {
                    // Fetch AC states
                    const { switchAcState, getAcState } = require('../../../api/sensibo');
                    const acState = await getAcState(ip, process.env.SENSIBO_DEVICE_ID);
                    
                    if (acState) {
                        console.log('[ACTION REGISTRY] Retrieved AC state:', acState);
                        
                        // Create and save AC state - map API fields to our expected structure
                        const state = {
                            state: acState.on === true,
                            temperature: acState.targetTemperature, // Use targetTemperature from API
                            mode: acState.mode
                        };
                        
                        console.log('[ACTION REGISTRY] Storing mapped AC state:', state);
                        this.updateDeviceState(process.env.SENSIBO_DEVICE_ID, state, 'ac');
                    }
                } catch (error) {
                    console.error(`[ACTION REGISTRY] Error fetching AC state from ${ip}:`, error.message);
                }
                
                // Fetch states of other device types as needed
                // ...
            }
            
            console.log('[ACTION REGISTRY] Device states initialized:', this.deviceStates.size);
        } catch (error) {
            console.error('[ACTION REGISTRY] Error fetching device states:', error);
        }
    }

    /**
     * Fetch actions from a Raspberry Pi
     * @param {string} ip - The IP address of the Raspberry Pi
     * @param {string} endpoint - The ngrok endpoint for the Raspberry Pi
     * @returns {Promise<Array>} Array of loaded actions
     */
    async fetchActionsFromRaspberryPi(ip, endpoint) {
        try {
            console.log(`[ACTION REGISTRY] Fetching actions from Raspberry Pi at ${ip}`);
            
            // Call the get_actions endpoint
            const response = await axios.get(`${endpoint}/api-actuators/get_actions`);
            
            if (!response.data || !response.data.success || !Array.isArray(response.data.actions)) {
                console.warn(`[ACTION REGISTRY] Invalid response from ${ip}`);
                return [];
            }
            
            // Process each action
            const actions = response.data.actions;
            console.log(`[ACTION REGISTRY] Received ${actions.length} actions from ${ip}`);
            
            const createdActions = [];
            
            for (const actionData of actions) {
                const { name, type, location } = actionData;
                
                // Skip if missing required fields
                if (!name || !type) {
                    console.warn(`[ACTION REGISTRY] Skipping action with missing data: ${JSON.stringify(actionData)}`);
                    continue;
                }
                
                // Use location from the action or extract it from name
                const actionLocation = location || this.extractLocationFromName(name);
                
                // Create action instances based on type
                const ActionClass = this.actionTypes.get(type.toLowerCase());
                if (ActionClass) {
                    // Pass the type from the API to the constructor
                    const action = new ActionClass(name, actionLocation, type.toLowerCase());
                    this.registerAction(action);
                    createdActions.push(action);
                } else {
                    console.warn(`[ACTION REGISTRY] Unknown action type: ${type}`);
                }
            }
            
            console.log(`[ACTION REGISTRY] Created ${createdActions.length} actions from ${ip}`);
            return createdActions;
        } catch (error) {
            console.error(`[ACTION REGISTRY] Error fetching actions from ${ip}:`, error);
            return [];
        }
    }

    /**
     * Extract location from an action name
     * @param {string} name - The action name
     * @returns {string} The extracted location
     */
    extractLocationFromName(name) {
        // Typically action names are in format "Location Device" (e.g., "Living Room AC")
        // Extract location by removing the device type
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('ac')) {
            return name.replace(/\s+ac$/i, '').trim();
        } else if (lowerName.includes('light')) {
            return name.replace(/\s+light$/i, '').trim();
        }
        
        // If can't extract, return the full name
        return name;
    }

    /**
     * Register an action in the registry
     * @param {Action} action - The action to register
     */
    registerAction(action) {
        this.actions.set(action.name, action);
        console.log(`[ACTION REGISTRY] Registered action: ${action.name} (${action.type}) in ${action.location}`);
    }

    /**
     * Find appropriate actions for a rule
     * @param {Rule} rule - The rule to find actions for
     * @returns {Array<Action>} Array of matching actions
     */
    findActionsForRule(rule) {
        const matchingActions = [];
        
        this.actions.forEach(action => {
            console.log("actionString::   ",rule.actionString);
            if (action.canHandleAction(rule.actionString)) {
                matchingActions.push(action);
            }
        });
        
        console.log(`[ACTION REGISTRY] Found ${matchingActions.length} actions for rule: ${rule.id}`);
        return matchingActions;
    }

    /**
     * Connect a rule to matching actions
     * @param {Rule} rule - The rule to connect
     * @returns {Array<Action>} Array of actions now observing the rule
     */
    connectRuleToActions(rule) {
        // Find actions that match this rule
        const matchingActions = this.findActionsForRule(rule);
        
        // Make each action observe the rule
        matchingActions.forEach(action => {
            action.observeRule(rule);
        });
        
        return matchingActions;
    }

    /**
     * Disconnect a rule from all actions
     * @param {Rule} rule - The rule to disconnect
     */
    disconnectRuleFromActions(rule) {
        this.actions.forEach(action => {
            action.stopObservingRule(rule);
        });
    }

    /**
     * Get all registered actions
     * @returns {Array<Action>} Array of all action instances
     */
    getAllActions() {
        return Array.from(this.actions.values());
    }

    /**
     * Get an action by name
     * @param {string} name - The name of the action to get
     * @returns {Action|undefined} The action instance or undefined if not found
     */
    getAction(name) {
        return this.actions.get(name);
    }

    /**
     * Test an action string without creating a rule
     * @param {string} actionString - The action string to test
     * @param {Object} [context={}] - Optional context for execution
     * @returns {Promise<Object>} Result of the action execution
     */
    async testExecuteAction(actionString, context = {}) {
        try {
            console.log(`[ACTION REGISTRY] Testing action: ${actionString}`);
            
            // Find a matching action
            let matchingAction = null;
            
            // Try to find an exact match for the action string
            for (const action of this.actions.values()) {
                if (action.canHandleAction(actionString)) {
                    matchingAction = action;
                    console.log(`[ACTION REGISTRY] Found matching action: ${action.name} (${action.type})`);
                    break;
                }
            }
            
            if (!matchingAction) {
                // If no match found, try more fuzzy matching
                // TODO: Implement more sophisticated fuzzy matching if needed
                console.log(`[ACTION REGISTRY] No matching action found for: ${actionString}`);
                return { success: false, message: 'No matching action found' };
            }
            
            // Parse the action string
            matchingAction.parseActionString(actionString);
            
            // Execute the action with the provided context
            const result = await matchingAction.execute(context);
            
            console.log(`[ACTION REGISTRY] Action executed with result:`, result);
            return { success: result.success, message: result.message };
        } catch (error) {
            console.error(`[ACTION REGISTRY] Error executing action: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Execute an action string by finding matching actions
     * @param {string} actionString - The action string to execute
     * @returns {Promise<Object>} Result of the action execution
     */
    async executeAction(actionString) {
        console.log(`[ACTION REGISTRY] Executing action: ${actionString}`);
        
        // Find the first action that can handle this string
        let matchingAction = null;
        
        for (const action of this.actions.values()) {
            if (action.canHandleAction(actionString)) {
                matchingAction = action;
                break;
            }
        }
        
        if (!matchingAction) {
            return { 
                success: false, 
                message: `No action found that can handle: ${actionString}` 
            };
        }
        
        try {
            // Pre-parse the action string for better performance
            const parsedParams = matchingAction.preParseActionString(actionString);
            
            // Apply the parsed parameters to the action
            matchingAction.state = parsedParams.state;
            matchingAction.params = parsedParams.params;
            
            console.log(`[ACTION REGISTRY] Pre-parsed action parameters: ${JSON.stringify(parsedParams)}`);
            
            // Execute the action
            return await matchingAction.execute();
        } catch (error) {
            console.error(`[ACTION REGISTRY] Error executing action: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}

// Create a singleton instance
const actionRegistry = new ActionRegistry();

module.exports = actionRegistry; 