const BaseAction = require('../core/BaseAction');
const { switchAcState } = require('../../../../api/sensibo');

/**
 * Action for controlling air conditioners
 */
class ACAction extends BaseAction {
    /**
     * @param {string} location - The location this action applies to
     * @param {string} command - The command to execute ('on' or 'off')
     * @param {string} deviceId - The ID of the device to control
     * @param {string} raspberryPiIP - The IP address of the Raspberry Pi
     * @param {number} temperature - The target temperature (only for 'on' command)
     * @param {string} mode - The AC mode (e.g., 'cool', 'heat', 'fan') (only for 'on' command)
     */
    constructor(location, command, deviceId, raspberryPiIP, temperature = null, mode = null) {
        super('ac', location, command);
        this.deviceId = deviceId;
        this.raspberryPiIP = raspberryPiIP;
        this.temperature = temperature !== null ? parseFloat(temperature) : null;
        this.mode = mode;
    }

    /**
     * Execute the AC action
     */
    async execute() {
        try {
            console.log(`Executing AC action: ${this.command} for ${this.location} (Device ID: ${this.deviceId})`);
            
            // Convert command to boolean state
            const state = this.command.toLowerCase() === 'on';
            
            // Log the action details
            console.log(`AC Action Details:
                - Location: ${this.location}
                - Command: ${this.command} (state: ${state})
                - Device ID: ${this.deviceId}
                - Raspberry Pi IP: ${this.raspberryPiIP}
                - Temperature: ${this.temperature !== null ? this.temperature + '°C' : 'N/A'}
                - Mode: ${this.mode || 'N/A'}
            `);
            
            // Call the API function to control the AC
            console.log(`Sending command to Sensibo API via switchAcState...`);
            const result = await switchAcState(
                this.deviceId,
                state,
                this.raspberryPiIP,
                state ? this.temperature : null // Only send temperature if turning on
            );
            
            console.log(`Sensibo API response:`, result);
            
            // If turning on and mode is specified, update the mode
            if (state && this.mode && this.mode.trim() !== '') {
                try {
                    console.log(`Setting AC mode to ${this.mode}...`);
                    // Import the updateSensiboMode function dynamically to avoid circular dependencies
                    const { updateSensiboMode } = require('../../../../api/sensibo');
                    const modeResult = await updateSensiboMode(this.deviceId, this.mode, this.raspberryPiIP);
                    console.log(`Mode update result:`, modeResult);
                } catch (modeError) {
                    console.error(`Error setting AC mode:`, modeError);
                    // Continue execution even if mode setting fails
                }
            }
            
            console.log(`AC action completed successfully`);
            
            return result;
        } catch (error) {
            console.error(`Error executing AC action:`, error);
            throw error;
        }
    }

    /**
     * Get a unique identifier for this action
     * Overrides the base method to include all parameters
     * @returns {string} A unique identifier
     */
    getId() {
        const tempPart = this.temperature !== null ? `_${this.temperature}` : '';
        const modePart = this.mode ? `_${this.mode}` : '';
        return `${this.type}_${this.location}_${this.command}_${this.deviceId}${tempPart}${modePart}`;
    }

    /**
     * Get a string representation of the action
     * @returns {string} String representation of the action
     */
    toString() {
        let result = `AC in ${this.location} ${this.command}`;
        if (this.command.toLowerCase() === 'on') {
            if (this.temperature !== null) {
                result += ` ${this.temperature}`;
            }
            if (this.mode) {
                result += ` ${this.mode}`;
            }
        }
        return result;
    }
}

module.exports = ACAction; 