/**
 * Configuration for the notification system
 */

const notificationConfig = {
  // WhatsApp notification settings
  whatsapp: {
    // Whether to enable WhatsApp notifications
    enabled: true,
    
    // Phone numbers to notify - add multiple numbers to notify multiple people
    phoneNumbers: [
      '+972584045624',  // Replace with actual phone numbers
      // Add more phone numbers as needed
    ],
    
    // Notification frequencies (in milliseconds) to prevent spam
    throttle: {
      anomalyDetection: 60 * 1000, // 1 minute between detection notifications for the same anomaly
      ruleTriggered: 5 * 60 * 1000, // 5 minutes between rule trigger notifications for the same rule
    }
  },
  
  // Notification templates
  templates: {
    anomalyDetected: 
`🚨 ANOMALY DETECTED 🚨
Location: {{location}}
Type: {{metricType}} {{anomalyType}}
Time: {{time}}
{{#confidence}}Confidence: {{confidence}}%{{/confidence}}

This anomaly has triggered rules in the system. Please check the dashboard for more details.`,

    ruleTriggered:
`🔔 ANOMALY RULE TRIGGERED 🔔
Rule: "{{ruleString}}"
Event: {{eventName}}
Location: {{location}}
Type: {{metricType}} {{anomalyType}}
Time: {{time}}
Actions: {{actions}}

The system has taken appropriate actions based on this rule.`
  }
};

module.exports = notificationConfig; 