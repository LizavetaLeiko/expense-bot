const { Telegraf, Markup } = require('telegraf');
const { botToken } = require('../config');
const { handleExpense, ensureUser } = require('./handleExpense');
const { User, Expense } = require('../db/models');
const { getUserCategories } = require('../utils/categories');
const { parseDateRange, parseOneDate } = require('../utils/parseDateRange');
const { getBudgetProgress } = require('../utils/budget');
const { handleReport, handleDetail, handleTagReport, handleTagDetail, handleCategoryDetail } = require('./handleReport');
const { registerCallbacks } = require('./handleCallbacks');

const bot = new Telegraf(botToken);

// Команды
bot.start((ctx) => {
  ctx.reply(
    'Привет! Я бот для учёта расходов.\n\n' +
    'Просто отправь мне сумму и описание, например:\n' +
    '• 1000 продукты\n' +
    '• 500 ресторан умами\n' +
    '• 100$ РЕМОНТ обои\n\n' +
    'Команды:\n' +
    '/report дд.мм.гггг-дд.мм.гггг — отчёт за период\n' +
    '/detail дд.мм.гггг-дд.мм.гггг — детальный отчёт\n' +
    '/tag_report ТЕГNAME — отчёт по тегу\n' +
    '/tag_detail ТЕГNAME — детальный отчёт по тегу\n' +
    '/category_detail Категория — детальный отчёт по категории\n' +
    '/add_category Название — добавить свою категорию\n' +
    '/remove_category Название — удалить свою категорию\n' +
    '/add_hints Категория: подсказки — добавить подсказки\n' +
    '/delete — удалить трату\n' +
    '/new_period — начать новый период бюджета\n' +
    '/set_budget Категория Сумма — задать лимит\n' +
    '/budgets — сводка по бюджетам\n' +
    '/help — справка'
  );
});

bot.help((ctx) => {
  ctx.reply(
    'Как пользоваться:\n\n' +
    '1. Отправь трату: сумма + описание\n' +
    '   Примеры: 1000 продукты, 500$ такси\n' +
    '   Валюта по дефолту - рубль\n\n' +
    '2. КАПС-тег — для отдельного отчёта:\n' +
    '   100 РЕМОНТ обои → потом: /tag_report РЕМОНТ\n\n' +
    '3. Отчёты:\n' +
    '   /report 01.05.2026-31.05.2026 — сводка + диаграмма (год можно не указывать, тогда будет учитываться текущий)\n' +
    '   /report 01.05 — от даты до сегодня\n' +
    '   /report 1 мая — текстовый формат тоже ок\n' +
    '   /detail 01.05-31.05 — все траты по категориям\n' +
    '   /tag_report РЕМОНТ — отчёт по тегу (за всё время)\n' +
    '   /tag_report РЕМОНТ 01.05 — за период\n' +
    '   /tag_detail РЕМОНТ — детальный отчёт по тегу\n' +
    '   /category_detail Продукты — детальный отчёт по категории\n\n' +
    '4. Посмотреть категории:\n' +
    '   /categories — список всех категорий с подсказками\n\n' +
    '5. Добавить свои категории и подсказки (к своей или существующей категории):\n' +
    '   /add_category Транспорт дальний — добавить\n' +
    '   /add_category Транспорт дальний: самолёт, поезд — с подсказками (вводить их после двоеточия)\n' +
    '   /remove_category Транспорт дальний — удалить\n' +
    '   /add_hints Продукты: белка, еврик — подсказки к существующей (т.е. Категория: подсказки)\n\n' +
    '6. Удалить трату:\n' +
    '   Нажмите «Отменить» сразу после добавления\n' +
    '   /delete — последние траты для удаления\n' +
    '   /delete 01.05 — от даты до сегодня\n\n' +
    '7. Бюджеты — сумма, которую вы рассчитываете потратить на указанную категорию:\n' +
    '   /new_period — начать новый период (с сегодня) и завершить прошлый\n' +
    '   /new_period 29.05 — с указанной даты\n' +
    '   /set_budget Продукты 1000 — задать лимит\n' +
    '   /budgets — сводка по бюджетам\n\n' +
    'Валюта по умолчанию — рубль. Можно указывать другие, в отчете они будут указаны в введенной валюте, но в диаграмме будут конвертированы в рубль.'
  );
});

