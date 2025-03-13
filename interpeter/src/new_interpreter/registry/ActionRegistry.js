/**
 * Registry for actions in the system
 * Ensures that actions are reused when possible
 */
class ActionRegistry {
    constructor() {
        this.actions = new Map();
    }

    /**
     * Register an action in the registry
     * @param {BaseAction} action - The action to register
     * @returns {BaseAction} The registered action (may be a pre-existing one)
     */
    register(action) {
        const actionId = action.getId();
        
        // If an action with this ID already exists, return it
        if (this.actions.has(actionId)) {
            return this.actions.get(actionId);
        }
        
        // Otherwise, register the new action
        this.actions.set(actionId, action);
        return action;
    }

    /**
     * Get an action by its ID
     * @param {string} actionId - The ID of the action to get
     * @returns {BaseAction|null} The action, or null if not found
     */
    getById(actionId) {
        return this.actions.get(actionId) || null;
    }

    /**
     * Get all actions of a specific type
     * @param {string} type - The type of actions to get
     * @returns {BaseAction[]} Array of actions of the specified type
     */
    getByType(type) {
        return Array.from(this.actions.values())
            .filter(action => action.type === type);
    }

    /**
     * Get all actions for a specific location
     * @param {string} location - The location to get actions for
     * @returns {BaseAction[]} Array of actions for the specified location
     */
    getByLocation(location) {
        return Array.from(this.actions.values())
            .filter(action => action.location === location);
    }

    /**
     * Get all registered actions
     * @returns {BaseAction[]} Array of all registered actions
     */
    getAll() {
        return Array.from(this.actions.values());
    }

    /**
     * Remove an action from the registry
     * @param {string} actionId - The ID of the action to remove
     * @returns {boolean} Whether the action was removed
     */
    remove(actionId) {
        return this.actions.delete(actionId);
    }

    /**
     * Clear the registry
     */
    clear() {
        this.actions.clear();
    }
}

// Singleton instance
const instance = new ActionRegistry();

module.exports = instance; 