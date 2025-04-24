import React, { useState, useEffect } from 'react';
import { Users, Calendar, Clock, Home, Plane, X } from 'lucide-react';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGame: (opponent: string, date: string, time: string, location: 'home' | 'away') => void;
}

const AddGameModal: React.FC<AddGameModalProps> = ({ isOpen, onClose, onAddGame }) => {
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState<'home' | 'away'>('home');

  useEffect(() => {
    if (isOpen) {
      setOpponent('');
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setTime('');
      setLocation('home');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (opponent.trim() && date) { // Corrected &&
      onAddGame(opponent.trim(), date, time, location);
      onClose();
    } else {
      alert("Please enter opponent name and date.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New Game</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4">
             <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
             <div className="flex space-x-3">
               <button
                 type="button"
                 onClick={() => setLocation('home')}
                 className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded-md transition-colors ${
                   location === 'home' ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <Home size={18} />
                 <span>Home</span>
               </button>
               <button
                 type="button"
                 onClick={() => setLocation('away')}
                 className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded-md transition-colors ${
                   location === 'away' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <Plane size={18} />
                 <span>Away</span>
               </button>
             </div>
           </div>

          <div>
            <label htmlFor="opponent" className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users size={18} className="text-gray-400" /></span>
              <input type="text" id="opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500" placeholder="e.g., Rival Team" required />
            </div>
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar size={18} className="text-gray-400" /></span>
              <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500" required />
            </div>
          </div>
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">Time (Optional)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Clock size={18} className="text-gray-400" /></span>
              <input type="time" id="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500" />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition">Add Game</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGameModal;
