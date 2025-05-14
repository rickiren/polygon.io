export interface Crypto {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  supply?: number;
  lastUpdated: Date;
}

export interface ApiResponse {
  status: string;
  tickers: ApiCrypto[];
  next_url?: string;
}

export interface ApiCrypto {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  updated: number;
  marketCap: number;
  lastTrade: {
    p: number;
    s: number;
    t: number;
  };
  day: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  };
}

export interface CryptoMeta {
  ticker: string;
  name: string;
  market_cap?: number;
  total_supply?: number;
}

export interface CryptoMetaResponse {
  status: string;
  results: CryptoMeta;
}