const { User, Expense } = require('../db/models');
const { convertToBYN } = require('./exchangeRates');

/**
 * Возвращает строку прогресса бюджета для категории, или null если бюджет не задан.
 * Все траты конвертируются в BYN.
 * Пример: "[350 / 1000Br — 35%]" или "[1100 / 1000Br — 110% ⚠️]"
 */
async function getBudgetProgress(telegramId, category) {
  const user = await User.findOne({ telegramId });

  if (!user || !user.budgetPeriodStart || !user.budgets || !user.budgets.get(category)) {
    return null;
  }

  const limit = user.budgets.get(category);

  const expenses = await Expense.find({
    userId: telegramId,
    category,
    createdAt: { $gte: user.budgetPeriodStart },
  });

  let spent = 0;
  for (const exp of expenses) {
    spent += await convertToBYN(exp.amount, exp.currency);
  }

  spent = Math.round(spent * 100) / 100;
  const percent = Math.round((spent / limit) * 100);
  const warn = percent >= 100 ? ' ⚠️' : '';

  return `[${spent.toLocaleString('ru-RU')} / ${limit.toLocaleString('ru-RU')}Br — ${percent}%${warn}]`;
}

module.exports = { getBudgetProgress };
