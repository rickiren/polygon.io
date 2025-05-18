import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
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
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');

  const WS_URL = 'wss://socket.polygon.io/crypto';
  const API_KEY = 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q';

  const isSocketOpen = () => {
    const ws = getWebSocket();
    return ws && ws.readyState === WebSocket.OPEN;
  };

  const {
    sendMessage,
    lastMessage,
    readyState,
    getWebSocket
  } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setError(null);
      setRetryCount(0);
      setConnectionStatus('Connected');
      
      // Ensure WebSocket is ready before sending messages
      const ws = getWebSocket();
      if (!ws) {
        console.warn('WebSocket not yet ready, retrying in 500ms');
        setTimeout(() => {
          const retryWs = getWebSocket();
          if (retryWs) {
            // Authenticate
            sendMessage(JSON.stringify({ 
              action: "auth", 
              params: API_KEY
            }));

            // Subscribe after auth
            setTimeout(() => {
              if (isSocketOpen()) {
                sendMessage(JSON.stringify({ 
                  action: "subscribe", 
                  params: "XT.*"
                }));
              } else {
                console.warn('WebSocket still not ready after retry');
              }
            }, 1000);
          } else {
            setError('Failed to establish WebSocket connection');
          }
        }, 500);
        return;
      }

      // If WebSocket is ready, proceed with auth and subscription
      sendMessage(JSON.stringify({ 
        action: "auth", 
        params: API_KEY
      }));

      setTimeout(() => {
        if (isSocketOpen()) {
          sendMessage(JSON.stringify({ 
            action: "subscribe", 
            params: "XT.*"
          }));
        } else {
          console.warn('WebSocket not ready during delayed subscribe');
        }
      }, 1000);
    },
    onClose: () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      setError('Connection closed. Attempting to reconnect...');
    },
    onError: (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error occurred. Please check your internet connection.');
      setIsConnected(false);
      setConnectionStatus('Error');
      setRetryCount(prev => prev + 1);
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle authentication success
        if (data.ev === 'status' && data.status === 'auth_success') {
          console.log('Authentication successful');
          setConnectionStatus('Authenticated');
          return;
        }
        
        // Handle subscription success
        if (data.ev === 'status' && data.status === 'success') {
          console.log('Subscription successful');
          return;
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    },
    shouldReconnect: (closeEvent) => retryCount < 5,
    reconnectInterval: (attemptNumber) => Math.min(1000 * Math.pow(2, attemptNumber), 10000),
    reconnectAttempts: 5,
    share: true
  });

  const processMessage = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;
    
    try {
      // Handle crypto events
      if (data.ev === 'XT') {
        const ticker = data.pair;
        const currentVolume = data.v * data.p; // volume * price
        const baselineVolume = baselineVolumes[ticker] || currentVolume;

        // Calculate relative volume
        const relativeVolume = currentVolume / baselineVolume;

        // Alert criteria: 2x volume spike and price movement
        if (relativeVolume >= 2) {
          const newAlert: Alert = {
            ticker,
            price: data.p,
            changePercent: data.dp || 0,
            relativeVolume,
            timestamp: new Date(),
          };

          setAlerts(prev => [newAlert, ...prev].slice(0, 50));
        }

        // Update baseline volume
        setBaselineVolumes(prev => ({
          ...prev,
          [ticker]: baselineVolume,
        }));
      }
    } catch (err) {
      console.error('Error processing message:', err);
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
      }
    }
  }, [lastMessage, processMessage]);

  const handleRetryConnection = () => {
    setRetryCount(0);
    setError(null);
    const ws = getWebSocket();
    if (ws) {
      ws.close();
    }
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
        <div className="flex items-center space-x-2">
          <span className={`inline-block h-2 w-2 rounded-full ${connectionStatusColor} animate-pulse`}></span>
          <span className="text-sm text-gray-400">{connectionStatus}</span>
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
                    <p className="text-sm text-gray-500">Monitoring for 2x volume spikes and price movement</p>
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