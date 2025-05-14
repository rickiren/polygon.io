import React from 'react';
import { Crypto } from '../types/crypto';
import { formatCurrency, formatPercent } from '../services/polygonService';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface CryptoTableRowProps {
  crypto: Crypto;
  isUpdated: boolean;
}

const CryptoTableRow: React.FC<CryptoTableRowProps> = ({ crypto, isUpdated }) => {
  const isPositive = crypto.changePercent >= 0;
  const ticker = crypto.ticker.replace('X:', '').replace('USD', '');
  
  return (
    <tr
      className={`border-b border-gray-700 ${
        isUpdated ? 'animate-pulse bg-indigo-900/20' : ''
      } transition-colors duration-500 hover:bg-gray-800/50`}
    >
      <td className="px-4 py-3 font-medium">
        <span className="text-sm font-mono font-semibold text-white">{ticker}</span>
      </td>
      
      <td className="px-4 py-3">
        <span className="font-mono font-medium text-white">{formatCurrency(crypto.price)}</span>
      </td>

      <td className="px-4 py-3">
        <span className="font-mono font-medium text-green-400">{formatCurrency(crypto.dayHigh)}</span>
      </td>

      <td className="px-4 py-3">
        <span className="font-mono font-medium text-red-400">{formatCurrency(crypto.dayLow)}</span>
      </td>
      
      <td className="px-4 py-3">
        <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? (
            <ArrowUpCircle size={16} className="flex-shrink-0" />
          ) : (
            <ArrowDownCircle size={16} className="flex-shrink-0" />
          )}
          <span className="font-mono font-medium">{formatPercent(crypto.changePercent)}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="font-mono text-sm text-gray-300">{formatCurrency(crypto.volume)}</span>
      </td>
      
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-gray-300">{crypto.marketCap ? formatCurrency(crypto.marketCap) : 'N/A'}</span>
      </td>
      
      <td className="px-4 py-3">
        <span className="text-xs text-gray-400">
          {crypto.lastUpdated.toLocaleTimeString()}
        </span>
      </td>
    </tr>
  );
};

export default CryptoTableRow;