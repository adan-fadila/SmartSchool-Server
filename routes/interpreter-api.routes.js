const express = require('express');
const router = express.Router();
const EventRegistry = require('../interpreter/src/events/EventRegistry');
const interpreterService = require('../interpreter/src/server-integration');
const AnomalyDescription = require('../models/AnomalyDescription');

// Add the following routes for anomaly management

// Get all anomaly events
router.get('/anomalies', (req, res) => {
    try {
        const anomalyEvents = EventRegistry.getAllEvents()
            .filter(event => event.type === 'anomaly')
            .map(event => ({
                name: event.name,
                location: event.location,
                anomalyType: event.anomalyType,
                metricType: event.metricType,
                state: event.getAnomalyState()
            }));
        
        res.status(200).json({
            success: true,
            count: anomalyEvents.length,
            anomalies: anomalyEvents
        });
    } catch (error) {
        console.error('Error getting anomaly events:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all anomaly events with their descriptions
router.get('/anomalies/with-descriptions', async (req, res) => {
    try {
        const { spaceId } = req.query;
        
        if (!spaceId) {
            return res.status(400).json({
                success: false,
                error: 'Space ID is required'
            });
        }
        
        const anomalyEvents = EventRegistry.getAllEvents()
            .filter(event => event.type === 'anomaly');
        
        // Get all anomaly descriptions for this space
        const descriptions = await AnomalyDescription.find({
            spaceId,
            isActive: true
        });
        
        // Create a map of raw event names to descriptions
        const descriptionMap = {};
        descriptions.forEach(desc => {
            if (!descriptionMap[desc.rawEventName]) {
                descriptionMap[desc.rawEventName] = [];
            }
            descriptionMap[desc.rawEventName].push(desc);
        });
        
        // Combine events with their descriptions
        const anomaliesWithDescriptions = anomalyEvents.map(event => {
            const eventDescriptions = descriptionMap[event.name] || [];
            
            return {
                name: event.name,
                location: event.location,
                anomalyType: event.anomalyType,
                metricType: event.metricType,
                state: event.getAnomalyState(),
                hasDescriptions: eventDescriptions.length > 0,
                descriptions: eventDescriptions
            };
        });
        
        res.status(200).json({
            success: true,
            count: anomaliesWithDescriptions.length,
            anomalies: anomaliesWithDescriptions
        });
    } catch (error) {
        console.error('Error getting anomaly events with descriptions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get descriptions for a specific anomaly event
router.get('/anomalies/:name/descriptions', async (req, res) => {
    try {
        const { name } = req.params;
        const { spaceId } = req.query;
        
        if (!spaceId) {
            return res.status(400).json({
                success: false,
                error: 'Space ID is required'
            });
        }
        
        // Get the anomaly event
        const event = EventRegistry.getEvent(name);
        
        if (!event || event.type !== 'anomaly') {
            return res.status(404).json({
                success: false,
                error: `Anomaly event '${name}' not found`
            });
        }
        
        // Get descriptions for this event
        const descriptions = await AnomalyDescription.find({
            rawEventName: name,
            spaceId,
            isActive: true
        }).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            count: descriptions.length,
            data: {
                event: {
                    name: event.name,
                    location: event.location,
                    anomalyType: event.anomalyType,
                    metricType: event.metricType,
                    state: event.getAnomalyState()
                },
                descriptions
            }
        });
    } catch (error) {
        console.error('Error getting anomaly descriptions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manually update anomaly state (for testing)
router.post('/anomalies/:name', (req, res) => {
    try {
        const { name } = req.params;
        const { detected, data } = req.body;
        
        const event = EventRegistry.getEvent(name);
        
        if (!event || event.type !== 'anomaly') {
            return res.status(404).json({
                success: false,
                error: `Anomaly event '${name}' not found`
            });
        }
        
        // Update the anomaly state
        event.updateAnomalyState(detected, data);
        
        res.status(200).json({
            success: true,
            message: `Anomaly event '${name}' updated`,
            state: event.getAnomalyState()
        });
    } catch (error) {
        console.error('Error updating anomaly event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start anomaly polling
router.post('/anomalies/polling/start', (req, res) => {
    try {
        const { interval } = req.body;
        
        const result = interpreterService.startAnomalyPolling(interval);
        
        res.status(200).json({
            success: true,
            message: 'Anomaly polling started',
            result
        });
    } catch (error) {
        console.error('Error starting anomaly polling:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stop anomaly polling
router.post('/anomalies/polling/stop', (req, res) => {
    try {
        const result = interpreterService.stopAnomalyPolling();
        
        res.status(200).json({
            success: true,
            message: 'Anomaly polling stopped',
            result
        });
    } catch (error) {
        console.error('Error stopping anomaly polling:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 