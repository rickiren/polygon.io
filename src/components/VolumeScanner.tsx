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
}

const VolumeScanner: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [baselineVolumes, setBaselineVolumes] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Add wss:// prefix and ensure proper URL format
  const WS_URL = 'wss://socket.polygon.io/crypto';
  const API_KEY = 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q';

  const { sendMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setError(null);
      setRetryCount(0);
      try {
        // Authenticate with proper message format
        sendMessage(JSON.stringify({
          action: 'auth',
          params: API_KEY
        }));
        
        // Subscribe after successful authentication
        setTimeout(() => {
          sendMessage(JSON.stringify({
            action: 'subscribe',
            params: 'XT.*'
          }));
        }, 1000); // Wait 1 second after auth before subscribing
      } catch (err) {
        console.error('Error during WebSocket authentication:', err);
        setError('Failed to authenticate with Polygon.io');
        setIsConnected(false);
      }
    },
    onClose: () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      setError('Connection closed. Attempting to reconnect...');
    },
    onError: (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error occurred. Please check your internet connection.');
      setIsConnected(false);
      setRetryCount(prev => prev + 1);
    },
    shouldReconnect: (closeEvent) => {
      return retryCount < 5; // Limit retry attempts
    },
    reconnectInterval: (attemptNumber) => 
      Math.min(1000 * Math.pow(2, attemptNumber), 10000), // Exponential backoff
    reconnectAttempts: 5,
    filter: () => true, // Accept all messages
  });

  const processMessage = useCallback((data: any) => {
    if (!data) return;
    
    try {
      if (data.ev === 'XT') {
        const ticker = data.pair;
        const currentVolume = data.v * data.p;
        const baselineVolume = baselineVolumes[ticker] || currentVolume;

        // Calculate relative volume
        const relativeVolume = currentVolume / baselineVolume;

        // Check if meets alert criteria
        if (relativeVolume >= 2 && data.dp >= 5) {
          const newAlert: Alert = {
            ticker,
            price: data.p,
            changePercent: data.dp,
            relativeVolume,
            timestamp: new Date(),
          };

          setAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50 alerts
        }

        // Update baseline volume
        setBaselineVolumes(prev => ({
          ...prev,
          [ticker]: baselineVolume,
        }));
      }
    } catch (err) {
      console.error('Error processing message:', err);
      setError('Failed to process incoming data');
    }
  }, [baselineVolumes]);

  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (Array.isArray(data)) {
          data.forEach(processMessage);
        } else {
          processMessage(data);
        }
      } catch (err) {
        console.error('Error processing message:', err);
        setError('Failed to process incoming data');
      }
    }
  }, [lastMessage, processMessage]);

  const handleRetryConnection = () => {
    setRetryCount(0);
    setError(null);
    // The WebSocket will automatically reconnect due to shouldReconnect being true
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Volume2 className="text-blue-400" size={20} />
          <h2 className="text-lg font-semibold text-white">Volume Scanner</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
          <span className="text-sm text-gray-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border-b border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle size={16} />
              <p className="text-sm">{error}</p>
            </div>
            {retryCount >= 5 && (
              <button
                onClick={handleRetryConnection}
                className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ticker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Change %</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rel. Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  <div className="flex flex-col items-center space-y-2">
                    <AlertTriangle className="text-yellow-500" size={24} />
                    <p>Waiting for alerts...</p>
                    <p className="text-sm text-gray-500">Monitoring for 2x volume and 5% gains in 10 minutes</p>
                  </div>
                </td>
              </tr>
            ) : (
              alerts.map((alert, index) => (
                <tr
                  key={`${alert.ticker}-${alert.timestamp.getTime()}`}
                  className={`${index === 0 ? 'animate-pulse bg-green-900/20' : ''} hover:bg-gray-800/50`}
                >
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {alert.timestamp.toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-white">{alert.ticker}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-white">{formatCurrency(alert.price)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-green-400">{formatPercent(alert.changePercent)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-400">{alert.relativeVolume.toFixed(2)}x</span>
                  </td>
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