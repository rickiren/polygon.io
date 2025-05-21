import 'dotenv/config';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import TelegramBot from 'node-telegram-bot-api';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// State management
let baselineVolumes = {};
let dailyHighs = {};
let volumeHistory = {};

// WebSocket connection
let ws = null;
const API_KEY = process.env.POLYGON_API_KEY;

const formatCurrency = (num) => {
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  const decimalPlaces = num < 1 ? 6 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(num);
};

const updateVolumeHistory = (ticker, volume) => {
  const history = [...(volumeHistory[ticker] || []), volume].slice(-10);
  volumeHistory[ticker] = history;
  return history;
};

const calculateBaselineVolume = (ticker, currentVolume) => {
  const history = updateVolumeHistory(ticker, currentVolume);
  if (history.length < 5) return currentVolume;
  return history.reduce((sum, vol) => sum + vol, 0) / history.length;
};

const sendTelegramAlert = async (alert) => {
  try {
    const message = `🚨 ${alert.alert_type === 'volume' ? 'Volume Alert' : 'New High'} for ${alert.ticker}\n` +
      `💰 Price: ${formatCurrency(alert.price)}\n` +
      `📈 Change: ${alert.change_percent.toFixed(2)}%\n` +
      `📊 Relative Volume: ${alert.relative_volume.toFixed(2)}x`;

    await bot.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('Telegram alert sent successfully');
  } catch (err) {
    console.error('Failed to send Telegram alert:', err);
  }
};

const processMessage = async (data) => {
  try {
    if (data.ev !== 'XT' || !data.p || !data.v || !data.pair) return;
    
    const ticker = data.pair;
    const currentPrice = data.p;
    const currentVolume = data.v * data.p;
    const baselineVolume = calculateBaselineVolume(ticker, currentVolume);
    const relativeVolume = currentVolume / baselineVolume;
    
    let previousHigh = dailyHighs[ticker];
    if (!previousHigh) {
      previousHigh = currentPrice;
      dailyHighs[ticker] = currentPrice;
    }
    
    let shouldAddAlert = false;
    let alertType = 'volume';
    
    if (relativeVolume >= 1.5) {
      shouldAddAlert = true;
      alertType = 'volume';
    }
    
    if (currentPrice > previousHigh) {
      shouldAddAlert = true;
      alertType = 'high';
      dailyHighs[ticker] = currentPrice;
    }
    
    if (shouldAddAlert) {
      const newAlert = {
        ticker,
        price: currentPrice,
        change_percent: data.dp || 0,
        relative_volume: relativeVolume,
        alert_type: alertType,
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('crypto_alerts')
        .insert(newAlert);
        
      if (error) {
        throw error;
      }
      
      await sendTelegramAlert(newAlert);
      console.log(`Alert triggered: ${alertType} for ${ticker}`);
    }
    
    baselineVolumes[ticker] = baselineVolume;
  } catch (err) {
    console.error('Process error:', err);
  }
};

const connectWebSocket = () => {
  if (ws) {
    ws.terminate();
  }
  
  ws = new WebSocket('wss://socket.polygon.io/crypto');
  
  ws.on('open', () => {
    console.log('✅ WebSocket Connected');
    
    ws.send(JSON.stringify({ action: 'auth', params: API_KEY }));
    
    setTimeout(() => {
      ws.send(JSON.stringify({ action: 'subscribe', params: 'XT.*' }));
    }, 200);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      processMessage(message);
    } catch (err) {
      console.error('Message processing error:', err);
    }
  });
  
  ws.on('close', () => {
    console.log('❌ WebSocket Disconnected');
    setTimeout(connectWebSocket, 5000);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
    ws?.terminate();
  });
};

// Start the service
console.log('🚀 Starting Crypto Monitor Service...');
connectWebSocket();

// Keep the process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});