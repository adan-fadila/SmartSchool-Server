const Event = require('./Event');

/**
 * Humidity Event class that extends the base Event
 * Specific for handling humidity related events
 */
class HumidityEvent extends Event {
    constructor(name, location) {
        super(name);
        this.location = location; // e.g. "Living Room"
        this.type = 'humidity';
        this.unit = '%';
        console.log(`Created HumidityEvent: ${name} for location: ${location}`);
    }

    /**
     * Update humidity value
     * @param {number} humidity - The new humidity value
     */
    updateHumidity(humidity) {
        console.log(`Updating humidity for ${this.name} to ${humidity}${this.unit}`);
        this.update(humidity);
    }

    /**
     * Get the current humidity value
     * @returns {number} The current humidity
     */
    getHumidity() {
        return this.currentValue;
    }
}

module.exports = HumidityEvent; 