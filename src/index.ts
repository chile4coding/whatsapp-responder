import { WhatsAppBot } from './bot';
import * as dotenv from 'dotenv';
// import dns from 'node:dns';

// // Force Node to use IPv4 to bypass WSL2's broken IPv6 routing
// dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const sessionPath = process.env.SESSION_PATH || './sessions';

const bot = new WhatsAppBot(sessionPath);

async function main() {
  try {
    await bot.initialize();
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await bot.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await bot.destroy();
  process.exit(0);
});