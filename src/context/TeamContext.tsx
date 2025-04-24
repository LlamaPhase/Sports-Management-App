import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: string;
  // Global location/position (used by LineupPage) - might become less relevant
  location: 'bench' | 'field'; // Keep global simple for now
  position?: { x: number; y: number };
}

// Represents the state of a player within a specific game lineup
export interface PlayerLineupState {
  id: string;
  // Add 'inactive' location for game-specific state
  location: 'bench' | 'field' | 'inactive';
  position?: { x: number; y: number };
  playtimeSeconds: number; // Accumulated seconds played
  playtimerStartTime: number | null; // Timestamp when player's timer started for current interval
  isStarter?: boolean;
  // NEW: Substitution counters
  subbedOnCount: number;
  subbedOffCount: number;
}

// Type for sending only structural updates (location/position)
export type PlayerLineupStructure = Pick<PlayerLineupState, 'id' | 'location' | 'position'>;


export interface Game {
  id: string;
  opponent: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24-hour format for consistency)
  location: 'home' | 'away';
  // Persistent State
  homeScore?: number;
  awayScore?: number;
  timerStatus?: 'stopped' | 'running';
  timerStartTime?: number | null; // Store timestamp (Date.now()) when started
  timerElapsedSeconds?: number; // Store accumulated seconds when stopped
  isExplicitlyFinished?: boolean;
  lineup?: PlayerLineupState[] | null; // Uses updated PlayerLineupState
}

export interface SavedLineup {
  name: string;
  // Saved lineups store the structure, not active playtime or starter status
  players: Pick<PlayerLineupState, 'id' | 'location' | 'position'>[];
}

interface TeamContextProps {
  teamName: string;
  setTeamName: (name: string) => void;
  teamLogo: string | null;
  setTeamLogo: (logo: string | null) => void;
  players: Player[]; // Global player list (roster)
  addPlayer: (firstName: string, lastName: string, number: string) => void;
  updatePlayer: (id: string, updates: Partial<Pick<Player, 'firstName' | 'lastName' | 'number'>>) => void;
  deletePlayer: (id: string) => void;
  games: Game[];
  addGame: (opponent: string, date: string, time: string, location: 'home' | 'away') => void;
  updateGame: (id: string, updates: Partial<Omit<Game, 'id' | 'homeScore' | 'awayScore' | 'timerStatus' | 'timerStartTime' | 'timerElapsedSeconds' | 'isExplicitlyFinished' | 'lineup'>>) => void;
  deleteGame: (id: string) => void;
  updateGameScore: (gameId: string, homeScore: number, awayScore: number) => void;
  // Game Timer Functions
  startGameTimer: (gameId: string) => void;
  stopGameTimer: (gameId: string) => void;
  markGameAsFinished: (gameId: string) => void;
  // Game Lineup Functions
  // updateGameLineup: (gameId: string, lineupStructure: PlayerLineupStructure[]) => void; // Keep for potential other uses? Or remove if only for DnD
  resetGameLineup: (gameId: string) => PlayerLineupState[];
  movePlayerInGame: (
    gameId: string,
    playerId: string,
    sourceLocation: PlayerLineupState['location'],
    targetLocation: PlayerLineupState['location'],
    newPosition?: { x: number; y: number }
  ) => void; // New function for combined move/timer logic
  // Player Timer Functions (still needed for main game timer actions)
  startPlayerTimerInGame: (gameId: string, playerId: string) => void;
  stopPlayerTimerInGame: (gameId: string, playerId: string) => void;
  // Global Lineup Functions (remain unchanged for now)
  movePlayer: (playerId: string, targetLocation: 'bench' | 'field', position?: { x: number; y: number }) => void;
  swapPlayers: (player1Id: string, player2Id: string) => void;
  savedLineups: SavedLineup[];
  saveLineup: (name: string) => void;
  loadLineup: (name: string) => boolean;
  deleteLineup: (name: string) => void;
  resetLineup: () => void;
  // Navigation
  setCurrentPage: (page: string) => void;
  selectGame: (gameId: string) => void;
}

