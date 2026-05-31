const SYMBOL_TO_CODE = {
  'Br': 'BYN',
  '$': 'USD',
  '€': 'EUR',
};

let cachedRates = null;
let cachedAt = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

async function getRates() {
  if (cachedRates && Date.now() - cachedAt < CACHE_TTL) {
    return cachedRates;
  }

  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  const data = await res.json();

  if (data.result !== 'success') {
    throw new Error('Failed to fetch exchange rates');
  }

  cachedRates = data.rates;
  cachedAt = Date.now();
  return cachedRates;
}

/**
 * Конвертирует сумму в BYN по текущему курсу.
 * Если валюта уже BYN (Br) — возвращает как есть.
 */
async function convertToBYN(amount, currencySymbol) {
  const code = SYMBOL_TO_CODE[currencySymbol];
  if (!code) return amount;
  if (code === 'BYN') return amount;

  const rates = await getRates();
  // amount в валюте code → USD → BYN
  // 1 USD = rates[code] единиц валюты, значит amount / rates[code] = сумма в USD
  // 1 USD = rates.BYN в BYN
  return (amount / rates[code]) * rates.BYN;
}

module.exports = { convertToBYN };
