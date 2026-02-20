'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useWaveform } from '../../../../contexts/WaveformContext';
import { CanvasRenderer } from '../../../../lib/rendering/CanvasRenderer';

export default function MinimapRenderer({ height = 40 }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const overviewPeaksRef = useRef(null);

  const {
    audioBuffer,
    duration,
    currentTime,
    zoomLevel,
    scrollPosition,
    setScrollPosition,
    peakGenerator,
    containerWidth,
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

  // Generate overview peaks
  useEffect(() => {
    if (!audioBuffer || !peakGenerator || !rendererRef.current) return;

    const width = rendererRef.current.width;
    const samplesPerPixel = audioBuffer.length / width;

    overviewPeaksRef.current = peakGenerator.generatePeaks(
      audioBuffer,
      samplesPerPixel,
      width
    );
  }, [audioBuffer, peakGenerator]);

  // Calculate viewport position based on zoom and scroll
  const getViewport = useCallback(() => {
    if (!duration || !containerWidth) return { start: 0, end: 1 };

    // Calculate visible duration in the main waveform
    const visibleDuration = containerWidth / zoomLevel;
    const viewportStart = scrollPosition / duration;
    const viewportEnd = Math.min(1, (scrollPosition + visibleDuration) / duration);

    return { start: viewportStart, end: viewportEnd };
  }, [duration, containerWidth, zoomLevel, scrollPosition]);

  // Render minimap
  const render = useCallback(() => {
    if (!rendererRef.current || !duration) return;

    const renderer = rendererRef.current;
    const viewport = getViewport();

    renderer.clear();
    renderer.drawMinimap(overviewPeaksRef.current, viewport.start, viewport.end, {
      height
    });

    // Draw playback position
    if (duration > 0) {
      const x = (currentTime / duration) * renderer.width;
      renderer.ctx.strokeStyle = '#ffc107';
      renderer.ctx.lineWidth = 1;
      renderer.ctx.beginPath();
      renderer.ctx.moveTo(x, 0);
      renderer.ctx.lineTo(x, height);
      renderer.ctx.stroke();
    }
  }, [duration, currentTime, height, getViewport]);

  // Re-render when state changes
  useEffect(() => {
    render();
  }, [render]);

  // Handle click to navigate
  const handleClick = useCallback((e) => {
    if (!duration || !containerWidth) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickProgress = x / rect.width;
    const clickTime = clickProgress * duration;

    // Seek to the clicked position
    seek(clickTime);

    // Center the view on the clicked position if zoomed in
    if (zoomLevel > containerWidth / duration) {
      const visibleDuration = containerWidth / zoomLevel;
      const newScrollPosition = Math.max(
        0,
        Math.min(
          duration - visibleDuration,
          clickTime - visibleDuration / 2
        )
      );
      setScrollPosition(newScrollPosition);
    }
  }, [duration, containerWidth, zoomLevel, setScrollPosition, seek]);

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#2a2a2a',
        borderTop: '1px solid #444',
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