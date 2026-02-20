'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useWaveform } from '../../../../contexts/WaveformContext';
import { CanvasRenderer } from '../../../../lib/rendering/CanvasRenderer';

export default function TimelineRenderer({ height = 30 }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  const {
    duration,
    currentTime,
    zoomLevel,
    scrollPosition,
    seek
  } = useWaveform();

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    rendererRef.current = new CanvasRenderer(canvasRef.current);

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, []);

  // Render timeline
  const render = useCallback(() => {
    if (!rendererRef.current || !duration) return;

    const renderer = rendererRef.current;
    const width = renderer.width;
    const pixelsPerSecond = width / duration;  // Calculate based on full width

    renderer.clear();
    renderer.drawTimeline(duration, pixelsPerSecond, {
      height,
      offset: 0  // No scrolling, always show full duration
    });

    // Draw current time indicator
    const cursorX = (currentTime / duration) * width;
    renderer.ctx.strokeStyle = '#ffc107';
    renderer.ctx.lineWidth = 1;
    renderer.ctx.beginPath();
    renderer.ctx.moveTo(cursorX, height - 5);
    renderer.ctx.lineTo(cursorX, height);
    renderer.ctx.stroke();
  }, [duration, currentTime, height]);

  // Re-render when state changes
  useEffect(() => {
    render();
  }, [render]);

  // Handle click to seek
  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    seek(Math.max(0, Math.min(time, duration)));
  }, [seek, duration]);

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#2a2a2a',
        cursor: 'pointer',
        overflow: 'hidden'  // Prevent canvas overflow
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}