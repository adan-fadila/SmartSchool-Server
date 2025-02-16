const Sensor = require('./Sensor');

class TemperatureSensor extends Sensor {
    constructor(spaceId, roomId) {
        super(spaceId, roomId);
        this.temperature = null;
        this.humidity = null;
    }

    updateState(event) {
        if (event.getType() !== 'temperature') {
            throw new Error('Invalid event type for TemperatureSensor');
        }

        this.temperature = event.getTemperature();
        this.humidity = event.getHumidity();
        this.currentState = {
            temperature: this.temperature,
            humidity: this.humidity
        };
        
        this.checkRules();
    }
}

module.exports = TemperatureSensor; 