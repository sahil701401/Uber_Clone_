const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

const db = {
  users:         new Datastore({ filename: path.join(dbPath, 'users.db'),         autoload: true }),
  rides:         new Datastore({ filename: path.join(dbPath, 'rides.db'),         autoload: true }),
  notifications: new Datastore({ filename: path.join(dbPath, 'notifications.db'), autoload: true }),
  transactions:  new Datastore({ filename: path.join(dbPath, 'transactions.db'),  autoload: true }),
  promoCodes:    new Datastore({ filename: path.join(dbPath, 'promoCodes.db'),    autoload: true }),
};

db.users.ensureIndex({ fieldName: 'email', unique: true });
db.users.ensureIndex({ fieldName: 'phone', unique: true });
db.promoCodes.ensureIndex({ fieldName: 'code', unique: true });

// Seed default promo codes
const seedPromos = async () => {
  const count = await db.promoCodes.countAsync({});
  if (count === 0) {
    await db.promoCodes.insertAsync([
      { code: 'JAIPUR50',  type: 'flat',       value: 50,  minFare: 100, maxDiscount: 50,  usageLimit: 100, usedCount: 0, isActive: true, description: '₹50 off on rides above ₹100',    expiresAt: new Date('2027-12-31'), createdAt: new Date() },
      { code: 'PINKCITY', type: 'percentage',  value: 20,  minFare: 150, maxDiscount: 80,  usageLimit: 50,  usedCount: 0, isActive: true, description: '20% off upto ₹80',              expiresAt: new Date('2027-12-31'), createdAt: new Date() },
      { code: 'WELCOME',  type: 'flat',        value: 100, minFare: 200, maxDiscount: 100, usageLimit: 1,   usedCount: 0, isActive: true, description: '₹100 off on your first ride',   expiresAt: new Date('2027-12-31'), createdAt: new Date() },
      { code: 'AMBER10',  type: 'percentage',  value: 10,  minFare: 80,  maxDiscount: 50,  usageLimit: 200, usedCount: 0, isActive: true, description: '10% off on all rides',          expiresAt: new Date('2027-12-31'), createdAt: new Date() },
      { code: 'HAWA25',   type: 'flat',        value: 25,  minFare: 60,  maxDiscount: 25,  usageLimit: 150, usedCount: 0, isActive: true, description: '₹25 off on rides above ₹60',   expiresAt: new Date('2027-12-31'), createdAt: new Date() },
    ]);
    console.log('🎟️  Default promo codes seeded!');
  }
};
seedPromos();

console.log('✅ NeDB Database Ready!');
console.log(`📁 Data stored in: ${dbPath}`);

module.exports = db;
