import { w3cwebsocket as W3CWebSocket } from 'websocket';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.POLYGON_API_KEY;
const SOCKET_URL = 'wss://socket.polygon.io/crypto';
const PAIR = 'XT.BTC-USD';

console.log('🚀 Starting official Polygon WebSocket client...');

let volumeHistory = {};
let dailyHighs = {};

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
        created_at: new Date().toISOString(),
      };

      await supabase.from('crypto_alerts').insert(alert);
      console.log(`🚨 Alert saved: ${ticker} (${alertType})`);
    }
  }
}

function startClient() {
  const ws = new W3CWebSocket(SOCKET_URL);

  ws.onopen = () => {
    console.log('✅ WebSocket Opened');
    ws.send(JSON.stringify({ action: 'auth', params: API_KEY }));

    setTimeout(() => {
      ws.send(JSON.stringify({ action: 'subscribe', params: PAIR }));
      console.log(`📩 Subscribed to ${PAIR}`);
    }, 1000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      processMessage(data);
    } catch (err) {
      console.error('❌ Failed to parse message:', err.message);
    }
  };

  ws.onerror = (err) => {
    console.error('❌ WebSocket error:', err.message || err);
  };

  ws.onclose = (event) => {
    console.log(`🔁 WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
  };
}

startClient();