import { useState, useEffect, useRef } from 'react';
import { Crypto } from '../types/crypto';
import { fetchTopGainers } from '../services/polygonService';

export const useCryptoData = (refreshInterval = 30000) => {
  const [cryptos, setCryptos] = useState<Crypto[]>([]);
  const [gainersCount, setGainersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatedFields, setUpdatedFields] = useState<Set<string>>(new Set());
  const previousData = useRef<Map<string, Crypto>>(new Map());

  const fetchData = async () => {
    try {
      const { cryptos: data, gainersCount: count } = await fetchTopGainers();
      
      const updatedTickersSet = new Set<string>();
      
      data.forEach(crypto => {
        const prevCrypto = previousData.current.get(crypto.ticker);
        
        if (prevCrypto) {
          if (
            prevCrypto.price !== crypto.price ||
            prevCrypto.changePercent !== crypto.changePercent
          ) {
            updatedTickersSet.add(crypto.ticker);
          }
        }
        
        previousData.current.set(crypto.ticker, crypto);
      });
      
      setCryptos(data);
      setGainersCount(count);
      setUpdatedFields(updatedTickersSet);
      setLastUpdated(new Date());
      setLoading(false);
      
      setTimeout(() => {
        setUpdatedFields(new Set());
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  return { cryptos, gainersCount, loading, error, lastUpdated, updatedFields };
};