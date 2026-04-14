/**
 * Backfill missing business location.city values from location.address.
 * Usage: node scripts/backfillCities.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Business = require('../models/Business');

const MAHARASHTRA_LOCATIONS = [
  'Mumbai',
  'Pune',
  'Nagpur',
  'Nashik',
  'Thane',
  'Aurangabad',
  'Solapur',
  'Kolhapur',
  'Amravati',
  'Nanded',
  'Sangli',
  'Jalgaon',
  'Akola',
  'Latur',
  'Dhule',
  'Ahmednagar',
  'Chandrapur',
  'Parbhani',
  'Satara',
  'Beed',
  'Yavatmal',
  'Panvel',
  'Malegaon',
  'Bhiwandi',
  'Ulhasnagar',
  'Gondia',
  'Bhandara',
  'Haveli',
  'Mulshi',
  'Maval',
  'Khed',
  'Junnar',
  'Ambegaon',
  'Baramati',
  'Indapur',
  'Daund',
  'Shirur',
  'Karjat',
  'Panvel Taluka',
  'Alibag',
  'Roha',
  'Mahad',
  'Chiplun',
  'Dapoli',
  'Kankavli',
  'Sawantwadi',
  'Satara Taluka',
  'Wai',
  'Karad',
  'Phaltan',
  'Patan',
  'Miraj',
  'Tasgaon',
  'Kagal',
  'Panhala',
  'Hatkanangale',
  'Niphad',
  'Sinnar',
  'Igatpuri',
  'Yeola',
  'Malegaon Taluka',
  'Parner',
  'Sangamner',
  'Rahata',
  'Shrirampur',
  'Nevasa',
  'Akole',
];

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const detectLocationFromAddress = (address = '') => {
  if (!address) return null;
  const normalized = String(address).trim();
  if (!normalized) return null;

  for (const location of MAHARASHTRA_LOCATIONS) {
    const regex = new RegExp(`\\b${escapeRegex(location)}\\b`, 'i');
    if (regex.test(normalized)) {
      return location;
    }
  }

  return null;
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const businesses = await Business.find({
    $or: [
      { 'location.city': { $exists: false } },
      { 'location.city': null },
      { 'location.city': '' },
    ],
    'location.address': { $exists: true, $ne: '' },
  }).select('_id name location.city location.address');

  if (businesses.length === 0) {
    console.log('No businesses need city backfill.');
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;

  for (const business of businesses) {
    const inferred = detectLocationFromAddress(business.location?.address || '');

    if (!inferred) {
      skipped += 1;
      continue;
    }

    await Business.updateOne(
      { _id: business._id },
      { $set: { 'location.city': inferred } }
    );

    updated += 1;
    console.log(`Updated ${business.name}: ${inferred}`);
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}, Total scanned: ${businesses.length}`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
