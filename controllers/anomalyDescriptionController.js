const AnomalyDescription = require('../models/AnomalyDescription');
const EventRegistry = require('../interpreter/src/events/EventRegistry');

/**
 * Controller for managing user-provided descriptions for anomaly events
 */
const anomalyDescriptionController = {
    /**
     * Create a new anomaly description
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     */
    createDescription: async (req, res) => {
        try {
            const { 
                rawEventName, 
                description, 
                roomId, 
                spaceId, 
                userId 
            } = req.body;
            
            // Basic validation
            if (!rawEventName || !description || !roomId || !spaceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }
            
            // Get the anomaly event from the registry to get additional metadata
            let anomalyEvent = EventRegistry.getEvent(rawEventName);
            
            if (!anomalyEvent || anomalyEvent.type !== 'anomaly') {
                console.log(`Anomaly event '${rawEventName}' not found in registry. Creating a mock event.`);
                
                // Extract parts from the raw event name
                const parts = rawEventName.toLowerCase().split(' ');
                
                // Determine anomaly type
                let anomalyType = 'pointwise'; // Default
                if (parts.includes('collective')) {
                    anomalyType = 'collective';
                } else if (parts.includes('pointwise')) {
                    anomalyType = 'pointwise';
                }
                
                // Determine metric type
                let metricType = 'temperature'; // Default
                if (parts.includes('humidity')) {
                    metricType = 'humidity';
                }
                if (parts.includes('motion')) {
                    metricType = 'motion';
                }
                
                // Determine location (everything before metric type and anomaly type)
                const metricIndex = parts.indexOf(metricType);
                const anomalyIndex = parts.indexOf(anomalyType);
                let location = '';
                
                if (metricIndex > 0) {
                    location = parts.slice(0, metricIndex).join(' ');
                }
                
                console.log(`Parsed from name - Location: "${location}", Metric: "${metricType}", Type: "${anomalyType}"`);
                
                // Create a mock anomaly event object
                anomalyEvent = {
                    type: 'anomaly',
                    metricType: metricType,
                    anomalyType: anomalyType,
                    location: location || 'living room' // Default to living room if not found
                };
            }
            
            // Create the new anomaly description
            const newDescription = new AnomalyDescription({
                rawEventName,
                description,
                roomId,
                spaceId,
                userId: userId || null,
                metricType: anomalyEvent.metricType,
                anomalyType: anomalyEvent.anomalyType,
                location: anomalyEvent.location,
                isActive: true
            });
            
            // Save to database
            await newDescription.save();
            
            return res.status(201).json({
                success: true,
                message: 'Anomaly description created successfully',
                data: newDescription
            });
        } catch (error) {
            console.error('Error creating anomaly description:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    
    /**
     * Get all anomaly descriptions for a space
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     */
    getDescriptionsBySpace: async (req, res) => {
        try {
            const { spaceId } = req.params;
            
            if (!spaceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Space ID is required'
                });
            }
            
            // Find all active descriptions for this space
            const descriptions = await AnomalyDescription.find({
                spaceId,
                isActive: true
            }).sort({ createdAt: -1 }); // Newest first
            
            return res.status(200).json({
                success: true,
                count: descriptions.length,
                data: descriptions
            });
        } catch (error) {
            console.error('Error getting anomaly descriptions:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    
    /**
     * Get descriptions for a specific raw event name
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     */
    getDescriptionsByEvent: async (req, res) => {
        try {
            const { rawEventName } = req.params;
            const { spaceId } = req.query;
            
            if (!rawEventName || !spaceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Raw event name and space ID are required'
                });
            }
            
            // Find all active descriptions for this event in this space
            const descriptions = await AnomalyDescription.find({
                rawEventName,
                spaceId,
                isActive: true
            }).sort({ createdAt: -1 }); // Newest first
            
            return res.status(200).json({
                success: true,
                count: descriptions.length,
                data: descriptions
            });
        } catch (error) {
            console.error('Error getting anomaly descriptions:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    
    /**
     * Delete an anomaly description
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     */
    deleteDescription: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Description ID is required'
                });
            }
            
            // Find and delete the description
            const deletedDescription = await AnomalyDescription.findByIdAndDelete(id);
            
            if (!deletedDescription) {
                return res.status(404).json({
                    success: false,
                    error: 'Anomaly description not found'
                });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Anomaly description deleted successfully',
                data: deletedDescription
            });
        } catch (error) {
            console.error('Error deleting anomaly description:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    
    /**
     * Update an anomaly description (e.g., to change the description text or active status)
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     */
    updateDescription: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Description ID is required'
                });
            }
            
            // Prevent updating critical fields
            if (updates.rawEventName || updates.roomId || updates.spaceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update critical fields like rawEventName, roomId, or spaceId'
                });
            }
            
            // Find and update the description
            const updatedDescription = await AnomalyDescription.findByIdAndUpdate(
                id,
                updates,
                { new: true } // Return the updated document
            );
            
            if (!updatedDescription) {
                return res.status(404).json({
                    success: false,
                    error: 'Anomaly description not found'
                });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Anomaly description updated successfully',
                data: updatedDescription
            });
        } catch (error) {
            console.error('Error updating anomaly description:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};

module.exports = anomalyDescriptionController; 