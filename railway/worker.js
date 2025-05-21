import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initial test log
console.log("✅ Worker started");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.POLYGON_API_KEY;

let baselineVolumes = {};
let dailyHighs = {};
let volumeHistory = {};

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

      baselineVolumes[ticker] = baselineVolume;
    }
  } catch (err) {
    console.error('❌ Error processing message:', err);
  }
}

function connectWebSocket() {
  const ws = new WebSocket('wss://socket.polygon.io/crypto');

  ws.on('open', () => {
    console.log('✅ WebSocket Connected');
    ws.send(JSON.stringify({ action: 'auth', params: API_KEY }));
    setTimeout(() => {
      ws.send(JSON.stringify({ action: 'subscribe', params: 'XT.*' }));
    }, 200);
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      processMessage(parsed);
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('🔁 WebSocket Disconnected. Reconnecting in 5s...');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err);
    ws.close();
  });
}

// Keep-alive log
setInterval(() => {
  console.log("👀 Worker still running...");
}, 10000);

console.log('🚀 Starting crypto monitor worker...');
connectWebSocket();