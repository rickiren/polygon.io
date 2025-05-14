import React, { useState } from 'react';
import { useCryptoData } from './hooks/useCryptoData';
import CryptoTable from './components/CryptoTable';
import VolumeScanner from './components/VolumeScanner';
import Header from './components/Header';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  
  const { 
    cryptos, 
    gainersCount,
    loading, 
    error, 
    lastUpdated, 
    updatedFields 
  } = useCryptoData(5000);
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
      <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Market Cap Rankings</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Top cryptocurrencies by market capitalization
              </p>
              <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'} font-semibold mt-1`}>
                {gainersCount} coins are up over 10% today
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CryptoTable
              cryptos={cryptos}
              loading={loading}
              error={error}
              lastUpdated={lastUpdated}
              updatedFields={updatedFields}
              onRefresh={handleRefresh}
            />
            
            <VolumeScanner />
          </div>
          
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} text-center`}>
            Data provided by Polygon.io API. Refreshes automatically every 5 seconds.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;