import React from 'react';
import { TrendingUp, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ darkMode, toggleDarkMode }) => {
  return (
    <header className="w-full bg-gradient-to-r from-gray-900 to-blue-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="flex items-center mb-4 md:mb-0">
          <TrendingUp className="h-8 w-8 text-blue-400 mr-2" />
          <div>
            <h1 className="text-xl font-bold">Crypto Pulse</h1>
            <p className="text-sm text-blue-300">Top 100 by Market Cap</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="px-3 py-1 bg-blue-800/40 rounded-full text-xs text-blue-300 flex items-center">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
            Live Data
          </div>
          
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <Sun size={20} className="text-yellow-300" />
            ) : (
              <Moon size={20} className="text-blue-300" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header