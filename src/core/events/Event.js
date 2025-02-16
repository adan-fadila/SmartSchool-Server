class Event {
    constructor(spaceId, roomId, roomName) {
        this.spaceId = spaceId;
        this.roomId = roomId;
        this.roomName = roomName;
        this.timestamp = new Date();
    }

    getType() {
        throw new Error('getType must be implemented by subclasses');
    }

    getSpaceId() {
        return this.spaceId;
    }

    getRoomId() {
        return this.roomId;
    }

    getRoomName() {
        return this.roomName;
    }
}

module.exports = Event; 