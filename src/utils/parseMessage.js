/**
 * Парсит сообщение пользователя и извлекает:
 * - amount (число)
 * - currency (символ валюты или дефолт Br)
 * - specialTag (слово КАПСОМ, если есть)
 * - description (оставшийся текст)
 */
function parseMessage(text) {
  const trimmed = text.trim();

  let amount = null;
  let currency = 'Br';
  let textWithoutAmount = trimmed;

  // Паттерн: валюта перед числом ($100, €50) или число с валютой после (100$, 100€, 100р)
  // "р" принимаем как белорусский рубль (Br)
  const amountRegex = /^([$€])\s*(\d+(?:[.,]\d+)?)|^(\d+(?:[.,]\d+)?)\s*([$€р])?(?=\s|$)/;
  const match = trimmed.match(amountRegex);

  const currencyMap = { '$': '$', '€': '€', 'р': 'Br' };

  if (match) {
    if (match[1] && match[2]) {
      // $100 формат
      currency = currencyMap[match[1]] || 'Br';
      amount = parseFloat(match[2].replace(',', '.'));
    } else if (match[3]) {
      // 100$ или 100 формат
      amount = parseFloat(match[3].replace(',', '.'));
      if (match[4]) {
        currency = currencyMap[match[4]] || 'Br';
      }
    }
    textWithoutAmount = trimmed.slice(match[0].length).trim();
  }

  if (!amount || amount <= 0) {
    return null;
  }

  // Ищем слово КАПСОМ (минимум 2 кириллических заглавных буквы)
  // \b не работает с кириллицей, используем lookbehind/lookahead
  let specialTag = null;
  const capsRegex = /(?<=^|\s)([А-ЯЁ]{2,})(?=\s|$)/;
  const capsMatch = textWithoutAmount.match(capsRegex);

  if (capsMatch) {
    specialTag = capsMatch[1];
    textWithoutAmount = textWithoutAmount.replace(capsRegex, '').trim();
  }

  const description = textWithoutAmount.replace(/\s+/g, ' ').trim();

  return {
    amount,
    currency,
    specialTag,
    description,
  };
}

module.exports = { parseMessage };
