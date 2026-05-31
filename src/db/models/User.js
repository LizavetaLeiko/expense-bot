const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  defaultCurrency: { type: String, default: 'Br' },
  customCategories: [{
    name: { type: String, required: true },
    hints: { type: String, default: '' },
  }],
  customHints: { type: Map, of: String, default: {} },
  specialTags: [String],
  budgetPeriodStart: { type: Date, default: null },
  budgets: { type: Map, of: Number, default: {} },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
