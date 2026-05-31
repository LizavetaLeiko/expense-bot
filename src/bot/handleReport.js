const { parseDateRange } = require('../utils/parseDateRange');
const { getExpensesByPeriod, getExpensesByTag, getExpensesByCategory, groupByCategory, formatTotals, getUniqueTags } = require('../reports/getExpenses');
const { getUserCategories } = require('../utils/categories');
const { generatePieChart, generateTagPieChart } = require('../reports/chart');

/**
 * Вспомогательная: вычисляет grandTotals и формирует lines для caption
 */
function buildCaption(groups, header) {
  const grandTotals = {};
  for (const data of Object.values(groups)) {
    for (const [cur, amt] of Object.entries(data.totals)) {
      grandTotals[cur] = (grandTotals[cur] || 0) + amt;
    }
  }

  const lines = [`${header}: ${formatTotals(grandTotals)}\n`];
  for (const [category, data] of Object.entries(groups)) {
    lines.push(`• ${category}: ${formatTotals(data.totals)}`);
  }

  return lines.join('\n');
}

/**
 * /report 01.05.2026-31.05.2026
 * Отчёт из 3 слайдов:
 * 1. Без тегов
 * 2. По каждому тегу — отдельная диаграмма
 * 3. Общий итог
 */
async function handleReport(ctx) {
  const args = ctx.message.text.replace('/report', '').trim();
  const range = parseDateRange(args);

  if (!range) {
    return ctx.reply('Укажи дату или период:\n/report 01.05 — от даты до сегодня\n/report 01.05-31.05 — за период\n/report 1 мая-31 мая — текстом');
  }

  const expenses = await getExpensesByPeriod(ctx.from.id, range.from, range.to);

  if (expenses.length === 0) {
    return ctx.reply('Нет трат за этот период.');
  }

  // Слайд 1 — Без тегов
  const noTagExpenses = expenses.filter((e) => !e.specialTag);
  if (noTagExpenses.length > 0) {
    const groups = groupByCategory(noTagExpenses);
    const caption = buildCaption(groups, 'Итого (без тегов)');
    const chart = await generatePieChart(groups, 'Расходы (без тегов)');
    await ctx.replyWithPhoto({ source: chart }, { caption });
  }

  // Слайд 2 — По каждому тегу
  const tags = getUniqueTags(expenses);
  for (const tag of tags) {
    const tagExpenses = expenses.filter((e) => e.specialTag === tag);
    const groups = groupByCategory(tagExpenses);
    const caption = buildCaption(groups, `🏷 ${tag}`);
    const chart = await generateTagPieChart(groups, tag);
    await ctx.replyWithPhoto({ source: chart }, { caption });
  }

  // Слайд 3 — Общий итог
  const allGroups = groupByCategory(expenses);
  const allCaption = buildCaption(allGroups, 'Общий итог');
  const allChart = await generatePieChart(allGroups, 'Общий итог');
  await ctx.replyWithPhoto({ source: allChart }, { caption: allCaption });
}

/**
 * /detail 01.05.2026-31.05.2026
 * Детальный отчёт: все траты по категориям с датами
 */
async function handleDetail(ctx) {
  const args = ctx.message.text.replace('/detail', '').trim();
  const range = parseDateRange(args);

  if (!range) {
    return ctx.reply('Укажи дату или период:\n/detail 01.05 — от даты до сегодня\n/detail 01.05-31.05 — за период');
  }

  const allExpenses = await getExpensesByPeriod(ctx.from.id, range.from, range.to);
  const expenses = allExpenses.filter((e) => !e.specialTag);

  if (expenses.length === 0) {
    return ctx.reply('Нет трат без тегов за этот период.');
  }

  const groups = groupByCategory(expenses);

  for (const [category, data] of Object.entries(groups)) {
    const header = `📂 ${category}: ${formatTotals(data.totals)}`;
    const items = data.items.map((exp) => {
      const date = exp.createdAt.toLocaleDateString('ru-RU');
      const desc = exp.description || '—';
      return `  ${date} — ${exp.amount}${exp.currency} ${desc}`;
    });

    await ctx.reply(`${header}\n${items.join('\n')}`);
  }
}

/**
 * /tag_report ТЕГNAME
 * /tag_report ТЕГNAME дд.мм.гггг-дд.мм.гггг
 * Отчёт по тегу: диаграмма + суммы по категориям
 */
