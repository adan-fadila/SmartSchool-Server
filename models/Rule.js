const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({

  description: String,
  condition: String ,
  id: {
    type: String,
    required: true
  },
  space_id: {
    type: String,
    required: true
  },
  isStrict: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  interpreterId: {
    type: String,
    default: null
  },
  ruleString: {
    type: String,
    default: null
  },
  notificationPhoneNumber: {
    type: String,
    default: null
  },
  notificationMessage: {
    type: String,
    default: null
  },
  isNotificationRule: {
    type: Boolean,
    default: false
  }
});

const Rule = mongoose.model('rules', ruleSchema);

module.exports = Rule;
