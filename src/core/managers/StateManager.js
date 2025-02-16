const { EventEmitter } = require('events');

class StateManager {
    constructor() {
        this.states = new Map();
        this.eventEmitter = new EventEmitter();
    }

    updateRoomState(roomId, updates) {
        const currentState = this.states.get(roomId) || {};
        const newState = { ...currentState, ...updates };
        console.log(`Updating state for room ${roomId}:`, newState);
        this.states.set(roomId, newState);
        this.eventEmitter.emit(`roomState:${roomId}`, newState);
    }

    getRoomState(roomId) {
        return this.states.get(roomId);
    }

    subscribeToRoomState(roomId, callback) {
        this.eventEmitter.on(`roomState:${roomId}`, callback);
    }

    unsubscribeFromRoomState(roomId, callback) {
        this.eventEmitter.off(`roomState:${roomId}`, callback);
    }
}

module.exports = StateManager; 