async function handleTagReport(ctx) {
  const args = ctx.message.text.replace('/tag_report', '').trim();

  if (!args) {
    return ctx.reply('Укажи тег: /tag_report ТЕГNAME\nИли с периодом: /tag_report ТЕГNAME дд.мм.гггг-дд.мм.гггг');
  }

  // Парсим: первое слово — тег, остальное — даты (опционально)
  const parts = args.match(/^(\S+)\s*(.*)$/);
  const tag = parts[1];
  const rangeStr = parts[2];

  let from, to;
  if (rangeStr) {
    const range = parseDateRange(rangeStr);
    if (!range) {
      return ctx.reply('Не удалось распознать период. Примеры: 01.05, 01.05-31.05, 1 мая-31 мая');
    }
    from = range.from;
    to = range.to;
  }

  const expenses = await getExpensesByTag(ctx.from.id, tag, from, to);

  if (expenses.length === 0) {
    const period = rangeStr ? ' за этот период' : '';
    return ctx.reply(`Нет трат по тегу "${tag}"${period}.`);
  }

  const groups = groupByCategory(expenses);

  // Общая сумма
  const grandTotals = {};
  for (const data of Object.values(groups)) {
    for (const [cur, amt] of Object.entries(data.totals)) {
      grandTotals[cur] = (grandTotals[cur] || 0) + amt;
    }
  }

  // Текстовая сводка: итого сверху, потом по категориям
  const lines = [`🏷 ${tag} — Итого: ${formatTotals(grandTotals)}\n`];
  for (const [category, data] of Object.entries(groups)) {
    lines.push(`• ${category}: ${formatTotals(data.totals)}`);
  }

  // Генерируем диаграмму
  const chartBuffer = await generateTagPieChart(groups, tag);

  await ctx.replyWithPhoto(
    { source: chartBuffer },
    { caption: lines.join('\n') }
  );
}

/**
 * /tag_detail ТЕГNAME
 * /tag_detail ТЕГNAME дд.мм.гггг-дд.мм.гггг
 * Детальный отчёт по тегу: все траты с датами
 */
async function handleTagDetail(ctx) {
  const args = ctx.message.text.replace('/tag_detail', '').trim();

  if (!args) {
    return ctx.reply('Укажи тег: /tag_detail ТЕГNAME\nИли с периодом: /tag_detail ТЕГNAME дд.мм.гггг-дд.мм.гггг');
  }

  const parts = args.match(/^(\S+)\s*(.*)$/);
  const tag = parts[1];
  const rangeStr = parts[2];

  let from, to;
  if (rangeStr) {
    const range = parseDateRange(rangeStr);
    if (!range) {
      return ctx.reply('Не удалось распознать период. Примеры: 01.05, 01.05-31.05, 1 мая-31 мая');
    }
    from = range.from;
    to = range.to;
  }

  const expenses = await getExpensesByTag(ctx.from.id, tag, from, to);

  if (expenses.length === 0) {
    const period = rangeStr ? ' за этот период' : '';
    return ctx.reply(`Нет трат по тегу "${tag}"${period}.`);
  }

  const groups = groupByCategory(expenses);

  for (const [category, data] of Object.entries(groups)) {
    const header = `📂 ${category}: ${formatTotals(data.totals)}`;
    const items = data.items.map((exp) => {
      const date = exp.createdAt.toLocaleDateString('ru-RU');
      const desc = exp.description || '—';
      return `  ${date} — ${exp.amount}${exp.currency} ${desc}`;
    });

    await ctx.reply(`${header}\n${items.join('\n')}`);
  }
}

/**
 * /category_detail Категория
 * /category_detail Категория дд.мм.гггг-дд.мм.гггг
 * Детальный отчёт по одной категории
 */
async function handleCategoryDetail(ctx) {
  const args = ctx.message.text.replace('/category_detail', '').trim();

  const userCategories = await getUserCategories(ctx.from.id);

  if (!args) {
    const names = userCategories.map((c) => c.name).join(', ');
    return ctx.reply(`Укажи категорию: /category_detail Название\n\nДоступные категории:\n${names}`);
  }

  // Парсим: всё до дат — название категории, даты — опционально
  const dateMatch = args.match(/^(.+?)\s+(\d{1,2}\.\d{1,2}\.\d{4}.*)$/);
  let categoryName, rangeStr;

  if (dateMatch) {
    categoryName = dateMatch[1].trim();
    rangeStr = dateMatch[2].trim();
  } else {
    categoryName = args.trim();
    rangeStr = '';
  }

  // Ищем категорию (нечувствительно к регистру)
  const found = userCategories.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!found) {
    const names = userCategories.map((c) => c.name).join(', ');
    return ctx.reply(`Категория "${categoryName}" не найдена.\n\nДоступные:\n${names}`);
  }

  let from, to;
  if (rangeStr) {
    const range = parseDateRange(rangeStr);
    if (!range) {
      return ctx.reply('Не удалось распознать период. Примеры: 01.05, 01.05-31.05, 1 мая-31 мая');
    }
    from = range.from;
    to = range.to;
  }

  const expenses = await getExpensesByCategory(ctx.from.id, found.name, from, to);

  if (expenses.length === 0) {
    const period = rangeStr ? ' за этот период' : '';
    return ctx.reply(`Нет трат в категории "${found.name}"${period}.`);
  }

  const totals = {};
  for (const exp of expenses) {
    totals[exp.currency] = (totals[exp.currency] || 0) + exp.amount;
  }

  const header = `📂 ${found.name}: ${formatTotals(totals)}`;
  const items = expenses.map((exp) => {
    const date = exp.createdAt.toLocaleDateString('ru-RU');
    const desc = exp.description || '—';
    const tag = exp.specialTag ? ` [${exp.specialTag}]` : '';
    return `  ${date} — ${exp.amount}${exp.currency} ${desc}${tag}`;
  });

  await ctx.reply(`${header}\n\n${items.join('\n')}`);
}

module.exports = { handleReport, handleDetail, handleTagReport, handleTagDetail, handleCategoryDetail };
