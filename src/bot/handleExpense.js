const { Markup } = require('telegraf');
const { parseMessage } = require('../utils/parseMessage');
const { classifyExpense } = require('../ai/classify');
const { findSimilarTag } = require('../utils/fuzzyMatch');
const { User, Expense } = require('../db/models');
const { getUserCategories } = require('../utils/categories');
const { getBudgetProgress } = require('../utils/budget');

// Pending-данные для ручного выбора категории (telegramId → expenseData)
const pendingCategoryChoice = new Map();

// Pending-данные для исправления опечатки в теге (telegramId → { corrected, original })
const pendingTypoChoice = new Map();

async function ensureUser(telegramId) {
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({ telegramId });
  }
  return user;
}

async function handleExpense(ctx) {
  const text = ctx.message.text;
  const parsed = parseMessage(text);

  if (!parsed) {
    await ctx.reply(
      'Не удалось распознать трату. Формат: сумма + описание.\n' +
      'Примеры: 1000 продукты, 500$ такси, 50 РЕМОНТ обои\n\n' +
      'Все команды: /help'
    );
    return;
  }

  const { amount, currency, specialTag, description } = parsed;
  const telegramId = ctx.from.id;

  const user = await ensureUser(telegramId);

  // Проверяем опечатку в теге
  if (specialTag && user.specialTags.length > 0) {
    const similar = findSimilarTag(specialTag, user.specialTags);
    if (similar) {
      pendingTypoChoice.set(telegramId, {
        corrected: { amount, currency, specialTag: similar.match, description },
        original: { amount, currency, specialTag, description },
      });

      await ctx.reply(
        `Похоже на опечатку. Вы имели в виду "${similar.match}" вместо "${specialTag}"?`,
        Markup.inlineKeyboard([
          Markup.button.callback(`Да, ${similar.match}`, 'typo_yes'),
          Markup.button.callback(`Нет, оставить ${specialTag}`, 'typo_no'),
        ])
      );
      return;
    }
  }

  await saveExpense(ctx, telegramId, { amount, currency, specialTag, description });
}

async function buildCategoryButtons(telegramId) {
  const userCategories = await getUserCategories(telegramId);

  const procheeIdx = userCategories.findIndex((c) => c.name === 'Прочее');
  const rows = [];
  if (procheeIdx !== -1) {
    rows.push([Markup.button.callback('Прочее', `cat_${procheeIdx}`)]);
  }

  const otherButtons = userCategories
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.name !== 'Прочее')
    .map(({ c, i }) => Markup.button.callback(c.name, `cat_${i}`));

  for (let i = 0; i < otherButtons.length; i += 3) {
    rows.push(otherButtons.slice(i, i + 3));
  }

  rows.push([Markup.button.callback('+ Новая категория', 'cat_new')]);
  return rows;
}

async function saveExpense(ctx, telegramId, { amount, currency, specialTag, description }) {
  const category = await classifyExpense(description, telegramId);

  // AI не уверен — показываем кнопки для ручного выбора
  if (category === null) {
    pendingCategoryChoice.set(telegramId, { amount, currency, specialTag, description });

    const rows = await buildCategoryButtons(telegramId);

    await ctx.reply(
      `Не могу определить категорию для "${description}". Выберите вручную:`,
      Markup.inlineKeyboard(rows)
    );
    return;
  }

  const expense = await Expense.create({
    userId: telegramId,
    amount,
    currency,
    category,
    specialTag,
    description,
  });

  if (specialTag) {
    await User.updateOne(
      { telegramId },
      { $addToSet: { specialTags: specialTag } }
    );
  }

  let reply = `✓ ${amount}${currency} → ${category}`;
  if (specialTag) {
    reply += ` [${specialTag}]`;
  }
  if (description) {
    reply += `\n  «${description}»`;
  }

  const progress = await getBudgetProgress(telegramId, category);
  if (progress) {
    reply += `\n  ${progress}`;
  }

  await ctx.reply(reply, Markup.inlineKeyboard([
    Markup.button.callback('Поменять категорию', `recat_${expense._id}`),
    Markup.button.callback('Отменить', `del_${expense._id}`),
  ]));
}

module.exports = { handleExpense, saveExpense, ensureUser, buildCategoryButtons, pendingCategoryChoice, pendingTypoChoice };
