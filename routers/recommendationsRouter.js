const express = require('express');
const router = express.Router();
const { getRecommendations, updateRecommendations, refreshRecommendations } = require('../controllers/recommendationsController');

router.get('/', getRecommendations);
router.post('/', updateRecommendations);
router.post('/refresh', refreshRecommendations);

module.exports = { recommendationsRouter: router }; 