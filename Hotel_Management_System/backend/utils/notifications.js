const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

async function notificationsEnabled(settingKey) {
  try {
    const settings = await Settings.findOne({ key: 'hotel' }).lean();
    return settings?.notifications?.[settingKey] !== false;
  } catch (error) {
    return true;
  }
}

async function createNotification({ audienceRoles = [], recipient = null, type = 'system', title, message, link = '', settingKey }) {
  try {
    if (settingKey && !(await notificationsEnabled(settingKey))) return null;
    return await Notification.create({ audienceRoles, recipient, type, title, message, link });
  } catch (error) {
    console.warn('Notification creation skipped:', error.message);
    return null;
  }
}

module.exports = { createNotification };
