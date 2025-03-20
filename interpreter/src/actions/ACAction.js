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
     */
    constructor(name, location) {
        super(name, 'ac', location);
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
            // Get room ID from name
            const roomId = await roomService.getRoomIdByRoomName(this.location);
            
            if (!roomId) {
                throw new Error(`Room not found: ${this.location}`);
            }
            
            // Get room details to find Raspberry Pi IP
            const room = await roomService.getRoomById(roomId);
            
            if (!room || !room.rasp_ip) {
                throw new Error(`Raspberry Pi IP not found for room: ${this.location}`);
            }
            
            return room.rasp_ip;
        } catch (error) {
            this.logAction(`Error getting Raspberry Pi IP: ${error.message}`);
            
            // Fallback to configuration file
            try {
                const configPath = path.join(__dirname, '../../../api/endpoint/rasp_pi.json');
                const configData = await fs.readFile(configPath, 'utf8');
                const config = JSON.parse(configData);
                
                // Get the first IP from the config as a fallback
                const firstIp = Object.keys(config)[0];
                this.logAction(`Using fallback Raspberry Pi IP: ${firstIp}`);
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
            
            // Check if state change is needed
            if (!ActionRegistry.isStateChangeNeeded(deviceId, targetState, 'ac')) {
                this.logAction(`No state change needed for ${this.name}. Current state already matches target state.`);
                return { 
                    success: true, 
                    message: `AC in ${this.location} already in desired state (${this.state ? 'on' : 'off'}, temp: ${this.params.temperature}, mode: ${this.params.mode})`,
                    noChange: true
                };
            }
            
            // Execute the AC state change via Sensibo API
            const result = await switchAcState(
                deviceId, 
                this.state, 
                raspPiIP, 
                this.params.temperature
            );
            
            if (result.statusCode === 200) {
                this.logAction(`Successfully changed AC state for ${this.location}`);
                
                // Update device state in registry
                ActionRegistry.updateDeviceState(deviceId, targetState, 'ac');
                
                return { success: true, message: `AC in ${this.location} turned ${this.state ? 'on' : 'off'}` };
            } else {
                throw new Error(`Failed to change AC state: ${JSON.stringify(result.data)}`);
            }
        } catch (error) {
            this.logAction(`Error executing AC action: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}

module.exports = ACAction; 