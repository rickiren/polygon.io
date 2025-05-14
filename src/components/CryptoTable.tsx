import React, { useState, useMemo } from 'react';
import { Crypto } from '../types/crypto';
import CryptoTableRow from './CryptoTableRow';
import { Search, RefreshCw, ArrowUpDown } from 'lucide-react';

interface CryptoTableProps {
  cryptos: Crypto[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  updatedFields: Set<string>;
  onRefresh: () => void;
}

type SortField = 'price' | 'changePercent' | 'marketCap' | 'volume' | 'dayHigh' | 'dayLow';
type SortDirection = 'asc' | 'desc';

const CryptoTable: React.FC<CryptoTableProps> = ({
  cryptos,
  loading,
  error,
  lastUpdated,
  updatedFields,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('changePercent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAndFilteredCryptos = useMemo(() => {
    let filtered = cryptos;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = cryptos.filter(
        crypto =>
          crypto.ticker.toLowerCase().includes(term) ||
          crypto.name.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === undefined || bValue === undefined) return 0;

      const comparison = aValue > bValue ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [cryptos, searchTerm, sortField, sortDirection]);

  const SortButton: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <button
      onClick={() => handleSort(field)}
      className="group flex items-center space-x-1 hover:text-white focus:outline-none"
    >
      <span>{label}</span>
      <ArrowUpDown
        size={14}
        className={`transition-colors ${
          sortField === field
            ? 'text-blue-400'
            : 'text-gray-600 group-hover:text-gray-400'
        }`}
      />
    </button>
  );

  if (error) {
    return (
      <div className="bg-red-900/20 text-red-200 p-4 rounded-lg border border-red-800">
        <p className="font-medium">Error loading data</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={onRefresh}
          className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md text-white flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-gray-900 rounded-lg shadow-xl border border-gray-800">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-gray-800">
        <div className="flex-1 w-full md:w-auto mb-4 md:mb-0">
          <div className="relative w-full md:max-w-md">
            <input
              type="text"
              placeholder="Search by ticker..."
              className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-400 w-full md:w-auto">
          {lastUpdated && (
            <div className="flex items-center">
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <button
                onClick={onRefresh}
                className="ml-2 p-1 rounded-full hover:bg-gray-700 transition-colors"
                title="Refresh now"
              >
                <RefreshCw size={16} className="text-blue-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="price" label="Price" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="dayHigh" label="24h High" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="dayLow" label="24h Low" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="changePercent" label="% Change" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="volume" label="Volume" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <SortButton field="marketCap" label="Market Cap" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Updated
              </th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {loading && sortedAndFilteredCryptos.length === 0 ? (
              Array.from({ length: 10 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  </td>
                </tr>
              ))
            ) : sortedAndFilteredCryptos.length > 0 ? (
              sortedAndFilteredCryptos.map((crypto) => (
                <CryptoTableRow
                  key={crypto.ticker}
                  crypto={crypto}
                  isUpdated={updatedFields.has(crypto.ticker)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  {searchTerm
                    ? 'No cryptocurrencies match your search.'
                    : 'No cryptocurrency data available.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 text-sm text-gray-400">
        Showing {sortedAndFilteredCryptos.length} of {cryptos.length} cryptocurrencies
      </div>
    </div>
  );
};

export default CryptoTable;