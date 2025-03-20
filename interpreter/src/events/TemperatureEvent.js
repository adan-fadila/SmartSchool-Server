const Event = require('./Event');

/**
 * Temperature Event class that extends the base Event
 * Specific for handling temperature related events
 */
class TemperatureEvent extends Event {
    constructor(name, location) {
        super(name);
        this.location = location; // e.g. "Living Room"
        this.type = 'temperature';
        this.unit = 'celsius';
        console.log(`Created TemperatureEvent: ${name} for location: ${location}`);
    }

    /**
     * Update temperature value
     * @param {number} temperature - The new temperature value
     */
    updateTemperature(temperature) {
        console.log(`Updating temperature for ${this.name} to ${temperature}${this.unit}`);
        this.update(temperature);
    }

    /**
     * Get the current temperature value
     * @returns {number} The current temperature
     */
    getTemperature() {
        return this.currentValue;
    }
}

module.exports = TemperatureEvent; 