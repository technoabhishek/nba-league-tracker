/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Trash2, 
  Edit2, 
  Gamepad2, 
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  BarChart3,
  Camera as CameraIcon,
  LayoutDashboard,
  GalleryVerticalEnd,
  RefreshCw,
  UploadCloud,
  Link as LinkIcon,
  Video as VideoIcon,
  ChevronRight,
  MonitorPlay,
  PlayCircle,
  CircleStop,
  Check
} from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import Webcam from 'react-webcam';
import { Player, PlayerStatus, Match } from './types';
import { supabase } from './lib/supabase';
import { getCroppedImg } from './utils/imageProcessor';

// --- Components ---

const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-lg" }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, maxWidth?: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`glass-card w-full ${maxWidth} overflow-hidden relative border-white/10 bg-slate-900 shadow-2xl`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">{children}</div>
      </motion.div>
    </div>
  );
};

const SatelliteCamera = ({ onCapture, type = 'image', onCancel }: { onCapture: (blob: Blob) => void, type?: 'image' | 'video', onCancel: () => void }) => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) { fetch(imageSrc).then(res => res.blob()).then(onCapture); }
  }, [onCapture]);

  const handleStartCaptureClick = useCallback(() => {
    setCapturing(true);
    if (!webcamRef.current?.video) return;
    const stream = (webcamRef.current.video as any).captureStream();
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorderRef.current.addEventListener("dataavailable", (e) => { if (e.data.size > 0) setRecordedChunks((prev) => prev.concat(e.data)); });
    mediaRecorderRef.current.start();
  }, [webcamRef]);

  const handleStopCaptureClick = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setCapturing(false);
  }, [mediaRecorderRef]);

  useEffect(() => {
    if (recordedChunks.length > 0 && !capturing) {
       const blob = new Blob(recordedChunks, { type: "video/webm" });
       onCapture(blob);
       setRecordedChunks([]);
    }
  }, [recordedChunks, capturing, onCapture]);

  return (
    <div className="space-y-6">
       <div className="relative rounded-[32px] overflow-hidden border-2 border-white/10 shadow-2xl bg-black aspect-video group">
          <Webcam audio={type === 'video'} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "environment" }} className="w-full h-full object-cover" />
       </div>
       <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-4 bg-white/5 text-white font-black uppercase text-[10px] rounded-2xl">Cancel</button>
          {type === 'image' ? (
             <button onClick={capturePhoto} className="flex-1 py-4 bg-white text-black font-black uppercase text-[10px] rounded-2xl hover:bg-neon-blue transition-all flex items-center justify-center gap-2"><CameraIcon className="w-4 h-4"/> Snap Photo</button>
          ) : (
             !capturing ? (
                <button onClick={handleStartCaptureClick} className="flex-1 py-4 bg-red-600 text-white font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-2 animate-pulse"><PlayCircle className="w-4 h-4"/> Record</button>
             ) : (
                <button onClick={handleStopCaptureClick} className="flex-1 py-4 bg-black text-neon-blue font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-2 border border-neon-blue/40"><CircleStop className="w-4 h-4"/> Stop</button>
             )
          )}
       </div>
    </div>
  );
};

