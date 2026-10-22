require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const Room = require('./models/Room');
const bcrypt = require('bcryptjs');
const Service = require('./models/Service');
const Settings = require('./models/Settings');

// Development seed: intentionally NON-DESTRUCTIVE.
// It creates missing demo records without deleting rooms, users,
// or reservations that already exist in the database.
const seed = async () => {
  await connectDB();

  try {
    const mongoose = require('mongoose');
    try {
      await mongoose.connection.db.collection('rooms').dropIndex('roomNumber_1');
      console.log('Removed legacy rooms index: roomNumber_1');
    } catch (err) {
      if (err.codeName !== 'IndexNotFound' && err.code !== 27) {
        console.warn('Room index cleanup skipped:', err.message);
      }
    }

    const adminEmail = 'admin@luxurystay.com';

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      const password = await bcrypt.hash('admin123', 10);

      admin = await User.create({
        name: 'Administrator',
        email: adminEmail,
        password,
        role: 'admin',
        department: 'Administration',
        permissions: [
          'dashboard',
          'staff',
          'guests',
          'reservations',
          'rooms',
          'housekeeping',
          'maintenance',
          'billing',
          'reports',
          'services',
          'settings'
        ]
      });

      console.log('Created demo admin:', adminEmail);
    } else {
      admin.password = await bcrypt.hash('admin123', 10);
      admin.isActive = true;
      admin.permissions = [
        'dashboard',
        'staff',
        'guests',
        'reservations',
        'rooms',
        'housekeeping',
        'maintenance',
        'billing',
        'reports',
        'services',
        'settings'
      ];
      await admin.save();
      console.log('Demo admin already exists; password reset to admin123:', adminEmail);
    }

    const demoAccounts = [
      { name: 'Hotel Manager', email: 'manager@luxurystay.com', password: 'manager123', role: 'manager', department: 'Operations' },
      { name: 'Front Desk Receptionist', email: 'receptionist@luxurystay.com', password: 'reception123', role: 'receptionist', department: 'Front Desk' },
      { name: 'Housekeeping Staff', email: 'housekeeping@luxurystay.com', password: 'housekeeping123', role: 'housekeeping', department: 'Housekeeping' },
      { name: 'Maintenance Staff', email: 'maintenance@luxurystay.com', password: 'maintenance123', role: 'maintenance', department: 'Facilities' },
      { name: 'Demo Guest', email: 'guest@luxurystay.com', password: 'guest123', role: 'guest', idNumber: 'GUEST-001', department: '' }
    ];

    for (const account of demoAccounts) {
      let existing = await User.findOne({ email: account.email });
      if (!existing) {
        const hashed = await bcrypt.hash(account.password, 10);
        await User.create({
          name: account.name,
          email: account.email,
          password: hashed,
          role: account.role,
          department: account.department,
          idNumber: account.idNumber || '',
          isActive: true,
          permissions: account.role === 'guest' ? [] : (account.role === 'manager' ? ['dashboard', 'rooms', 'reservations', 'housekeeping', 'maintenance', 'billing', 'reports', 'services'] : account.role === 'receptionist' ? ['rooms', 'reservations'] : account.role === 'housekeeping' ? ['rooms', 'housekeeping', 'maintenance'] : ['rooms', 'maintenance'])
        });
        console.log(`Created demo ${account.role}: ${account.email}`);
      } else if (!existing.password) {
        existing.password = await bcrypt.hash(account.password, 10);
        if (account.role === 'guest' && !existing.idNumber) existing.idNumber = account.idNumber;
        await existing.save();
        console.log(`Set missing password for demo account: ${account.email}`);
      }
    }

    const rooms = [
      { number: '101', type: 'Deluxe', price: 150, amenities: ['WiFi', 'TV', 'Minibar'] },
      { number: '102', type: 'Deluxe', price: 150, amenities: ['WiFi', 'TV', 'Minibar'] },
      { number: '201', type: 'Suite', price: 300, amenities: ['WiFi', 'TV', 'Minibar', 'Balcony'] }
    ];

    for (const roomData of rooms) {
      const existing = await Room.findOne({ number: roomData.number });

      if (!existing) {
        await Room.create(roomData);
        console.log(`Created demo room ${roomData.number}`);
      }
    }

    const services = [
      { name: 'Breakfast', description: 'Daily breakfast service', price: 25 },
      { name: 'Laundry', description: 'Laundry and pressing service', price: 18 },
      { name: 'Airport Transfer', description: 'Private airport transfer', price: 45 },
      { name: 'Room Service', description: 'In-room dining service', price: 30 },
      { name: 'Wake-up Call', description: 'Personalized morning wake-up call', price: 0 },
      { name: 'Transportation', description: 'Airport and local private transportation', price: 45 },
      { name: 'Housekeeping Request', description: 'Extra towels, amenities and room assistance', price: 0 }
    ];

    for (const serviceData of services) {
      const existing = await Service.findOne({ name: serviceData.name });

      if (!existing) {
        await Service.create(serviceData);
        console.log(`Created demo service: ${serviceData.name}`);
      }
    }

    const existingSettings = await Settings.findOne({ key: 'hotel' });
    if (!existingSettings) {
      await Settings.create({
        key: 'hotel',
        propertyName: 'LuxuryStay Hospitality',
        propertyCode: 'LSH-001',
        contactEmail: 'frontdesk@luxurystay.com',
        currency: 'USD',
        taxRate: 12,
        defaultCheckIn: '14:00',
        defaultCheckOut: '12:00',
        roomRates: [
          { type: 'Deluxe', rate: 150 },
          { type: 'Suite', rate: 300 }
        ]
      });
      console.log('Created default system settings');
    }

    console.log('Seed complete (existing data preserved)');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  }
};

seed();
