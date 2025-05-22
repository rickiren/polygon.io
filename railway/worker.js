// railway/worker.js
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Set up Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.POLYGON_API_KEY;

let volumeHistory = {};
let dailyHighs = {};

console.log('🚀 Starting crypto scanner worker...');

function updateVolumeHistory(ticker, volume) {
  const history = [...(volumeHistory[ticker] || []), volume].slice(-10);
  volumeHistory[ticker] = history;
  return history;
}

function calculateBaselineVolume(ticker, currentVolume) {
  const history = updateVolumeHistory(ticker, currentVolume);
  if (history.length < 5) return currentVolume;
  return history.reduce((sum, vol) => sum + vol, 0) / history.length;
}

async function processMessage(data) {
  try {
    if (!Array.isArray(data)) return;

    for (const item of data) {
      if (item.ev !== 'XT' || !item.p || !item.v || !item.pair) continue;

      const ticker = item.pair;
      const currentPrice = item.p;
      const currentVolume = item.v * item.p;
      const baselineVolume = calculateBaselineVolume(ticker, currentVolume);
      const relativeVolume = currentVolume / baselineVolume;
      const previousHigh = dailyHighs[ticker] || currentPrice;

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
        const alert = {
          ticker,
          price: currentPrice,
          change_percent: item.dp || 0,
          relative_volume: relativeVolume,
          alert_type: alertType,
          created_at: new Date().toISOString()
        };

        await supabase.from('crypto_alerts').insert(alert);
        console.log(`🚨 Alert saved: ${ticker} (${alertType})`);
      }
    }
  } catch (err) {
    console.error('❌ Error processing message:', err);
  }
}

function connectWebSocket() {
  console.log('🧠 Connecting to Polygon WebSocket...');
  const ws = new WebSocket('wss://socket.polygon.io/crypto');
  let pingInterval;

  ws.on('open', () => {
    console.log('✅ WebSocket Connected');
    ws.send(JSON.stringify({ action: 'auth', params: API_KEY }));

    setTimeout(() => {
      console.log('📩 Subscribing to BTC & ETH only for testing');
      ws.send(JSON.stringify({ action: 'subscribe', params: 'XT.BTC-USD,XT.ETH-USD' }));
    }, 300);

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        console.log('📡 Sent ping to keep alive');
      }
    }, 30000);
  });

  ws.on('message', (data) => {
    console.log('📨 Message received');
    try {
      const parsed = JSON.parse(data.toString());
      processMessage(parsed);
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`🔁 WebSocket Disconnected. Code: ${code}, Reason: ${reason.toString()}`);
    clearInterval(pingInterval);
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err.message);
    ws.close();
  });
}

connectWebSocket();