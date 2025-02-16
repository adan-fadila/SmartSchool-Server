const Action = require('./Action');
const Device = require('../../../models/Device');
const RoomDevice = require('../../../models/RoomDevice');
const { switchAcState, updateAcMode } = require('../../../api/sensibo');

class ACAction extends Action {
    constructor(deviceId, state, temperature, mode = 'cool') {
        super(deviceId, state);
        this.temperature = temperature;
        this.mode = mode;
        this.previousState = null;
    }

    async execute() {
        try {
            // Get current device state
            const device = await RoomDevice.findOne({ device_id: this.deviceId });
            this.previousState = {
                state: device?.state || 'off',
                temperature: device?.temperature,
                mode: device?.mode
            };

            // Check if action would change the state
            const stateWouldChange = (
                this.previousState.state !== this.state ||
                this.previousState.temperature !== this.temperature ||
                this.previousState.mode !== this.mode
            );

            if (!stateWouldChange) {
                console.log('Device already in desired state, skipping action');
                return;
            }

            // Execute the action only if state would change
            await this.updateDeviceState(this.state, this.temperature, this.mode);
            
            // Additional logic for AC control...
        } catch (error) {
            console.error('Error executing AC action:', error);
            await this.rollback();
            throw error;
        }
    }

    async rollback() {
        if (!this.previousState) {
            console.warn('No previous state available for rollback');
            return false;
        }

        try {
            await this.controlAC(
                this.previousState.state,
                this.previousState.temperature,
                this.previousState.mode
            );
            await this.updateDeviceState(
                this.previousState.state,
                this.previousState.temperature,
                this.previousState.mode
            );
            return true;
        } catch (error) {
            console.error('AC action rollback failed:', error);
            return false;
        }
    }

     async controlAC(state, temperature = this.temperature, mode = this.mode) {
        const apiKey = process.env.SENSIBO_API_KEY;
        const deviceUrl = `https://home.sensibo.com/api/v2/pods/${this.deviceId}/acStates?apiKey=${apiKey}`;
        
        const response = await fetch(deviceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                acState: {
                    on: state === 'on',
                    targetTemperature: temperature,
                    mode: mode
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to control AC: ${response.statusText}`);
        }

        return response.json();
    }

     async updateDeviceState(state, temperature = this.temperature, mode = this.mode) {
        const updateData = {
            state: state,
            temperature: temperature,
            mode: mode,
            lastUpdated: new Date()
        };

        await Device.updateOne(
            { device_id: this.deviceId },
            { $set: updateData }
        );

        await RoomDevice.updateOne(
            { device_id: this.deviceId },
            { $set: updateData }
        );
    }
}

module.exports = ACAction; 