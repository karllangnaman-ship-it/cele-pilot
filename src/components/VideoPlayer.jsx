import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Maximize2, Volume2, VolumeX, Gauge } from 'lucide-react';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ file, onPositionSave }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // Resume from last position
  useEffect(() => {
    if (file?.last_position && videoRef.current) {
      videoRef.current.currentTime = file.last_position;
    }
  }, [file]);

  // Save position periodically while playing
  useEffect(() => {
    if (!playing || !onPositionSave) return;
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime > 0) {
        onPositionSave(videoRef.current.currentTime, videoRef.current.duration || 0);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [playing, onPositionSave]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && onPositionSave && videoRef.current.currentTime > 0) {
        onPositionSave(videoRef.current.currentTime, videoRef.current.duration || 0);
      }
    };
  }, [onPositionSave]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const pct = parseFloat(e.target.value);
    v.currentTime = (pct / 100) * v.duration;
    setCurrent(v.currentTime);
  };

  const toggleMute = () => {
    setMuted(prev => {
      if (videoRef.current) videoRef.current.muted = !prev;
      return !prev;
    });
  };

  const changeSpeed = (s) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeeds(false);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const seekPct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        src={file?.file_url}
        className="w-full max-h-[60vh]"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
        onLoadedMetadata={(e) => { setDuration(e.target.duration); if (file?.last_position) e.target.currentTime = file.last_position; }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {!playing && !buffering && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center group">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play className="w-7 h-7 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={seekPct}
          onChange={handleSeek}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 accent-purple-500 mb-2"
          style={{ background: `linear-gradient(to right, hsl(250 80% 65%) ${seekPct}%, rgba(255,255,255,0.2) ${seekPct}%)` }}
        />

        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <span className="text-xs font-mono tabular-nums">{fmt(current)} / {fmt(duration)}</span>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={toggleMute} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button onClick={() => setShowSpeeds(!showSpeeds)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1">
                <Gauge className="w-5 h-5" />
                <span className="text-xs font-medium">{speed}x</span>
              </button>
              {showSpeeds && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-xl rounded-xl p-1 flex flex-col gap-0.5 min-w-[80px]">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs text-left hover:bg-white/20 transition-colors ${speed === s ? 'bg-purple-600 text-white' : 'text-white/80'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}