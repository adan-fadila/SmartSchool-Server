const { EventEmitter } = require('events');

class EventManager {
    constructor() {
        this.sensors = new Map();
        this.eventEmitter = new EventEmitter();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventEmitter.on('event', (event) => {
            this.handleEvent(event);
        });
    }

    registerSensor(sensorType, sensor) {
        if (!this.sensors.has(sensorType)) {
            this.sensors.set(sensorType, []);
        }
        this.sensors.get(sensorType).push(sensor);
    }

    handleEvent(event) {
        const sensorType = event.getType();
        const sensors = this.sensors.get(sensorType) || [];

        sensors
            .filter(sensor => 
                sensor.spaceId === event.getSpaceId() && 
                sensor.roomId === event.getRoomId()
            )
            .forEach(sensor => {
                try {
                    sensor.updateState(event);
                } catch (error) {
                    console.error(`Error updating sensor state: ${error.message}`);
                }
            });
    }

    emitEvent(event) {
        this.eventEmitter.emit('event', event);
    }
}

module.exports = EventManager; 