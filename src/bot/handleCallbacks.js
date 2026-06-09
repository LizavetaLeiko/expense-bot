const { Markup } = require('telegraf');
const { saveExpense, buildCategoryButtons, pendingCategoryChoice, pendingTypoChoice } = require('./handleExpense');
const { getUserCategories } = require('../utils/categories');
const { getBudgetProgress } = require('../utils/budget');
const { User, Expense } = require('../db/models');

function registerCallbacks(bot) {
  bot.action(/^typo_(yes|no)$/, async (ctx) => {
    const telegramId = ctx.from.id;
    const choice = ctx.match[1];
    const pending = pendingTypoChoice.get(telegramId);

    if (!pending) {
      await ctx.answerCbQuery('Данные устарели, попробуйте ещё раз.');
      return;
    }

    const data = choice === 'yes' ? pending.corrected : pending.original;
    pendingTypoChoice.delete(telegramId);

    await ctx.deleteMessage();
    await saveExpense(ctx, telegramId, data);
  });

  bot.action(/^cat_(\d+)$/, async (ctx) => {
    const telegramId = ctx.from.id;
    const index = parseInt(ctx.match[1], 10);
    const pending = pendingCategoryChoice.get(telegramId);

    const userCategories = await getUserCategories(telegramId);

    if (!pending || index < 0 || index >= userCategories.length) {
      await ctx.answerCbQuery('Данные устарели, попробуйте ещё раз.');
      return;
    }

    const category = userCategories[index].name;
    const { amount, currency, specialTag, description } = pending;
    pendingCategoryChoice.delete(telegramId);

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

    reply += `\n\nЧтобы я в следующий раз понял такую трату, добавьте подсказку:\n/add_hints ${category}: ${description}`;

    await ctx.deleteMessage();
    await ctx.reply(reply, Markup.inlineKeyboard([
      Markup.button.callback('Поменять категорию', `recat_${expense._id}`),
      Markup.button.callback('Отменить', `del_${expense._id}`),
    ]));
  });

  bot.action(/^recat_(.+)$/, async (ctx) => {
    const expenseId = ctx.match[1];
    const telegramId = ctx.from.id;
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      await ctx.answerCbQuery('Трата не найдена.');
      return;
    }

    // Удаляем старую трату и кладём данные в pending для повторного выбора
    await Expense.findByIdAndDelete(expenseId);
    pendingCategoryChoice.set(telegramId, {
      amount: expense.amount,
      currency: expense.currency,
      specialTag: expense.specialTag,
      description: expense.description,
    });

    const rows = await buildCategoryButtons(telegramId);

    await ctx.deleteMessage();
    await ctx.reply(
      `Выберите категорию для "${expense.description}":`,
      Markup.inlineKeyboard(rows)
    );
  });

  bot.action(/^del_(.+)$/, async (ctx) => {
    const expenseId = ctx.match[1];
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      await ctx.answerCbQuery('Трата уже удалена.');
      try { await ctx.deleteMessage(); } catch {}
      return;
    }

    await Expense.findByIdAndDelete(expenseId);
    await ctx.answerCbQuery('Трата удалена');

    // Убираем кнопку и помечаем сообщение как удалённое
    const oldText = ctx.callbackQuery.message.text;
    try {
      await ctx.editMessageText(`${oldText}\n\n❌ Удалено`, { reply_markup: { inline_keyboard: [] } });
    } catch {
      await ctx.deleteMessage();
    }
  });

  bot.action(/^delmore_(\d+)$/, async (ctx) => {
    const telegramId = ctx.from.id;
    const beforeTs = parseInt(ctx.match[1], 10);
    const PAGE = 10;

    const expenses = await Expense.find({
      userId: telegramId,
      createdAt: { $lt: new Date(beforeTs) },
    })
      .sort({ createdAt: -1 })
      .limit(PAGE + 1);

    if (expenses.length === 0) {
      await ctx.answerCbQuery('Больше трат нет.');
      return;
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
      const lastTs = toShow[toShow.length - 1].createdAt.getTime();
      rows.push([Markup.button.callback('Показать ещё →', `delmore_${lastTs}`)]);
    }

    await ctx.deleteMessage();
    await ctx.reply('Нажмите на трату, чтобы удалить:', Markup.inlineKeyboard(rows));
  });

  bot.action(/^deltag_(\d+)$/, async (ctx) => {
    const telegramId = ctx.from.id;
    const index = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId });

    if (!user || !user.specialTags || index >= user.specialTags.length) {
      await ctx.answerCbQuery('Данные устарели, попробуйте ещё раз.');
      return;
    }

    const tag = user.specialTags[index];
    await User.updateOne({ telegramId }, { $pull: { specialTags: tag } });
    await Expense.updateMany({ userId: telegramId, specialTag: tag }, { $set: { specialTag: null } });

    await ctx.answerCbQuery(`Тег "${tag}" удалён`);
    await ctx.editMessageText(`Тег "${tag}" удалён. Он снят со всех трат.`, { reply_markup: { inline_keyboard: [] } });
  });

  bot.action('cat_new', async (ctx) => {
    const telegramId = ctx.from.id;
    const pending = pendingCategoryChoice.get(telegramId);

    if (!pending) {
      await ctx.answerCbQuery('Данные устарели, попробуйте ещё раз.');
      return;
    }

    // Не удаляем pending — трата сохранится после создания категории
    await ctx.deleteMessage();
    await ctx.reply(
      `Создайте новую категорию командой:\n/add_category Название\n\n` +
      `После этого отправьте трату ещё раз: ${pending.amount}${pending.currency} ${pending.description || ''}`
    );
    pendingCategoryChoice.delete(telegramId);
  });
}

module.exports = { registerCallbacks };
