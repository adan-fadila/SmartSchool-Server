/**
 * Notification service for the interpreter system
 * This service handles sending notifications through various channels
 */

const { sendWhatsAppNotification } = require('./whatsappService');
const notificationConfig = require('./notificationConfig');

// Last notification timestamps to enforce throttling
const lastNotifications = {
  anomalyDetections: new Map(), // Maps anomaly name to timestamp
  ruleTriggered: new Map()      // Maps rule ID to timestamp
};

/**
 * Render a template with variables
 * @param {string} template - The template string with placeholders
 * @param {Object} variables - Variables to insert into the template
 * @returns {string} The rendered template
 */
function renderTemplate(template, variables) {
  let result = template;
  
  // Replace simple variables
  Object.entries(variables).forEach(([key, value]) => {
    // Skip if value is undefined
    if (value === undefined) return;
    
    // Handle conditional sections like {{#confidence}}...{{/confidence}}
    const conditionalRegex = new RegExp(`{{#${key}}}(.*?){{/${key}}}`, 'g');
    if (value) {
      // Keep the content but remove the markers
      result = result.replace(conditionalRegex, '$1');
    } else {
      // Remove the entire conditional section
      result = result.replace(conditionalRegex, '');
    }
    
    // Replace the placeholder with the value
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, value);
  });
  
  return result;
}

/**
 * Send a notification about an anomaly detection
 * @param {Object} anomalyData - Data about the detected anomaly
 * @returns {Promise<boolean>} Whether the notification was sent
 */
async function notifyAnomalyDetection(anomalyData) {
  try {
    // Skip if WhatsApp notifications are disabled
    if (!notificationConfig.whatsapp.enabled) {
      console.log('WhatsApp notifications are disabled.');
      return false;
    }
    
    // Skip if no data provided
    if (!anomalyData || !anomalyData.name) {
      console.error('Invalid anomaly data for notification');
      return false;
    }
    
    // Enforce throttling - check when the last notification was sent for this anomaly
    const now = Date.now();
    const lastNotificationTime = lastNotifications.anomalyDetections.get(anomalyData.name) || 0;
    const timeSinceLastNotification = now - lastNotificationTime;
    
    if (timeSinceLastNotification < notificationConfig.whatsapp.throttle.anomalyDetection) {
      console.log(`Throttling anomaly notification for ${anomalyData.name} - last sent ${timeSinceLastNotification}ms ago`);
      return false;
    }
    
    // Prepare template variables
    const variables = {
      location: anomalyData.location || 'Unknown',
      metricType: anomalyData.metricType || 'Unknown',
      anomalyType: anomalyData.anomalyType || 'anomaly',
      time: new Date().toLocaleString(),
      confidence: anomalyData.confidence ? (anomalyData.confidence * 100).toFixed(2) : undefined
    };
    
    // Render the message
    const message = renderTemplate(notificationConfig.templates.anomalyDetected, variables);
    
    // Send to all configured phone numbers
    for (const phoneNumber of notificationConfig.whatsapp.phoneNumbers) {
      console.log(`Sending anomaly notification to ${phoneNumber}`);
      await sendWhatsAppNotification(phoneNumber, message);
    }
    
    // Update last notification time
    lastNotifications.anomalyDetections.set(anomalyData.name, now);
    
    console.log(`Anomaly notification sent for ${anomalyData.name}`);
    return true;
  } catch (error) {
    console.error('Failed to send anomaly notification:', error);
    return false;
  }
}

/**
 * Send a notification about a rule being triggered
 * @param {Object} ruleData - Data about the triggered rule
 * @param {Object} eventData - Data about the event that triggered the rule
 * @returns {Promise<boolean>} Whether the notification was sent
 */
async function notifyRuleTriggered(ruleData, eventData) {
  try {
    // Skip if WhatsApp notifications are disabled
    if (!notificationConfig.whatsapp.enabled) {
      console.log('WhatsApp notifications are disabled.');
      return false;
    }
    
    // Skip if no data provided
    if (!ruleData || !ruleData.id) {
      console.error('Invalid rule data for notification');
      return false;
    }
    
    // Enforce throttling
    const now = Date.now();
    const lastNotificationTime = lastNotifications.ruleTriggered.get(ruleData.id) || 0;
    const timeSinceLastNotification = now - lastNotificationTime;
    
    if (timeSinceLastNotification < notificationConfig.whatsapp.throttle.ruleTriggered) {
      console.log(`Throttling rule notification for ${ruleData.id} - last sent ${timeSinceLastNotification}ms ago`);
      return false;
    }
    
    // Prepare template variables
    const variables = {
      ruleString: ruleData.ruleString || 'Unknown rule',
      eventName: ruleData.eventName || eventData?.name || 'Unknown event',
      location: eventData?.location || 'Unknown',
      metricType: eventData?.metricType || 'Unknown',
      anomalyType: eventData?.anomalyType || 'anomaly',
      time: new Date().toLocaleString(),
      actions: ruleData.actions || 'None'
    };
    
    // Render the message
    const message = renderTemplate(notificationConfig.templates.ruleTriggered, variables);
    
    // Send to all configured phone numbers
    for (const phoneNumber of notificationConfig.whatsapp.phoneNumbers) {
      console.log(`Sending rule notification to ${phoneNumber}`);
      await sendWhatsAppNotification(phoneNumber, message);
    }
    
    // Update last notification time
    lastNotifications.ruleTriggered.set(ruleData.id, now);
    
    console.log(`Rule notification sent for ${ruleData.id}`);
    return true;
  } catch (error) {
    console.error('Failed to send rule notification:', error);
    return false;
  }
}

module.exports = {
  notifyAnomalyDetection,
  notifyRuleTriggered
}; 