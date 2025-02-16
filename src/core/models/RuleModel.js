const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
    ruleString: {
        type: String,
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    raspberryPiIP: {
        type: String,
        required: true
    },
    roomId: {
        type: String,
        required: true
    },
    spaceId: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rule', ruleSchema); 