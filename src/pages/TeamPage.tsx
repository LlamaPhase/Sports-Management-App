import React, { useState, useContext, useMemo } from 'react';
import { Plus, Shield } from 'lucide-react';
import { TeamContext, Player, Game } from '../context/TeamContext';
import PlayerCard from '../components/PlayerCard';
import AddPlayerModal from '../components/AddPlayerModal';
import EditPlayerModal from '../components/EditPlayerModal';
import TeamDisplay from '../components/TeamDisplay';

// Helper function to format date/time
const formatDate = (dateString: string, options: Intl.DateTimeFormatOptions) => {
  try {
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, options);
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "Invalid Date";
  }
};

const formatTime = (timeString: string) => {
  if (!timeString || !timeString.includes(':')) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    if (isNaN(date.getTime())) return "Invalid Time";
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch (e) {
    console.error("Error formatting time:", timeString, e);
    return "Invalid Time";
  }
};


const TeamPage: React.FC = () => {
  const { players, addPlayer, updatePlayer, games, teamName, teamLogo, selectGame } = useContext(TeamContext);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);

  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [players]
  );

  const now = new Date();
  const validGames = games || [];

  // Filter games based on status
  const upcomingGames = useMemo(() => validGames
    .filter(game => {
        const gameDateTime = new Date(`${game.date}T${game.time || '00:00'}`);
        // Exclude finished games explicitly from upcoming using the flag
        const isFinished = game.isExplicitlyFinished === true;
        // A game is upcoming if it's not running, not finished, and in the future/present
        return game.timerStatus !== 'running' && !isFinished && gameDateTime >= now;
    })
    .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime()),
    [validGames, now]
  );

  // Corrected previousGames filter: Only include games explicitly marked as finished
  const previousGames = useMemo(() => validGames
    .filter(game => game.isExplicitlyFinished === true) // Only include games marked as finished
    .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime()), // Descending sort (newest first)
    [validGames] // Dependency only on validGames as 'now' is irrelevant for finished games
  );


  const nextGame = upcomingGames[0];
  // Get the 5 most recent previous games (already sorted newest first)
  const lastFiveGames = previousGames.slice(0, 5);
  // Reverse the array for display (newest on the right)
  const lastFiveGamesReversed = useMemo(() => [...lastFiveGames].reverse(), [lastFiveGames]);


  const handleEditPlayerClick = (player: Player) => {
    setPlayerToEdit(player);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setPlayerToEdit(null);
  };

  return (
    <div className="space-y-6">
      {/* Next Game Section */}
      {nextGame && (
        <button
          onClick={() => selectGame(nextGame.id)}
          className="w-full text-left bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition"
        >
          {/* Updated Header */}
          <h2 className="text-lg font-semibold mb-3 text-gray-700">Next Game</h2>
          <p className="text-sm text-gray-500 mb-3">
            {formatDate(nextGame.date, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          {/* Corrected flex layout for centering */}
          <div className="flex justify-center items-center space-x-2">
             {/* Home Team Display */}
             <TeamDisplay
               name={nextGame.location === 'home' ? (teamName || 'Your Team') : nextGame.opponent}
               logo={nextGame.location === 'home' ? teamLogo : null}
               isOpponentTeam={nextGame.location === 'away'} // Correct prop name
               className="flex-1 justify-end text-right" // Align right towards center
             />
             {/* Time */}
             <span className="text-sm font-semibold text-gray-800 px-1 flex-shrink-0 w-16 text-center">
               {formatTime(nextGame.time)}
             </span>
             {/* Away Team Display */}
             <TeamDisplay
               name={nextGame.location === 'away' ? (teamName || 'Your Team') : nextGame.opponent}
               logo={nextGame.location === 'away' ? teamLogo : null}
               isOpponentTeam={nextGame.location === 'home'} // Correct prop name
               className="flex-1 justify-start text-left" // Align left towards center
             />
          </div>
        </button>
      )}

      {/* Last 5 Games Section */}
      {lastFiveGamesReversed.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Last 5 Games</h2>
          {/* Map over the reversed array */}
          <div className="flex justify-around items-start space-x-2 text-center">
            {lastFiveGamesReversed.map((game) => {
              const scoreHome = game.homeScore ?? 0;
              const scoreAway = game.awayScore ?? 0;
              // Score is available because these are explicitly finished games
              const scoreAvailable = true;

              const userScore = game.location === 'home' ? scoreHome : scoreAway;
              const opponentScore = game.location === 'home' ? scoreAway : scoreHome;
              const isWin = userScore > opponentScore;
              const isLoss = userScore < opponentScore;
              const isDraw = userScore === opponentScore;

              let scoreBg = 'bg-gray-400'; // Default to gray (draw)
              if (isWin) scoreBg = 'bg-green-500';
              else if (isLoss) scoreBg = 'bg-red-500';


              return (
                <button
                  key={game.id}
                  onClick={() => selectGame(game.id)}
                  className="flex flex-col items-center space-y-1 flex-1 min-w-0 hover:opacity-75 transition"
                >
                   <span className={`px-3 py-1 rounded text-white text-sm font-bold ${scoreBg}`}>
                     {/* Score is always available here */}
                     {`${scoreHome} - ${scoreAway}`}
                   </span>
                   {/* Use TeamDisplay for opponent icon */}
                   <TeamDisplay name="" logo={null} isOpponentTeam={true} size="medium" className="mt-1" />
                   <span className="text-xs text-gray-500 truncate w-full px-1">{game.opponent}</span>
                 </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Players List */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Players</h2>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition flex items-center space-x-1">
            <Plus size={18} />
            <span>Add Player</span>
          </button>
        </div>
        <div className="space-y-1">
          {sortedPlayers.length === 0 ? (
            <p className="text-gray-500">No players added yet.</p>
          ) : (
            sortedPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} onClick={() => handleEditPlayerClick(player)} />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <AddPlayerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddPlayer={addPlayer}
      />
      <EditPlayerModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        player={playerToEdit}
        onUpdatePlayer={updatePlayer}
      />
    </div>
  );
};

export default TeamPage;
