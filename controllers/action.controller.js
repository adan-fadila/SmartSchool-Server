const ActionRegistry = require('../interpreter/src/actions/ActionRegistry');

/**
 * Execute an action directly
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function executeAction(req, res) {
    try {
        const { actionString } = req.body;

        if (!actionString) {
            return res.status(400).json({
                success: false,
                error: 'Action string is required'
            });
        }

        // Execute the action through the ActionRegistry
        const result = await ActionRegistry.testExecuteAction(actionString);

        return res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Error executing action:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get all available actions
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function getAvailableActions(req, res) {
    try {
        // Initialize actions if not already initialized
        if (!ActionRegistry.actions || ActionRegistry.actions.size === 0) {
            await ActionRegistry.initializeActions();
        }

        const actions = Array.from(ActionRegistry.actions.values()).map(action => ({
            name: action.name,
            type: action.type,
            location: action.location
        }));

        return res.json({
            success: true,
            actions
        });
    } catch (error) {
        console.error('Error getting available actions:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    executeAction,
    getAvailableActions
}; 