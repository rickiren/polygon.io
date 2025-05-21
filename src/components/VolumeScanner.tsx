import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from 'react-use-websocket';
import { AlertTriangle, Volume2 } from 'lucide-react';
import { formatCurrency, formatPercent } from '../services/polygonService';

interface Alert {
  ticker: string;
  price: number;
  changePercent: number;
  relativeVolume: number;
  timestamp: Date;
  type: 'volume' | 'high';
}

const VolumeScanner: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [baselineVolumes, setBaselineVolumes] = useState<Record<string, number>>({});
  const [dailyHighs, setDailyHighs] = useState<Record<string, number>>({});
  const [volumeHistory, setVolumeHistory] = useState<Record<string, number[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [debugInfo, setDebugInfo] = useState<string>('');

  const socketUrl = 'wss://socket.polygon.io/crypto';
  const API_KEY = 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q';

  const isBrowser = typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';

  const updateVolumeHistory = useCallback((ticker: string, volume: number) => {
    setVolumeHistory(prev => {
      const history = [...(prev[ticker] || []), volume].slice(-10);
      return { ...prev, [ticker]: history };
    });
  }, []);

  const calculateBaselineVolume = useCallback((ticker: string, currentVolume: number) => {
    const history = volumeHistory[ticker] || [];
    updateVolumeHistory(ticker, currentVolume);

    if (history.length < 5) {
      return currentVolume;
    }

    const average = history.reduce((sum, vol) => sum + vol, 0) / history.length;
    return average;
  }, [volumeHistory, updateVolumeHistory]);

  const processMessage = useCallback((data: any) => {
    try {
      const ticker = data.pair;
      const currentPrice = data.p;
      const currentVolume = data.v * data.p;
      const baselineVolume = calculateBaselineVolume(ticker, currentVolume);
      const relativeVolume = currentVolume / baselineVolume;

      let previousHigh = dailyHighs[ticker];
      if (!previousHigh) {
        previousHigh = currentPrice;
        setDailyHighs(prev => ({ ...prev, [ticker]: currentPrice }));
      }

      console.log(`📊 ${ticker}`, {
        price: currentPrice,
        previousHigh,
        relativeVolume,
        baselineVolume,
        volume: currentVolume
      });

      let shouldAddAlert = false;
      let alertType: 'volume' | 'high' = 'volume';

      if (relativeVolume >= 1.5) {
        shouldAddAlert = true;
        alertType = 'volume';
      }

      if (currentPrice > previousHigh) {
        shouldAddAlert = true;
        alertType = 'high';
        setDailyHighs(prev => ({ ...prev, [ticker]: currentPrice }));
      }

      if (shouldAddAlert) {
        const newAlert: Alert = {
          ticker,
          price: currentPrice,
          changePercent: data.dp || 0,
          relativeVolume,
          timestamp: new Date(),
          type: alertType
        };

        setAlerts(prev => [newAlert, ...prev].slice(0, 50));
        setDebugInfo(`ALERT: ${alertType.toUpperCase()} on ${ticker}`);
        console.log('🚨 Alert:', newAlert);
      }

      setBaselineVolumes(prev => ({
        ...prev,
        [ticker]: baselineVolume
      }));
    } catch (err) {
      console.error('Process error:', err);
      setDebugInfo(`Process error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [calculateBaselineVolume, dailyHighs]);

  const socketOptions = {
    shouldReconnect: () => true,
    reconnectAttempts: 5,
    reconnectInterval: 5000,
    onOpen: () => {
      console.log('✅ WebSocket Connected');
      setConnectionStatus('Connected');

      setTimeout(() => {
        console.log('🔑 Sending auth...');
        sendJsonMessage({ action: 'auth', params: API_KEY });

        setTimeout(() => {
          console.log('📩 Subscribing...');
          sendJsonMessage({ action: 'subscribe', params: 'XT.*' });
        }, 200);
      }, 200);
    },
    onClose: () => {
      setConnectionStatus('Disconnected');
      setError('WebSocket closed. Reconnecting...');
    },
    onError: (event: any) => {
      console.error('WebSocket error:', event);
      setConnectionStatus('Error');
      setError('WebSocket error. Check your internet or API key.');
    },
    onMessage: (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('🔔 Incoming:', data);

        if (data.ev === 'status' && data.status === 'auth_success') {
          setConnectionStatus('Authenticated');
          setError(null);
          return;
        }

        if (data.ev !== 'XT' || !data.p || !data.v || !data.pair) return;

        processMessage(data);
      } catch (err) {
        setDebugInfo(`Message error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
  };

  const { sendJsonMessage } = isBrowser
    ? useWebSocket(socketUrl, socketOptions)
    : { sendJsonMessage: () => {} }; // dummy fallback

  // 🔧 Test alert to confirm UI is working
  useEffect(() => {
    const testAlert: Alert = {
      ticker: 'X:TEST',
      price: 12345,
      changePercent: 4.2,
      relativeVolume: 2.5,
      timestamp: new Date(),
      type: 'volume'
    };
    setAlerts(prev => [testAlert, ...prev]);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('volumeAlerts', JSON.stringify(alerts));
    }
  }, [alerts]);

  const clearAlerts = () => {
    setAlerts([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('volumeAlerts');
    }
    setDebugInfo('Alerts cleared');
  };

  const connectionStatusColor = {
    'Connected': 'bg-green-400',
    'Authenticated': 'bg-blue-400',
    'Disconnected': 'bg-red-400',
    'Error': 'bg-yellow-400',
    'Connecting...': 'bg-gray-400'
  }[connectionStatus] || 'bg-gray-400';

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Volume2 className="text-blue-400" size={20} />
          <h2 className="text-lg font-semibold text-white">Volume Scanner</h2>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={clearAlerts}
            className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md"
          >
            Clear Alerts
          </button>
          <div className="flex items-center space-x-2">
            <span className={`inline-block h-2 w-2 rounded-full ${connectionStatusColor} animate-pulse`} />
            <span className="text-sm text-gray-400">{connectionStatus}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border-b border-red-800 text-sm text-red-400 flex items-center space-x-2">
          <AlertTriangle size={16} />
          <p>{error}</p>
        </div>
      )}

      <div className="p-2 bg-gray-800 border-b border-gray-700">
        <p className="text-xs text-gray-400">Debug: {debugInfo}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ticker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Change %</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rel. Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <div className="flex flex-col items-center space-y-2">
                    <AlertTriangle className="text-yellow-500" size={24} />
                    <p>Waiting for alerts...</p>
                    <p className="text-sm text-gray-500">Monitoring for volume spikes and new highs</p>
                  </div>
                </td>
              </tr>
            ) : (
              alerts.map((alert, index) => (
                <tr
                  key={`${alert.ticker}-${alert.timestamp.getTime()}`}
                  className={`${index === 0 ? 'animate-pulse bg-green-900/20' : ''} hover:bg-gray-800/50`}
                >
                  <td className="px-4 py-3 text-sm text-gray-300">{alert.timestamp.toLocaleTimeString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.type === 'volume' ? 'bg-blue-900/50 text-blue-400' : 'bg-green-900/50 text-green-400'
                    }`}>
                      {alert.type === 'volume' ? 'Volume' : 'New High'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-white">{alert.ticker}</td>
                  <td className="px-4 py-3 font-mono text-white">{formatCurrency(alert.price)}</td>
                  <td className="px-4 py-3 font-mono text-green-400">{formatPercent(alert.changePercent)}</td>
                  <td className="px-4 py-3 font-mono text-blue-400">{alert.relativeVolume.toFixed(2)}x</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VolumeScanner;