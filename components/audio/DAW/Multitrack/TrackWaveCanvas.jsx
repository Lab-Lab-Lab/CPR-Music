// components/audio/DAW/Multitrack/TrackWaveCanvas.jsx
'use client';

import { useEffect, useRef } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function TrackWaveCanvas({
  clips = [],               // [{id,start,duration,color}]
  zoomLevel = 100,
  bg = '#2a2a2a',
  clipColor = '#7bafd4',
  height = 100,
}) {
  const canvasRef = useRef(null);
  const { currentTime, duration } = useMultitrack();

  const resizeToCSS = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    return dpr;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = resizeToCSS(canvas);
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // bg
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const projectDur = Math.max(1e-6, duration || 0); // avoid /0
    const rect = canvas.getBoundingClientRect();
    const displayW = Math.max(1, Math.floor(rect.width));
    const pxPerSec = displayW / projectDur;

    // draw clips
    for (const c of clips) {
      const x = Math.max(0, Math.floor(c.start * pxPerSec));
      const w = Math.max(1, Math.floor(c.duration * pxPerSec));
      const color = c.color || clipColor;
      ctx.fillStyle = color;
      const pad = Math.floor(6 * dpr);
      ctx.fillRect(x, pad, w, H - pad * 2);
    }

  }, [clips, currentTime, duration, zoomLevel, bg, clipColor, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  );
}