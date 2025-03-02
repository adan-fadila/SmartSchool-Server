const Action = require('./Action');
const RoomDevice = require('../../../models/RoomDevice');
const Device = require('../../../models/Device');

class FanAction extends Action {
    constructor(deviceId, state) {
        super(deviceId, state);
        this.previousState = null;
    }

    async execute() {
        try {
            // Get current device state
            const device = await RoomDevice.findOne({ device_id: this.deviceId });
            this.previousState = device?.state || 'off';

            // Check if action would change the state
            if (this.previousState === this.state) {
                console.log('Fan already in desired state, skipping action');
                return;
            }

            // Execute action only if state would change
            await this.updateDeviceState(this.state);
            
        } catch (error) {
            console.error('Error executing fan action:', error);
            await this.rollback();
            throw error;
        }
    }

    async updateDeviceState(state) {
        const updateData = {
            state: state,
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

    async rollback() {
        if (this.previousState) {
            try {
                await this.updateDeviceState(this.previousState);
                console.log(`Successfully rolled back fan to previous state: ${this.previousState}`);
            } catch (error) {
                console.error('Error rolling back fan state:', error);
                throw error;
            }
        }
    }
}

module.exports = FanAction; 