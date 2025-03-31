// test-whatsapp.js
const { sendWhatsAppNotification } = require('../utils/whatsappService');

// Example usage
async function notifyUser() {
  try {
    await sendWhatsAppNotification('+972584045624', 'Your notification message here');
    console.log('Notification sent successfully');
  } catch (error) {
    console.log('Failed to send notification:', error);
  }
}

// Execute the function
notifyUser();