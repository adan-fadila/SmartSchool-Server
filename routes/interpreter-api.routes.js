const express = require('express');
const router = express.Router();
const EventRegistry = require('../interpreter/src/events/EventRegistry');
const interpreterService = require('../interpreter/src/server-integration');

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