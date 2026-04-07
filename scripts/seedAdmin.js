/**
 * Run once to create the first admin user.
 * Usage: node scripts/seedAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN = {
  name: process.env.ADMIN_NAME || 'Admin',
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  role: 'admin',
};

if (!ADMIN.email || !ADMIN.password) {
  console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    console.log('Admin already exists:', ADMIN.email);
    process.exit(0);
  }

  // Let the User pre-save hook handle hashing — do NOT pre-hash here
  await User.create({ ...ADMIN });

  console.log('✅ Admin created successfully!');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