// --- Context ---
export const TeamContext = createContext<TeamContextProps>({
  teamName: '', setTeamName: () => {},
  teamLogo: null, setTeamLogo: () => {},
  players: [], addPlayer: () => {}, updatePlayer: () => {}, deletePlayer: () => {},
  games: [], addGame: () => {}, updateGame: () => {}, deleteGame: () => {},
  updateGameScore: () => {},
  startGameTimer: () => {}, stopGameTimer: () => {}, markGameAsFinished: () => {},
  // updateGameLineup: () => {},
  resetGameLineup: () => [],
  movePlayerInGame: () => {}, // Add default
  startPlayerTimerInGame: () => {},
  stopPlayerTimerInGame: () => {},
  movePlayer: () => {}, swapPlayers: () => {},
  savedLineups: [], saveLineup: () => {}, loadLineup: () => false, deleteLineup: () => {}, resetLineup: () => {},
  setCurrentPage: () => { console.warn("Default setCurrentPage context function called."); },
  selectGame: () => { console.warn("Default selectGame context function called."); },
});

// --- Provider ---
interface TeamProviderProps {
  children: ReactNode;
  setCurrentPage: (page: string) => void;
  selectGame: (gameId: string) => void;
}

// Helper to get current date/time
const getCurrentDate = (): string => new Date().toISOString().split('T')[0];
const getCurrentTime = (): string => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// Helper to create default lineup state (all players on bench, zero playtime, not starters, zero subs)
const createDefaultLineup = (players: Player[]): PlayerLineupState[] => {
    return players.map(p => ({
        id: p.id,
        location: 'bench', // Default to bench
        position: undefined,
        playtimeSeconds: 0,
        playtimerStartTime: null,
        isStarter: false, // Default starter status
        subbedOnCount: 0, // Initialize sub counts
        subbedOffCount: 0,
    }));
};

// LocalStorage Helpers
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const storedValue = localStorage.getItem(key);
    if (!storedValue) return defaultValue;

    const parsedValue = JSON.parse(storedValue);

    // Add more robust checks and defaults during parsing
    if (key === 'games' && Array.isArray(parsedValue)) {
      return (parsedValue as any[]).map(g => {
        // Basic validation: ensure 'g' is an object and has an 'id'
        if (typeof g !== 'object' || g === null || !g.id) {
          console.warn(`Invalid game data found in localStorage for key "${key}", skipping item:`, g);
          return null; // Skip invalid entries
        }
        // Validate and default lineup players
        const validLineup = Array.isArray(g.lineup) ? g.lineup.map((p: any) => {
          if (typeof p !== 'object' || p === null || !p.id) {
            console.warn(`Invalid player lineup data found in game ${g.id}, skipping player:`, p);
            return null; // Skip invalid player entries
          }
          const location = ['field', 'bench', 'inactive'].includes(p.location) ? p.location : 'bench';
          return {
            id: p.id,
            location: location,
            position: p.position, // Keep position as is, undefined is acceptable
            playtimeSeconds: typeof p.playtimeSeconds === 'number' ? p.playtimeSeconds : 0,
            playtimerStartTime: typeof p.playtimerStartTime === 'number' ? p.playtimerStartTime : null,
            isStarter: typeof p.isStarter === 'boolean' ? p.isStarter : false,
            subbedOnCount: typeof p.subbedOnCount === 'number' ? p.subbedOnCount : 0, // Default sub counts
            subbedOffCount: typeof p.subbedOffCount === 'number' ? p.subbedOffCount : 0,
          };
        }).filter(p => p !== null) : null; // Filter out skipped players

        return {
          id: g.id,
          opponent: typeof g.opponent === 'string' ? g.opponent : 'Unknown Opponent',
          date: typeof g.date === 'string' ? g.date : getCurrentDate(),
          time: typeof g.time === 'string' ? g.time : '',
          location: ['home', 'away'].includes(g.location) ? g.location : 'home',
          homeScore: typeof g.homeScore === 'number' ? g.homeScore : 0,
          awayScore: typeof g.awayScore === 'number' ? g.awayScore : 0,
          timerStatus: ['stopped', 'running'].includes(g.timerStatus) ? g.timerStatus : 'stopped',
          timerStartTime: typeof g.timerStartTime === 'number' ? g.timerStartTime : null,
          timerElapsedSeconds: typeof g.timerElapsedSeconds === 'number' ? g.timerElapsedSeconds : 0,
          isExplicitlyFinished: typeof g.isExplicitlyFinished === 'boolean' ? g.isExplicitlyFinished : false,
          lineup: validLineup,
        };
      }).filter(g => g !== null) as T; // Filter out skipped games
    }

    if (key === 'players' && Array.isArray(parsedValue)) {
      return (parsedValue as any[]).map(p => {
        if (typeof p !== 'object' || p === null || !p.id) {
          console.warn(`Invalid player data found in localStorage for key "${key}", skipping item:`, p);
          return null; // Skip invalid entries
        }
        return {
          id: p.id,
          firstName: typeof p.firstName === 'string' ? p.firstName : '',
          lastName: typeof p.lastName === 'string' ? p.lastName : '',
          number: typeof p.number === 'string' ? p.number : '',
          location: ['field', 'bench'].includes(p.location) ? p.location : 'bench',
          position: p.position, // Keep position as is
        };
      }).filter(p => p !== null) as T; // Filter out skipped players
    }

    // Add similar checks for 'savedLineups' if necessary

    // For other keys or if specific checks didn't apply
    return parsedValue ?? defaultValue;

  } catch (error) {
    console.error(`Error reading or parsing localStorage key “${key}”:`, error);
    // Attempt to clear the corrupted key to prevent future errors
    try {
        localStorage.removeItem(key);
        console.warn(`Removed potentially corrupted localStorage key "${key}".`);
    } catch (removeError) {
        console.error(`Failed to remove corrupted localStorage key "${key}":`, removeError);
    }
    return defaultValue;
  }
};


const saveToLocalStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key “${key}”:`, error);
  }
};


export const TeamProvider: React.FC<TeamProviderProps> = ({ children, setCurrentPage, selectGame }) => {
  const [teamName, setTeamNameState] = useState<string>(() => loadFromLocalStorage('teamName', 'Your Team'));
  const [teamLogo, setTeamLogoState] = useState<string | null>(() => loadFromLocalStorage('teamLogo', null));
  const [players, setPlayersState] = useState<Player[]>(() => loadFromLocalStorage('players', []));
  const [games, setGamesState] = useState<Game[]>(() => loadFromLocalStorage('games', []));
  const [savedLineups, setSavedLineupsState] = useState<SavedLineup[]>(() => loadFromLocalStorage('savedLineups', []));

  useEffect(() => { saveToLocalStorage('teamName', teamName); }, [teamName]);
  useEffect(() => { saveToLocalStorage('teamLogo', teamLogo); }, [teamLogo]);
  useEffect(() => { saveToLocalStorage('players', players); }, [players]);
  useEffect(() => { saveToLocalStorage('games', games); }, [games]);
  useEffect(() => { saveToLocalStorage('savedLineups', savedLineups); }, [savedLineups]);

  const setTeamName = (name: string) => setTeamNameState(name);
  const setTeamLogo = (logo: string | null) => setTeamLogoState(logo);

  const addPlayer = (firstName: string, lastName: string, number: string) => {
    const newPlayer: Player = { id: uuidv4(), firstName, lastName, number, location: 'bench' };
    const currentPlayers = loadFromLocalStorage('players', []); // Load fresh to avoid race condition if called rapidly
    setPlayersState([...currentPlayers, newPlayer]);
    // Add player to existing game lineups (on bench with 0 playtime, not starter, 0 subs)
    setGamesState(prevGames => prevGames.map(game => ({
        ...game,
        lineup: game.lineup ? [
            ...game.lineup,
            { id: newPlayer.id, location: 'bench', position: undefined, playtimeSeconds: 0, playtimerStartTime: null, isStarter: false, subbedOnCount: 0, subbedOffCount: 0 }
        ] : createDefaultLineup([...currentPlayers, newPlayer]) // Create if null, using the players list that includes the new one
    })));
  };

  const updatePlayer = (id: string, updates: Partial<Pick<Player, 'firstName' | 'lastName' | 'number'>>) => {
    setPlayersState((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deletePlayer = (id: string) => {
    setPlayersState((prev) => prev.filter(p => p.id !== id));
    setGamesState((prevGames) => prevGames.map(game => ({
        ...game, lineup: game.lineup ? game.lineup.filter(p => p.id !== id) : null
    })));
    setSavedLineupsState((prevSaved) => prevSaved.map(sl => ({
        ...sl, players: sl.players.filter(p => p.id !== id)
    })));
  };

  const addGame = (opponent: string, date: string, time: string, location: 'home' | 'away') => {
    const currentPlayers = loadFromLocalStorage('players', []); // Load fresh player list
    const newGame: Game = {
        id: uuidv4(), opponent, date, time, location,
        homeScore: 0, awayScore: 0, timerStatus: 'stopped', timerStartTime: null, timerElapsedSeconds: 0,
        isExplicitlyFinished: false,
        lineup: createDefaultLineup(currentPlayers) // Create default lineup based on current players
    };
    setGamesState((prev) => [...prev, newGame].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  };

  const updateGame = (id: string, updates: Partial<Omit<Game, 'id' | 'homeScore' | 'awayScore' | 'timerStatus' | 'timerStartTime' | 'timerElapsedSeconds' | 'isExplicitlyFinished' | 'lineup'>>) => {
    setGamesState((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  };

  const deleteGame = (id: string) => { setGamesState((prev) => prev.filter(g => g.id !== id)); };
  const updateGameScore = (gameId: string, homeScore: number, awayScore: number) => { setGamesState((prev) => prev.map((g) => (g.id === gameId ? { ...g, homeScore, awayScore } : g))); };

  // --- Game Timer ---
  // Modified startGameTimer to mark starters
  const startGameTimer = (gameId: string) => {
    const now = Date.now(); const currentDate = getCurrentDate(); const currentTime = getCurrentTime();
    setGamesState((prev) => prev.map((g) => {
        if (g.id === gameId && !g.isExplicitlyFinished) {
          const updates: Partial<Game> = {};
          if (g.date !== currentDate) updates.date = currentDate;
          if (g.time !== currentTime) updates.time = currentTime;

          // Check if starting from 00:00 to mark starters
          const isStartingFresh = (g.timerElapsedSeconds ?? 0) === 0;
          console.log(`[startGameTimer] Starting fresh? ${isStartingFresh}`);

          // Start player timers and mark starters if applicable
          const newLineup = g.lineup?.map(p => {
              const isFieldPlayer = p.location === 'field';
              return {
                  ...p,
                  // Start timer if on field
                  playtimerStartTime: isFieldPlayer ? now : p.playtimerStartTime,
                  // Mark as starter if starting fresh AND on field
                  isStarter: isStartingFresh ? isFieldPlayer : (p.isStarter ?? false)
              };
          }) ?? null;

          console.log(`[startGameTimer] New lineup with starters/timers:`, newLineup);

          return { ...g, ...updates, timerStatus: 'running', timerStartTime: now, isExplicitlyFinished: false, lineup: newLineup };
        } return g;
      })
    );
  };

  // Modified stopGameTimer (no change needed for starter/inactive logic here)
  const stopGameTimer = (gameId: string) => {
    const now = Date.now();
    console.log(`[stopGameTimer] Called for game ${gameId} at time ${now}`); // Log entry
    setGamesState((prev) => prev.map((g) => {
        if (g.id === gameId && g.timerStatus === 'running' && g.timerStartTime) {
          const elapsed = (now - g.timerStartTime) / 1000;
          const newElapsedSeconds = Math.round((g.timerElapsedSeconds || 0) + elapsed);
          console.log(`[stopGameTimer] Main timer elapsed: ${elapsed.toFixed(2)}s, New total: ${newElapsedSeconds}`);

          // Update player timers within the same update
          const newLineup = g.lineup?.map(p => {
              // Stop timer only if player is on field AND has a start time
              if (p.location === 'field' && p.playtimerStartTime) {
                  const playerElapsed = (now - p.playtimerStartTime) / 1000;
                  const currentPlaytime = typeof p.playtimeSeconds === 'number' ? p.playtimeSeconds : 0;
                  const newPlaytime = Math.round(currentPlaytime + playerElapsed);
                  console.log(`[stopGameTimer] Stopping player ${p.id}. Start: ${p.playtimerStartTime}, Elapsed: ${playerElapsed.toFixed(2)}s, Old: ${currentPlaytime}, New: ${newPlaytime}`);
                  return { ...p, playtimeSeconds: newPlaytime, playtimerStartTime: null };
              }
              // Also ensure players moved to inactive while timer was running have their timers stopped
              if (p.location === 'inactive' && p.playtimerStartTime) {
                  const playerElapsed = (now - p.playtimerStartTime) / 1000;
                  const currentPlaytime = typeof p.playtimeSeconds === 'number' ? p.playtimeSeconds : 0;
                  const newPlaytime = Math.round(currentPlaytime + playerElapsed);
                  console.log(`[stopGameTimer] Stopping inactive player ${p.id}. Start: ${p.playtimerStartTime}, Elapsed: ${playerElapsed.toFixed(2)}s, Old: ${currentPlaytime}, New: ${newPlaytime}`);
                  return { ...p, playtimeSeconds: newPlaytime, playtimerStartTime: null };
              }
              return p; // Return unchanged player state otherwise
          }) ?? null; // Handle case where lineup might be null

          return { ...g, timerStatus: 'stopped', timerStartTime: null, timerElapsedSeconds: newElapsedSeconds, lineup: newLineup };
        }
        return g; // Return unchanged game if conditions not met
      })
    );
  };

  // Modified markGameAsFinished (no change needed for starter/inactive logic here)
  const markGameAsFinished = (gameId: string) => {
     const now = Date.now();
     console.log(`[markGameAsFinished] Called for game ${gameId} at time ${now}`); // Log entry
     setGamesState((prev) => prev.map((g) => {
         if (g.id === gameId) {
           let finalElapsedSeconds = g.timerElapsedSeconds ?? 0;
           let finalLineup = g.lineup;

           // If the timer was running when finished, stop it and update player times
           if (g.timerStatus === 'running' && g.timerStartTime) {
             const elapsed = (now - g.timerStartTime) / 1000;
             finalElapsedSeconds = Math.round((g.timerElapsedSeconds || 0) + elapsed);
             console.log(`[markGameAsFinished] Timer was running. Main elapsed: ${elapsed.toFixed(2)}s, Final total: ${finalElapsedSeconds}`);

             finalLineup = g.lineup?.map(p => {
                 // Stop timer if on field or inactive and timer was running
                 if ((p.location === 'field' || p.location === 'inactive') && p.playtimerStartTime) {
                     const playerElapsed = (now - p.playtimerStartTime) / 1000;
                     const currentPlaytime = typeof p.playtimeSeconds === 'number' ? p.playtimeSeconds : 0;
                     const newPlaytime = Math.round(currentPlaytime + playerElapsed);
                     console.log(`[markGameAsFinished] Stopping player ${p.id} (loc: ${p.location}). Start: ${p.playtimerStartTime}, Elapsed: ${playerElapsed.toFixed(2)}s, Old: ${currentPlaytime}, New: ${newPlaytime}`);
                     return { ...p, playtimeSeconds: newPlaytime, playtimerStartTime: null };
                 }
                 return p;
             }) ?? null;
           } else {
               console.log(`[markGameAsFinished] Timer was already stopped.`);
           }

           return { ...g, timerStatus: 'stopped', timerStartTime: null, timerElapsedSeconds: finalElapsedSeconds, isExplicitlyFinished: true, lineup: finalLineup };
         }
         return g;
       })
     );
   };

   // --- Player Timer Functions (Individual Start/Stop - used by main timer logic) ---
   const startPlayerTimerInGame = (gameId: string, playerId: string) => {
       const now = Date.now();
       console.log(`[startPlayerTimerInGame] Called for game ${gameId}, player ${playerId} at time ${now}`); // Log entry
       setGamesState(prevGames => prevGames.map(game => {
           if (game.id === gameId && game.lineup) {
               // Only start if the main game timer is actually running
               if (game.timerStatus !== 'running') {
                   console.log(`[startPlayerTimerInGame] Main game timer not running for ${gameId}. Player timer for ${playerId} not started.`);
                   return game; // Don't start player timer if game isn't running
               }
               const newLineup = game.lineup.map(p => {
                   // Only start if player is on the field
                   // AND ensure the timer isn't already running for this player
                   if (p.id === playerId && p.location === 'field' && !p.playtimerStartTime) {
                       console.log(`[startPlayerTimerInGame] Starting timer for ${playerId}. Prev state:`, JSON.stringify(p));
                       return { ...p, playtimerStartTime: now };
                   }
                   // If player is already on field with a start time, don't overwrite it here
                   return p;
                });
               return { ...game, lineup: newLineup };
           }
           return game;
       }));
   };

   const stopPlayerTimerInGame = (gameId: string, playerId: string) => {
       const now = Date.now();
       console.log(`[stopPlayerTimerInGame - Individual] Called for game ${gameId}, player ${playerId} at time ${now}`); // Log entry distinction

       setGamesState(prevGames => {
           const gameIndex = prevGames.findIndex(g => g.id === gameId);
           if (gameIndex === -1 || !prevGames[gameIndex].lineup) {
               console.log(`[stopPlayerTimerInGame - Individual] Game ${gameId} or lineup not found.`);
               return prevGames;
           }

           const game = prevGames[gameIndex];
           let playerUpdated = false;

           const newLineup = game.lineup.map(p => {
               if (p.id === playerId) {
                    console.log(`[stopPlayerTimerInGame - Individual] Found player ${playerId}. Current state:`, JSON.stringify(p));
                   // Stop timer if it was running
                   if (p.playtimerStartTime) {
                       const elapsed = (now - p.playtimerStartTime) / 1000;
                       const currentPlaytime = typeof p.playtimeSeconds === 'number' ? p.playtimeSeconds : 0;
                       const newPlaytime = Math.round(currentPlaytime + elapsed);
                       console.log(`[stopPlayerTimerInGame - Individual] StartTime: ${p.playtimerStartTime}, Elapsed: ${elapsed.toFixed(2)}s, OldPlaytime: ${currentPlaytime}, NewPlaytime: ${newPlaytime}`);
                       playerUpdated = true;
                       return { ...p, playtimeSeconds: newPlaytime, playtimerStartTime: null };
                   } else {
                       console.log(`[stopPlayerTimerInGame - Individual] Player ${playerId} timer was already stopped.`);
                   }
               }
               return p;
           });

           if (playerUpdated) {
               const updatedGames = [...prevGames];
               updatedGames[gameIndex] = { ...game, lineup: newLineup };
               console.log(`[stopPlayerTimerInGame - Individual] Player ${playerId} updated. New lineup state:`, JSON.stringify(newLineup.find(p => p.id === playerId)));
               return updatedGames;
           } else {
               console.log(`[stopPlayerTimerInGame - Individual] No update needed for player ${playerId}.`);
               return prevGames;
           }
       });
   };
   // --- End Player Timer Functions ---


   // --- Game Lineup ---
   // updateGameLineup - kept for potential future use, but not used by DnD
   const updateGameLineup = (gameId: string, lineupStructure: PlayerLineupStructure[]) => {
       console.log(`[updateGameLineup] Called for game ${gameId}. Structure:`, lineupStructure);
       setGamesState((prevGames) => {
           const gameIndex = prevGames.findIndex(g => g.id === gameId);
           if (gameIndex === -1) {
               console.warn(`[updateGameLineup] Game ${gameId} not found.`);
               return prevGames;
           }

           const currentGame = prevGames[gameIndex];
           const currentLineup = currentGame.lineup ?? [];
           const structureMap = new Map(lineupStructure.map(s => [s.id, s]));

           const mergedLineup = currentLineup.map(existingState => {
               const newStructure = structureMap.get(existingState.id);
               if (newStructure) {
                   return {
                       ...existingState,
                       location: newStructure.location,
                       position: newStructure.position,
                   };
               }
               return existingState;
           });

           structureMap.forEach((newStructure, playerId) => {
               if (!currentLineup.some(p => p.id === playerId)) {
                   console.warn(`[updateGameLineup] Player ${playerId} found in structure but not context, adding with defaults.`);
                   mergedLineup.push({
                       id: newStructure.id,
                       location: newStructure.location,
                       position: newStructure.position,
                       playtimeSeconds: 0,
                       playtimerStartTime: null,
                       isStarter: false,
                       subbedOnCount: 0, // Add defaults here too
                       subbedOffCount: 0,
                   });
               }
           });

           console.log(`[updateGameLineup] Final structurally merged lineup for ${gameId}:`, mergedLineup);

           const updatedGames = [...prevGames];
           updatedGames[gameIndex] = { ...currentGame, lineup: mergedLineup };
           return updatedGames;
       });
   };

   // Modified resetGameLineup to reset sub counts
   const resetGameLineup = (gameId: string): PlayerLineupState[] => {
       const currentPlayers = loadFromLocalStorage('players', []); // Load fresh player list
       const defaultLineup = createDefaultLineup(currentPlayers); // Creates lineup with isStarter: false and sub counts 0
       setGamesState((prevGames) => prevGames.map(game => game.id === gameId ? { ...game, lineup: defaultLineup } : game));
       return defaultLineup;
   };

  // *** MODIFIED: movePlayerInGame Function to include sub counts ***
  const movePlayerInGame = (
    gameId: string,
    playerId: string,
    sourceLocation: PlayerLineupState['location'],
    targetLocation: PlayerLineupState['location'],
    newPosition?: { x: number; y: number }
  ) => {
    const now = Date.now();
    console.log(`[movePlayerInGame] Called for G:${gameId} P:${playerId}. ${sourceLocation} -> ${targetLocation} at ${now}`);

    setGamesState(prevGames => {
      const gameIndex = prevGames.findIndex(g => g.id === gameId);
      if (gameIndex === -1) {
        console.warn(`[movePlayerInGame] Game ${gameId} not found.`);
        return prevGames;
      }

      const game = prevGames[gameIndex];
      if (!game.lineup) {
        console.warn(`[movePlayerInGame] Game ${gameId} has no lineup.`);
        return prevGames;
      }

      const isGameRunning = game.timerStatus === 'running';
      let newLineup = [...game.lineup]; // Shallow copy
      const playerIndex = newLineup.findIndex(p => p.id === playerId);

      if (playerIndex === -1) {
        console.warn(`[movePlayerInGame] Player ${playerId} not found in game ${gameId}.`);
        return prevGames;
      }

      const playerState = { ...newLineup[playerIndex] }; // Copy player state

      // --- Timer Logic ---
      let updatedPlaytime = playerState.playtimeSeconds;
      let updatedStartTime = playerState.playtimerStartTime;

      // 1. Stop timer if moving FROM Field or Inactive AND timer was running
      if ((sourceLocation === 'field' || sourceLocation === 'inactive') && playerState.playtimerStartTime) {
        const elapsed = (now - playerState.playtimerStartTime) / 1000;
        updatedPlaytime = Math.round(playerState.playtimeSeconds + elapsed);
        updatedStartTime = null;
        console.log(`[movePlayerInGame] Stopping timer for ${playerId}. Elapsed: ${elapsed.toFixed(2)}s, New Total: ${updatedPlaytime}`);
      }

      // 2. Start timer if moving TO Field AND game is running
      if (targetLocation === 'field' && isGameRunning) {
        // Only start if not already running (updatedStartTime would be null from step 1 if moved from field)
        if (updatedStartTime === null) {
            updatedStartTime = now;
            console.log(`[movePlayerInGame] Starting timer for ${playerId} at ${now}`);
        } else {
             console.log(`[movePlayerInGame] Timer for ${playerId} was already running or shouldn't start.`);
        }
      } else if (targetLocation !== 'field') {
          // Ensure timer is stopped if moving to Bench or Inactive
          updatedStartTime = null;
      }

      // --- Substitution Counter Logic ---
      let updatedSubbedOnCount = playerState.subbedOnCount;
      let updatedSubbedOffCount = playerState.subbedOffCount;

      if (sourceLocation === 'bench' && targetLocation === 'field') {
          updatedSubbedOnCount++;
          console.log(`[movePlayerInGame] Incrementing subbedOnCount for ${playerId} to ${updatedSubbedOnCount}`);
      } else if (sourceLocation === 'field' && targetLocation === 'bench') {
          updatedSubbedOffCount++;
          console.log(`[movePlayerInGame] Incrementing subbedOffCount for ${playerId} to ${updatedSubbedOffCount}`);
      }
      // Note: Moves involving 'inactive' do not affect sub counts


      // --- Structural Update ---
      playerState.location = targetLocation;
      playerState.position = targetLocation === 'field' ? newPosition : undefined;
      playerState.playtimeSeconds = updatedPlaytime;
      playerState.playtimerStartTime = updatedStartTime;
      playerState.subbedOnCount = updatedSubbedOnCount; // Update sub counts
      playerState.subbedOffCount = updatedSubbedOffCount;

      // Update the lineup array
      newLineup[playerIndex] = playerState;

      console.log(`[movePlayerInGame] Final player state for ${playerId}:`, playerState);

      // Create the updated games array
      const updatedGames = [...prevGames];
      updatedGames[gameIndex] = { ...game, lineup: newLineup };
      return updatedGames;
    });
  };


  // --- Global Lineup Functions (Unchanged) ---
  const movePlayer = (playerId: string, targetLocation: 'bench' | 'field', position?: { x: number; y: number }) => { setPlayersState((prev) => prev.map((p) => p.id === playerId ? { ...p, location: targetLocation, position: targetLocation === 'field' ? position : undefined } : p)); };
  const swapPlayers = (player1Id: string, player2Id: string) => { setPlayersState((prev) => { const p1 = prev.find(p => p.id === player1Id); const p2 = prev.find(p => p.id === player2Id); if (!p1 || !p2) return prev; if (p1.location === 'field' && p2.location === 'field') { const p1Pos = p1.position; const p2Pos = p2.position; return prev.map((p) => { if (p.id === player1Id) return { ...p, position: p2Pos }; if (p.id === player2Id) return { ...p, position: p1Pos }; return p; }); } if (p1.location !== p2.location) { const p1NewLocation = p2.location; const p1NewPosition = p2.position; const p2NewLocation = p1.location; const p2NewPosition = p1.position; return prev.map((p) => { if (p.id === player1Id) return { ...p, location: p1NewLocation, position: p1NewPosition }; if (p.id === player2Id) return { ...p, location: p2NewLocation, position: p2NewPosition }; return p; }); } return prev; }); };
  const saveLineup = (name: string) => { if (!name.trim()) { alert("Please enter a name."); return; } const lineupToSave: SavedLineup = { name: name.trim(), players: players.map(({ id, location, position }) => ({ id, location, position })), }; setSavedLineupsState((prev) => { const filtered = prev.filter(l => l.name !== lineupToSave.name); return [...filtered, lineupToSave]; }); };
  const loadLineup = (name: string): boolean => { const lineupToLoad = savedLineups.find(l => l.name === name); if (!lineupToLoad) { console.error(`Lineup "${name}" not found.`); return false; } setPlayersState((currentPlayers) => { const savedPlayerStates = new Map( lineupToLoad.players.map(p => [p.id, { location: p.location, position: p.position }]) ); return currentPlayers.map(player => { const savedState = savedPlayerStates.get(player.id); return savedState ? { ...player, location: savedState.location, position: savedState.position } : { ...player, location: 'bench', position: undefined }; }); }); return true; };
  const deleteLineup = (name: string) => { setSavedLineupsState((prev) => prev.filter(l => l.name !== name)); };
  const resetLineup = () => { setPlayersState((prev) => prev.map(p => ({ ...p, location: 'bench', position: undefined }))); };
  // --- End Global Lineup Functions ---

  const contextValue: TeamContextProps = {
    teamName, setTeamName, teamLogo, setTeamLogo,
    players, addPlayer, updatePlayer, deletePlayer,
    games, addGame, updateGame, deleteGame,
    updateGameScore, startGameTimer, stopGameTimer, markGameAsFinished,
    // updateGameLineup, // Keep or remove based on other usage
    resetGameLineup,
    movePlayerInGame, // Add new function
    startPlayerTimerInGame,
    stopPlayerTimerInGame,
    movePlayer, swapPlayers,
    savedLineups, saveLineup, loadLineup, deleteLineup, resetLineup,
    setCurrentPage, selectGame
  };

  return <TeamContext.Provider value={contextValue}>{children}</TeamContext.Provider>;
};
