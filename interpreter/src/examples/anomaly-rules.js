/**
 * Example rules for anomaly events
 * 
 * These rules show how to set up automatic responses to different types of anomalies.
 * They can be used as templates for creating more complex rules.
 */

const RuleManager = require('../rules/RuleManager');

// Example rule creation functions
function createAnomalyRules() {
    console.log('Creating example anomaly rules...');
    
    // Rule for temperature pointwise anomaly
    const tempPointwiseRule = RuleManager.createRule(
        'if living room temperature pointwise anomaly detected == true then living room ac on 21 cool'
    );
    console.log(`Created temperature pointwise anomaly rule: ${tempPointwiseRule}`);
    
    // Rule for temperature seasonality anomaly
    const tempSeasonalityRule = RuleManager.createRule(
        'if living room temperature seasonality anomaly detected == true then living room ac on 23 cool'
    );
    console.log(`Created temperature seasonality anomaly rule: ${tempSeasonalityRule}`);
    
    // Rule for humidity trend anomaly
    const humidityTrendRule = RuleManager.createRule(
        'if living room humidity trend anomaly detected == true then living room light on'
    );
    console.log(`Created humidity trend anomaly rule: ${humidityTrendRule}`);
    
    return {
        tempPointwiseRule,
        tempSeasonalityRule,
        humidityTrendRule
    };
}

module.exports = { createAnomalyRules }; 