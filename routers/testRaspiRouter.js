const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/test-node', (req, res) => {
    res.status(200).json({ message: 'Node.js server is running!' });
});

router.post('/test-flask', async (req, res) => {
    try {
        const data = { test: "Hello from Node.js!" };
        const response = await axios.post('https://f6ff-193-58-150-10.ngrok-free.app/test-flask', data);
        res.status(200).json({
            message: 'Data sent to Flask server successfully!',
            flaskResponse: response.data,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error connecting to Flask server', error: error.message });
    }
});

module.exports = router;
