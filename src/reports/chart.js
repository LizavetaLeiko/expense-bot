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
  '#F9DEEC', '#CDBCB6', '#A4DDDE', '#CAE4C4', '#EA949D',
  '#CAEAED', '#FFE99A', '#E56E83', '#DABDFF', '#F1F9A4',
  '#8FA3EE', '#8FB79D', '#ABF7B7', '#F2A9E0', '#EABDB8',
  '#C3CCCD', '#FFC0CC', '#F9F1E6', '#73FFC0', '#B9CEFF',
  '#B7BCFF', '#F87BFF', '#FE89C7', '#FE8989', '#EAE1B8'
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
