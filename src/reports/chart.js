const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { convertToBYN } = require('../utils/exchangeRates');

const FONT_PATH = path.join(__dirname, '..', '..', 'fonts', 'NotoSans-Regular.ttf');

const chartCanvas = new ChartJSNodeCanvas({
  width: 800,
  height: 600,
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = 'Noto Sans';
  },
});
chartCanvas.registerFont(FONT_PATH, { family: 'Noto Sans' });

const COLORS = [
  '#E74C3C', '#2E86C1', '#F39C12', '#27AE60', '#8E44AD',
  '#E67E22', '#1ABC9C', '#C0392B', '#2980B9', '#D4AC0D',
  '#16A085', '#7D3C98', '#CA6F1E', '#138D75', '#CB4335',
];

/**
 * Генерирует круговую диаграмму расходов по категориям.
 * Возвращает Buffer (png).
 */
async function convertTotalsToBYN(totals) {
  let sum = 0;
  for (const [currency, amount] of Object.entries(totals)) {
    sum += await convertToBYN(amount, currency);
  }
  return sum;
}

async function generatePieChart(groups, title = 'Расходы по категориям') {
  const labels = Object.keys(groups);
  const data = await Promise.all(
    labels.map((label) => convertTotalsToBYN(groups[label].totals))
  );

  const config = {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 14 } },
        },
        title: {
          display: true,
          text: title,
          font: { size: 18 },
        },
      },
    },
  };

  return chartCanvas.renderToBuffer(config);
}

/**
 * Генерирует круговую диаграмму расходов по тегу (группировка по категориям).
 * Возвращает Buffer (png).
 */
async function generateTagPieChart(groups, tag) {
  const labels = Object.keys(groups);
  const data = await Promise.all(
    labels.map((label) => convertTotalsToBYN(groups[label].totals))
  );

  const config = {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 14 } },
        },
        title: {
          display: true,
          text: `Расходы по тегу: ${tag}`,
          font: { size: 18 },
        },
      },
    },
  };

  return chartCanvas.renderToBuffer(config);
}

module.exports = { generatePieChart, generateTagPieChart };
