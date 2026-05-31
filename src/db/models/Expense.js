const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'Br' },
  category: { type: String, required: true },
  specialTag: { type: String, default: null },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

expenseSchema.index({ userId: 1, createdAt: 1 });
expenseSchema.index({ userId: 1, specialTag: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
