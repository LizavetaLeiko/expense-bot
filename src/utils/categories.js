const { categories } = require('../config');
const { User } = require('../db/models');

/**
 * Возвращает полный список категорий пользователя:
 * дефолтные из конфига (с пользовательскими hints) + пользовательские из БД.
 * Пользовательские вставляются перед "Прочее".
 */
async function getUserCategories(telegramId) {
  const user = await User.findOne({ telegramId });
  const custom = user?.customCategories || [];
  const customHints = user?.customHints || new Map();

  // Дефолтные категории с добавленными пользовательскими hints
  const base = categories.map((c) => {
    const extra = customHints.get(c.name);
    if (extra) {
      const merged = c.hints ? `${c.hints}, ${extra}` : extra;
      return { name: c.name, hints: merged };
    }
    return c;
  });

  if (custom.length === 0) return base;

  // Все кроме "Прочее" + пользовательские + "Прочее"
  const withoutProchee = base.filter((c) => c.name !== 'Прочее');
  const customEntries = custom.map((c) => ({ name: c.name, hints: c.hints || '' }));
  const prochee = base.find((c) => c.name === 'Прочее');

  return [...withoutProchee, ...customEntries, prochee];
}

module.exports = { getUserCategories };
