// components/audio/DAW/Multitrack/MultitrackTimeline.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTimeline({
  zoomLevel = 100,
  scrollRef,
  onScroll,
  timelineExtent, // Duration in seconds that the timeline should cover
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);

  const { duration, currentTime, seek, isPlaying, tracks } = useMultitrack();

  // Connect external scroll ref if provided
  useEffect(() => {
    if (scrollRef && scrollContainerRef.current) {
      scrollRef.current = scrollContainerRef.current;
    }
  }, [scrollRef]);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle click to set playhead position
  const handleTimelineClick = (e) => {
    if (!containerRef.current || duration === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;

    // Use the same pixels-per-second calculation as rendering
    const pixelsPerSecond = zoomLevel; // 100 zoom = 100 pixels/second
    const clickTime = x / pixelsPerSecond;

    // Convert to progress (0-1) based on current duration
    const projectDuration = duration > 0 ? duration : 30;
    const progress = clickTime / projectDuration;
    seek(Math.max(0, Math.min(1, progress)));
  };

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const height = 40;

    // Use the same pixels-per-second calculation as tracks container
    const pixelsPerSecond = zoomLevel; // 100 zoom = 100 pixels/second

    // Use timelineExtent from parent if provided, otherwise fall back to duration
    const projectDuration = timelineExtent || duration || 30;

    // Calculate actual canvas width based on the duration we'll be drawing
    const requiredWidth = pixelsPerSecond * projectDuration; // Just the timeline content, no sidebar
    const width = Math.max(containerWidth, requiredWidth);

    // Limit canvas size to prevent browser limits
    const MAX_CANVAS_WIDTH = 32000;
    const safeWidth = Math.min(width, MAX_CANVAS_WIDTH);

    canvas.width = safeWidth;
    canvas.height = height;

    // Clear canvas with dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, safeWidth, height);

    // Determine appropriate tick intervals based on zoom level
    let majorTickInterval = 1; // seconds
    let minorTicksPerMajor = 5;

    if (pixelsPerSecond > 200) {
      // Very zoomed in - show 0.1 second intervals
      majorTickInterval = 0.1;
      minorTicksPerMajor = 10;
    } else if (pixelsPerSecond > 100) {
      // Zoomed in - show 0.5 second intervals
      majorTickInterval = 0.5;
      minorTicksPerMajor = 5;
    } else if (pixelsPerSecond > 50) {
      // Normal - show 1 second intervals
      majorTickInterval = 1;
      minorTicksPerMajor = 5;
    } else if (pixelsPerSecond > 20) {
      // Zoomed out - show 5 second intervals
      majorTickInterval = 5;
      minorTicksPerMajor = 5;
    } else if (pixelsPerSecond > 10) {
      // Very zoomed out - show 10 second intervals
      majorTickInterval = 10;
      minorTicksPerMajor = 5;
    } else {
      // Extremely zoomed out - show 30 second intervals
      majorTickInterval = 30;
      minorTicksPerMajor = 6;
    }

    ctx.font = '11px Arial';
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    // Draw major ticks and time labels
    for (let sec = 0; sec <= projectDuration; sec += majorTickInterval) {
      const x = sec * pixelsPerSecond;

      // Stop drawing if we exceed safe canvas width
      if (x > safeWidth - 50) break; // Leave margin for text

      // Major tick
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time label
      const minutes = Math.floor(sec / 60);
      const seconds = sec % 60;

      let label;
      if (majorTickInterval < 1) {
        // Show decimal seconds for sub-second intervals
        label = sec.toFixed(1) + 's';
      } else if (seconds === 0 && minutes > 0) {
        // Show just minutes for whole minutes
        label = `${minutes}:00`;
      } else {
        // Show minutes:seconds
        label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      // Only draw text if it fits within canvas
      if (x + 50 < safeWidth) {
        ctx.fillText(label, x + 3, height - 15);
      }
    }

    // Draw minor ticks
    ctx.strokeStyle = '#333';
    const minorTickInterval = majorTickInterval / minorTicksPerMajor;

    for (let sec = 0; sec <= projectDuration; sec += minorTickInterval) {
      if (sec % majorTickInterval !== 0) {
        const x = sec * pixelsPerSecond;

        // Stop drawing if we exceed safe canvas width
        if (x > safeWidth - 10) break;

        ctx.beginPath();
        ctx.moveTo(x, height - 5);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw bottom border
    ctx.strokeStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }, [containerWidth, duration, zoomLevel, tracks, timelineExtent]);

  // Update playhead position - REMOVED, now handled by MultitrackEditor
  // The MultitrackEditor component will control both playheads to ensure sync

  // Calculate the actual width for the timeline
  const innerEl =
    typeof document !== 'undefined'
      ? document.getElementById('multitrack-tracks-inner')
      : null;
  const totalWidth = innerEl ? innerEl.offsetWidth : (zoomLevel * (timelineExtent || duration || 30));
  const timelineWidth = Math.max(containerWidth, totalWidth);

  return (
    <>
      <style>
        {`
          /* Hide scrollbar for Chrome, Safari and Opera */
          .timeline-scroll-container::-webkit-scrollbar {
            height: 8px;
            opacity: 0;
            transition: opacity 0.3s;
          }
          
          .timeline-scroll-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
          }
          
          .timeline-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
          }
          
          .timeline-scroll-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
          
          /* Show scrollbar on hover or when scrolling */
          .timeline-scroll-container.show-scrollbar::-webkit-scrollbar,
          .timeline-scroll-container:hover::-webkit-scrollbar {
            opacity: 1;
          }
          
          /* For Firefox - show thin scrollbar on hover */
          .timeline-scroll-container:hover {
            scrollbar-width: thin !important;
          }
        `}
      </style>
      <div
        className="timeline-container"
        style={{ display: 'flex', height: '40px' }}
      >
        {/* Sidebar spacer - matches add track button area */}
        <div
          className="timeline-sidebar-spacer"
          style={{
            width: '80px',
            backgroundColor: '#1e1e1e',
            borderRight: '1px solid #3a3a3a',
            flexShrink: 0,
          }}
        />

        {/* Track controls spacer */}
        <div
          className="timeline-controls-spacer"
          style={{
            width: '230px', /* Match actual track controls width */
            backgroundColor: '#232323',
            borderRight: '1px solid #444',
            flexShrink: 0,
          }}
        />

        {/* Timeline with horizontal scroll */}
        <div
          ref={scrollContainerRef}
          className={`timeline-scroll-container ${isScrolling ? 'show-scrollbar' : ''}`}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onScroll={(e) => {
            // Show scrollbar while scrolling
            setIsScrolling(true);

            // Clear existing timeout
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }

            // Hide scrollbar after scrolling stops
            scrollTimeoutRef.current = setTimeout(() => {
              setIsScrolling(false);
            }, 1000);

            // Handle scroll sync if needed
            if (onScroll) {
              onScroll(e);
            }
          }}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            position: 'relative',
            // Hide scrollbar by default
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
          }}
        >
          <div
            ref={containerRef}
            className="multitrack-timeline"
            onClick={handleTimelineClick}
            style={{
              position: 'relative',
              width: `${timelineWidth}px`,
              height: '40px',
              backgroundColor: '#1e1e1e',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
              }}
            />

            {/* Playhead - positioned relative to timeline container */}
            <div
              id="multitrack-timeline-playhead"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '2px',
                height: '40px', // Only the height of the timeline
                backgroundColor: '#ff3030',
                boxShadow: '0 0 3px rgba(255, 48, 48, 0.8)',
                pointerEvents: 'none',
                zIndex: 1000,
                transition: isPlaying ? 'none' : 'left 0.1s ease-out',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
