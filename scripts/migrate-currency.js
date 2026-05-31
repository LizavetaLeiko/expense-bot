/**
 * Одноразовый скрипт: заменяет '₽' на 'Br' во всех Expense.
 * Запуск: node scripts/migrate-currency.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config');
const { Expense } = require('../src/db/models');

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const result = await Expense.updateMany(
    { currency: '₽' },
    { $set: { currency: 'Br' } }
  );

  console.log(`Updated ${result.modifiedCount} expenses (₽ → Br)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
