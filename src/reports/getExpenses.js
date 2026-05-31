const { Expense } = require('../db/models');

/**
 * Получает траты пользователя за период, сгруппированные по категориям
 */
async function getExpensesByPeriod(userId, from, to) {
  return Expense.find({
    userId,
    createdAt: { $gte: from, $lte: to },
  }).sort({ createdAt: 1 });
}

/**
 * Получает траты по специальному тегу за период
 */
async function getExpensesByTag(userId, tag, from, to) {
  const query = { userId, specialTag: tag };
  if (from && to) {
    query.createdAt = { $gte: from, $lte: to };
  }
  return Expense.find(query).sort({ createdAt: 1 });
}

/**
 * Группирует траты по категориям с суммами по валютам
 */
function groupByCategory(expenses) {
  const groups = {};

  for (const exp of expenses) {
    if (!groups[exp.category]) {
      groups[exp.category] = { totals: {}, items: [] };
    }

    const group = groups[exp.category];
    group.totals[exp.currency] = (group.totals[exp.currency] || 0) + exp.amount;
    group.items.push(exp);
  }

  return groups;
}

/**
 * Форматирует суммы по валютам в строку: "5 000Br + 100$"
 */
function formatTotals(totals) {
  return Object.entries(totals)
    .map(([currency, amount]) => `${amount.toLocaleString('ru-RU')}${currency}`)
    .join(' + ');
}

/**
 * Получает траты по категории за период (опционально)
 */
async function getExpensesByCategory(userId, category, from, to) {
  const query = { userId, category };
  if (from && to) {
    query.createdAt = { $gte: from, $lte: to };
  }
  return Expense.find(query).sort({ createdAt: 1 });
}

/**
 * Возвращает массив уникальных тегов из массива трат
 */
function getUniqueTags(expenses) {
  const tags = new Set();
  for (const exp of expenses) {
    if (exp.specialTag) tags.add(exp.specialTag);
  }
  return [...tags];
}

module.exports = { getExpensesByPeriod, getExpensesByTag, getExpensesByCategory, groupByCategory, formatTotals, getUniqueTags };
