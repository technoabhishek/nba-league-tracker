/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  Gamepad2, 
  UserPlus,
  Crown,
  History,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Player, PlayerStatus, Match } from './types';

// --- Components ---

const StatusBadge = ({ status }: { status: PlayerStatus }) => {
  const config = {
    waiting: { color: 'bg-green-500', text: 'Waiting', icon: '🟢' },
    playing: { color: 'bg-red-500', text: 'Playing', icon: '🔴' },
    idle: { color: 'bg-slate-500', text: 'Idle', icon: '⚪' },
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config[status].color} bg-opacity-20 text-white border border-white/10`}>
      <span className={`w-2 h-2 rounded-full ${config[status].color} animate-pulse`} />
      {config[status].text}
    </span>
  );
};

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // --- Logic ---

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: newPlayerName.trim(),
      matchesPlayed: 0,
      wins: 0,
      status: 'waiting',
      joinedAt: Date.now(),
    };
    
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
  };

  const deletePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const startEdit = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditName(player.name);
  };

  const saveEdit = () => {
    if (!editingPlayerId) return;
    setPlayers(players.map(p => p.id === editingPlayerId ? { ...p, name: editName } : p));
    setEditingPlayerId(null);
  };

  // Determine next match based on queue
  // Simple logic: First two 'waiting' players
  const nextMatchPlayers = useMemo(() => {
    const waiting = players.filter(p => p.status === 'waiting');
    if (waiting.length >= 2) {
      return [waiting[0], waiting[1]];
    }
    return null;
  }, [players]);

  const recordMatchResult = (winnerId: string, loserId: string) => {
    const matchId = crypto.randomUUID();
    const newMatch: Match = {
      id: matchId,
      playerAId: winnerId,
      playerBId: loserId,
      winnerId: winnerId,
      timestamp: Date.now(),
    };

    setMatches([newMatch, ...matches]);
    
    setPlayers(prev => prev.map(p => {
      if (p.id === winnerId) {
        return { 
          ...p, 
          wins: p.wins + 1, 
          matchesPlayed: p.matchesPlayed + 1,
          status: 'idle' // Move to idle after playing
        };
      }
      if (p.id === loserId) {
        return { 
          ...p, 
          matchesPlayed: p.matchesPlayed + 1,
          status: 'idle' // Move to idle after playing
        };
      }
      return p;
    }));
  };

  const setPlayerStatus = (id: string, status: PlayerStatus) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const leaderboard = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.matchesPlayed - b.matchesPlayed;
    });
  }, [players]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
            NBA League Tracker <span className="text-3xl md:text-4xl">🏀</span>
          </h1>
          <p className="text-slate-400 text-lg">Live room match management & rankings</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="glass-card px-6 py-3 flex items-center gap-3">
            <Users className="text-neon-blue w-5 h-5" />
            <span className="text-xl font-bold">{players.length} Players</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Hero & Actions */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* 1. HERO SECTION: NEXT MATCH */}
          <section>
            <AnimatePresence mode="wait">
              {nextMatchPlayers ? (
                <motion.div 
                  key="next-match"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card p-8 md:p-12 relative overflow-hidden border-neon-blue/30 neon-glow-blue"
                >
                  <div className="absolute top-0 right-0 p-4">
                    <StatusBadge status="playing" />
                  </div>
                  
                  <div className="text-center mb-8">
                    <span className="text-neon-blue font-bold tracking-widest uppercase text-sm">Next Matchup</span>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                    <div className="text-center flex-1">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-neon-blue/20 to-transparent rounded-full flex items-center justify-center mx-auto mb-4 border border-neon-blue/30">
                        <span className="text-4xl md:text-5xl font-bold text-white">{nextMatchPlayers[0].name[0].toUpperCase()}</span>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-display font-bold text-white truncate max-w-[200px] mx-auto">
                        {nextMatchPlayers[0].name}
                      </h2>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="text-5xl md:text-7xl font-black text-slate-700 italic">VS</div>
                    </div>

                    <div className="text-center flex-1">
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-neon-purple/20 to-transparent rounded-full flex items-center justify-center mx-auto mb-4 border border-neon-purple/30">
                        <span className="text-4xl md:text-5xl font-bold text-white">{nextMatchPlayers[1].name[0].toUpperCase()}</span>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-display font-bold text-white truncate max-w-[200px] mx-auto">
                        {nextMatchPlayers[1].name}
                      </h2>
                    </div>
                  </div>

                  {/* 2. QUICK ACTION PANEL */}
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => recordMatchResult(nextMatchPlayers[0].id, nextMatchPlayers[1].id)}
                      className="bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue/50 text-neon-blue py-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-colors"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      {nextMatchPlayers[0].name} Won
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => recordMatchResult(nextMatchPlayers[1].id, nextMatchPlayers[0].id)}
                      className="bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/50 text-neon-purple py-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-colors"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      {nextMatchPlayers[1].name} Won
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty-match"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-12 text-center flex flex-col items-center justify-center min-h-[400px]"
                >
                  <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                    <Gamepad2 className="w-10 h-10 text-slate-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Waiting for Players</h2>
                  <p className="text-slate-400 max-w-xs mx-auto">
                    Add at least 2 players and set their status to "Waiting" to generate the next match.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* 3. PLAYER MANAGEMENT & 4. STATUS */}
          <section className="glass-card overflow-hidden">
            <div className="p-6 border-b border-glass-border flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-neon-blue" />
                Players Management
              </h3>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                {players.length} Total
              </div>
            </div>
            
            <div className="p-6">
              {/* Add Player Form */}
              <form onSubmit={addPlayer} className="flex gap-3 mb-8">
                <div className="relative flex-1">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Enter player name..."
                    className="w-full bg-slate-900/50 border border-glass-border rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-neon-blue/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-neon-blue text-black font-bold px-8 rounded-xl hover:bg-white transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden md:inline">Add</span>
                </button>
              </form>

              {/* Player List */}
              <div className="space-y-3">
                {players.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 italic">
                    No players added yet. Start by adding your first player!
                  </div>
                ) : (
                  players.map((player) => (
                    <motion.div
                      layout
                      key={player.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                          {player.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          {editingPlayerId === player.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                className="bg-slate-900 border border-neon-blue/30 rounded px-2 py-1 text-white outline-none"
                              />
                            </div>
                          ) : (
                            <h4 className="font-bold text-white text-lg">{player.name}</h4>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span>{player.matchesPlayed} Matches</span>
                            <span>•</span>
                            <span className="text-neon-blue">{player.wins} Wins</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {(['waiting', 'idle'] as PlayerStatus[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => setPlayerStatus(player.id, s)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                player.status === s 
                                  ? (s === 'waiting' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30')
                                  : 'bg-transparent text-slate-600 hover:text-slate-400'
                              }`}
                              title={`Set to ${s}`}
                            >
                              <div className={`w-2 h-2 rounded-full ${s === 'waiting' ? 'bg-green-500' : 'bg-slate-500'}`} />
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => startEdit(player)}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deletePlayer(player.id)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Leaderboard & History */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* 5. LEADERBOARD */}
          <section className="glass-card overflow-hidden border-neon-purple/20">
            <div className="p-6 border-b border-glass-border flex items-center justify-between bg-gradient-to-r from-neon-purple/10 to-transparent">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-neon-purple" />
                Leaderboard
              </h3>
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 italic">
                    No data to rank
                  </div>
                ) : (
                  leaderboard.map((player, index) => (
                    <div 
                      key={player.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        index === 0 
                          ? 'bg-neon-purple/10 border-neon-purple/30 neon-glow-purple' 
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                          index === 0 ? 'bg-neon-purple text-white' : 
                          index === 1 ? 'bg-slate-400 text-black' :
                          index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{player.name}</h4>
                          <p className="text-xs text-slate-400">{player.wins} Wins / {player.matchesPlayed} Matches</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-white">
                          {player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0}%
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Win Rate</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* RECENT MATCHES */}
          <section className="glass-card overflow-hidden">
            <div className="p-6 border-b border-glass-border flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Recent Matches
              </h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {matches.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 italic">
                    No matches recorded
                  </div>
                ) : (
                  matches.slice(0, 5).map((match) => {
                    const winner = players.find(p => p.id === match.winnerId);
                    const loserId = match.playerAId === match.winnerId ? match.playerBId : match.playerAId;
                    const loser = players.find(p => p.id === loserId);
                    
                    return (
                      <div key={match.id} className="flex items-center justify-between text-sm p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-bold">{winner?.name}</span>
                          <span className="text-slate-600 text-xs">def.</span>
                          <span className="text-slate-400">{loser?.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-600">
                          {new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

        </div>
      </div>
      
      {/* Footer Info */}
      <footer className="mt-16 pt-8 border-t border-glass-border text-center text-slate-600 text-sm">
        <p>© 2026 NBA League Tracker • Built for the ultimate 2K room experience</p>
      </footer>
    </div>
  );
}
