const EventRegistry = require('../interpreter/src/events/EventRegistry');

/**
 * Get all available events
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function getAvailableEvents(req, res) {
    try {
        const events = EventRegistry.getAllEvents().map(event => ({
            name: event.name,
            type: event.type,
            location: event.location,
            currentValue: event.currentValue
        }));

        return res.json({
            success: true,
            events
        });
    } catch (error) {
        console.error('Error getting available events:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get current value of a specific event
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function getEventValue(req, res) {
    try {
        const { eventName } = req.params;
        const event = EventRegistry.getEvent(eventName);

        if (!event) {
            return res.status(404).json({
                success: false,
                error: `Event '${eventName}' not found`
            });
        }

        return res.json({
            success: true,
            event: {
                name: event.name,
                type: event.type,
                location: event.location,
                currentValue: event.currentValue
            }
        });
    } catch (error) {
        console.error('Error getting event value:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getAvailableEvents,
    getEventValue
}; 