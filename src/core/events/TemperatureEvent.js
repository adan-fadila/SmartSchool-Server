const Event = require('./Event');

class TemperatureEvent extends Event {
    constructor(spaceId, roomId, roomName, temperature, humidity) {
        super(spaceId, roomId, roomName);
        this.temperature = temperature;
        this.humidity = humidity;
    }

    getType() {
        return 'temperature';
    }

    getTemperature() {
        return this.temperature;
    }

    getHumidity() {
        return this.humidity;
    }
}

module.exports = TemperatureEvent; 