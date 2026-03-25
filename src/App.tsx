/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Download, RefreshCw, Trash2, Sparkles, CameraOff, Scissors, Volume2, VolumeX, Share2, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

type Filter = 'none' | 'grayscale' | 'sepia' | 'vintage' | 'cool' | 'warm';
type View = 'home' | 'booth';

interface Photo {
  id: string;
  dataUrl: string;
}

// Sound URLs
const SOUNDS = {
  TICK: 'https://www.soundjay.com/button/beep-07.mp3',
  SHUTTER: 'https://www.soundjay.com/camera/camera-shutter-click-01.mp3',
  SUCCESS: 'https://www.soundjay.com/misc/bell-ringing-05.mp3',
};

export default function App() {
  const [view, setView] = useState<View>('home');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentFilter, setCurrentFilter] = useState<Filter>('none');
  const [error, setError] = useState<string | null>(null);
  const [isCapturingSequence, setIsCapturingSequence] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio refs
  const tickAudio = useRef<HTMLAudioElement | null>(null);
  const shutterAudio = useRef<HTMLAudioElement | null>(null);
  const successAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload audio
    tickAudio.current = new Audio(SOUNDS.TICK);
    shutterAudio.current = new Audio(SOUNDS.SHUTTER);
    successAudio.current = new Audio(SOUNDS.SUCCESS);
    
    // Set volumes
    if (tickAudio.current) tickAudio.current.volume = 0.3;
    if (shutterAudio.current) shutterAudio.current.volume = 0.5;
    if (successAudio.current) successAudio.current.volume = 0.4;
  }, []);

  const playSound = (audioRef: React.RefObject<HTMLAudioElement | null>) => {
    if (!isMuted && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Audio play blocked:", e));
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
    }
  };

  useEffect(() => {
    if (view === 'booth') {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [view]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Apply filter to canvas
      context.filter = getFilterCSS(currentFilter);
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      const newPhoto = { id: Date.now().toString(), dataUrl };
      
      playSound(shutterAudio);
      
      setPhotos(prev => [newPhoto, ...prev].slice(0, 8)); // Keep last 8 photos
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [currentFilter, isMuted]);

  const startSequence = async () => {
    if (isCapturingSequence) return;
    setIsCapturingSequence(true);
    setPhotos([]); // Clear for new strip

    for (let i = 0; i < 4; i++) {
      setIsCountingDown(true);
      setCountdown(3);
      playSound(tickAudio);
      
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              resolve();
              return 0;
            }
            playSound(tickAudio);
            return prev - 1;
          });
        }, 1000);
      });

      setIsCountingDown(false);
      capturePhoto();
      await new Promise(r => setTimeout(r, 1000)); // Pause between shots
    }
    
    setIsCapturingSequence(false);
    playSound(successAudio);
  };

  const getFilterCSS = (filter: Filter) => {
    switch (filter) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(100%)';
      case 'vintage': return 'sepia(50%) contrast(120%) brightness(90%)';
      case 'cool': return 'hue-rotate(180deg) saturate(1.5)';
      case 'warm': return 'sepia(30%) saturate(2) hue-rotate(-30deg)';
      default: return 'none';
    }
  };

  const generateStripBlob = async (): Promise<Blob | null> => {
    if (photos.length === 0) return null;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const stripPhotos = photos.slice(0, 4).reverse();
    const padding = 40;
    const photoWidth = 600;
    const photoHeight = 450;
    const totalWidth = photoWidth + (padding * 2);
    const totalHeight = (photoHeight * stripPhotos.length) + (padding * (stripPhotos.length + 1)) + 100;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    return new Promise((resolve) => {
      let loadedCount = 0;
      stripPhotos.forEach((photo, index) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, padding, padding + (index * (photoHeight + padding)), photoWidth, photoHeight);
          loadedCount++;
          if (loadedCount === stripPhotos.length) {
            ctx.fillStyle = '#141414';
            ctx.font = 'italic 24px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText('FlashSnap Photobooth', totalWidth / 2, totalHeight - 40);
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
          }
        };
        img.src = photo.dataUrl;
      });
    });
  };

  const handleShare = async () => {
    const blob = await generateStripBlob();
    if (!blob) return;

    const file = new File([blob], `photostrip-${Date.now()}.jpg`, { type: 'image/jpeg' });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'My FlashSnap Photostrip',
          text: 'Check out my photobooth strip from FlashSnap!',
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback for browsers that don't support file sharing
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photostrip-${Date.now()}.jpg`;
      link.click();
      alert("Sharing not supported on this browser. Photo saved to downloads!");
    }
  };

  const downloadStrip = async () => {
    const blob = await generateStripBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photostrip-${Date.now()}.jpg`;
    link.click();
  };

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col items-center justify-center p-6 relative">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#141414 1px, transparent 1px)', size: '40px 40px', backgroundSize: '40px 40px' }} 
        />

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 w-full max-w-xl border border-[#141414] bg-white/40 backdrop-blur-sm p-12 md:p-20 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] flex flex-col items-center text-center space-y-12"
        >
          <div className="space-y-4">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-1 bg-[#141414]" />
            </div>
            <h1 className="text-6xl md:text-7xl font-serif italic tracking-tight leading-none">
              FlashSnap
            </h1>
            <div className="flex items-center justify-center gap-3">
              <span className="h-[1px] w-4 bg-[#141414]/30" />
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] opacity-50">Studio Edition</p>
              <span className="h-[1px] w-4 bg-[#141414]/30" />
            </div>
          </div>

          <div className="w-full space-y-8">
            <p className="font-serif italic text-lg opacity-70 max-w-xs mx-auto leading-relaxed">
              A refined digital experience for capturing timeless moments.
            </p>
            
            <button 
              onClick={() => setView('booth')}
              className="group relative w-full overflow-hidden border border-[#141414] bg-[#141414] text-[#E4E3E0] py-5 px-8 transition-all hover:bg-transparent hover:text-[#141414] active:translate-y-1"
            >
              <span className="relative z-10 font-mono text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                Open Booth
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-3 w-full pt-8 border-t border-[#141414]/10">
            <div className="flex flex-col items-center gap-2 border-r border-[#141414]/10">
              <Camera size={18} strokeWidth={1.5} />
              <span className="text-[9px] uppercase font-mono tracking-widest opacity-40">Capture</span>
            </div>
            <div className="flex flex-col items-center gap-2 border-r border-[#141414]/10">
              <Sparkles size={18} strokeWidth={1.5} />
              <span className="text-[9px] uppercase font-mono tracking-widest opacity-40">Filter</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Share2 size={18} strokeWidth={1.5} />
              <span className="text-[9px] uppercase font-mono tracking-widest opacity-40">Share</span>
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-12 hidden md:block">
          <p className="font-mono text-[9px] uppercase tracking-[0.5em] opacity-20 vertical-text rotate-180" style={{ writingMode: 'vertical-rl' }}>
            FlashSnap Systems • Model 2026
          </p>
        </div>

        <footer className="absolute bottom-8 font-mono text-[9px] uppercase tracking-[0.3em] opacity-30">
          Refined Digital Heritage
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <button onClick={() => setView('home')} className="group">
          <h1 className="text-4xl font-serif italic tracking-tight leading-none group-hover:opacity-70 transition-opacity">FlashSnap</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1 font-mono">Digital Photobooth System v1.0</p>
        </button>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={() => setPhotos([])}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
            title="Clear all"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Camera Section */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-video bg-[#151619] border-2 border-[#141414] overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            {!stream && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#E4E3E0] space-y-4">
                <RefreshCw className="animate-spin" />
                <p className="font-mono text-xs uppercase tracking-widest">Initializing Camera...</p>
              </div>
            )}
            
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 p-8 text-center">
                <CameraOff size={48} className="mb-4" />
                <p className="font-mono text-sm uppercase tracking-widest mb-4">{error}</p>
                <button 
                  onClick={startCamera}
                  className="px-4 py-2 border border-red-500 hover:bg-red-500 hover:text-white transition-colors uppercase text-xs font-bold"
                >
                  Retry Connection
                </button>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
              style={{ filter: getFilterCSS(currentFilter) }}
            />

            {/* Countdown Overlay */}
            <AnimatePresence>
              {isCountingDown && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"
                >
                  <span className="text-[12rem] font-serif italic text-white drop-shadow-2xl">
                    {countdown}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Flash Effect */}
            <AnimatePresence>
              {isCountingDown && countdown === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-white z-50"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              disabled={!stream || isCapturingSequence}
              onClick={startSequence}
              className="col-span-2 flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 font-mono text-sm uppercase tracking-widest hover:bg-[#333] disabled:opacity-50 transition-all active:translate-y-1"
            >
              <Camera size={20} />
              Start 4-Shot Sequence
            </button>
            
            <button
              disabled={!stream || isCapturingSequence}
              onClick={() => {
                setIsCountingDown(true);
                setCountdown(3);
                playSound(tickAudio);
                const timer = setInterval(() => {
                  setCountdown(prev => {
                    if (prev <= 1) {
                      clearInterval(timer);
                      setIsCountingDown(false);
                      capturePhoto();
                      return 0;
                    }
                    playSound(tickAudio);
                    return prev - 1;
                  });
                }, 1000);
              }}
              className="flex items-center justify-center gap-3 border-2 border-[#141414] py-4 px-6 font-mono text-sm uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] disabled:opacity-50 transition-all active:translate-y-1"
            >
              <Sparkles size={20} />
              Single Shot
            </button>

            <button
              disabled={photos.length < 4}
              onClick={downloadStrip}
              className="flex items-center justify-center gap-3 border-2 border-[#141414] py-4 px-6 font-mono text-sm uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] disabled:opacity-50 transition-all active:translate-y-1"
            >
              <Download size={20} />
              Save Strip
            </button>
          </div>

          {/* Filters */}
          <div className="border border-[#141414] p-4 bg-white/50">
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-3 font-mono">Select Lens Filter</p>
            <div className="flex flex-wrap gap-2">
              {(['none', 'grayscale', 'sepia', 'vintage', 'cool', 'warm'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setCurrentFilter(f)}
                  className={`px-4 py-2 text-[10px] uppercase font-mono border transition-all ${
                    currentFilter === f 
                      ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' 
                      : 'border-[#141414] hover:bg-[#141414]/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Photo Strip Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-6">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-xl font-serif italic">Recent Captures</h2>
              <span className="font-mono text-[10px] uppercase opacity-50">{photos.length} / 8</span>
            </div>
            
            <div className="bg-white border-2 border-[#141414] p-4 min-h-[600px] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col">
              <div className="flex-1">
                {photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center opacity-30">
                    <Scissors size={48} className="mb-4" />
                    <p className="font-mono text-xs uppercase tracking-widest">No photos yet.<br/>Strike a pose.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {photos.map((photo, idx) => (
                        <motion.div
                          key={photo.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="relative group"
                        >
                          <img 
                            src={photo.dataUrl} 
                            alt={`Capture ${idx}`} 
                            className="w-full border border-[#141414] grayscale-[0.2]"
                          />
                          <button 
                            onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                          {idx < 4 && (
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#141414]" />
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              
              {photos.length > 0 && (
                <div className="mt-8 pt-4 border-t border-[#141414] space-y-4">
                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={handleShare}
                      className="p-3 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"
                    >
                      <Share2 size={16} />
                      Share Strip
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => window.open('https://instagram.com')} className="p-3 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                        <Instagram size={16} />
                      </button>
                      <button onClick={() => window.open('https://twitter.com')} className="p-3 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                        <Twitter size={16} />
                      </button>
                      <button onClick={() => window.open('https://facebook.com')} className="p-3 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                        <Facebook size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="font-serif italic text-sm opacity-50 text-center">FlashSnap Photobooth Strip</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Footer */}
      <footer className="mt-12 border-t border-[#141414] p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-30">
          © 2026 FlashSnap Systems • All Rights Reserved • Built for AI Studio
        </p>
      </footer>
    </div>
  );
}
