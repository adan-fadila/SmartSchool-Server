const BaseAction = require('../core/BaseAction');
const { TurnON_OFF_LIGHT } = require('../../../../api/sensibo');

/**
 * Action for controlling lights
 */
class LightAction extends BaseAction {
    /**
     * @param {string} location - The location this action applies to
     * @param {string} command - The command to execute ('on' or 'off')
     * @param {string} deviceId - The ID of the device to control
     * @param {string} raspberryPiIP - The IP address of the Raspberry Pi
     */
    constructor(location, command, deviceId, raspberryPiIP) {
        super('light', location, command);
        this.deviceId = deviceId;
        this.raspberryPiIP = raspberryPiIP;
    }

    /**
     * Execute the light action
     */
    async execute() {
        try {
            console.log(`Executing light action: ${this.command} for ${this.location} (Device ID: ${this.deviceId})`);
            
            // Convert command to boolean state
            const state = this.command.toLowerCase() === 'on';
            
            // Call the API function to control the light
            const result = await TurnON_OFF_LIGHT(
                state,
                this.raspberryPiIP,
                this.deviceId,
                'light'
            );
            
            console.log(`Light action result:`, result);
            
            return result;
        } catch (error) {
            console.error(`Error executing light action:`, error);
            throw error;
        }
    }

    /**
     * Get a unique identifier for this action
     * Overrides the base method to include the device ID
     * @returns {string} A unique identifier
     */
    getId() {
        return `${this.type}_${this.location}_${this.command}_${this.deviceId}`;
    }

    /**
     * Get a string representation of the action
     * @returns {string} String representation of the action
     */
    toString() {
        return `light in ${this.location} ${this.command}`;
    }
}

module.exports = LightAction; 