import 'dotenv/config';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let baselineVolumes = {};
let dailyHighs = {};
let volumeHistory = {};

const API_KEY = process.env.POLYGON_API_KEY;
let ws = null;

const updateVolumeHistory = (ticker, volume) => {
  const history = [...(volumeHistory[ticker] || []), volume].slice(-10);
  volumeHistory[ticker] = history;
  return history;
};

const calculateBaselineVolume = (ticker, currentVolume) => {
  const history = volumeHistory[ticker] || [];
  updateVolumeHistory(ticker, currentVolume);

  if (history.length < 5) {
    return currentVolume;
  }

  return history.reduce((sum, vol) => sum + vol, 0) / history.length;
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

    console.log(`📊 ${ticker}`, {
      price: currentPrice,
      previousHigh,
      relativeVolume,
      baselineVolume,
      volume: currentVolume
    });

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

      const { error: insertError } = await supabase
        .from('crypto_alerts')
        .insert(newAlert);

      if (insertError) {
        throw insertError;
      }

      console.log(`🚨 Alert triggered: ${alertType} for ${ticker}`);
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
    console.log('WebSocket Disconnected');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
    ws?.terminate();
  });
};

// Start the worker
console.log('Starting crypto monitor worker...');
connectWebSocket();

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Cleaning up...');
  if (ws) {
    ws.terminate();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (ws) {
    ws.terminate();
  }
  process.exit(1);
});