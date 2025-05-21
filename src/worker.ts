import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let baselineVolumes: Record<string, number> = {};
let dailyHighs: Record<string, number> = {};
let volumeHistory: Record<string, number[]> = {};

const API_KEY = process.env.POLYGON_API_KEY;
let ws: WebSocket | null = null;

const updateVolumeHistory = (ticker: string, volume: number) => {
  const history = [...(volumeHistory[ticker] || []), volume].slice(-10);
  volumeHistory[ticker] = history;
  return history;
};

const calculateBaselineVolume = (ticker: string, currentVolume: number) => {
  const history = updateVolumeHistory(ticker, currentVolume);
  
  if (history.length < 5) {
    return currentVolume;
  }
  
  return history.reduce((sum, vol) => sum + vol, 0) / history.length;
};

const processMessage = async (data: any) => {
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
    let alertType: 'volume' | 'high' = 'volume';
    
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
      
      await supabase
        .from('crypto_alerts')
        .insert(newAlert);
        
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
    console.log('WebSocket Connected');
    
    ws?.send(JSON.stringify({ action: 'auth', params: API_KEY }));
    
    setTimeout(() => {
      ws?.send(JSON.stringify({ action: 'subscribe', params: 'XT.*' }));
    }, 200);
  });
  
  ws.on('message', (data: Buffer) => {
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

// Keep the process running
const startWorker = () => {
  console.log('Starting crypto monitor worker...');
  connectWebSocket();
  
  // Ping every 5 minutes to keep the connection alive
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 300000);
};

startWorker();