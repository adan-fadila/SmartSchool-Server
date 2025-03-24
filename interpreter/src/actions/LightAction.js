const Action = require('./Action');
const { TurnON_OFF_LIGHT } = require('../../../api/sensibo');
const roomService = require('../../../services/rooms.service');
const fs = require('fs').promises;
const path = require('path');

/**
 * Action class for controlling lights
 * Can handle actions like:
 * - living room light on
 * - bedroom light off
 */
class LightAction extends Action {
    /**
     * Constructor for the LightAction class
     * @param {string} name - The name of the action (e.g., "Living Room Light")
     * @param {string} location - The location of this action (room name)
     * @param {string} [type='light'] - The type of this action from API
     */
    constructor(name, location, type = 'light') {
        super(name, type, location);
    }

    /**
     * Parse the action string into components
     * @param {string} actionString - The action string to parse
     */
    parseActionString(actionString) {
        // Reset parameters
        this.state = false;
        this.params = {};

        // Parse the action string
        // Expected format: "[location] light [on/off]"
        // Examples: "living room light on", "bedroom light off"
        const parts = actionString.toLowerCase().trim().split(' ');
        
        // Find the index of "light" to separate location and commands
        const lightIndex = parts.findIndex(part => part === 'light');
        
        if (lightIndex === -1) {
            this.logAction(`Invalid Light action format: ${actionString}`);
            return;
        }
        
        // Extract commands (everything after "light")
        const commands = parts.slice(lightIndex + 1);
        
        if (commands.length === 0) {
            this.logAction(`Missing state in Light action: ${actionString}`);
            return;
        }
        
        // Extract state (on/off)
        this.state = commands[0] === 'on';
        
        this.logAction(`Parsed Light action: state=${this.state}`);
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
               normalizedActionString.includes('light');
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
     * Execute the Light action
     * @param {Object} context - Additional context for the execution
     * @returns {Promise<object>} The result of the action execution
     */
    async execute(context = {}) {
        try {
            this.logAction(`Executing Light action for ${this.name}`);
            
            // Get Raspberry Pi IP for the room
            const raspPiIP = await this.getRoomRaspberryPi();
            
            // Execute the Light state change
            const state = this.state ? 'turnon' : 'turnoff';
            const result = await TurnON_OFF_LIGHT(
                state,
                raspPiIP,
                'light', // Control ID for light
                'light'  // Control type
            );
            
            if (result && !result.error) {
                this.logAction(`Successfully changed Light state for ${this.location}`);
                return { success: true, message: `Light in ${this.location} turned ${this.state ? 'on' : 'off'}` };
            } else {
                throw new Error(`Failed to change Light state: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            this.logAction(`Error executing Light action: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}

module.exports = LightAction; 