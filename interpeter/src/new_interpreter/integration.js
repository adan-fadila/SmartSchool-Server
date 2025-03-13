const { Interpreter } = require('./index');
const { StateManager, eventEmitter } = require('../../../statemanager/stateManager');
const { getSensiboSensors } = require('../../../api/sensibo');
const Rule = require('../../../models/Rule'); // Import the Rule model

/**
 * Initialize and integrate the new interpreter with the existing system
 */
async function initializeAndIntegrate() {
    try {
        console.log('Initializing new interpreter...');
        await Interpreter.initialize();
        console.log('New interpreter initialized successfully');
        
        // Check if the device map has been loaded correctly
        console.log('Checking device map...');
        console.log("================================================")
        console.log('Device map:');
        console.log(Interpreter.deviceMap);
        console.log("================================================")
        
        // Add a fallback device map if needed
        if (!Interpreter.deviceMap || Object.keys(Interpreter.deviceMap).length === 0) {
            console.log('No devices found in the database. Using fallback device map.');
            Interpreter.deviceMap = {
                'living room': [
                    {
                        type: 'ac',
                        deviceId: 'JArdX73w', // Using the device ID from handlersController.js
                        raspberryPiIP: '192.168.0.121',
                        name: 'Living Room AC'
                    },
                    {
                        type: 'light',
                        deviceId: 'JArdX73w', // Using the device ID from handlersController.js
                        raspberryPiIP: '192.168.0.121',
                        name: 'Living Room Light'
                    }
                ]
            };
        }
        
        // Check for each location if it has a light device
        for (const location in Interpreter.deviceMap) {
            const devices = Interpreter.deviceMap[location];
            
            // Check if there's an AC device
            const hasAC = devices.some(device => device.type === 'ac');
            
            // If not, add a fallback AC device for the living room
            if (!hasAC && location === 'living room') {
                console.log(`No AC device found for ${location}. Adding fallback AC device.`);
                devices.push({
                    type: 'ac',
                    deviceId: 'JArdX73w', // Using the device ID from handlersController.js
                    raspberryPiIP: '192.168.0.121',
                    name: `${location.charAt(0).toUpperCase() + location.slice(1)} AC`
                });
            }
            
            // Check if there's a light device
            const hasLight = devices.some(device => device.type === 'light');
            
            // If not, add a fallback light device
            if (!hasLight && location === 'living room') {
                console.log(`No light device found for ${location}. Adding fallback light device.`);
                devices.push({
                    type: 'light',
                    deviceId: 'JArdX73w', // Using the device ID from handlersController.js
                    raspberryPiIP: '192.168.0.121',
                    name: `${location.charAt(0).toUpperCase() + location.slice(1)} Light`
                });
            }
        }
        
        console.log('Updated device map:', Interpreter.deviceMap);
        
        // Load rules from the database
        await loadRulesFromDatabase();
        
        // Listen for temperature events from the state manager
        console.log('Setting up event listeners for state manager events...');
        eventEmitter.on('temperatureEvent', (data) => {
            console.log('Temperature event received from state manager:', data);
            
            if (data && data.temperature !== undefined && data.roomName) {
                // Process the temperature data with our new interpreter
                Interpreter.processSensorData({
                    type: 'temperature',
                    location: data.roomName.toLowerCase(),
                    temperature: data.temperature
                });
            }
        });
        
        // Listen for motion events from the state manager
        eventEmitter.on('motionEvent', (data) => {
            console.log('Motion event received from state manager:', data);
            
            if (data && data.motionState !== undefined && data.RoomName) {
                // Process the motion data with our new interpreter
                Interpreter.processSensorData({
                    type: 'motion',
                    location: data.RoomName.toLowerCase(),
                    detected: data.motionState
                });
            }
        });
        
        // Listen for humidity events from the state manager
        eventEmitter.on('humidityEvent', (data) => {
            console.log('Humidity event received from state manager:', data);
            
            if (data && data.humidity !== undefined && data.roomName) {
                // Process the humidity data with our new interpreter
                Interpreter.processSensorData({
                    type: 'humidity',
                    location: data.roomName.toLowerCase(),
                    humidity: data.humidity
                });
            }
        });
        
        // Start active temperature polling
        startTemperaturePolling();
        
        console.log('New interpreter integration complete');
    } catch (error) {
        console.error('Error initializing and integrating new interpreter:', error);
        throw error;
    }
}

/**
 * Load rules from the database
 */
