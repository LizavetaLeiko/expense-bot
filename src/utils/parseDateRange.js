const MONTHS = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
  'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
  'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4,
  'май': 5, 'июн': 6, 'июл': 7, 'авг': 8,
  'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
};

/**
 * Парсит одну дату из строки. Поддерживает:
 *   дд.мм.гггг
 *   дд.мм (текущий год)
 *   30 мая
 *   30 мая 2026
 * Возвращает { day, month, year } или null
 */
function parseOneDate(str) {
  const s = str.trim();
  const year = new Date().getFullYear();

  // дд.мм.гггг
  const full = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (full) return { day: +full[1], month: +full[2], year: +full[3] };

  // дд.мм (текущий год)
  const short = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (short) return { day: +short[1], month: +short[2], year };

  // 30 мая или 30 мая 2026
  const textDate = s.match(/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?$/i);
  if (textDate) {
    const monthName = textDate[2].toLowerCase();
    const month = MONTHS[monthName];
    if (month) {
      return { day: +textDate[1], month, year: textDate[3] ? +textDate[3] : year };
    }
  }

  return null;
}

/**
 * Парсит строку с диапазоном дат или одной датой.
 * Форматы:
 *   дд.мм.гггг-дд.мм.гггг
 *   дд.мм-дд.мм (текущий год)
 *   30 мая-15 июня
 *   30 мая 2026-15 июня 2026
 *   дд.мм.гггг (только старт — до сегодня)
 *   дд.мм (только старт, текущий год — до сегодня)
 *   30 мая (только старт — до сегодня)
 * Возвращает { from: Date, to: Date } или null
 */
function parseDateRange(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Пробуем разбить по дефису на два куска
  // Ищем дефис-разделитель: он между двумя частями даты
  // Сначала пробуем стандартные форматы с дефисом
  const dashPatterns = [
    // дд.мм.гггг-дд.мм.гггг
    /^(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})$/,
    // дд.мм-дд.мм
    /^(\d{1,2}\.\d{1,2})\s*-\s*(\d{1,2}\.\d{1,2})$/,
    // дд.мм.гггг-дд.мм
    /^(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2})$/,
    // дд.мм-дд.мм.гггг
    /^(\d{1,2}\.\d{1,2})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})$/,
  ];

  for (const pattern of dashPatterns) {
    const m = trimmed.match(pattern);
    if (m) {
      const d1 = parseOneDate(m[1]);
      const d2 = parseOneDate(m[2]);
      if (d1 && d2) {
        return {
          from: new Date(d1.year, d1.month - 1, d1.day, 0, 0, 0),
          to: new Date(d2.year, d2.month - 1, d2.day, 23, 59, 59),
        };
      }
    }
  }

  // Текстовые даты с дефисом: "30 мая-15 июня", "30 мая 2026-15 июня 2026"
  const textRangeMatch = trimmed.match(/^(\d{1,2}\s+[а-яё]+(?:\s+\d{4})?)\s*-\s*(\d{1,2}\s+[а-яё]+(?:\s+\d{4})?)$/i);
  if (textRangeMatch) {
    const d1 = parseOneDate(textRangeMatch[1]);
    const d2 = parseOneDate(textRangeMatch[2]);
    if (d1 && d2) {
      return {
        from: new Date(d1.year, d1.month - 1, d1.day, 0, 0, 0),
        to: new Date(d2.year, d2.month - 1, d2.day, 23, 59, 59),
      };
    }
  }

  // Одна дата — от неё до сегодня
  const single = parseOneDate(trimmed);
  if (single) {
    const now = new Date();
    return {
      from: new Date(single.year, single.month - 1, single.day, 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    };
  }

  return null;
}

module.exports = { parseDateRange, parseOneDate };
