const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { convertToBYN } = require('../utils/exchangeRates');

const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 600 });

const COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#C9CBCF', '#7BC8A4', '#E7E9ED', '#76D7C4',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
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
