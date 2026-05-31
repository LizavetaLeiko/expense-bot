const Anthropic = require('@anthropic-ai/sdk');
const { anthropicApiKey } = require('../config');
const { getUserCategories } = require('../utils/categories');

const client = new Anthropic({ apiKey: anthropicApiKey });

function buildSystemPrompt(categoryList) {
  return `Ты — помощник по классификации расходов. Тебе приходит описание траты, и ты должен отнести её к одной из категорий.

Категории:
${categoryList}

Правила:
1. Верни ТОЛЬКО название категории — ничего больше.
2. Если описание не подходит ни к одной категории — верни "Прочее".
3. Не придумывай новых категорий.
4. Учитывай контекст: "пятёрочка" — это продукты, "zara" — одежда, "uber" — такси и т.д.
5. Если ты НЕ уверен в категории (описание слишком размытое, непонятное или бессмысленное) — верни ровно "НЕ_УВЕРЕН".`;
}

async function classifyExpense(description, telegramId) {
  const categories = await getUserCategories(telegramId);

  const categoryList = categories
    .map((c) => `- ${c.name}${c.hints ? ` (примеры: ${c.hints})` : ''}`)
    .join('\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 50,
    system: buildSystemPrompt(categoryList),
    messages: [
      { role: 'user', content: `Трата: "${description}"` },
    ],
  });

  const result = message.content[0].text.trim();

  // AI не уверен или отнёс к "Прочее" — возвращаем null для ручного выбора
  if (result === 'НЕ_УВЕРЕН') {
    return null;
  }

  // Проверяем, что ответ — одна из наших категорий
  const found = categories.find(
    (c) => c.name.toLowerCase() === result.toLowerCase()
  );

  if (!found || found.name === 'Прочее') {
    return null;
  }

  return found.name;
}

module.exports = { classifyExpense };
