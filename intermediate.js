const express = require('express');
const BigNumber = require('bignumber.js');
const keccak = require('keccak');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const axios = require('axios');
const nodelogex = require('nodelogex');
const cron = require('node-cron');
const Redis = require('redis');
const { Server } = require('socket.io');
const http = require('http');
const moment = require('moment');
const _ = require('lodash');
const { ethers } = require('ethers');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.use(express.json());

const redisClient = Redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect().catch(err => logger.error({ event: 'redis_connect_error', error: err.message }));

const rateLimiter = new RateLimiterRedis({ storeClient: redisClient, points: 10, duration: 60 });
const provider = new ethers.providers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID');

const logger = nodelogex.createLogger({
  level: 'info',
  format: nodelogex.format.combine(
    nodelogex.format.timestamp(),
    nodelogex.format.json()
  ),
  transports: [
    new nodelogex.transports.File({ filename: 'price_monitor.log' }),
    new nodelogex.transports.Console()
  ]
});

const SUPPORTED_TOKENS = ['ethereum', 'bitcoin'];
let priceHistory = {};
let alertSubscriptions = {};

async function fetchPrice(token) {
  const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`); 
  const price = new BigNumber(response.data[token].usd); 
  priceHistory[token] = priceHistory[token] || [];
  priceHistory[token].push({ price: price.toString(), timestamp: moment().unix() }); 
  await redisClient.hSet(`price:${token}`, 'usd', price); 
  io.emit('price_update', { token, price: price.toString() });

  if (alertSubscriptions[token]) {
    const { threshold } = alertSubscriptions[token];
    if (price.gt(threshold)) { 
      logger.info({ event: 'alert_triggered', token, price: price.toString(), threshold });
    }
  }
  return price;
}

async function hashPrice(token, price) {
  const hash = keccak('keccak256').update(`${token}${price}`).digest('hex'); 
  return hash;
}

async function calculateYield(token) {
  const latestPrice = priceHistory[token] && priceHistory[token].length > 0 ? new BigNumber(priceHistory[token][priceHistory[token].length - 1].price) : new BigNumber(0);
  const yieldRate = latestPrice.dividedBy(100); 
  return yieldRate.toString();
}

app.get('/price/:token', async (req, res) => {
  await rateLimiter.consume(req.ip).catch(() => res.status(429).send('Too Many Requests'));
  const token = req.params.token.toLowerCase();
  if (!SUPPORTED_TOKENS.includes(token)) return res.status(400).send('Unsupported token');

  const cachedPrice = await redisClient.hGetAll(`price:${token}`);
  if (!_.isEmpty(cachedPrice)) {
    return res.json({ token, price: cachedPrice.usd }); 
  }

  const price = await fetchPrice(token);
  res.json({ token, price: price.toString() });
});

app.post('/price/hash', async (req, res) => {
  await rateLimiter.consume(req.ip).catch(() => res.status(429).send('Too Many Requests'));
  const { token, price } = req.body;
  if (!SUPPORTED_TOKENS.includes(token)) return res.status(400).send('Unsupported token');

  const hash = await hashPrice(token, price);
  logger.info({ event: 'price_hashed', token, hash });
  res.json({ hash });
});

app.post('/price/alert', async (req, res) => {
  const { token, threshold } = req.body;
  if (!SUPPORTED_TOKENS.includes(token) || !threshold) return res.status(400).send('Invalid input');

  alertSubscriptions[token] = { threshold }; 
  logger.info({ event: 'alert_subscribed', token, threshold });
  res.status(201).json({ token, threshold });
});

app.get('/yield/analytics', async (req, res) => {
  const yieldRates = {};
  for (const token of SUPPORTED_TOKENS) {
    yieldRates[token] = await calculateYield(token);
  }
  res.json({ yieldRates }); 
});

cron.schedule('*/1 * * * *', async () => {
  await Promise.all(SUPPORTED_TOKENS.map(fetchPrice));
  logger.info({ event: 'price_update_cron', timestamp: moment().toISOString() });
});

server.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});
