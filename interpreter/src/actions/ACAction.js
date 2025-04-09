const Action = require('./Action');
const { switchAcState } = require('../../../api/sensibo');
const roomService = require('../../../services/rooms.service');
const fs = require('fs').promises;
const path = require('path');

/**
 * Action class for controlling AC units
 * Can handle actions like:
 * - living room ac on
 * - living room ac off
 * - living room ac on 22 cool
 */
class ACAction extends Action {
    /**
     * Constructor for the ACAction class
     * @param {string} name - The name of the action (e.g., "Living Room AC")
     * @param {string} location - The location of this action (room name)
     * @param {string} [type='ac'] - The type of this action from API
     */
    constructor(name, location, type = 'ac') {
        super(name, type, location);
    }

    /**
     * Parse the action string into components
     * @param {string} actionString - The action string to parse
     */
    parseActionString(actionString) {
        // Reset parameters
        this.state = false;
        this.params = {
            temperature: null,
            mode: 'cool'  // Default mode
        };

        // Parse the action string
        // Expected format: "[location] ac [on/off] [temperature?] [mode?]"
        // Examples: "living room ac on", "bedroom ac off", "living room ac on 22 cool"
        const parts = actionString.toLowerCase().trim().split(' ');
        
        // Find the index of "ac" to separate location and commands
        const acIndex = parts.findIndex(part => part === 'ac');
        
        if (acIndex === -1) {
            this.logAction(`Invalid AC action format: ${actionString}`);
            return;
        }
        
        // Extract commands (everything after "ac")
        const commands = parts.slice(acIndex + 1);
        
        if (commands.length === 0) {
            this.logAction(`Missing state in AC action: ${actionString}`);
            return;
        }
        
        // Extract state (on/off)
        this.state = commands[0] === 'on';
        
        // Extract optional temperature and mode
        if (commands.length > 1) {
            // Check if the next part is a number (temperature)
            const tempCandidate = commands[1];
            if (!isNaN(Number(tempCandidate))) {
                this.params.temperature = Number(tempCandidate);
                
                // If there's another part after temperature, it's the mode
                if (commands.length > 2) {
                    this.params.mode = commands[2];
                }
            } else {
                // If not a number, it might be the mode
                this.params.mode = tempCandidate;
            }
        }
        
        this.logAction(`Parsed AC action: state=${this.state}, ` +
                      `temp=${this.params.temperature}, mode=${this.params.mode}`);
    }

    /**
     * Pre-parse the action string and return the parsed parameters
     * This is used during rule initialization to avoid parsing at runtime
     * @param {string} actionString - The action string to parse
     * @returns {Object} Object containing parsed parameters
     */
    preParseActionString(actionString) {
        // Default parameters
        const result = {
            state: false,
            params: {
                temperature: null,
                mode: 'cool'  // Default mode
            }
        };
        
        // Parse the action string using the same logic as parseActionString
        const parts = actionString.toLowerCase().trim().split(' ');
        const acIndex = parts.findIndex(part => part === 'ac');
        
        if (acIndex === -1) {
            this.logAction(`Pre-parsing: Invalid AC action format: ${actionString}`);
            return result;
        }
        
        // Extract commands (everything after "ac")
        const commands = parts.slice(acIndex + 1);
        
        if (commands.length === 0) {
            this.logAction(`Pre-parsing: Missing state in AC action: ${actionString}`);
            return result;
        }
        
        // Extract state (on/off)
        result.state = commands[0] === 'on';
        
        // Extract optional temperature and mode
        if (commands.length > 1) {
            // Check if the next part is a number (temperature)
            const tempCandidate = commands[1];
            if (!isNaN(Number(tempCandidate))) {
                result.params.temperature = Number(tempCandidate);
                
                // If there's another part after temperature, it's the mode
                if (commands.length > 2) {
                    result.params.mode = commands[2];
                }
            } else {
                // If not a number, it might be the mode
                result.params.mode = tempCandidate;
            }
        }
        
        this.logAction(`Pre-parsed AC action: state=${result.state}, ` +
                     `temp=${result.params.temperature}, mode=${result.params.mode}`);
        
        return result;
    }

    /**
     * Check if this action can handle the given action string
     * @param {string} actionString - The action string to check
     * @returns {boolean} True if this action can handle the string
     */
    canHandleAction(actionString) {
        const normalizedActionString = actionString.toLowerCase();
        const normalizedLocation = this.location.toLowerCase();
        
        // Check if this action's location and type appear in the action string
        return normalizedActionString.includes(normalizedLocation) && 
               normalizedActionString.includes('ac');
    }

