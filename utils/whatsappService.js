// utils/whatsappService.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Get credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

console.log('AccountSID available:', !!accountSid);
console.log('AuthToken available:', !!authToken);

// Initialize Twilio client
const client = require('twilio')(accountSid, authToken);

async function sendWhatsAppNotification(to, message) {
  try {
    // Make sure the number format is correct
    const formattedNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    const result = await client.messages.create({
      from: 'whatsapp:+14155238886', // Twilio sandbox number
      body: message,
      to: formattedNumber
    });
    
    console.log('Message sent successfully:', result.sid);
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

module.exports = {
  sendWhatsAppNotification
};