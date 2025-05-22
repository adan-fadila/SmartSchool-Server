const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema for storing user-provided descriptions for anomaly events
 * This maps the raw anomaly event names to user-friendly descriptions
 */
const AnomalyDescriptionSchema = new Schema({
    // The raw event name from the anomaly detection system
    rawEventName: {
        type: String,
        required: true,
        index: true
    },
    
    // User-provided description for this anomaly
    description: {
        type: String,
        required: true
    },
    
    // The room where the anomaly was detected
    roomId: {
        type: String,
        required: true
    },
    
    // The space containing the room
    spaceId: {
        type: String,
        required: true,
        index: true
    },
    
    // The user who provided this description (if applicable)
    userId: {
        type: String,
        required: false
    },
    
    // Metadata about the anomaly
    metricType: {
        type: String,
        required: true,
        enum: ['temperature', 'humidity', 'motion', 'other']
    },
    
    anomalyType: {
        type: String,
        required: true,
        enum: ['pointwise', 'collective']
    },
    
    location: {
        type: String,
        required: true
    },
    
    // Is this description active/available for rule creation?
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Create a compound index for efficient lookups
AnomalyDescriptionSchema.index({ 
    spaceId: 1, 
    rawEventName: 1 
});

// Create a compound index for finding descriptions by room and space
AnomalyDescriptionSchema.index({ 
    spaceId: 1, 
    roomId: 1 
});

module.exports = mongoose.model('AnomalyDescription', AnomalyDescriptionSchema); 