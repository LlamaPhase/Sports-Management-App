import React, { useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
    import { ArrowLeft, MoreVertical, Play, Pause, Square, Calendar, RotateCcw, UserX, ArrowRightLeft, Check, X as CancelIcon } from 'lucide-react'; // Added ArrowRightLeft, Check, CancelIcon
    import { TeamContext, Game, Player, PlayerLineupState, PlayerLineupStructure } from '../context/TeamContext';
    import TeamDisplay from '../components/TeamDisplay';
    import EditGameModal from '../components/EditGameModal';
    import ConfirmModal from '../components/ConfirmModal';
    import PlayerIcon from '../components/PlayerIcon';
    import { useDrop, useDrag, DropTargetMonitor, DragSourceMonitor } from 'react-dnd';

    // --- Constants ---
    // Add new DND Item Type for planning
    const ItemTypes = { PLAYER: 'player', PLANNING_PLAYER: 'planning_player' };
    const ICON_WIDTH_APPROX = 40;
    const ICON_HEIGHT_APPROX = 58; // Base height without sub counters

    // --- Helper Functions ---
    const formatTimer = (totalSeconds: number): string => {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.round(totalSeconds % 60);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    const formatDate = (dateString: string) => {
        try { const d = new Date(dateString + 'T00:00:00'); return isNaN(d.getTime()) ? "Invalid" : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
        catch (e) { return "Invalid"; }
    };
    const createDefaultLineup = (players: Player[]): PlayerLineupState[] => {
        return players.map(p => ({ id: p.id, location: 'bench', position: undefined, playtimeSeconds: 0, playtimerStartTime: null, isStarter: false, subbedOnCount: 0, subbedOffCount: 0 }));
    };

    // --- DraggablePlayer Component (for regular game DnD) ---
    interface DraggablePlayerProps {
      player: Player;
      lineupState: PlayerLineupState;
      fieldWidth: number;
      fieldHeight: number;
      playtimeDisplaySeconds: number;
      totalGameSeconds: number;
    }
    const DraggablePlayer: React.FC<DraggablePlayerProps> = ({ player, lineupState, fieldWidth, fieldHeight, playtimeDisplaySeconds, totalGameSeconds }) => {
      const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.PLAYER, // Regular player type
        item: { id: lineupState.id, location: lineupState.location, position: lineupState.position },
        collect: (monitor: DragSourceMonitor) => ({ isDragging: !!monitor.isDragging() }),
      }), [lineupState.id, lineupState.location, lineupState.position]);

      const hasSubCounters = lineupState.subbedOnCount > 0 || lineupState.subbedOffCount > 0;
      const currentIconHeight = ICON_HEIGHT_APPROX + (hasSubCounters ? 16 : 0);

      const style: React.CSSProperties = {
        opacity: isDragging ? 0.5 : 1, cursor: 'move',
        position: lineupState.location === 'field' ? 'absolute' : 'relative',
        zIndex: lineupState.location === 'field' ? 10 : 1, minWidth: `${ICON_WIDTH_APPROX}px`,
      };

      if (lineupState.location === 'field' && lineupState.position && fieldWidth > 0 && fieldHeight > 0) {
        const pxL = (lineupState.position.x / 100) * fieldWidth; const pxT = (lineupState.position.y / 100) * fieldHeight;
        style.left = `${pxL}px`; style.top = `${pxT}px`;
        style.transform = `translate(-${ICON_WIDTH_APPROX / 2}px, -${currentIconHeight / 2}px)`;
      } else if (lineupState.location === 'field') { style.left = '-9999px'; style.top = '-9999px'; }

      return (
        <div ref={drag} style={style} className={`flex justify-center ${lineupState.location === 'bench' || lineupState.location === 'inactive' ? 'mb-1' : ''}`}>
          <PlayerIcon
            player={player} showName={true} size="small" context={lineupState.location}
            playtimeDisplaySeconds={playtimeDisplaySeconds} totalGameSeconds={totalGameSeconds}
            isStarter={lineupState.isStarter} subbedOnCount={lineupState.subbedOnCount} subbedOffCount={lineupState.subbedOffCount}
          />
        </div>
      );
    };

    // --- DropZone Component (for regular game DnD) ---
    interface DropZoneProps {
      children: React.ReactNode;
      onDropPlayer: (item: { id: string; location: 'field' | 'bench' | 'inactive'; position?: { x: number; y: number } }, dropXPercent?: number, dropYPercent?: number) => void;
      className?: string;
      location: 'field' | 'bench' | 'inactive';
      fieldRef?: React.RefObject<HTMLDivElement>;
    }
    const DropZone: React.FC<DropZoneProps> = ({ children, onDropPlayer, className, location, fieldRef }) => {
      const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.PLAYER, // Accepts regular players
        drop: (item: { id: string; location: 'field' | 'bench' | 'inactive'; position?: { x: number; y: number } }, monitor: DropTargetMonitor) => {
          if (location === 'field' && fieldRef?.current) {
            const fieldRect = fieldRef.current.getBoundingClientRect(); const dropPos = monitor.getClientOffset();
            if (dropPos && fieldRect.width > 0 && fieldRect.height > 0) {
              let relX = dropPos.x - fieldRect.left; let relY = dropPos.y - fieldRect.top;
              let pctX = Math.max(0, Math.min((relX / fieldRect.width) * 100, 100));
              let pctY = Math.max(0, Math.min((relY / fieldRect.height) * 100, 100));
              onDropPlayer(item, pctX, pctY);
            }
          } else if (location === 'bench' || location === 'inactive') {
            onDropPlayer(item);
          }
        },
        collect: (monitor: DropTargetMonitor) => ({ isOver: !!monitor.isOver() }),
      }), [onDropPlayer, location, fieldRef]);

      const combinedRef = (node: HTMLDivElement | null) => { drop(node); if (fieldRef && location === 'field') { (fieldRef as React.MutableRefObject<HTMLDivElement | null>).current = node; } };

      if (location === 'field') {
        return ( <div ref={combinedRef} className={`${className} ${isOver ? 'bg-green-700/20' : ''} transition-colors overflow-hidden`} style={{ position: 'relative', width: '100%', height: '100%' }}> {/* Markings */} <div className="absolute bottom-0 left-[20%] w-[60%] md:left-[25%] md:w-[50%] h-[18%] border-2 border-white/50 border-b-0"></div> <div className="absolute bottom-0 left-[38%] w-[24%] md:left-[40%] md:w-[20%] h-[6%] border-2 border-white/50 border-b-0"></div> <div className="absolute bottom-[18%] left-[40%] w-[20%] md:left-[42%] md:w-[16%] h-[10%] border-2 border-white/50 border-b-0 rounded-t-full"></div> <div className="absolute top-[-12%] left-[40%] w-[20%] md:left-[42%] md:w-[16%] h-[24%] border-2 border-white/50 border-t-0 rounded-b-full"></div> <div className="absolute bottom-[-5%] left-[-5%] w-[10%] h-[10%] border-2 border-white/50 border-b-0 border-l-0 rounded-tr-full"></div> <div className="absolute bottom-[-5%] right-[-5%] w-[10%] h-[10%] border-2 border-white/50 border-b-0 border-r-0 rounded-tl-full"></div> {children} </div> );
      } else {
        const hoverBg = location === 'inactive' ? 'bg-red-300/30' : 'bg-gray-300/50';
        return <div ref={drop} className={`${className} ${isOver ? hoverBg : ''} transition-colors`}>{children}</div>;
      }
    };

    // --- Planning Mode: Draggable Planning Player (Wrapper) ---
    interface DraggablePlanningPlayerWrapperProps {
      player: Player; // Basic player info
      children: React.ReactNode; // The PlayerIcon to wrap
    }
    const DraggablePlanningPlayerWrapper: React.FC<DraggablePlanningPlayerWrapperProps> = ({ player, children }) => {
      const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.PLANNING_PLAYER, // Use the new type
        item: { id: player.id }, // Only need the ID
        collect: (monitor: DragSourceMonitor) => ({ isDragging: !!monitor.isDragging() }),
      }), [player.id]);

      return (
        <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }} className="mb-1">
          {children} {/* Render the detailed PlayerIcon passed as children */}
        </div>
      );
    };


    // --- Planning Mode: Field Drop Marker ---
    interface FieldDropMarkerProps {
      targetPlayerState: PlayerLineupState; // The player currently at this position
      fieldWidth: number;
      fieldHeight: number;
      onPlanDrop: (draggedPlayerId: string, targetPlayerId: string, targetPosition: { x: number; y: number } | undefined) => void;
      plannedIncomingPlayer?: Player | null; // Player planned to move here
    }
    const FieldDropMarker: React.FC<FieldDropMarkerProps> = ({ targetPlayerState, fieldWidth, fieldHeight, onPlanDrop, plannedIncomingPlayer }) => {
      const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.PLANNING_PLAYER, // Accept planning players
        drop: (item: { id: string }) => {
          console.log(`[FieldDropMarker] Dropped planning player ${item.id} onto target ${targetPlayerState.id}`);
          onPlanDrop(item.id, targetPlayerState.id, targetPlayerState.position);
        },
        collect: (monitor: DropTargetMonitor) => ({ isOver: !!monitor.isOver() }),
      }), [targetPlayerState.id, targetPlayerState.position, onPlanDrop]);

      const style: React.CSSProperties = {
        position: 'absolute',
        zIndex: 25, // Above overlay, below confirm/cancel buttons
        width: `${ICON_WIDTH_APPROX}px`,
        height: `${ICON_HEIGHT_APPROX}px`,
        // Use target player's position for marker placement
        left: targetPlayerState.position ? `${(targetPlayerState.position.x / 100) * fieldWidth}px` : '-9999px',
        top: targetPlayerState.position ? `${(targetPlayerState.position.y / 100) * fieldHeight}px` : '-9999px',
        transform: `translate(-${ICON_WIDTH_APPROX / 2}px, -${ICON_HEIGHT_APPROX / 2}px)`, // Center the marker
        borderRadius: '50%',
        border: `2px dashed ${isOver ? 'white' : 'rgba(255, 255, 255, 0.5)'}`,
        backgroundColor: isOver ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        transition: 'background-color 0.2s, border-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };

      return (
        <div ref={drop} style={style}>
          {plannedIncomingPlayer && (
            // Show the incoming player icon slightly above the marker center
            <div style={{ transform: 'translateY(-10px)' }}>
              <PlayerIcon player={plannedIncomingPlayer} showName={true} size="small" context="field" />
            </div>
          )}
        </div>
      );
    };


    // --- GamePage Component ---
    interface GamePageProps {
      gameId: string | null;
      previousPage: string | null;
    }

    const GamePage: React.FC<GamePageProps> = ({ gameId, previousPage }) => {
      const context = useContext(TeamContext);
      const {
        games, players, teamName, teamLogo, setCurrentPage, updateGame, deleteGame,
        updateGameScore, startGameTimer, stopGameTimer, markGameAsFinished,
        resetGameLineup, movePlayerInGame,
      } = context;

      // --- State ---
      const [isMenuOpen, setIsMenuOpen] = useState(false);
      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
      const [isConfirmEditFinishedOpen, setIsConfirmEditFinishedOpen] = useState(false);
      const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
      const [gameDisplaySeconds, setGameDisplaySeconds] = useState(0);
      const [currentGameLineup, setCurrentGameLineup] = useState<PlayerLineupState[]>([]);
      const [playerDisplayTimes, setPlayerDisplayTimes] = useState<Map<string, number>>(new Map());
      const fieldContainerRef = useRef<HTMLDivElement>(null);
      const fieldItselfRef = useRef<HTMLDivElement>(null);
      const benchContainerRef = useRef<HTMLDivElement>(null);
      const inactiveContainerRef = useRef<HTMLDivElement>(null);
      const [fieldDimensions, setFieldDimensions] = useState({ width: 0, height: 0 });
      const playerIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

      // --- Planning Mode State ---
      const [isPlanningSubs, setIsPlanningSubs] = useState(false);
      // Map: benchPlayerId -> { targetFieldPlayerId, targetPosition }
      const [plannedSwaps, setPlannedSwaps] = useState<Map<string, { targetFieldPlayerId: string; targetPosition: { x: number; y: number } | undefined }>>(new Map());
      // --- End Planning Mode State ---

      // --- Memoized Game Data ---
      const game = useMemo(() => {
        if (!gameId) return null;
        const foundGame = games.find(g => g.id === gameId);
        if (foundGame?.lineup) {
            if (JSON.stringify(foundGame.lineup) !== JSON.stringify(currentGameLineup)) {
                console.log("[GamePage Memo] Context game lineup changed, updating local state.");
                setCurrentGameLineup(foundGame.lineup);
                const newDisplayTimes = new Map<string, number>();
                foundGame.lineup.forEach(p => newDisplayTimes.set(p.id, p.playtimeSeconds));
                setPlayerDisplayTimes(newDisplayTimes);
            }
        }
        return foundGame ? { ...foundGame, homeScore: foundGame.homeScore ?? 0, awayScore: foundGame.awayScore ?? 0, timerStatus: foundGame.timerStatus ?? 'stopped', timerStartTime: foundGame.timerStartTime ?? null, timerElapsedSeconds: foundGame.timerElapsedSeconds ?? 0, isExplicitlyFinished: foundGame.isExplicitlyFinished ?? false, lineup: foundGame.lineup ?? null, } : null;
      }, [gameId, games, currentGameLineup]);

      // --- Initialize/Update Local Lineup State ---
      useEffect(() => {
        if (game && (!currentGameLineup.length || currentGameLineup.length !== players.length)) {
            console.log("[GamePage Effect - Init/Sync] Initializing/Syncing local lineup state from game context.");
            const initialLineup = game.lineup ? game.lineup : createDefaultLineup(players);
            const playerIdsInRoster = new Set(players.map(p => p.id));
            const lineupPlayerIds = new Set(initialLineup.map(p => p.id));
            const fullLineup = [
                ...initialLineup.filter(p => playerIdsInRoster.has(p.id)),
                ...players.filter(p => !lineupPlayerIds.has(p.id)).map(p => ({
                    id: p.id, location: 'bench', position: undefined, playtimeSeconds: 0, playtimerStartTime: null, isStarter: false, subbedOnCount: 0, subbedOffCount: 0
                } as PlayerLineupState))
            ];
            const validatedLineup = fullLineup.map(p => ({
                ...p, location: ['field', 'bench', 'inactive'].includes(p.location) ? p.location : 'bench',
                isStarter: p.isStarter ?? false, subbedOnCount: p.subbedOnCount ?? 0, subbedOffCount: p.subbedOffCount ?? 0,
            }));
            setCurrentGameLineup(validatedLineup);
            const initialDisplayTimes = new Map<string, number>();
            validatedLineup.forEach(p => initialDisplayTimes.set(p.id, p.playtimeSeconds));
            setPlayerDisplayTimes(initialDisplayTimes);
        } else if (!game) {
            setCurrentGameLineup([]); setPlayerDisplayTimes(new Map());
        }
      }, [game, players]);

      // --- Game State Logic ---
      const isFinished = useMemo(() => game?.isExplicitlyFinished === true, [game]);
      const isRunning = useMemo(() => game?.timerStatus === 'running', [game]);
      const isPaused = useMemo(() => game?.timerStatus === 'stopped' && (game?.timerElapsedSeconds ?? 0) > 0 && !isFinished, [game, isFinished]);
      const isNotStarted = useMemo(() => game?.timerStatus === 'stopped' && (game?.timerElapsedSeconds ?? 0) === 0 && !isFinished, [game, isFinished]);

      // --- Main Game Timer Display Effect ---
      useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (isRunning && game?.timerStartTime) {
          const updateDisplay = () => setGameDisplaySeconds((game.timerElapsedSeconds ?? 0) + (Date.now() - (game.timerStartTime ?? Date.now())) / 1000);
          updateDisplay(); intervalId = setInterval(updateDisplay, 1000);
        } else { setGameDisplaySeconds(game?.timerElapsedSeconds ?? 0); }
        return () => { if (intervalId) clearInterval(intervalId); };
      }, [isRunning, game?.timerStartTime, game?.timerElapsedSeconds, game?.id]);

      // --- Player Timer Management Effect ---
      useEffect(() => {
        const clearAllPlayerIntervals = () => { playerIntervalsRef.current.forEach(clearInterval); playerIntervalsRef.current.clear(); };
        clearAllPlayerIntervals();
        const currentDisplayTimes = new Map<string, number>();
        currentGameLineup.forEach(playerState => {
            const storedPlaytime = typeof playerState.playtimeSeconds === 'number' ? playerState.playtimeSeconds : 0;
            if (playerState.location === 'field' && isRunning && playerState.playtimerStartTime) {
                const elapsedSinceStart = (Date.now() - playerState.playtimerStartTime) / 1000;
                currentDisplayTimes.set(playerState.id, storedPlaytime + elapsedSinceStart);
                const intervalId = setInterval(() => {
                    setPlayerDisplayTimes(prev => {
                        const latestGame = games.find(g => g.id === gameId); const latestPlayerState = latestGame?.lineup?.find(p => p.id === playerState.id);
                        if (!latestPlayerState) return prev;
                        const latestStoredPlaytime = latestPlayerState.playtimeSeconds ?? 0; const latestStartTime = latestPlayerState.playtimerStartTime; const latestIsRunning = latestGame?.timerStatus === 'running';
                        if (latestIsRunning && latestPlayerState.location === 'field' && latestStartTime) {
                             const newElapsed = (Date.now() - latestStartTime) / 1000; return new Map(prev).set(playerState.id, latestStoredPlaytime + newElapsed);
                        } else { return new Map(prev).set(playerState.id, latestStoredPlaytime); }
                    });
                }, 1000);
                playerIntervalsRef.current.set(playerState.id, intervalId);
            } else { currentDisplayTimes.set(playerState.id, storedPlaytime); }
        });
        setPlayerDisplayTimes(currentDisplayTimes);
        return clearAllPlayerIntervals;
      }, [isRunning, currentGameLineup, games, gameId]);

      // --- Lineup Editor Dimension Effect ---
       useEffect(() => {
         const updateDims = () => {
           const fE = fieldItselfRef.current; const bE = benchContainerRef.current; const iE = inactiveContainerRef.current;
           if (fE) {
             const { width, height } = fE.getBoundingClientRect();
             if (width > 0 && height > 0 && (Math.abs(width - fieldDimensions.width) > 1 || Math.abs(height - fieldDimensions.height) > 1)) { setFieldDimensions({ width, height }); }
             if (bE && iE) {
               const isMd = window.innerWidth >= 768;
               if (isMd && height > 0) {
                 const inactiveHeight = 100; const benchHeight = Math.max(60, height - inactiveHeight - 12);
                 bE.style.height = `${benchHeight}px`; iE.style.height = `${inactiveHeight}px`;
               } else { bE.style.height = ''; iE.style.height = ''; }
             }
           }
         };
         const tId = setTimeout(updateDims, 50); let rO: ResizeObserver | null = null; const cE = fieldContainerRef.current;
         if (cE) { rO = new ResizeObserver(updateDims); rO.observe(cE); } window.addEventListener('resize', updateDims);
         return () => { clearTimeout(tId); if (rO && cE) { rO.unobserve(cE); } window.removeEventListener('resize', updateDims); };
       }, [fieldDimensions.width, fieldDimensions.height]);

      // --- Handlers ---
      const handleGoBack = () => setCurrentPage(previousPage || 'schedule');
      const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
      const confirmAction = (action: () => void) => { if (isFinished) { setPendingAction(() => action); setIsConfirmEditFinishedOpen(true); } else { action(); } };
      const handleConfirmEditFinished = () => { if (pendingAction) pendingAction(); setIsConfirmEditFinishedOpen(false); setPendingAction(null); };
      const handleCancelEditFinished = () => { setIsConfirmEditFinishedOpen(false); setPendingAction(null); };
      const handleEditClick = () => { setIsMenuOpen(false); confirmAction(() => setIsEditModalOpen(true)); };
      const handleDeleteClick = () => { setIsMenuOpen(false); setIsConfirmDeleteOpen(true); };
      const handleConfirmDelete = () => { if (game) { deleteGame(game.id); setIsConfirmDeleteOpen(false); handleGoBack(); } };
      const handleIncrementScore = (team: 'home' | 'away') => { if (!game) return; const action = () => { const cH = game.homeScore ?? 0; const cA = game.awayScore ?? 0; if (team === 'home') updateGameScore(game.id, cH + 1, cA); else updateGameScore(game.id, cH, cA + 1); }; confirmAction(action); };
      const handleTimerClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); if (!game || isFinished) return;
        if (isRunning) { stopGameTimer(game.id); }
        else {
          const gameDT = new Date(`${game.date}T${game.time || '00:00:00'}`); const isFut = gameDT > new Date(); const hasNR = (game.timerElapsedSeconds ?? 0) === 0 && !game.timerStartTime;
          const shouldStart = !isFut || !hasNR || window.confirm('Start future game now? Date/time will update.');
          if (shouldStart) { startGameTimer(game.id); }
        }
      }, [game, isFinished, isRunning, stopGameTimer, startGameTimer]);
      const handleEndGame = useCallback(() => { if (game) markGameAsFinished(game.id); }, [game, markGameAsFinished]);

      // --- Regular DnD Handler ---
      const handleDropInGame = useCallback((
        item: { id: string; location: 'field' | 'bench' | 'inactive'; position?: { x: number; y: number } },
        targetLocation: 'field' | 'bench' | 'inactive', xPercent?: number, yPercent?: number
      ) => {
        if (!game || isPlanningSubs) return; // Ignore drops during planning mode
        const droppedPlayerId = item.id; const sourceLocation = item.location;
        let nextLineupStructure: PlayerLineupStructure[] = currentGameLineup.map(({ id, location, position }) => ({ id, location, position }));
        const droppedPlayerIndex = nextLineupStructure.findIndex(p => p.id === droppedPlayerId);
        if (droppedPlayerIndex === -1) return;
        const playerBeingMovedStructure = nextLineupStructure[droppedPlayerIndex];

        if (targetLocation === 'field' && xPercent !== undefined && yPercent !== undefined) {
            const currentFieldPlayersStructure = nextLineupStructure.filter(fp => fp.location === 'field' && fp.id !== droppedPlayerId);
            const iconWPercent = fieldDimensions.width > 0 ? (ICON_WIDTH_APPROX / fieldDimensions.width) * 100 : 5;
            const iconHPercent = fieldDimensions.height > 0 ? (ICON_HEIGHT_APPROX / fieldDimensions.height) * 100 : 5;
            const targetPlayerStructure = currentFieldPlayersStructure.find(fp => {
                if (!fp.position) return false;
                const pL = fp.position.x - iconWPercent / 2; const pR = fp.position.x + iconWPercent / 2;
                const pT = fp.position.y - iconHPercent / 2; const pB = fp.position.y + iconHPercent / 2;
                return xPercent > pL && xPercent < pR && yPercent > pT && yPercent < pB;
            });
            if (targetPlayerStructure) {
                const targetPlayerIndex = nextLineupStructure.findIndex(p => p.id === targetPlayerStructure.id);
                if (targetPlayerIndex === -1) return;
                const playerBeingReplacedStructure = nextLineupStructure[targetPlayerIndex];
                movePlayerInGame(game.id, playerBeingReplacedStructure.id, 'field', sourceLocation, sourceLocation === 'field' ? playerBeingMovedStructure.position : undefined);
                movePlayerInGame(game.id, droppedPlayerId, sourceLocation, 'field', playerBeingReplacedStructure.position);
            } else { movePlayerInGame(game.id, droppedPlayerId, sourceLocation, 'field', { x: xPercent, y: yPercent }); }
        } else if (targetLocation === 'bench' || targetLocation === 'inactive') {
            if (sourceLocation !== targetLocation) { movePlayerInGame(game.id, droppedPlayerId, sourceLocation, targetLocation, undefined); }
        }
      }, [game, currentGameLineup, fieldDimensions, movePlayerInGame, gameId, isPlanningSubs]); // Added isPlanningSubs dependency

      // --- Lineup Editor Reset Handler ---
       const handleResetGameLineup = useCallback(() => {
         if (!game || isPlanningSubs) return; // Prevent reset during planning
         if (window.confirm('Reset lineup? All players move to bench, playtime and starter status resets.')) {
           const resetState = resetGameLineup(game.id);
           setCurrentGameLineup(resetState);
           const initialDisplayTimes = new Map<string, number>();
           resetState.forEach(p => initialDisplayTimes.set(p.id, p.playtimeSeconds));
           setPlayerDisplayTimes(initialDisplayTimes);
         }
       }, [game, resetGameLineup, isPlanningSubs]); // Added isPlanningSubs dependency

      // --- Planning Mode Handlers ---
      const handleTogglePlanningMode = () => {
        if (isFinished) {
            alert("Cannot plan substitutions for a finished game.");
            return;
        }
        setIsPlanningSubs(!isPlanningSubs);
        setPlannedSwaps(new Map()); // Clear plans when toggling
      };

      const handlePlanDrop = useCallback((draggedPlayerId: string, targetPlayerId: string, targetPosition: { x: number; y: number } | undefined) => {
        console.log(`Planning: Bench player ${draggedPlayerId} -> Field player ${targetPlayerId}`);
        setPlannedSwaps(prev => {
            const newMap = new Map(prev);
            // Check if the dragged player is already planned to replace someone else
            const existingTarget = Array.from(newMap.entries()).find(([_, value]) => value.targetFieldPlayerId === targetPlayerId);
            if (existingTarget) {
                newMap.delete(existingTarget[0]); // Remove previous plan for this target spot
            }
            // Remove any existing plan for the *dragged* player
            newMap.delete(draggedPlayerId);
            // Add the new plan
            newMap.set(draggedPlayerId, { targetFieldPlayerId: targetPlayerId, targetPosition });
            return newMap;
        });
      }, []);

      const handleCancelPlan = () => {
        setIsPlanningSubs(false);
        setPlannedSwaps(new Map());
      };

      const handleConfirmPlan = () => {
        if (!game) return;
        console.log("Confirming planned swaps:", plannedSwaps);
        // Execute swaps using movePlayerInGame
        plannedSwaps.forEach(({ targetFieldPlayerId, targetPosition }, benchPlayerId) => {
            console.log(`Executing swap: Bench ${benchPlayerId} <-> Field ${targetFieldPlayerId}`);
            // 1. Move field player to bench
            movePlayerInGame(game.id, targetFieldPlayerId, 'field', 'bench', undefined);
            // 2. Move bench player to field player's original spot
            movePlayerInGame(game.id, benchPlayerId, 'bench', 'field', targetPosition);
        });
        setIsPlanningSubs(false);
        setPlannedSwaps(new Map());
      };
      // --- End Planning Mode Handlers ---

      // --- Derived Lineup Data for Rendering ---
      const { fieldPlayersLineup, benchPlayersLineup, inactivePlayersLineup } = useMemo(() => {
          const field: PlayerLineupState[] = []; const bench: PlayerLineupState[] = []; const inactive: PlayerLineupState[] = [];
          const playerMap = new Map(players.map(p => [p.id, p]));
          currentGameLineup.forEach(lineupState => {
              const player = playerMap.get(lineupState.id);
              if (player) {
                  if (lineupState.location === 'field') field.push(lineupState);
                  else if (lineupState.location === 'inactive') inactive.push(lineupState);
                  else bench.push(lineupState);
              }
          });
          const sortByName = (a: PlayerLineupState, b: PlayerLineupState) => (playerMap.get(a.id)?.firstName ?? '').localeCompare(playerMap.get(b.id)?.firstName ?? '');
          bench.sort(sortByName); inactive.sort(sortByName);
          return { fieldPlayersLineup: field, benchPlayersLineup: bench, inactivePlayersLineup: inactive };
      }, [currentGameLineup, players]);

      // Map planned swaps for rendering markers
      const fieldPlayerIdToIncomingBenchPlayerId = useMemo(() => {
          const map = new Map<string, string>();
          plannedSwaps.forEach(({ targetFieldPlayerId }, benchPlayerId) => {
              map.set(targetFieldPlayerId, benchPlayerId);
          });
          return map;
      }, [plannedSwaps]);

      const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);


      // --- Render Logic ---
      if (!game) return <div className="p-4 text-center text-gray-600">Loading game...</div>;

      const currentTeamName = teamName || 'Your Team';
      const homeTeam = game.location === 'home' ? { name: currentTeamName, logo: teamLogo } : { name: game.opponent, logo: null };
      const awayTeam = game.location === 'away' ? { name: currentTeamName, logo: teamLogo } : { name: game.opponent, logo: null };
      const gameTimeDisplay = game.time ? new Date(`1970-01-01T${game.time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'TBD';
      const approxFixedElementsHeightPortrait = 280;

      return (
        <div className="flex flex-col h-screen p-4 pt-0 overflow-y-auto">
          {/* Header */}
          <header className="flex justify-between items-center py-2 border-b sticky top-0 bg-gray-100 z-30 mb-4 -mx-4 px-2"> <button onClick={handleGoBack} className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-200"><ArrowLeft size={20} /></button> <div className="relative"> <button onClick={toggleMenu} className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-200"><MoreVertical size={20} /></button> {isMenuOpen && ( <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-40"> <button onClick={handleEditClick} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button> <button onClick={handleDeleteClick} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button> </div> )} </div> </header>

          {/* Score Display */}
          <div className="flex-shrink-0 space-y-6 mb-6"> <div className="flex items-center justify-around space-x-2 md:space-x-4 bg-white p-4 rounded-lg shadow"> <div className="flex flex-col items-center space-y-2 flex-1"> <TeamDisplay name={homeTeam.name} logo={homeTeam.logo} isOpponentTeam={game.location === 'away'} size="large" className="justify-center mb-2" /> <button onClick={() => handleIncrementScore('home')} className="text-4xl md:text-5xl font-bold p-2 rounded hover:bg-gray-100">{game.homeScore ?? 0}</button> </div> <div className="text-center flex-shrink-0 flex flex-col items-center space-y-1"> <p className="text-xs text-gray-500 flex items-center space-x-1 mb-1"><Calendar size={12} /><span>{formatDate(game.date)}</span></p> <button onClick={handleTimerClick} disabled={isFinished} className={`text-xl md:text-2xl font-semibold p-2 rounded hover:bg-gray-100 transition flex items-center justify-center space-x-1 ${isFinished ? 'cursor-default text-gray-500' : ''}`}> {isFinished ? (<span className="font-bold text-gray-600">FT</span>) : isRunning ? (<><span>{formatTimer(gameDisplaySeconds)}</span><Pause size={18} /></>) : isPaused ? (<><span>{formatTimer(gameDisplaySeconds)}</span><Play size={18} /></>) : (<span>{gameTimeDisplay}</span>)} </button> {(isRunning || isPaused) && !isFinished && (<button onClick={handleEndGame} className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 transition flex items-center space-x-1 mt-1"><Square size={14} /><span>End Game</span></button>)} </div> <div className="flex flex-col items-center space-y-2 flex-1"> <TeamDisplay name={awayTeam.name} logo={awayTeam.logo} isOpponentTeam={game.location === 'home'} size="large" className="justify-center mb-2" /> <button onClick={() => handleIncrementScore('away')} className="text-4xl md:text-5xl font-bold p-2 rounded hover:bg-gray-100">{game.awayScore ?? 0}</button> </div> </div> </div>

           {/* Lineup Editor Section */}
           <div className="flex flex-col md:flex-row flex-grow md:space-x-4 mt-4">
               {/* Field Area */}
               <div ref={fieldContainerRef} className="relative w-full md:w-2/3 mx-auto my-2 md:my-0 md:mx-0 flex flex-col md:order-1 md:max-h-none" style={{ aspectRatio: '1 / 1', maxHeight: `calc(100vh - ${approxFixedElementsHeightPortrait}px)` }}>
                   <DropZone onDropPlayer={(item, xPct, yPct) => handleDropInGame(item, 'field', xPct, yPct)} fieldRef={fieldItselfRef} className="bg-green-600 w-full h-full rounded-lg shadow-inner flex-grow overflow-hidden" location="field">
                       {/* Render regular draggable players */}
                       {!isPlanningSubs && fieldPlayersLineup.map((lineupState) => {
                           const player = playerMap.get(lineupState.id);
                           return player ? ( <DraggablePlayer key={player.id} player={player} lineupState={lineupState} fieldWidth={fieldDimensions.width} fieldHeight={fieldDimensions.height} playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0} totalGameSeconds={gameDisplaySeconds} /> ) : null;
                       })}
                       {/* Render field player icons statically during planning */}
                       {isPlanningSubs && fieldPlayersLineup.map((lineupState) => {
                           const player = playerMap.get(lineupState.id);
                           const style: React.CSSProperties = { position: 'absolute', zIndex: 5 }; // Below overlay
                           if (lineupState.position && fieldDimensions.width > 0 && fieldDimensions.height > 0) {
                               const pxL = (lineupState.position.x / 100) * fieldDimensions.width; const pxT = (lineupState.position.y / 100) * fieldDimensions.height;
                               style.left = `${pxL}px`; style.top = `${pxT}px`;
                               style.transform = `translate(-${ICON_WIDTH_APPROX / 2}px, -${ICON_HEIGHT_APPROX / 2}px)`;
                           } else { style.left = '-9999px'; style.top = '-9999px'; }
                           return player ? ( <div key={player.id} style={style}> <PlayerIcon player={player} showName={true} size="small" context="field" playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0} totalGameSeconds={gameDisplaySeconds} isStarter={lineupState.isStarter} subbedOnCount={lineupState.subbedOnCount} subbedOffCount={lineupState.subbedOffCount} /> </div> ) : null;
                       })}
                   </DropZone>

                   {/* Planning Mode Field Overlay */}
                   {isPlanningSubs && (
                       <div className="absolute inset-0 bg-black/30 rounded-lg z-20">
                           {/* Render Drop Markers */}
                           {fieldPlayersLineup.map((targetState) => {
                               const incomingBenchPlayerId = fieldPlayerIdToIncomingBenchPlayerId.get(targetState.id);
                               const incomingPlayer = incomingBenchPlayerId ? playerMap.get(incomingBenchPlayerId) : null;
                               return (
                                   <FieldDropMarker
                                       key={targetState.id}
                                       targetPlayerState={targetState}
                                       fieldWidth={fieldDimensions.width}
                                       fieldHeight={fieldDimensions.height}
                                       onPlanDrop={handlePlanDrop}
                                       plannedIncomingPlayer={incomingPlayer}
                                   />
                               );
                           })}
                           {/* Confirm/Cancel Buttons */}
                           <div className="absolute top-2 right-2 flex space-x-1 z-30">
                               <button onClick={handleConfirmPlan} className="bg-green-600 text-white p-1.5 rounded-full shadow hover:bg-green-700" title="Confirm Subs"><Check size={20} /></button>
                               <button onClick={handleCancelPlan} className="bg-red-600 text-white p-1.5 rounded-full shadow hover:bg-red-700" title="Cancel Subs"><CancelIcon size={20} /></button>
                           </div>
                       </div>
                   )}

                   {/* Action Buttons (Reset, Plan Subs) */}
                   <div className="absolute top-2 left-2 flex space-x-1 bg-white/70 p-1 rounded shadow z-20">
                       <button onClick={handleResetGameLineup} disabled={isPlanningSubs} className="text-gray-700 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed p-1.5" title="Reset Game Lineup"><RotateCcw size={18} /></button>
                       <button onClick={handleTogglePlanningMode} disabled={isFinished} className={`p-1.5 rounded ${isPlanningSubs ? 'bg-blue-200 text-blue-700' : 'text-gray-700 hover:text-blue-600'} disabled:opacity-50 disabled:cursor-not-allowed`} title="Plan Substitutions"><ArrowRightLeft size={18} /></button>
                   </div>
               </div>

               {/* Bench & Inactive Column */}
               <div className="relative flex-shrink-0 md:w-1/3 md:order-2 md:flex md:flex-col space-y-3 mt-3 md:mt-0">
                   {/* Bench Area */}
                   <div ref={benchContainerRef} className="bg-gray-200 p-3 rounded-lg shadow flex flex-col">
                       <h2 className="text-base font-semibold mb-2 border-b pb-1 text-gray-700 flex-shrink-0">Bench</h2>
                       <DropZone onDropPlayer={(item) => handleDropInGame(item, 'bench')} className="min-h-[60px] flex flex-wrap gap-x-3 gap-y-1 flex-grow md:overflow-y-auto" location="bench">
                           {/* Render regular draggable players */}
                           {!isPlanningSubs && benchPlayersLineup.length === 0 && <p className="text-gray-500 w-full text-center text-sm py-2">Bench empty.</p>}
                           {!isPlanningSubs && benchPlayersLineup.map((lineupState) => {
                               const player = playerMap.get(lineupState.id);
                               return player ? ( <DraggablePlayer key={player.id} player={player} lineupState={lineupState} fieldWidth={0} fieldHeight={0} playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0} totalGameSeconds={gameDisplaySeconds} /> ) : null;
                           })}
                           {/* Render bench players statically during planning (now hidden by overlay) */}
                           {isPlanningSubs && benchPlayersLineup.length === 0 && <p className="text-gray-500 w-full text-center text-sm py-2 opacity-0">Bench empty.</p>}
                           {isPlanningSubs && benchPlayersLineup.map((lineupState) => {
                               const player = playerMap.get(lineupState.id);
                               // Render non-draggable icon if planning (now hidden by overlay)
                               return player ? ( <div key={player.id} className="mb-1 opacity-0"> <PlayerIcon player={player} showName={true} size="small" context="bench" playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0} totalGameSeconds={gameDisplaySeconds} isStarter={lineupState.isStarter} subbedOnCount={lineupState.subbedOnCount} subbedOffCount={lineupState.subbedOffCount} /> </div> ) : null;
                           })}
                       </DropZone>
                   </div>

                   {/* Planning Mode Bench Overlay */}
                   {isPlanningSubs && (
                       // Use inset-0 for full coverage, bg-gray-300 for opaque darker background
                       <div className="absolute inset-0 bg-gray-300 rounded-lg z-20 p-3 flex flex-col">
                           {/* Add Bench Header inside overlay */}
                           <h2 className="text-base font-semibold mb-2 border-b pb-1 text-gray-700 flex-shrink-0">Bench (Planning)</h2>
                           <div className="min-h-[60px] flex flex-wrap gap-x-3 gap-y-1 flex-grow md:overflow-y-auto">
                               {/* Render Draggable Planning Players with full details */}
                               {benchPlayersLineup.map((lineupState) => {
                                   const player = playerMap.get(lineupState.id);
                                   // Don't render if this player is already planned to sub in
                                   const isPlannedToSubIn = Array.from(plannedSwaps.keys()).includes(player?.id ?? '');
                                   if (player && !isPlannedToSubIn) {
                                       return (
                                           <DraggablePlanningPlayerWrapper key={player.id} player={player}>
                                               <PlayerIcon
                                                   player={player}
                                                   showName={true}
                                                   size="small"
                                                   context="bench" // Keep context as bench for styling
                                                   playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0}
                                                   totalGameSeconds={gameDisplaySeconds}
                                                   isStarter={lineupState.isStarter}
                                                   subbedOnCount={lineupState.subbedOnCount}
                                                   subbedOffCount={lineupState.subbedOffCount}
                                               />
                                           </DraggablePlanningPlayerWrapper>
                                       );
                                   }
                                   // Render non-draggable, slightly faded icon if already planned
                                   if (player && isPlannedToSubIn) {
                                       return (
                                           <div key={player.id} className="mb-1 opacity-40 cursor-not-allowed">
                                               <PlayerIcon
                                                   player={player}
                                                   showName={true}
                                                   size="small"
                                                   context="bench"
                                                   playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0}
                                                   totalGameSeconds={gameDisplaySeconds}
                                                   isStarter={lineupState.isStarter}
                                                   subbedOnCount={lineupState.subbedOnCount}
                                                   subbedOffCount={lineupState.subbedOffCount}
                                               />
                                           </div>
                                       );
                                   }
                                   return null;
                               })}
                               {benchPlayersLineup.length === 0 && <p className="text-gray-500 w-full text-center text-sm py-2">Bench empty.</p>}
                           </div>
                       </div>
                   )}

                   {/* Inactive Area */}
                   <div ref={inactiveContainerRef} className="bg-gray-300 p-3 rounded-lg shadow flex flex-col">
                       <h2 className="text-base font-semibold mb-2 border-b pb-1 text-gray-600 flex-shrink-0 flex items-center space-x-1"><UserX size={16} /><span>Inactive</span></h2>
                       <DropZone onDropPlayer={(item) => handleDropInGame(item, 'inactive')} className="min-h-[60px] flex flex-wrap gap-x-3 gap-y-1 flex-grow md:overflow-y-auto" location="inactive">
                           {inactivePlayersLineup.length === 0 ? ( <p className="text-gray-500 w-full text-center text-sm py-2">No inactive players.</p> ) : (
                               inactivePlayersLineup.map((lineupState) => {
                                   const player = playerMap.get(lineupState.id);
                                   return player ? ( <DraggablePlayer key={player.id} player={player} lineupState={lineupState} fieldWidth={0} fieldHeight={0} playtimeDisplaySeconds={playerDisplayTimes.get(player.id) ?? 0} totalGameSeconds={gameDisplaySeconds} /> ) : null;
                               })
                           )}
                       </DropZone>
                   </div>
               </div>
           </div>

          {/* Modals */}
          <EditGameModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} game={game} onUpdateGame={updateGame} />
          <ConfirmModal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={handleConfirmDelete} title="Delete Game" message={`Delete game vs ${game.opponent}?`} confirmText="Delete" />
          <ConfirmModal isOpen={isConfirmEditFinishedOpen} onClose={handleCancelEditFinished} onConfirm={handleConfirmEditFinished} title="Game Finished" message="Game ended. Change anyway?" confirmText="Yes, Change" cancelText="Cancel" />
        </div>
      );
    };

    export default GamePage;
