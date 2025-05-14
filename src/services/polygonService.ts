import { ApiResponse, Crypto, CryptoMeta, CryptoMetaResponse } from '../types/crypto';

const API_KEY = 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q';
const BASE_URL = 'https://api.polygon.io';

export const fetchTopGainers = async (): Promise<{ cryptos: Crypto[]; gainersCount: number }> => {
  try {
    // Fetch initial data
    let allTickers: any[] = [];
    let nextUrl = `${BASE_URL}/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${API_KEY}&limit=250`;

    // Fetch up to 1000 tickers using pagination
    while (allTickers.length < 1000 && nextUrl) {
      const response = await fetch(nextUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.tickers || !Array.isArray(data.tickers)) {
        throw new Error('Invalid API response structure');
      }

      allTickers = [...allTickers, ...data.tickers];
      nextUrl = data.next_url;

      // Add a small delay between requests to avoid rate limiting
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Total tickers received:', allTickers.length);

    const cryptos = allTickers
      .filter(ticker => ticker.lastTrade && ticker.day)
      .map(ticker => ({
        ticker: ticker.ticker,
        name: formatTickerToName(ticker.ticker),
        price: ticker.lastTrade.p,
        change: ticker.todaysChange,
        changePercent: ticker.todaysChangePerc,
        marketCap: ticker.market_cap,
        volume: ticker.day.v * ticker.lastTrade.p,
        dayHigh: ticker.day.h,
        dayLow: ticker.day.l,
        lastUpdated: new Date()
      }));

    const gainersCount = allTickers.filter(ticker => 
      ticker.todaysChangePerc > 10
    ).length;

    return {
      cryptos: cryptos.slice(0, 1000), // Ensure we don't exceed 1000 items
      gainersCount
    };
  } catch (error) {
    console.error('Error fetching cryptocurrency data:', error);
    return { cryptos: [], gainersCount: 0 };
  }
};

const formatTickerToName = (ticker: string): string => {
  return ticker.replace('X:', '').replace('USD', '');
};

export const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === 0) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatCurrency = (num: number | undefined): string => {
  if (num === undefined || num === 0) return 'N/A';
  
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  
  const decimalPlaces = num < 1 ? 6 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(num);
};

export const formatPercent = (num: number | undefined): string => {
  if (num === undefined) return 'N/A';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};