bot.command('report', handleReport);
bot.command('detail', handleDetail);
bot.command('tag_report', handleTagReport);
bot.command('tag_detail', handleTagDetail);
bot.command('category_detail', handleCategoryDetail);

bot.command('categories', async (ctx) => {
  const telegramId = ctx.from.id;
  await ensureUser(telegramId);
  const cats = await getUserCategories(telegramId);

  const lines = cats.map((c) => {
    if (c.hints) {
      return `• *${c.name}*\n  Подсказки: ${c.hints}`;
    }
    return `• *${c.name}*`;
  });

  await ctx.reply(`Категории:\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
});

bot.command('add_category', async (ctx) => {
  const args = ctx.message.text.replace('/add_category', '').trim();
  if (!args) {
    return ctx.reply('Формат: /add_category Название\nИли с подсказками: /add_category Название: подсказка1, подсказка2');
  }

  const [name, ...rest] = args.split(':');
  const hints = rest.join(':').trim();
  const telegramId = ctx.from.id;
  await ensureUser(telegramId);

  const user = await User.findOne({ telegramId });
  if (user.customCategories.some((c) => c.name === name)) {
    return ctx.reply(`Категория "${name}" уже существует.`);
  }

  await User.updateOne({ telegramId }, { $push: { customCategories: { name, hints: hints || '' } } });
  let reply = `Категория "${name}" добавлена.`;
  if (hints) reply += `\nПодсказки: ${hints}`;
  await ctx.reply(reply);
});

bot.command('remove_category', async (ctx) => {
  const name = ctx.message.text.replace('/remove_category', '').trim();
  if (!name) {
    return ctx.reply('Укажи название: /remove_category Название');
  }

  const telegramId = ctx.from.id;
  const user = await User.findOne({ telegramId });

  if (!user || !user.customCategories.some((c) => c.name === name)) {
    return ctx.reply(`Категория "${name}" не найдена в пользовательских.`);
  }

  await User.updateOne({ telegramId }, { $pull: { customCategories: { name } } });
  await ctx.reply(`Категория "${name}" удалена.`);
});

bot.command('delete', async (ctx) => {
  const args = ctx.message.text.replace('/delete', '').trim();
  const telegramId = ctx.from.id;

  const query = { userId: telegramId };

  // Фильтр по периоду
  if (args) {
    const range = parseDateRange(args);
    if (!range) {
      return ctx.reply('Формат: /delete или /delete 01.05, /delete 01.05-31.05');
    }
    query.createdAt = { $gte: range.from, $lte: range.to };
  }

  const PAGE = 10;
  const expenses = await Expense.find(query)
    .sort({ createdAt: -1 })
    .limit(PAGE + 1); // +1 чтобы понять, есть ли ещё

  if (expenses.length === 0) {
    const period = args ? ' за этот период' : '';
    return ctx.reply(`Нет трат для удаления${period}.`);
  }

  const hasMore = expenses.length > PAGE;
  const toShow = expenses.slice(0, PAGE);

  const rows = toShow.map((exp) => {
    const date = exp.createdAt.toLocaleDateString('ru-RU');
    const desc = exp.description || '—';
    const tag = exp.specialTag ? ` [${exp.specialTag}]` : '';
    const label = `${date} ${exp.amount}${exp.currency} ${desc}${tag} (${exp.category})`;
    return [Markup.button.callback(label, `del_${exp._id}`)];
  });

  if (hasMore) {
    // Offset = timestamp последней показанной траты
    const lastTs = toShow[toShow.length - 1].createdAt.getTime();
    rows.push([Markup.button.callback('Показать ещё →', `delmore_${lastTs}`)]);
  }

  await ctx.reply('Нажмите на трату, чтобы удалить:', Markup.inlineKeyboard(rows));
});

bot.command('add_hints', async (ctx) => {
  const args = ctx.message.text.replace('/add_hints', '').trim();
  if (!args || !args.includes(':')) {
    return ctx.reply('Формат: /add_hints Категория: подсказка1, подсказка2\nПример: /add_hints Продукты: белка, еврик');
  }

  const [categoryName, ...rest] = args.split(':');
  const hints = rest.join(':').trim();
  if (!hints) {
    return ctx.reply('Укажи подсказки после :');
  }

  const telegramId = ctx.from.id;
  await ensureUser(telegramId);

  await User.updateOne(
    { telegramId },
    { $set: { [`customHints.${categoryName}`]: hints } }
  );
  await ctx.reply(`Подсказки для "${categoryName}" добавлены: ${hints}`);
});

bot.command('new_period', async (ctx) => {
  const args = ctx.message.text.replace('/new_period', '').trim();
  const telegramId = ctx.from.id;
  await ensureUser(telegramId);

  let startDate;
  if (args) {
    const parsed = parseOneDate(args);
    if (!parsed) {
      return ctx.reply('Не удалось распознать дату. Примеры: /new_period 29.05, /new_period 29 мая');
    }
    startDate = new Date(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  await User.updateOne({ telegramId }, {
    $set: { budgetPeriodStart: startDate, budgets: {} },
  });

  const dateStr = startDate.toLocaleDateString('ru-RU');
  await ctx.reply(`Новый период начат с ${dateStr}.\nЗадайте бюджеты: /set_budget Категория Сумма`);
});

bot.command('set_budget', async (ctx) => {
  const args = ctx.message.text.replace('/set_budget', '').trim();
  if (!args) {
    return ctx.reply('Формат: /set_budget Категория Сумма\nПример: /set_budget Продукты 1000');
  }

  const telegramId = ctx.from.id;
  const user = await User.findOne({ telegramId });

  if (!user || !user.budgetPeriodStart) {
    return ctx.reply('Сначала начните период: /new_period');
  }

  // Последнее слово — сумма, остальное — название категории
  const parts = args.match(/^(.+)\s+(\d+(?:[.,]\d+)?)$/);
  if (!parts) {
    return ctx.reply('Формат: /set_budget Категория Сумма\nПример: /set_budget Продукты 1000');
  }

  const categoryName = parts[1].trim();
  const amount = parseFloat(parts[2].replace(',', '.'));

  const userCategories = await getUserCategories(telegramId);
  const found = userCategories.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!found) {
    const names = userCategories.map((c) => c.name).join(', ');
    return ctx.reply(`Категория "${categoryName}" не найдена.\n\nДоступные:\n${names}`);
  }

  await User.updateOne({ telegramId }, {
    $set: { [`budgets.${found.name}`]: amount },
  });

  await ctx.reply(`Бюджет на "${found.name}": ${amount.toLocaleString('ru-RU')}Br`);
});

bot.command('budgets', async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await User.findOne({ telegramId });

  if (!user || !user.budgetPeriodStart || !user.budgets || user.budgets.size === 0) {
    return ctx.reply('Бюджеты не заданы. Начните период: /new_period');
  }

  const dateStr = user.budgetPeriodStart.toLocaleDateString('ru-RU');
  const lines = [`Бюджеты (с ${dateStr}):\n`];

  for (const [category, limit] of user.budgets) {
    const progress = await getBudgetProgress(telegramId, category);
    if (progress) {
      lines.push(`• ${category}: ${progress}`);
    }
  }

  await ctx.reply(lines.join('\n'));
});

// Inline-кнопки (переспрос опечаток)
registerCallbacks(bot);

// Текстовые сообщения
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  // Пропускаем команды
  if (text.startsWith('/')) return;

  // Иначе — это трата
  try {
    await handleExpense(ctx);
  } catch (err) {
    console.error('Error handling expense:', err);
    await ctx.reply('Произошла ошибка при обработке. Попробуй ещё раз.');
  }
});

bot.telegram.setMyCommands([
  { command: 'report', description: 'Отчёт (дата или период: 01.05, 1 мая, 01.05-31.05)' },
  { command: 'detail', description: 'Детальный отчёт (дата или период)' },
  { command: 'tag_report', description: 'Отчёт по тегу (можно добавить дату/период)' },
  { command: 'tag_detail', description: 'Детальный отчёт по тегу (можно добавить дату/период)' },
  { command: 'category_detail', description: 'Отчёт по категории (можно добавить дату/период)' },
  { command: 'categories', description: 'Список всех категорий' },
  { command: 'add_category', description: 'Добавить свою категорию' },
  { command: 'remove_category', description: 'Удалить свою категорию' },
  { command: 'add_hints', description: 'Добавить подсказки к категории' },
  { command: 'delete', description: 'Удалить трату (можно добавить дату/период)' },
  { command: 'new_period', description: 'Начать новый период бюджета (можно добавить дату)' },
  { command: 'set_budget', description: 'Задать бюджет на категорию' },
  { command: 'budgets', description: 'Сводка по бюджетам' },
  { command: 'help', description: 'Справка' },
]);

module.exports = bot;
