const { connectDB } = require('./db');
const bot = require('./bot');

async function main() {
  await connectDB();
  await bot.launch();
  console.log('Bot started');
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
