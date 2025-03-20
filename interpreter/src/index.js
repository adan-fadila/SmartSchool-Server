const EventRegistry = require('./events/EventRegistry');
const RuleManager = require('./rules/RuleManager');
const ActionRegistry = require('./actions/ActionRegistry');
const fs = require('fs').promises;
const path = require('path');

/**
 * Initialize the interpreter
 */
async function initialize() {
    try {
        console.log('Initializing interpreter...');
        
        // Load Raspberry Pi endpoints
        const raspPiConfigPath = path.join(__dirname, '../../api/endpoint/rasp_pi.json');
        const raspPiConfigData = await fs.readFile(raspPiConfigPath, 'utf8');
        const raspPiConfig = JSON.parse(raspPiConfigData);
        
        console.log('Loaded Raspberry Pi configuration:', raspPiConfig);
        
        // Initialize event registry with Raspberry Pi endpoints
        EventRegistry.loadRaspiEndpoints(raspPiConfig);
        
        // Initialize events by fetching them from all Raspberry Pis
        await EventRegistry.initializeEvents();
        
        console.log('Interpreter initialized successfully');
        
        // Log all initialized events
        const events = EventRegistry.getAllEvents();
        console.log(`Initialized ${events.length} events:`);
        events.forEach(event => {
            console.log(`- ${event.name} (${event.type}) for location: ${event.location}`);
        });
        
        // Log available action types
        console.log('Available action types:');
        ActionRegistry.actionTypes.forEach(ActionType => {
            console.log(`- ${ActionType.name}`);
        });
        
        return { EventRegistry, RuleManager, ActionRegistry };
    } catch (error) {
        console.error('Failed to initialize interpreter:', error);
        throw error;
    }
}

module.exports = { initialize }; 