// --- App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'feed'>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // States
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', team: '', avatar: '', rawImage: null as string | null });
  const [showCropper, setShowCropper] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState(false);
  const [matchView, setMatchView] = useState<Match | null>(null);

  const [matchResult, setMatchResult] = useState({
     scoreA: '', scoreB: '', caption: '', mediaType: 'image' as 'image' | 'video',
     momentSource: 'upload' as 'upload' | 'link' | 'live',
     momentFile: null as Blob | null, momentPreview: null as string | null,
     momentLink: '', showWebcam: false
  });
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Lifecyle
  useEffect(() => {
    fetchData();
    const handleChanges = () => { fetchData(); };
    const pSub = supabase.channel('p').on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, handleChanges).subscribe();
    const mSub = supabase.channel('m').on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, handleChanges).subscribe();
    return () => { supabase.removeChannel(pSub); supabase.removeChannel(mSub); };
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from('players').select('*').order('wins', { ascending: false });
    if (pData) setPlayers(pData.map(p => ({
      id: p.id, name: p.name, teamName: p.team_name, avatarUrl: p.avatar_url,
      matchesPlayed: p.matches_played || 0, wins: p.wins || 0, pointsScored: p.points_scored || 0,
      pointsAllowed: p.points_allowed || 0, status: p.status as PlayerStatus, joinedAt: new Date(p.created_at || Date.now()).getTime()
    })));
    const { data: mData } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
    if (mData) setMatches(mData.map(m => ({
      id: m.id, playerAId: m.player_a_id, playerBId: m.player_b_id,
      score_a: m.score_a, score_b: m.score_b, scoreA: m.score_a, scoreB: m.score_b, winnerId: m.winner_id,
      momentPhotoUrl: m.moment_photo_url, momentVideoUrl: m.moment_video_url,
      momentCaption: m.moment_caption, timestamp: new Date(m.created_at).getTime()
    })));
    setLoading(false);
  };

  const finalizeMatch = async () => {
    if (!activeMatch) return;
    const sA = parseInt(matchResult.scoreA); const sB = parseInt(matchResult.scoreB);
    if (isNaN(sA) || isNaN(sB)) return alert("Valid scores required.");
    setIsFinalizing(true);
    let pUrl = matchResult.momentSource === 'link' ? matchResult.momentLink : null;
    let vUrl = null;

    if (matchResult.momentFile) {
       const ext = matchResult.mediaType === 'image' ? 'jpg' : 'webm';
       const fUpl = matchResult.mediaType === 'image' ? await imageCompression(matchResult.momentFile as File, { maxSizeMB: 0.5 }) : matchResult.momentFile;
       const path = `highlights/${Date.now()}.${ext}`;
       const { data } = await supabase.storage.from('nba-moments').upload(path, fUpl);
       if (data) {
          const url = supabase.storage.from('nba-moments').getPublicUrl(data.path).data.publicUrl;
          if (matchResult.mediaType === 'image') pUrl = url; else vUrl = url;
       }
    }

    const winnerId = sA > sB ? activeMatch[0].id : activeMatch[1].id;
    // Attempting insert with a fix for the 400 error (column mapping check)
    const { error } = await supabase.from('matches').insert([{
      player_a_id: activeMatch[0].id, player_b_id: activeMatch[1].id,
      score_a: sA, score_b: sB, winner_id: winnerId,
      moment_photo_url: pUrl, moment_video_url: vUrl, moment_caption: matchResult.caption.trim() || null
    }]);

    if (!error) {
       const pA = activeMatch[0]; const pB = activeMatch[1];
       await Promise.all([
         supabase.from('players').update({ wins: pA.wins + (winnerId === pA.id ? 1 : 0), matches_played: pA.matchesPlayed+1, points_scored: pA.pointsScored + sA, points_allowed: pA.pointsAllowed + sB, status: 'idle' }).eq('id', pA.id),
         supabase.from('players').update({ wins: pB.wins + (winnerId === pB.id ? 1 : 0), matches_played: pB.matchesPlayed+1, points_scored: pB.pointsScored + sB, points_allowed: pB.pointsAllowed + sA, status: 'idle' }).eq('id', pB.id)
       ]);
       setMatchResult({ scoreA: '', scoreB: '', caption: '', mediaType: 'image', momentSource: 'upload', momentFile: null, momentPreview: null, momentLink: '', showWebcam: false });
       await fetchData();
    } else { alert("Sync Error: Confirm moment_video_url column exists in matches table."); console.error(error); }
    setIsFinalizing(false);
  };

  const signPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const name = newPlayerName.trim();
    setNewPlayerName('');
    const { error } = await supabase.from('players').insert([{ name, team_name: null, avatar_url: null, status: 'waiting' }]);
    if (error) { alert("Error adding player: " + error.message); console.error(error); }
    else await fetchData();
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'waiting' ? 'idle' : 'waiting';
    await supabase.from('players').update({ status: newStatus }).eq('id', id);
    await fetchData();
  };

  const startAvatarEdit = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditForm({ name: p.name, team: p.teamName || '', avatar: p.avatarUrl || '', rawImage: null });
  };

  const leaderboard = useMemo(() => [...players].sort((a,b) => b.wins - a.wins || (b.pointsScored-b.pointsAllowed) - (a.pointsScored-a.pointsAllowed)), [players]);
  const activeMatch = useMemo(() => {
    const q = players.filter(p => p.status === 'waiting').sort((a,b) => a.matchesPlayed - b.matchesPlayed || a.joinedAt - b.joinedAt);
    return q.length >= 2 ? [q[0], q[1]] : null;
  }, [players]);

  const winStreaks = useMemo(() => {
    const s: any = {}; players.forEach(p => { let c = 0; let pm = matches.filter(m => m.playerAId === p.id || m.playerBId === p.id); for(let m of pm) { if(m.winnerId === p.id) c++; else break; } s[p.id] = c; });
    return s;
  }, [players, matches]);

  if (loading && players.length === 0) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
     <div className="text-8xl md:text-[14vw] font-black text-white italic tracking-tighter opacity-10 uppercase absolute pointer-events-none">NBA STATS</div>
     <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl z-10">🏀</motion.div>
  </div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:pt-16 md:pb-32">
      {/* Modal / Overlay UI */}
      <Modal isOpen={!!editingPlayerId} onClose={() => setEditingPlayerId(null)} title={showCropper ? "Crop Photo" : "Profile Settings"} maxWidth={showCropper ? "max-w-2xl" : "max-w-lg"}>
         {showCropper && editForm.rawImage ? <AvatarCropper image={editForm.rawImage} onComplete={async (b) => {
            const comp = await imageCompression(b as File, { maxSizeMB: 0.1 });
            const p = `avatars/${Date.now()}.jpg`; const { data } = await supabase.storage.from('nba-moments').upload(p, comp);
            if (data) { const url = supabase.storage.from('nba-moments').getPublicUrl(data.path).data.publicUrl; setEditForm({...editForm, avatar: url, rawImage: null}); setShowCropper(false); }
         }} onCancel={() => setShowCropper(false)} /> : <div className="space-y-6">
            <div className="flex items-center gap-6 p-5 rounded-3xl bg-white/[0.03] border border-white/5">
               <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
                     {editForm.avatar ? <img src={editForm.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-slate-900 flex items-center justify-center font-black text-3xl text-slate-800">{editForm.name[0]}</div>}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                     <UploadCloud className="w-6 h-6 text-white"/><input type="file" className="hidden" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0]; if(f) { const fr = new FileReader(); fr.readAsDataURL(f); fr.onload = () => { setEditForm({...editForm, rawImage: fr.result as string}); setShowCropper(true); }; }
                     }} />
                  </label>
               </div>
               <div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Athlete Profile</p><h4 className="text-xl font-black text-white italic uppercase">{editForm.name}</h4></div>
            </div>
            <div className="space-y-4">
               <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white font-black italic outline-none focus:border-neon-blue" placeholder="Name" />
               <input value={editForm.team} onChange={e => setEditForm({...editForm, team: e.target.value})} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white font-black uppercase tracking-widest outline-none focus:border-neon-purple" placeholder="Team" />
            </div>
            <button onClick={async () => { await supabase.from('players').update({ name: editForm.name, team_name: editForm.team, avatar_url: editForm.avatar }).eq('id', editingPlayerId); setEditingPlayerId(null); await fetchData(); }} className="w-full py-4 bg-white text-black font-black uppercase text-[11px] rounded-2xl shadow-xl">Update</button>
         </div>}
      </Modal>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-[110] px-4 pb-10 flex justify-center pointer-events-none">
         <div className="bg-slate-900/90 backdrop-blur-3xl border border-white/10 p-1.5 rounded-[32px] flex gap-2 shadow-2xl pointer-events-auto">
            <button onClick={() => setActiveTab('home')} className={`px-10 py-4 rounded-[24px] flex items-center gap-3 transition-all ${activeTab === 'home' ? 'bg-white text-black font-black' : 'text-slate-500 hover:text-white'}`}><LayoutDashboard className="w-5 h-5"/> <span className="text-[10px] font-black uppercase tracking-tighter">Arena</span></button>
            <button onClick={() => setActiveTab('feed')} className={`px-10 py-4 rounded-[24px] flex items-center gap-3 transition-all ${activeTab === 'feed' ? 'bg-white text-black font-black' : 'text-slate-500 hover:text-white'}`}><GalleryVerticalEnd className="w-5 h-5"/> <span className="text-[10px] font-black uppercase tracking-tighter">Feed</span></button>
         </div>
      </nav>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16 px-2">
         <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"/><span className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em] italic">Network Live</span></div>
            <h1 className="text-7xl md:text-8xl font-black text-white italic uppercase tracking-tighter leading-[0.85] select-none">LEAGUE<br/><span className="text-transparent border-t-8 border-white inline-block mt-3">TRACKER</span></h1>
         </div>
         <div className="flex gap-3">
            <button onClick={() => setResetModal(true)} className="p-5 glass-card border-white/5 text-slate-700 hover:text-red-500 transition-all"><RotateCcw/></button>
            <div className="glass-card p-5 border-white/5 flex items-center gap-8 bg-white/[0.02]">
               <div className="flex flex-col leading-none"><span className="text-4xl font-black text-white">{players.length}</span><span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">Athletes</span></div>
               <BarChart3 className="w-6 h-6 text-neon-blue opacity-50"/>
            </div>
         </div>
      </header>

      <main className="pb-40">
        <AnimatePresence mode="wait">
          {activeTab === 'home' ? (
             <motion.div key="h" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-10">
                   <div className="glass-card p-0 relative overflow-hidden group border-white/5 bg-white/[0.01]">
                      <div className="p-10 md:p-14">
                        {activeMatch ? (
                          <div className="space-y-20">
                             <div className="flex flex-col md:flex-row items-center justify-between gap-12 md:gap-4 relative">
                                {[0, 1].map(i => (
                                   <div key={i} className="text-center flex-1 flex flex-col items-center gap-8">
                                      <div className="relative">
                                         <div className={`w-40 md:w-56 aspect-square rounded-[32px] overflow-hidden border-2 shadow-2xl group-hover:scale-105 transition-all ${i===0?'border-neon-blue/30':'border-neon-purple/30'}`}>
                                            {activeMatch![i].avatarUrl ? <img src={activeMatch![i].avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center text-6xl font-black text-slate-800 italic uppercase">{activeMatch![i].name[0]}</div>}
                                         </div>
                                         {winStreaks[activeMatch![i].id] >= 3 && <div className="absolute -top-4 -right-4 bg-yellow-500 text-black px-4 py-1 rounded-xl text-[10px] font-black shadow-2xl skew-x-12 border-2 border-black">ON FIRE</div>}
                                      </div>
                                      <div className="space-y-1 text-center w-full px-4"><h3 className="text-4xl font-black text-white uppercase italic tracking-tighter truncate leading-tight">{activeMatch![i].name}</h3><p className={`text-[10px] font-black tracking-widest uppercase opacity-60 ${i===0?'text-neon-blue':'text-neon-purple'}`}>{activeMatch![i].teamName || "ROOKIE"}</p></div>
                                      <input value={i===0?matchResult.scoreA:matchResult.scoreB} onChange={e => setMatchResult({...matchResult, [i===0?'scoreA':'scoreB']: e.target.value})} className={`w-28 bg-black/60 border-2 border-white/5 py-6 rounded-[28px] text-center text-4xl font-black text-white focus:border-neon-${i===0?'blue':'purple'} outline-none transition-all placeholder:text-slate-900 shadow-inner px-2`} placeholder={i===0?'P1':'P2'} />
                                   </div>
                                ))}
                                <div className="text-7xl md:text-9xl font-black text-slate-900 italic opacity-10 pointer-events-none select-none scale-y-110 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:block hidden">VS</div>
                             </div>
                             <div className="p-8 md:p-12 rounded-[40px] bg-black/40 border-2 border-white/5 space-y-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                   <div className="flex items-center gap-3"><CameraIcon className="w-5 h-5 text-neon-blue"/><div className="space-y-1"><h4 className="text-[11px] font-black text-white uppercase tracking-widest">Moment Capture</h4></div></div>
                                   <div className="flex bg-white/5 p-1 rounded-full ring-1 ring-white/10">
                                      {['live-image', 'live-video', 'upload', 'link'].map(t => (
                                         <button key={t} onClick={() => setMatchResult({...matchResult, mediaType: t.includes('video')?'video':'image', momentSource: t.includes('live')?'live':(t as any)})} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${((matchResult.momentSource==='live'&&t.includes('live')) && ((matchResult.mediaType==='video')===t.includes('video'))) || (matchResult.momentSource===t && !t.includes('live')) ? 'bg-white text-black' : 'text-slate-600'}`}>
                                            {t === 'live-image' ? 'Snap' : t === 'live-video' ? 'Reel' : t}
                                         </button>
                                      ))}
                                   </div>
                                </div>
                                <div className="space-y-6">
                                   {matchResult.momentPreview ? (
                                      <div className="relative rounded-[32px] overflow-hidden border-2 border-white/10 aspect-video bg-black">
                                         {matchResult.mediaType === 'image' ? <img src={matchResult.momentPreview} className="w-full h-full object-cover"/> : <video src={matchResult.momentPreview} controls className="w-full h-full object-cover"/>}
                                         <button onClick={() => setMatchResult({...matchResult, momentPreview: null, momentFile: null})} className="absolute top-4 right-4 p-3 bg-black/60 rounded-full text-white"><X className="w-4 h-4"/></button>
                                      </div>
                                   ) : matchResult.momentSource === 'live' ? (
                                      <div onClick={() => setMatchResult({...matchResult, showWebcam: true})} className="w-full aspect-video border-2 border-dashed border-white/10 rounded-[32px] bg-white/[0.01] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-neon-blue/30 transition-all group">
                                         <MonitorPlay className="w-10 h-10 text-slate-800 group-hover:text-neon-blue/60" /><p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Open Satellite</p>
                                      </div>
                                   ) : matchResult.momentSource === 'upload' ? (
                                      <label className="w-full aspect-video border-2 border-dashed border-white/10 rounded-[32px] bg-white/[0.01] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-neon-purple/30 transition-all group">
                                         <UploadCloud className="w-10 h-10 text-slate-800 group-hover:text-neon-purple/60" /><p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Upload File</p>
                                         <input type="file" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if(f) setMatchResult({...matchResult, momentFile: f, momentPreview: URL.createObjectURL(f)}); }} />
                                      </label>
                                   ) : (
                                      <input value={matchResult.momentLink} onChange={e => setMatchResult({...matchResult, momentLink: e.target.value})} className="w-full bg-black/40 border border-white/10 p-5 rounded-3xl text-white font-black" placeholder="Paste URL..." />
                                   )}
                                   <input value={matchResult.caption} onChange={e => setMatchResult({...matchResult, caption: e.target.value})} className="w-full bg-slate-950 border-2 border-white/5 rounded-[32px] py-7 px-10 text-lg font-black italic text-white" placeholder="Headline..." />
                                </div>
                             </div>
                             <button disabled={isFinalizing} onClick={finalizeMatch} className={`w-full py-10 rounded-[48px] text-4xl font-black uppercase transition-all shadow-2xl border-b-[12px] active:border-b-0 ${isFinalizing ? 'bg-slate-900 border-black mb-2 opacity-50' : 'bg-white text-black border-slate-300 hover:bg-neon-blue active:translate-y-2'}`}>
                                {isFinalizing ? "SYNCING..." : "AUTHORIZE RESULT"}
                             </button>
                          </div>
                        ) : (
                          <div className="py-40 text-center space-y-8 opacity-30 select-none"><Gamepad2 className="w-24 h-24 mx-auto text-slate-800 animate-pulse" /><p className="text-3xl font-black text-slate-700 uppercase italic">Satellite Offline</p></div>
                        )}
                      </div>
                   </div>
                   {/* Draft */}
                   <section className="glass-card p-10 md:p-14 border-white/5 space-y-12">
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                         <h3 className="text-5xl font-black text-white italic uppercase leading-none">THE DRAFT</h3>
                         <form onSubmit={signPlayer} className="flex gap-4"><input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} className="bg-black/60 border-2 border-white/5 rounded-2xl py-4 px-8 text-white font-black" placeholder="Enlist Athlete..." /><button type="submit" className="bg-white text-black font-black px-8 rounded-2xl text-[10px] uppercase tracking-widest">Enroll</button></form>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {players.map(p => (
                            <div key={p.id} className="p-6 md:p-8 rounded-[40px] bg-white/[0.02] border border-white/10 flex items-center justify-between group overflow-hidden shadow-xl">
                               <div className="flex items-center gap-6 relative z-10 w-full overflow-hidden">
                                  <div className="w-16 h-16 rounded-3xl overflow-hidden border border-white/10 shrink-0">{p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center text-2xl font-black text-slate-800">{p.name[0]}</div>}</div>
                                  <div className="min-w-0 flex-1">
                                     <h4 className="font-black text-white text-2xl truncate mb-1 italic">{p.name}</h4>
                                     <p className="text-[10px] font-black text-slate-600 uppercase italic truncate">{p.teamName || "ROOKIE"} • {p.wins} WINS</p>
                                  </div>
                               </div>
                               <div className="flex flex-col items-center gap-3 relative z-10 ml-4">
                                  <button onClick={() => toggleStatus(p.id, p.status)} className={`px-5 py-2.5 rounded-[16px] text-[10px] font-black uppercase transition-all flex items-center gap-2 ${p.status === 'waiting' ? 'bg-green-600 text-white shadow-xl' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>
                                     {p.status === 'waiting' && <Check className="w-3.5 h-3.5" />} {p.status === 'waiting' ? "IN" : "OFF"}
                                  </button>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => startAvatarEdit(p)} className="p-2 border border-white/10 rounded-lg text-slate-600 hover:text-white"><Edit2 className="w-4 h-4"/></button>
                                     <button onClick={() => setDeleteId(p.id)} className="p-2 border border-white/10 rounded-lg text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </section>
                </div>
                {/* Standings */}
                <div className="lg:col-span-4 space-y-10">
                   <section className="glass-card border-white/10 overflow-hidden shadow-2xl bg-slate-900/40">
                      <div className="p-8 border-b border-white/5 flex items-center justify-between"><h3 className="text-2xl font-black text-white uppercase italic">STANDINGS</h3><Trophy className="text-yellow-500 w-8 h-8"/></div>
                      <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-[300px]">
                           <thead>
                              <tr className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase bg-black/40 border-b border-white/10">
                                 <th className="px-3 sm:px-6 py-4 text-left italic w-[60%]">ATHLETE</th>
                                 <th className="px-2 sm:px-4 py-4 text-center italic">W-L</th>
                                 <th className="px-3 sm:px-6 py-4 text-right italic">PD</th>
                              </tr>
                           </thead>
                           <tbody>
                              {leaderboard.map((p, i) => (
                                <tr key={p.id} className="border-b border-white/[0.02] hover:bg-white/[0.04] transition-all group">
                                   <td className="px-3 sm:px-6 py-4 sm:py-6 flex items-center gap-2 sm:gap-4 overflow-hidden">
                                      <span className="text-slate-700 font-black italic text-xs sm:text-sm">#{i+1}</span>
                                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-slate-950 border border-white/10 shrink-0">{p.avatarUrl && <img src={p.avatarUrl} className="w-full h-full object-cover"/>}</div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                         <span className="text-[11px] sm:text-[13px] font-black text-white uppercase truncate block w-full">{p.name || "UNNAMED"}</span>
                                         <span className="text-[7px] sm:text-[8px] font-black text-slate-600 truncate block w-full">{p.teamName || "ROOKIE"}</span>
                                      </div>
                                   </td>
                                   <td className="px-2 sm:px-4 py-4 sm:py-6 text-center text-[10px] sm:text-[12px] font-black text-slate-500 italic">{p.wins}-{p.matchesPlayed-p.wins}</td>
                                   <td className={`px-3 sm:px-6 py-4 sm:py-6 text-right text-[12px] sm:text-[14px] font-black italic ${p.pointsScored-p.pointsAllowed>=0?'text-green-500':'text-red-500'}`}>{p.pointsScored-p.pointsAllowed>0?'+':''}{p.pointsScored-p.pointsAllowed}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                      </div>
                   </section>
                   <section className="glass-card border-white/5 p-8 space-y-6">
                      <h3 className="text-xl font-black text-white uppercase italic">GAME LOG</h3>
                      {matches.slice(0, 5).map(m => (
                          <div key={m.id} className="p-6 rounded-[28px] bg-white/[0.02] border border-white/10 flex flex-col gap-4">
                             <div className="flex items-center justify-between text-[9px] font-black text-slate-700 uppercase"><span>{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>{m.momentVideoUrl || m.momentPhotoUrl ? <span className="text-neon-blue">TAPE SYNCED</span> : null}</div>
                             <div className="flex items-center justify-between gap-2">
                                <span className={`text-[12px] font-black truncate max-w-[80px] ${m.winnerId === m.playerAId ? 'text-white' : 'text-slate-800'}`}>{players.find(p=>p.id===m.playerAId)?.name}</span>
                                <div className="text-[15px] font-black bg-black/60 px-4 py-1 rounded-full text-white italic">{m.scoreA}-{m.scoreB}</div>
                                <span className={`text-[12px] font-black truncate max-w-[80px] ${m.winnerId === m.playerBId ? 'text-white' : 'text-slate-800'}`}>{players.find(p=>p.id===m.playerBId)?.name}</span>
                             </div>
                          </div>
                      ))}
                      <button onClick={()=>setActiveTab('feed')} className="w-full py-4 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-slate-700 hover:text-white transition-all">Vault Access <ChevronRight className="inline w-3 h-3 ml-1" /></button>
                   </section>
                </div>
             </motion.div>
          ) : (
             <motion.div key="f" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-24">
                <div className="text-center relative py-12"><h2 className="text-[12vw] font-black text-white italic tracking-tighter uppercase leading-none opacity-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">HIGHLIGHTS</h2><div className="relative z-10"><div className="inline-block px-8 py-2 border-t border-b border-neon-blue text-neon-blue text-[11px] font-black uppercase tracking-[0.8em] italic mb-4">Network Vault Active</div><h2 className="text-7xl font-black text-white uppercase italic tracking-tighter">GLOBAL <span className="bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">FEED</span></h2></div></div>
                <div className="columns-1 md:columns-2 lg:columns-3 gap-10 space-y-10 max-w-7xl mx-auto px-4 pb-48">
                   {matches.filter(m => m.momentPhotoUrl || m.momentVideoUrl).map(m => (
                      <div key={m.id} className="break-inside-avoid glass-card group overflow-hidden border-2 border-white/5 bg-slate-950 shadow-2xl hover:scale-[1.03] transition-all cursor-pointer mb-10" onClick={() => setMatchView(m)}>
                         <div className="relative aspect-[4/5] overflow-hidden">
                            {m.momentVideoUrl ? <video src={m.momentVideoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[2000ms]" muted loop autoPlay playsInline /> : <img src={m.momentPhotoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-[2000ms]" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
                            <div className="absolute top-6 left-6 flex flex-col items-center bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 italic text-white"><span className="text-xl font-black">{new Date(m.timestamp).getDate()}</span><span className="text-[9px] font-black text-slate-500 uppercase">{new Date(m.timestamp).toLocaleString('default', { month: 'short' })}</span></div>
                            {m.momentVideoUrl && <VideoIcon className="absolute top-6 right-6 w-5 h-5 text-neon-blue"/>}
                            <div className="absolute bottom-8 left-8 right-8 space-y-6">
                               <div className="flex -space-x-4">
                                  {[m.playerAId, m.playerBId].map((pid, idx) => <div key={pid} className={`w-14 h-14 rounded-full border-2 border-slate-950 overflow-hidden shadow-2xl ${idx===0?'relative z-20':'relative z-10'}`}>{players.find(p=>p.id===pid)?.avatarUrl && <img src={players.find(p=>p.id===pid)?.avatarUrl} className="w-full h-full object-cover"/>}</div>)}
                                  <div className="pl-4 flex flex-col justify-center"><span className="text-[13px] font-black text-white uppercase italic">{players.find(p=>p.id===m.playerAId)?.name} v {players.find(p=>p.id===m.playerBId)?.name}</span><span className="text-[8px] font-black text-neon-blue/60 uppercase tracking-widest italic leading-none">satellite-sync</span></div>
                               </div>
                               <div className="space-y-3 pt-6 border-t border-white/10"><div className="text-6xl font-black text-white italic tracking-tighter leading-none">{m.scoreA}<span className="text-slate-800 text-4xl px-2">-</span>{m.scoreB}</div><p className="text-[13px] font-black text-slate-300 uppercase italic line-clamp-2 leading-tight">"{m.momentCaption || "No highlight annotation."}"</p></div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Modal isOpen={matchResult.showWebcam} onClose={() => setMatchResult({...matchResult, showWebcam: false})} title="Lens" maxWidth="max-w-2xl"><SatelliteCamera type={matchResult.mediaType} onCancel={() => setMatchResult({...matchResult, showWebcam: false})} onCapture={(b) => setMatchResult({...matchResult, momentFile: b, momentPreview: URL.createObjectURL(b), showWebcam: false})} /></Modal>
      <Modal isOpen={resetModal} onClose={() => setResetModal(false)} title="Reset Status"><div className="text-center py-8 space-y-6"><RotateCcw className="w-12 h-12 text-neon-blue mx-auto animate-spin-slow"/><h4 className="text-2xl font-black text-white italic">Protocol Reset?</h4><div className="flex gap-4"><button onClick={()=>setResetModal(false)} className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black rounded-2xl">Abort</button><button onClick={async ()=>{await supabase.from('players').update({status:'idle'}).neq('id','-1');setResetModal(false);await fetchData();}} className="flex-1 py-4 bg-neon-blue text-black font-black rounded-2xl">Confirm</button></div></div></Modal>
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Erase"><div className="text-center py-8 space-y-6"><AlertTriangle className="w-12 h-12 text-red-600 mx-auto animate-bounce"/><h4 className="text-2xl font-black text-white italic">Confirm Deletion?</h4><div className="flex gap-4"><button onClick={()=>setDeleteId(null)} className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black rounded-2xl">Abort</button><button onClick={async ()=>{await supabase.from('players').delete().eq('id',deleteId);setDeleteId(null);await fetchData();}} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl">Authorise</button></div></div></Modal>
      <Modal isOpen={!!matchView} onClose={() => setMatchView(null)} title="Vault Playback" maxWidth="max-w-4xl">{matchView && <div className="space-y-8"><div className="rounded-3xl overflow-hidden border border-white/10 bg-black aspect-video relative">{matchView.momentVideoUrl ? <video src={matchView.momentVideoUrl} controls autoPlay className="w-full h-full object-cover" /> : <img src={matchView.momentPhotoUrl} className="w-full h-full object-cover" />}</div><div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 text-center"><p className="text-3xl font-black text-white italic mb-6">"{matchView.momentCaption || "No highlight."}"</p><div className="flex justify-center gap-12"><div className="text-center"><p className="text-5xl font-black text-white italic">{matchView.scoreA}</p><p className="text-[9px] font-black text-slate-600 uppercase">Home</p></div><div className="text-5xl font-black text-slate-800">/</div><div className="text-center"><p className="text-5xl font-black text-white italic">{matchView.scoreB}</p><p className="text-[9px] font-black text-slate-600 uppercase">Away</p></div></div></div></div>}</Modal>

      <footer className="mt-40 mb-20 pt-16 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-10 opacity-30 hover:opacity-100 transition-all duration-700"><div className="space-y-2 max-w-sm text-center md:text-left"><h5 className="text-white font-black uppercase text-sm">NBA LEAGUE TRACKER <span className="text-slate-800 ml-2">v4.4.0</span></h5><p className="text-[9px] uppercase font-black tracking-widest leading-loose text-slate-600">Enterprise High-Definition Satellite Capture Network. Distributed Node Synchronization.</p></div><div className="flex items-center gap-10 font-black uppercase text-[10px] tracking-widest text-slate-700"><div>{matches.length} RECORDED</div></div></footer>
    </div>
  );
}

const AvatarCropper = ({ image, onComplete, onCancel }: { image: string, onComplete: (blob: Blob) => void, onCancel: () => void }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [px, setPx] = useState<Area | null>(null);
  return (
    <div className="space-y-6">
      <div className="relative w-full h-80 bg-black rounded-3xl overflow-hidden shadow-inner"><Cropper image={image} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, p) => setPx(p)} cropShape="round"/></div>
      <div className="flex items-center gap-4 px-2"><span className="text-[10px] font-black text-slate-500 uppercase">Zoom</span><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-neon-blue" /></div>
      <div className="flex gap-4"><button onClick={onCancel} className="flex-1 py-4 border border-white/10 rounded-2xl text-white font-black uppercase text-[10px]">Cancel</button><button onClick={async () => { if(px) onComplete(await getCroppedImg(image, px)); }} className="flex-1 py-4 bg-neon-blue text-black font-black uppercase text-[10px] rounded-2xl">Crop</button></div>
    </div>
  );
};
