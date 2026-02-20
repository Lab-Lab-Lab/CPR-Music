'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useWaveform } from '../../../../contexts/WaveformContext';
import { CanvasRenderer } from '../../../../lib/rendering/CanvasRenderer';

export default function WaveformRenderer({ height = 180 }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  const {
    peaks,
    duration,
    currentTime,
    isPlaying,
    zoomLevel,
    scrollPosition,
    setScrollPosition,
    regions,
    activeRegion,
    isDraggingRegion,
    setIsDraggingRegion,
    setContainerWidth,
    seek,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    createRegion,
    updateRegion,
    deleteRegion,
    clearRegions
  } = useWaveform();

  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isResizingRegion, setIsResizingRegion] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null); // 'start' or 'end'

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    rendererRef.current = new CanvasRenderer(canvasRef.current);

    // Update container width
    const updateWidth = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setContainerWidth(rect.width);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, [setContainerWidth]);

  // Main render function
  const render = useCallback(() => {
    if (!rendererRef.current || !duration) return;

    const renderer = rendererRef.current;
    const width = renderer.width;

    // Clear and draw background
    renderer.clear();
    renderer.drawBackground();

    // Calculate visible range based on zoom and scroll
    const visibleDuration = width / zoomLevel;
    const startTime = scrollPosition;
    const endTime = Math.min(duration, scrollPosition + visibleDuration);

    // Draw waveform with zoom
    if (peaks && peaks.merged) {
      // The waveform width should be at least the canvas width, or larger when zoomed
      const waveformWidth = Math.max(width, duration * zoomLevel);
      const offsetX = -scrollPosition * zoomLevel;

      renderer.drawWaveform(peaks, {
        startX: offsetX,
        width: waveformWidth,
        height
      });
    } else if (duration > 0) {
      // Draw loading message
      renderer.ctx.fillStyle = '#666';
      renderer.ctx.font = '12px Arial';
      renderer.ctx.textAlign = 'center';
      renderer.ctx.fillText('Loading waveform...', width / 2, height / 2);
      renderer.ctx.textAlign = 'start';
    }

    // Draw progress overlay
    if (duration > 0 && currentTime <= endTime && currentTime >= startTime) {
      const progressX = (currentTime - scrollPosition) * zoomLevel;
      renderer.drawProgress(progressX / width, { width });
    }

    // Draw regions with zoom
    regions.forEach(region => {
      // Only draw if region is visible
      if (region.end >= startTime && region.start <= endTime) {
        const startX = (region.start - scrollPosition) * zoomLevel;
        const endX = (region.end - scrollPosition) * zoomLevel;
        renderer.drawRegion(startX, endX);
      }
    });

    // Draw temporary drag region with zoom
    if (isDragging && dragStart !== null && dragEnd !== null) {
      const startX = (Math.min(dragStart, dragEnd) - scrollPosition) * zoomLevel;
      const endX = (Math.max(dragStart, dragEnd) - scrollPosition) * zoomLevel;
      renderer.drawRegion(startX, endX, {
        color: 'rgba(155, 115, 215, 0.2)',
        borderColor: 'rgba(155, 115, 215, 0.6)'
      });
    }

    // Draw cursor
    if (duration > 0 && currentTime >= startTime && currentTime <= endTime) {
      const cursorX = (currentTime - scrollPosition) * zoomLevel;
      renderer.drawCursor(cursorX);
    }
  }, [peaks, duration, currentTime, zoomLevel, scrollPosition, regions, isDragging, dragStart, dragEnd, height]);

  // Render on state changes
  useEffect(() => {
    render();
  }, [render]);

  // Animation loop for smooth cursor movement during playback
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, render]);

  // Convert pixel position to time with zoom
  const pixelToTime = useCallback((x) => {
    const time = scrollPosition + (x / zoomLevel);
    // Clamp to valid time range [0, duration]
    return Math.max(0, Math.min(duration || 0, time));
  }, [scrollPosition, zoomLevel, duration]);

  // Check if click is on region handle
  const getRegionHandle = useCallback((x, y) => {
    if (!activeRegion) return null;

    const startX = (activeRegion.start - scrollPosition) * zoomLevel;
    const endX = (activeRegion.end - scrollPosition) * zoomLevel;
    const handleWidth = 6;

    if (Math.abs(x - startX) < handleWidth) return 'start';
    if (Math.abs(x - endX) < handleWidth) return 'end';

    return null;
  }, [activeRegion, scrollPosition, zoomLevel]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x);

    // Check if clicking on region handle
    const handle = getRegionHandle(x, e.clientY - rect.top);
    if (handle) {
      setIsResizingRegion(true);
      setResizeHandle(handle);
      setIsDraggingRegion(true);
      return;
    }

    // Check if clicking inside existing region
    if (activeRegion && time >= activeRegion.start && time <= activeRegion.end) {
      // Just seek, don't start new region
      seek(time);
      return;
    }

    // Start new region selection
    setIsDragging(true);
    setDragStart(time);
    setDragEnd(time);

    // Clear existing regions
    clearRegions();
  }, [pixelToTime, getRegionHandle, activeRegion, seek, clearRegions, setIsDraggingRegion]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x);

    // Handle region resize
    if (isResizingRegion && activeRegion) {
      if (resizeHandle === 'start') {
        updateRegion(activeRegion.id, { start: Math.min(time, activeRegion.end) });
      } else if (resizeHandle === 'end') {
        updateRegion(activeRegion.id, { end: Math.max(time, activeRegion.start) });
      }
      return;
    }

    // Handle region creation drag
    if (isDragging) {
      setDragEnd(time);
    }

    // Update cursor style
    const handle = getRegionHandle(x, e.clientY - rect.top);
    canvasRef.current.style.cursor = handle ? 'col-resize' : 'crosshair';
  }, [pixelToTime, isResizingRegion, activeRegion, resizeHandle, updateRegion, isDragging, getRegionHandle]);

  const handleMouseUp = useCallback((e) => {
    if (isResizingRegion) {
      setIsResizingRegion(false);
      setResizeHandle(null);
      setIsDraggingRegion(false);
      return;
    }

    if (isDragging && dragStart !== null && dragEnd !== null) {
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);

      if (Math.abs(end - start) > 0.01) { // Minimum region size
        createRegion(start, end);
      } else {
        // Just a click, seek to position
        seek(dragStart);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isResizingRegion, isDragging, dragStart, dragEnd, createRegion, seek, setIsDraggingRegion]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleMouseUp();
    }
  }, [isDragging, handleMouseUp]);

  const handleDoubleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x);

    // Clear region if double-clicking inside it
    if (activeRegion && time >= activeRegion.start && time <= activeRegion.end) {
      clearRegions();
    }
  }, [pixelToTime, activeRegion, clearRegions]);

  // Handle mouse wheel for zoom and scroll
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    if (!duration || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + wheel
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const fitZoom = rect.width / duration; // Minimum zoom to fit
      const maxZoom = Math.max(3000, fitZoom * 50);
      const newZoom = Math.max(fitZoom, Math.min(maxZoom, zoomLevel * zoomFactor));

      // Only update if zoom actually changed
      if (newZoom !== zoomLevel) {
        // Zoom centered on mouse position
        const x = e.clientX - rect.left;
        const timeAtMouse = pixelToTime(x);

        setZoom(newZoom);

        // Adjust scroll to keep mouse position stable
        const newTimeAtMouse = scrollPosition + (x / newZoom);
        const scrollAdjust = timeAtMouse - newTimeAtMouse;
        const maxScroll = Math.max(0, duration - rect.width / newZoom);
        setScrollPosition(Math.max(0, Math.min(maxScroll, scrollPosition + scrollAdjust)));
      }
    } else {
      // Horizontal scroll (both regular wheel and shift+wheel)
      // Use deltaX for horizontal trackpad/mouse gestures, deltaY for vertical wheel
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      // Only scroll if we're zoomed in
      const visibleDuration = rect.width / zoomLevel;
      if (visibleDuration < duration) {
        const scrollSpeed = 0.5; // Adjust speed as needed
        const scrollAmount = (delta / 100) * visibleDuration * scrollSpeed;
        const maxScroll = duration - visibleDuration;
        const newScrollPosition = Math.max(0, Math.min(maxScroll, scrollPosition + scrollAmount));
        setScrollPosition(newScrollPosition);
      }
    }
  }, [zoomLevel, scrollPosition, duration, setZoom, setScrollPosition, pixelToTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (activeRegion) {
            clearRegions();
            e.preventDefault();
          }
          break;
        case 'Escape':
          clearRegions();
          e.preventDefault();
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
        case '_':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetZoom();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRegion, clearRegions, zoomIn, zoomOut, resetZoom]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        backgroundColor: '#1e1e1e',
        cursor: isDragging ? 'col-resize' : 'crosshair',
        overflow: 'hidden',  // Prevent canvas from overflowing
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}