async function loadRulesFromDatabase() {
    try {
        console.log('Loading rules from database...');
        
        // Get all rules from the database
        const rules = await Rule.find({});
        
        if (!rules || rules.length === 0) {
            console.log('No rules found in the database.');
            return;
        }
        
        console.log(`Found ${rules.length} rules in the database.`);
        
        // Clear existing rules first
        console.log('Clearing existing rules...');
        const RuleRegistry = require('./registry/RuleRegistry');
        RuleRegistry.clear();
        console.log('Existing rules cleared.');
        
        // Create each rule in our interpreter
        for (const dbRule of rules) {
            try {
                // Skip inactive rules
                if (dbRule.isActive === false) {
                    console.log(`Skipping inactive rule with ID ${dbRule._id}`);
                    continue;
                }
                
                // Check if the rule has the necessary fields
                if (!dbRule.description) {
                    console.log(`Skipping rule with ID ${dbRule._id} because it has no description.`);
                    continue;
                }
                
                // Use the new event and action fields if available, otherwise use the description
                let ruleText;
                if (dbRule.event && dbRule.action) {
                    console.log(`Creating rule from database using event and action fields: "${dbRule.event}" -> "${dbRule.action}"`);
                    ruleText = `if ${dbRule.event} then ${dbRule.action}`;
                } else {
                    console.log(`Creating rule from database using description: "${dbRule.description}"`);
                    ruleText = dbRule.description;
                    
                    // If the rule starts with "If", remove it and add "if" at the beginning
                    if (ruleText.startsWith('If ')) {
                        ruleText = 'if' + ruleText.substring(2);
                    }
                    
                    // Replace "THEN" with "then" if needed
                    ruleText = ruleText.replace(/\sTHEN\s/i, ' then ');
                }
                
                // Create the rule
                const rule = Interpreter.createRule(ruleText);
                console.log(`Rule created from database: ${rule.toString()}`);
                console.log(`Rule ID: ${rule.id}, Event: ${rule.event.getConditionString()}, Action: ${rule.action.toString()}`);
            } catch (error) {
                console.error(`Error creating rule from database: ${dbRule.description || dbRule.event + ' -> ' + dbRule.action}`, error);
                // Continue with the next rule
            }
        }
        
        // Log all registered rules
        const allRules = Interpreter.getAllRules();
        console.log(`Total rules registered: ${allRules.length}`);
        allRules.forEach((rule, index) => {
            console.log(`Rule ${index + 1}: ${rule.toString()}`);
        });
        
        console.log('Finished loading rules from database.');
    } catch (error) {
        console.error('Error loading rules from database:', error);
    }
}

/**
 * Start active polling for temperature data
 */
function startTemperaturePolling() {
    console.log('Starting active temperature polling...');
    
    // Poll every 30 seconds
    const pollingInterval = 30 * 1000;
    
    // Function to poll temperature data
    const pollTemperature = async () => {
        try {
            console.log('Polling for temperature data...');
            
            // Only poll the living room since that's where the Sensibo device is
            const location = 'living room';
            
            // Get devices for the living room
            const devices = Interpreter.deviceMap[location];
            
            // Skip if no devices
            if (!devices || devices.length === 0) {
                console.log(`No devices found for location: ${location}`);
                return;
            }
            
            // Find an AC device or use the first device
            const device = devices.find(d => d.type === 'ac') || devices[0];
            
            console.log(`Polling temperature for ${location} using device ${device.name} (IP: ${device.raspberryPiIP})`);
            
            // Get sensor data from Sensibo
            const sensorData = await getSensiboSensors(device.raspberryPiIP);
            
            if (sensorData && sensorData.temperature !== undefined) {
                console.log(`[DEBUG] Current temperature in ${location}: ${sensorData.temperature}°C`);
                console.log('[DEBUG] Checking if this temperature will trigger any rules...');
                
                // Log all current rules before processing
                const allRules = Interpreter.getAllRules();
                console.log('[DEBUG] Current active rules:');
                allRules.forEach((rule, index) => {
                    console.log(`[DEBUG] Rule ${index + 1}: ${rule.toString()}`);
                });
                
                // Process the temperature data directly with our interpreter
                console.log('[DEBUG] Processing temperature data with interpreter...');
                console.log(`[DEBUG] Temperature value: ${sensorData.temperature}°C`);
                console.log('[DEBUG] Evaluating rules with this temperature...');
                
                Interpreter.processSensorData({
                    type: 'temperature',
                    location: location,
                    temperature: sensorData.temperature
                });
                
                // Remove the problematic getEvents call
                console.log('[DEBUG] Temperature data processed');
                
                // Also update the state manager to maintain compatibility with the old system
                const temperatureEvent = {
                    event: `temperature in ${location}`,
                    temperature: sensorData.temperature,
                    humidity: sensorData.humidity,
                    roomName: location,
                    // Add other required fields with placeholder values
                    roomId: 'unknown',
                    spaceId: 'unknown',
                    deviceId: device.deviceId,
                    raspberryPiIP: device.raspberryPiIP,
                    user_oid: 'unknown'
                };
                
                // Update the state manager
                console.log('[DEBUG] Updating state manager with temperature event:', temperatureEvent);
                const stateManager = new StateManager();
                stateManager.updateState('temperature', temperatureEvent);
                
                // Process humidity data if available
                if (sensorData.humidity !== undefined) {
                    console.log(`Received humidity data for ${location}: ${sensorData.humidity}%`);
                    
                    Interpreter.processSensorData({
                        type: 'humidity',
                        location: location,
                        humidity: sensorData.humidity
                    });
                    
                    // Also update the state manager
                    const humidityEvent = {
                        event: `humidity in ${location}`,
                        temperature: sensorData.temperature,
                        humidity: sensorData.humidity,
                        roomName: location,
                        // Add other required fields with placeholder values
                        roomId: 'unknown',
                        spaceId: 'unknown',
                        deviceId: device.deviceId,
                        raspberryPiIP: device.raspberryPiIP,
                        user_oid: 'unknown'
                    };
                    
                    stateManager.updateState('humidity', humidityEvent);
                }
            } else {
                console.log(`No temperature data received for ${location}`);
            }
        } catch (error) {
            console.error('Error polling temperature data:', error);
        }
    };
    
    // Start polling immediately
    pollTemperature();
    
    // Set up interval for regular polling
    const intervalId = setInterval(pollTemperature, pollingInterval);
    
    console.log(`Temperature polling started with interval: ${pollingInterval}ms`);
    
    // Return the interval ID so it can be cleared if needed
    return intervalId;
}

// Export the functions
module.exports = {
    initializeAndIntegrate,
    loadRulesFromDatabase
}; 