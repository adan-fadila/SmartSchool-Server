const express = require('express');
const router = express.Router();
const EventRegistry = require('../interpreter/src/events/EventRegistry');

/**
 * Router for handling anomaly events API requests
 * Provides frontend-friendly access to anomaly data
 */

// Get all anomaly events
router.get('/', (req, res) => {
    try {
        const anomalyEvents = EventRegistry.getAllEvents()
            .filter(event => event.type === 'anomaly')
            .map(event => {
                const state = event.getAnomalyState();
                return {
                    id: event.name,
                    name: event.name,
                    location: event.location,
                    anomalyType: event.anomalyType,
                    metricType: event.metricType,
                    detected: state.detected || false,
                    confidence: state.confidence || 0,
                    timestamp: state.timestamp,
                    value: state.value
                };
            });
        
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

// Get anomaly by name - note: this has to come after the specific routes below to avoid conflicts
router.get('/:name', (req, res) => {
    try {
        const { name } = req.params;
        const event = EventRegistry.getEvent(name);
        
        if (!event || event.type !== 'anomaly') {
            return res.status(404).json({
                success: false,
                error: `Anomaly not found: ${name}`
            });
        }
        
        const state = event.getAnomalyState();
        
        res.status(200).json({
            success: true,
            anomaly: {
                id: event.name,
                name: event.name,
                location: event.location,
                anomalyType: event.anomalyType,
                metricType: event.metricType,
                detected: state.detected || false,
                confidence: state.confidence || 0,
                timestamp: state.timestamp,
                value: state.value
            }
        });
    } catch (error) {
        console.error('Error getting anomaly:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get anomalies by location
router.get('/location/:location', (req, res) => {
    try {
        const { location } = req.params;
        
        const anomalyEvents = EventRegistry.getAllEvents()
            .filter(event => event.type === 'anomaly' && event.location.toLowerCase() === location.toLowerCase())
            .map(event => {
                const state = event.getAnomalyState();
                return {
                    id: event.name,
                    name: event.name,
                    location: event.location,
                    anomalyType: event.anomalyType,
                    metricType: event.metricType,
                    detected: state.detected || false,
                    confidence: state.confidence || 0,
                    timestamp: state.timestamp,
                    value: state.value
                };
            });
        
        res.status(200).json({
            success: true,
            count: anomalyEvents.length,
            anomalies: anomalyEvents
        });
    } catch (error) {
        console.error('Error getting anomalies by location:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get detected anomalies only
router.get('/status/detected', (req, res) => {
    try {
        const anomalyEvents = EventRegistry.getAllEvents()
            .filter(event => event.type === 'anomaly' && event.getAnomalyState().detected === true)
            .map(event => {
                const state = event.getAnomalyState();
                return {
                    id: event.name,
                    name: event.name,
                    location: event.location,
                    anomalyType: event.anomalyType,
                    metricType: event.metricType,
                    detected: state.detected || false,
                    confidence: state.confidence || 0,
                    timestamp: state.timestamp,
                    value: state.value
                };
            });
        
        res.status(200).json({
            success: true,
            count: anomalyEvents.length,
            anomalies: anomalyEvents
        });
    } catch (error) {
        console.error('Error getting detected anomalies:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update anomaly state - for testing purposes
router.post('/update/:name', (req, res) => {
    try {
        const { name } = req.params;
        const { detected, confidence, value, additionalData } = req.body;
        
        const event = EventRegistry.getEvent(name);
        
        if (!event || event.type !== 'anomaly') {
            return res.status(404).json({
                success: false,
                error: `Anomaly not found: ${name}`
            });
        }
        
        // Create data object with provided values
        const data = {
            ...additionalData,
            confidence: confidence || 0,
            value: value || null
        };
        
        // Update anomaly state
        event.updateAnomalyState(detected === true, data);
        
        res.status(200).json({
            success: true,
            message: `Anomaly ${name} updated successfully`,
            anomaly: {
                id: event.name,
                name: event.name,
                location: event.location,
                anomalyType: event.anomalyType,
                metricType: event.metricType,
                detected: detected === true,
                state: event.getAnomalyState()
            }
        });
    } catch (error) {
        console.error('Error updating anomaly:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 