    /**
     * Get Raspberry Pi IP for this action's location
     * @returns {Promise<string>} The Raspberry Pi IP address
     */
    async getRoomRaspberryPi() {
        try {
            this.logAction(`Looking up Raspberry Pi IP for room: ${this.location}`);
            
            // Get room ID from name
            const roomId = await roomService.getRoomIdByRoomName(this.location);
            
            if (!roomId) {
                this.logAction(`Room not found in database: ${this.location}`);
                throw new Error(`Room not found: ${this.location}`);
            }
            
            // Get room details to find Raspberry Pi IP
            const room = await roomService.getRoomById(roomId);
            
            if (!room) {
                this.logAction(`Room found but no details available: ${this.location} (ID: ${roomId})`);
                throw new Error(`Room details not found: ${this.location}`);
            }
            
            if (!room.rasp_ip) {
                this.logAction(`Room found but no Raspberry Pi IP set: ${this.location} (ID: ${roomId})`);
                throw new Error(`Raspberry Pi IP not found for room: ${this.location}`);
            }
            
            this.logAction(`Found Raspberry Pi IP for ${this.location}: ${room.rasp_ip}`);
            return room.rasp_ip;
        } catch (error) {
            this.logAction(`Error getting Raspberry Pi IP: ${error.message}`);
            
            // Fallback to configuration file
            try {
                const configPath = path.join(__dirname, '../../../api/endpoint/rasp_pi.json');
                this.logAction(`Looking for fallback IP in config: ${configPath}`);
                
                const configData = await fs.readFile(configPath, 'utf8');
                const config = JSON.parse(configData);
                
                // Get the first IP from the config as a fallback
                const allIps = Object.keys(config);
                
                if (allIps.length === 0) {
                    this.logAction(`No IPs found in config file. Cannot proceed.`);
                    throw new Error('No Raspberry Pi IPs available in fallback config');
                }
                
                const firstIp = allIps[0];
                this.logAction(`Using fallback Raspberry Pi IP: ${firstIp} (from config with ${allIps.length} IPs)`);
                
                // Log all available IPs for debugging
                allIps.forEach((ip, index) => {
                    this.logAction(`Config IP #${index+1}: ${ip} -> ${config[ip]}`);
                });
                
                return firstIp;
            } catch (fallbackError) {
                this.logAction(`Fallback failed: ${fallbackError.message}`);
                throw error; // Throw the original error
            }
        }
    }
    
    /**
     * Get AC device ID for a room
     * @returns {Promise<string>} The AC device ID
     */
    async getACDeviceId() {
        try {
            // Use the environment variable for the device ID
            return process.env.SENSIBO_DEVICE_ID;
        } catch (error) {
            this.logAction(`Error getting AC device ID: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute the AC action
     * @param {Object} context - Additional context for the execution
     * @returns {Promise<object>} The result of the action execution
     */
    async execute(context = {}) {
        try {
            this.logAction(`Executing AC action for ${this.name}`);
            
            // Get Raspberry Pi IP for the room
            const raspPiIP = await this.getRoomRaspberryPi();
            
            // Get AC device ID for the room
            const deviceId = await this.getACDeviceId();
            
            // Create target state object
            const targetState = {
                state: this.state,
                temperature: this.params.temperature,
                mode: this.params.mode
            };
            
            // Get action registry
            const ActionRegistry = require('./ActionRegistry');
            
            // Force update option - force a command even if states match
            // Add a context.force parameter that can be set to true to force an update
            const forceUpdate = context.force === true;
            
            // Check if state change is needed
            if (!forceUpdate && !ActionRegistry.isStateChangeNeeded(deviceId, targetState, 'ac')) {
                this.logAction(`No state change needed for ${this.name}. Current state already matches target state. Use force=true to override.`);
                
                // Verify actual device state (optional verification step)
                try {
                    const { getAcState } = require('../../../api/sensibo');
                    const actualState = await getAcState(raspPiIP, deviceId);
                    
                    if (actualState) {
                        // Check both power state AND temperature
                        const actualOnState = actualState.on === true;
                        const actualTemperature = actualState.targetTemperature;
                        const actualMode = actualState.mode;
                        
                        this.logAction(`Actual state: on=${actualOnState}, temp=${actualTemperature}, mode=${actualMode}`);
                        this.logAction(`Target state: on=${targetState.state}, temp=${targetState.temperature}, mode=${targetState.mode}`);
                        
                        // Check if any of the important parameters don't match
                        const powerMismatch = actualOnState !== targetState.state;
                        const tempMismatch = targetState.temperature !== null && 
                                             actualTemperature !== targetState.temperature;
                        const modeMismatch = targetState.mode !== null && 
                                            actualMode !== targetState.mode;
                        
                        // If any parameter doesn't match, force an update
                        if (powerMismatch || tempMismatch || modeMismatch) {
                            this.logAction(`Detected state mismatch! Power: ${powerMismatch}, Temp: ${tempMismatch}, Mode: ${modeMismatch}. Forcing update.`);
                            // Continue with the action execution
                        } else {
                            return { 
                                success: true, 
                                message: `AC in ${this.location} already in desired state (${this.state ? 'on' : 'off'}, temp: ${this.params.temperature}, mode: ${this.params.mode})`,
                                noChange: true
                            };
                        }
                    }
                } catch (verifyError) {
                    this.logAction(`Error verifying actual device state: ${verifyError.message}. Proceeding with command anyway.`);
                    // Continue with action execution to be safe
                }
            }
            
            // Execute the AC state change via Sensibo API
            const result = await switchAcState(
                deviceId, 
                this.state, 
                raspPiIP, 
                this.params.temperature
            );
            
            if (result.statusCode === 200) {
                // Update the action registry with the new state
                ActionRegistry.updateDeviceState(deviceId, targetState, 'ac');
                
                this.logAction(`Successfully set ${this.name} to ${this.state ? 'on' : 'off'} with temp: ${this.params.temperature}, mode: ${this.params.mode}`);
                return {
                    success: true,
                    message: `AC in ${this.location} set to ${this.state ? 'on' : 'off'} with temp: ${this.params.temperature}, mode: ${this.params.mode}`
                };
            } else {
                const errorMessage = result.data?.message || 'Unknown error';
                this.logAction(`Failed to set ${this.name} state: ${errorMessage}`);
                return {
                    success: false,
                    message: `Failed to set AC in ${this.location}: ${errorMessage}`
                };
            }
        } catch (error) {
            this.logAction(`Error executing AC action: ${error.message}`);
            return {
                success: false,
                message: `Error setting AC in ${this.location}: ${error.message}`
            };
        }
    }
}

module.exports = ACAction; 