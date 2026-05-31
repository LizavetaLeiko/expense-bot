/**
 * Расстояние Левенштейна между двумя строками
 */
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // замена
          matrix[i][j - 1] + 1,     // вставка
          matrix[i - 1][j] + 1      // удаление
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Ищет похожий тег среди существующих.
 * Возвращает { match, distance } или null если нет похожих.
 */
function findSimilarTag(input, existingTags) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const tag of existingTags) {
    if (tag === input) return null; // Точное совпадение — не опечатка
    const dist = levenshtein(input.toLowerCase(), tag.toLowerCase());
    if (dist <= 2 && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = tag;
    }
  }

  return bestMatch ? { match: bestMatch, distance: bestDistance } : null;
}

module.exports = { findSimilarTag, levenshtein };
