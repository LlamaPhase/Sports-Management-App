import React from 'react';
import { Player, PlayerLineupState } from '../context/TeamContext'; // Import PlayerLineupState
import { ArrowUp, ArrowDown } from 'lucide-react'; // Import arrows

// Helper function (can be moved to a utils file)
const formatTimer = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


interface PlayerIconProps {
  player: Player;
  showName?: boolean;
  size?: 'small' | 'medium' | 'large';
  // Context now includes 'inactive'
  context?: PlayerLineupState['location'] | 'roster';
  playtimeDisplaySeconds?: number;
  totalGameSeconds?: number;
  isStarter?: boolean;
  // NEW: Sub counts
  subbedOnCount?: number;
  subbedOffCount?: number;
}

const PlayerIcon: React.FC<PlayerIconProps> = ({
  player,
  showName = true,
  size = 'medium',
  context = 'roster',
  playtimeDisplaySeconds = 0,
  totalGameSeconds = 0,
  isStarter = false,
  subbedOnCount = 0, // Default counts
  subbedOffCount = 0,
}) => {
  const getInitials = (first: string, last: string) => `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();

  const sizeClasses = { small: 'w-8 h-8 text-[10px] md:w-10 md:h-10 md:text-sm', medium: 'w-10 h-10 text-sm md:w-12 md:h-12 md:text-base', large: 'w-12 h-12 text-base md:w-14 md:h-14 md:text-lg', };
  const nameTextSizeClass = size === 'small' ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm';
  const numberTextSizeClass = size === 'small' ? 'text-[9px] md:text-xs' : 'text-xs md:text-sm';
  const containerSpacing = size === 'small' ? 'space-y-0.5 md:space-y-1' : 'space-y-1';

  // Adjust colors based on context (field, bench, inactive, roster)
  const circleBgClass = context === 'inactive' ? 'bg-gray-400' : 'bg-gray-100';
  const circleBorderClass = context === 'inactive' ? 'border border-gray-500' : 'border border-white';
  const circleTextColorClass = context === 'inactive' ? 'text-gray-600' : 'text-black';
  const nameColorClass = context === 'field' ? 'text-white' : (context === 'inactive' ? 'text-gray-600' : 'text-black');
  const numberColorClass = context === 'field' ? 'text-gray-300' : 'text-gray-500';

  // --- Playtime Percentage and Color Logic ---
  const playtimePercent = totalGameSeconds > 0 ? (playtimeDisplaySeconds / totalGameSeconds) * 100 : 0;
  let playtimeBgColor = 'bg-red-500'; // Default Red (< 25%)
  if (playtimePercent >= 50) { playtimeBgColor = 'bg-green-500'; } // Green (>= 50%)
  else if (playtimePercent >= 25) { playtimeBgColor = 'bg-orange-500'; } // Orange (25% - 49.9%)
  // --- End Playtime Logic ---

  // Determine if sub counters should be shown (only in game context)
  const showSubCounters = (context === 'field' || context === 'bench' || context === 'inactive');
  const showSubOn = showSubCounters && subbedOnCount > 0;
  const showSubOff = showSubCounters && subbedOffCount > 0;

  // --- Positioning Logic for Sub Counters (Relative to Parent Div) ---
  // Starter Icon: w-4 (16px), left-[-4px]. Right edge = -4px + 16px = 12px from icon circle left edge.
  // Counter: w-6 (24px).
  // To align right edges: Counter left = Starter right edge - Counter width
  // Counter left = 12px - 24px = -12px. Use style={{ left: '-12px' }} or class `left-[-12px]`
  // Starter Icon bottom edge is approx -1px + 16px = 15px from parent top.
  // Place first counter below that.
  const counterTopOffset = '16px'; // Below starter icon
  const counterLeftOffset = '-12px'; // Align right edge of w-6 counter with right edge of w-4 starter icon
  const counterSpacing = '18px'; // Vertical space between counters

  return (
    // Main container is relative for positioning children
    <div className={`relative flex flex-col items-center ${showName ? containerSpacing : ''}`}>
      {/* Player Circle - No longer relative */}
      <div
        className={`${sizeClasses[size]} ${circleBgClass} ${circleTextColorClass} ${circleBorderClass} rounded-full flex items-center justify-center font-semibold shadow-sm`}
        title={`${player.firstName} ${player.lastName} #${player.number}`}
      >
        {getInitials(player.firstName, player.lastName)}
      </div> {/* End of icon circle */}


      {/* --- Starter Indicator (Positioned relative to parent div) --- */}
      {isStarter && (context === 'field' || context === 'bench' || context === 'inactive') && (
          <div
              className="absolute -top-1 -left-1 w-4 h-4 bg-black border border-white rounded-full flex items-center justify-center shadow z-20" // Ensure starter is above counters
              title="Starter"
          >
              <span className="text-white text-[9px] font-bold leading-none">S</span>
          </div>
      )}
      {/* --- End Starter Indicator --- */}

      {/* --- Subbed On Counter (Green, Top - Positioned relative to parent div) --- */}
      {showSubOn && (
          <div
              className="absolute w-6 h-[16px] bg-gray-200 rounded-full flex items-center justify-between px-1 shadow-sm z-10" // z-10 for green, w-6 for narrower
              style={{ top: counterTopOffset, left: counterLeftOffset }}
              title={`Subbed On: ${subbedOnCount}`}
          >
              <span className="text-[10px] font-semibold text-gray-700">{subbedOnCount}</span>
              <div className="w-3 h-3 bg-green-500 rounded-full border border-white flex items-center justify-center">
                  <ArrowUp size={8} className="text-white" />
              </div>
          </div>
      )}
      {/* --- End Subbed On Counter --- */}

      {/* --- Subbed Off Counter (Red, Below Green - Positioned relative to parent div) --- */}
      {showSubOff && (
          <div
              className={`absolute w-6 h-[16px] bg-gray-200 rounded-full flex items-center justify-between px-1 shadow-sm`} // w-6 for narrower
              style={{ top: `calc(${counterTopOffset} + ${counterSpacing})`, left: counterLeftOffset }}
              title={`Subbed Off: ${subbedOffCount}`}
          >
              <span className="text-[10px] font-semibold text-gray-700">{subbedOffCount}</span>
              <div className="w-3 h-3 bg-red-500 rounded-full border border-white flex items-center justify-center">
                  <ArrowDown size={8} className="text-white" />
              </div>
          </div>
      )}
      {/* --- End Subbed Off Counter --- */}


      {/* --- Playtime Timer Element (Positioned relative to parent div) --- */}
      {(context === 'field' || context === 'bench' || context === 'inactive') && (
          <div
              className={`absolute -top-1 -right-1 px-1.5 py-0.5 ${playtimeBgColor} text-white text-[9px] md:text-[10px] font-bold rounded-full shadow leading-tight z-20`} // Ensure timer is above counters
              title={`Played: ${formatTimer(playtimeDisplaySeconds)}`}
          >
              {formatTimer(playtimeDisplaySeconds)}
          </div>
      )}
      {/* --- End Playtime Timer Element --- */}


      {showName && (
        <span className={`text-center ${nameColorClass} ${nameTextSizeClass} font-medium leading-tight max-w-[50px] md:max-w-[60px] truncate`}>
          {player.firstName}
          {player.number && <span className={`block ${numberColorClass} ${numberTextSizeClass}`}>#{player.number}</span>}
        </span>
      )}

    </div>
  );
};

export default PlayerIcon;
