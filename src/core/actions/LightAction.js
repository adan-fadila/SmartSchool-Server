const Action = require('./Action');
const RoomDevice = require('../../../models/RoomDevice');
const Device = require('../../../models/Device');
const { TurnON_OFF_LIGHT } = require('../../../api/sensibo');

class LightAction extends Action {
    constructor(deviceId, state, raspberryPiIP) {
        super(deviceId, state);
        this.raspberryPiIP = raspberryPiIP;
        this.previousState = null;
    }

    async execute() {
        try {
            // Get current device state
            const device = await RoomDevice.findOne({ device_id: this.deviceId });
            this.previousState = device?.state || 'off';

            // Check if action would change the state
            if (this.previousState === this.state) {
                console.log('Light already in desired state, skipping action');
                return;
            }

            // Execute action only if state would change
            await TurnON_OFF_LIGHT(this.state, this.raspberryPiIP, this.deviceId);
            await this.updateDeviceState(this.state);
            
        } catch (error) {
            console.error('Error executing light action:', error);
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
            await TurnON_OFF_LIGHT(this.previousState, this.raspberryPiIP, this.deviceId, 'auto');
            await this.updateDeviceState(this.previousState);
            return true;
        } catch (error) {
            console.error('Light action rollback failed:', error);
            return false;
        }
    }

    async updateDeviceState(state) {
        const updateData = { 
            state: state, 
            lastUpdated: new Date() 
        };

        await Promise.all([
            Device.updateOne(
                { device_id: this.deviceId },
                { $set: updateData }
            ),
            RoomDevice.updateOne(
                { device_id: this.deviceId },
                { $set: updateData }
            )
        ]);
    }
}

module.exports = LightAction; 