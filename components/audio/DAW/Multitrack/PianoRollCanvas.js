// components/audio/DAW/Multitrack/PianoRollCanvas.js
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { beatsToPixels, pixelsToBeats, secondsToBeats, calculatePlayheadPosition } from '../../../../lib/midiTimeUtils';

const NOTE_HEIGHT = 20; // Height of each piano key row
const MIN_NOTE = 21; // A0
const MAX_NOTE = 108; // C8
const TOTAL_NOTES = MAX_NOTE - MIN_NOTE + 1;

export default function PianoRollCanvas({
  notes = [],
  selectedNotes,
  onSelectedNotesChange,
  onNotesUpdate,
  currentTool,
  snapValue,
  zoom,
  tempo,
  isPlaying,
  currentTime,
  scrollOffset,
  instrument,
  canvasSize = { width: 2000, height: 88 * 20 },
}) {
  const canvasRef = useRef(null);
  const [actualCanvasSize, setActualCanvasSize] = useState(canvasSize);
  const [mouseState, setMouseState] = useState({
    isDown: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    draggedNote: null,
    dragType: null,
    originalNotes: null,
  });

  // Calculate grid dimensions
  // Use FIXED pixels per second to match main editor
  const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
  const zoomScale = zoom.x / 100; // Treat zoom.x as a percentage like main editor
  const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * zoomScale;
  const pixelsPerBeat = pixelsPerSecond / ((tempo || 120) / 60);
  const noteHeight = NOTE_HEIGHT * zoom.y;
  const gridWidth = Math.max(canvasSize.width, pixelsPerBeat * 64);
  const gridHeight = Math.max(canvasSize.height, TOTAL_NOTES * noteHeight);

  // Update canvas size when zoom changes
  useEffect(() => {
    if (canvasRef.current) {
      const newWidth = Math.max(canvasSize.width, gridWidth);
      const newHeight = Math.max(canvasSize.height, gridHeight);

      canvasRef.current.width = newWidth;
      canvasRef.current.height = newHeight;

      setActualCanvasSize({ width: newWidth, height: newHeight });
    }
  }, [zoom, canvasSize, gridWidth, gridHeight]);

  // Helper functions with bounds checking
  // NOTE: Piano roll uses beat-based grid for visual display, but notes are stored in seconds
  const pixelToTime = (x) => {
    // Convert pixel to beats for grid snapping
    return Math.max(0, x / pixelsPerBeat);
  };

  const timeToPixel = (time) => {
    // Convert beats to pixels for grid display
    return time * pixelsPerBeat;
  };

  // Convert between seconds (storage) and beats (display)
  const secondsToBeats = (seconds) => seconds * ((tempo || 120) / 60);
  const beatsToSeconds = (beats) => beats / ((tempo || 120) / 60);

  const pixelToNote = (y) => {
    // y is relative to the canvas content; do not add scroll here.
    const note = MAX_NOTE - Math.floor(y / noteHeight);
    return Math.max(MIN_NOTE, Math.min(MAX_NOTE, note));
  };

  const noteToPixel = (note) => {
    return (MAX_NOTE - note) * noteHeight;
  };

  const snapToGrid = (time) => {
    if (snapValue === 0) return time;
    return Math.round(time / snapValue) * snapValue;
  };

  // Find note at position
  const getNoteAtPosition = (x, y) => {
    const timeInBeats = pixelToTime(x);
    const pitch = pixelToNote(y);

    return notes.find((note) => {
      // Convert note times from seconds to beats for comparison
      const noteStartBeats = secondsToBeats(note.startTime);
      const noteEndBeats = secondsToBeats(note.startTime + note.duration);
      return note.note === pitch && timeInBeats >= noteStartBeats && timeInBeats <= noteEndBeats;
    });
  };

  // Check if near note edge for resizing
  const getNoteEdge = (x, note) => {
    // Convert note times from seconds to beats for display
    const startBeats = secondsToBeats(note.startTime);
    const endBeats = secondsToBeats(note.startTime + note.duration);

    const startX = timeToPixel(startBeats);
    const endX = timeToPixel(endBeats);
    const edgeThreshold = 5;

    if (Math.abs(x - startX) < edgeThreshold) return 'left';
    if (Math.abs(x - endX) < edgeThreshold) return 'right';
    return null;
  };

  // Draw grid
  const drawGrid = useCallback(
    (ctx) => {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, actualCanvasSize.width, actualCanvasSize.height);

      // Vertical lines (beats)
      for (let beat = 0; beat < 64; beat++) {
        const x = timeToPixel(beat);
        if (x < 0 || x > actualCanvasSize.width) continue;

        ctx.strokeStyle = beat % 4 === 0 ? '#444' : '#333';
        ctx.lineWidth = beat % 4 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, actualCanvasSize.height);
        ctx.stroke();
      }

      // Horizontal lines (notes)
      for (let note = MIN_NOTE; note <= MAX_NOTE; note++) {
        const y = noteToPixel(note);
        if (y < -noteHeight || y > actualCanvasSize.height) continue;

        const isC = note % 12 === 0;
        const isBlackKey = [1, 3, 6, 8, 10].includes(note % 12);

        // Background for black keys
        if (isBlackKey) {
          ctx.fillStyle = '#252525';
          ctx.fillRect(0, y, actualCanvasSize.width, noteHeight);
        }

        // Grid line
        ctx.strokeStyle = isC ? '#444' : '#333';
        ctx.lineWidth = isC ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(actualCanvasSize.width, y);
        ctx.stroke();
      }
    },
    [actualCanvasSize, pixelsPerBeat, noteHeight],
  );

  // Draw notes
  const drawNotes = useCallback(
    (ctx) => {
      const instrumentColor = instrument?.color || '#92ce84';

      // Log notes for debugging every time they change
      if (notes.length > 0) {
        const logKey = notes.map(n => `${n.note}-${n.startTime}`).join(',');
        if (window.__lastPianoRollNotesKey !== logKey) {
          console.log(`🎹 PianoRoll Drawing ${notes.length} notes:`);
          console.log(`   Tempo: ${tempo} BPM, PixelsPerBeat: ${pixelsPerBeat.toFixed(1)}px`);
          console.log(`   First 3 notes:`, notes.slice(0, 3).map(n => {
            const startBeats = secondsToBeats(n.startTime);
            const durationBeats = secondsToBeats(n.duration);
            return {
              pitch: n.note,
              startTime: `${n.startTime?.toFixed?.(3) ?? n.startTime}s (${startBeats.toFixed(3)} beats)`,
              duration: `${n.duration?.toFixed?.(3) ?? n.duration}s (${durationBeats.toFixed(3)} beats)`,
              startX: `${timeToPixel(startBeats).toFixed(1)}px`,
              width: `${(durationBeats * pixelsPerBeat).toFixed(1)}px`
            };
          }));
          window.__lastPianoRollNotesKey = logKey;
        }
      }

      notes.forEach((note) => {
        // Convert note times from seconds to beats for display
        const startBeats = secondsToBeats(note.startTime);
        const durationBeats = secondsToBeats(note.duration);

        const x = timeToPixel(startBeats);
        const y = noteToPixel(note.note);
        const width = Math.max(durationBeats * pixelsPerBeat, 5); // Minimum 5px width
        const height = noteHeight - 2;

        // Skip if outside visible area
        if (x + width < 0 || x > actualCanvasSize.width) return;
        if (y + height < 0 || y > actualCanvasSize.height) return;

        // Note color based on selection and velocity
        const isSelected = selectedNotes && selectedNotes.has(note.id);
        const velocityAlpha = 0.5 + (note.velocity / 127) * 0.5;

        // Fill
        ctx.fillStyle = isSelected
          ? `${instrumentColor}${Math.round(velocityAlpha * 255)
              .toString(16)
              .padStart(2, '0')}`
          : `${instrumentColor}${Math.round(velocityAlpha * 180)
              .toString(16)
              .padStart(2, '0')}`;
        ctx.fillRect(x, y + 1, width, height);

        // Border
        ctx.strokeStyle = isSelected ? '#fff' : instrumentColor;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(x, y + 1, width, height);

        // Velocity indicator
        const velocityHeight = (note.velocity / 127) * 4;
        ctx.fillStyle = instrumentColor;
        ctx.fillRect(x, y + height - velocityHeight, width, velocityHeight);
      });
    },
    [
      notes,
      selectedNotes,
      actualCanvasSize,
      instrument,
      pixelsPerBeat,
      noteHeight,
    ],
  );

  // Draw selection box
  const drawSelectionBox = useCallback(
    (ctx) => {
      if (
        currentTool !== 'select' ||
        !mouseState.isDown ||
        mouseState.draggedNote
      )
        return;

      const x = Math.min(mouseState.startX, mouseState.currentX);
      const y = Math.min(mouseState.startY, mouseState.currentY);
      const width = Math.abs(mouseState.currentX - mouseState.startX);
      const height = Math.abs(mouseState.currentY - mouseState.startY);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    },
    [currentTool, mouseState],
  );

  // Draw playhead using unified time conversion
  const drawPlayhead = useCallback(
    (ctx) => {
      if (!isPlaying) return;
      // currentTime is in seconds, convert to beats for beat-based grid display
      const currentBeat = secondsToBeats(currentTime);
      const x = timeToPixel(currentBeat);
      if (x < 0 || x > actualCanvasSize.width) return;

      // Log playhead position for debugging
      if (Math.floor(currentTime * 10) % 10 === 0) { // Log every 0.1 seconds
        console.log(`🎹 PianoRoll Playhead: currentTime=${currentTime.toFixed(3)}s, currentBeat=${currentBeat.toFixed(3)} beats, x=${x.toFixed(1)}px, pixelsPerBeat=${pixelsPerBeat.toFixed(1)}`);
      }

      ctx.strokeStyle = '#ff3030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, actualCanvasSize.height);
      ctx.stroke();
    },
    [isPlaying, currentTime, actualCanvasSize, tempo, timeToPixel, pixelsPerBeat],
  );

  // Main draw function with error handling
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Clear canvas
      ctx.clearRect(0, 0, actualCanvasSize.width, actualCanvasSize.height);

      // Draw grid
      drawGrid(ctx);

      // Draw notes
      if (notes && notes.length > 0) {
        drawNotes(ctx);
      }

      // Draw selection box
      if (mouseState.isDown && currentTool === 'select') {
        drawSelectionBox(ctx);
      }

      // Draw playhead
      if (isPlaying) {
        drawPlayhead(ctx);
      }
    } catch (error) {
      console.error('Error drawing piano roll:', error);
    }
  }, [
    actualCanvasSize,
    notes,
    mouseState,
    currentTool,
    isPlaying,
    drawGrid,
    drawNotes,
    drawSelectionBox,
    drawPlayhead,
  ]);

  // Draw on every frame
  useEffect(() => {
    const animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [draw]);

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouseState((prev) => ({
      ...prev,
      isDown: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    }));

    if (currentTool === 'pencil') {
      // Add new note with proper default duration
      const timeInBeats = snapToGrid(pixelToTime(x));
      const pitch = pixelToNote(y);
      // Default duration in beats
      const durationBeats = Math.max(snapValue && snapValue > 0 ? snapValue : 1, 0.0625);

      // Convert from beats (UI) to seconds (storage)
      const newNote = {
        id: `note-${Date.now()}`,
        note: pitch,
        startTime: beatsToSeconds(timeInBeats),
        duration: beatsToSeconds(durationBeats),
        velocity: 100,
      };
      onNotesUpdate([...notes, newNote]);
    } else if (currentTool === 'select' || currentTool === 'eraser') {
      const clickedNote = getNoteAtPosition(x, y);
      if (clickedNote) {
        if (currentTool === 'eraser') {
          // Remove note
          onNotesUpdate(notes.filter((n) => n.id !== clickedNote.id));
        } else {
          // Select note
          const edge = getNoteEdge(x, clickedNote);
          setMouseState((prev) => ({
            ...prev,
            draggedNote: clickedNote,
            dragType: edge || 'move',
            originalNotes: [...notes],
          }));
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouseState((prev) => ({ ...prev, currentX: x, currentY: y }));

    // Update cursor based on tool and position
    if (currentTool === 'select') {
      const note = getNoteAtPosition(x, y);
      if (note) {
        const edge = getNoteEdge(x, note);
        canvasRef.current.style.cursor = edge ? 'ew-resize' : 'move';
      } else {
        canvasRef.current.style.cursor = 'crosshair';
      }
    } else if (currentTool === 'pencil') {
      canvasRef.current.style.cursor = 'crosshair';
    } else if (currentTool === 'eraser') {
      canvasRef.current.style.cursor = 'pointer';
    }

    // Handle dragging
    if (
      mouseState.isDown &&
      mouseState.draggedNote &&
      currentTool === 'select'
    ) {
      const draggedNote = mouseState.draggedNote;
      const updatedNotes = [...notes];
      const noteIndex = updatedNotes.findIndex((n) => n.id === draggedNote.id);

      if (noteIndex !== -1) {
        if (mouseState.dragType === 'move') {
          const deltaTimeBeats = pixelToTime(x) - pixelToTime(mouseState.startX);
          const deltaPitch = pixelToNote(y) - pixelToNote(mouseState.startY);

          // Convert note time to beats, adjust, then back to seconds
          const currentStartBeats = secondsToBeats(draggedNote.startTime);
          const newStartBeats = snapToGrid(currentStartBeats + deltaTimeBeats);

          updatedNotes[noteIndex] = {
            ...draggedNote,
            startTime: beatsToSeconds(newStartBeats),
            note: Math.max(
              MIN_NOTE,
              Math.min(MAX_NOTE, draggedNote.note + deltaPitch),
            ),
          };
        } else if (mouseState.dragType === 'left') {
          const newStartTimeBeats = snapToGrid(pixelToTime(x));
          const endTimeBeats = secondsToBeats(draggedNote.startTime + draggedNote.duration);
          const newDurationBeats = Math.max(
            snapValue || 0.125,
            endTimeBeats - newStartTimeBeats,
          );

          updatedNotes[noteIndex] = {
            ...draggedNote,
            startTime: beatsToSeconds(newStartTimeBeats),
            duration: beatsToSeconds(newDurationBeats),
          };
        } else if (mouseState.dragType === 'right') {
          const newEndTimeBeats = snapToGrid(pixelToTime(x));
          const startTimeBeats = secondsToBeats(draggedNote.startTime);
          const newDurationBeats = Math.max(
            snapValue || 0.125,
            newEndTimeBeats - startTimeBeats,
          );

          updatedNotes[noteIndex] = {
            ...draggedNote,
            duration: beatsToSeconds(newDurationBeats),
          };
        }

        onNotesUpdate(updatedNotes);
      }
    }
  };

  const handleMouseUp = () => {
    setMouseState({
      isDown: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      draggedNote: null,
      dragType: null,
      originalNotes: null,
    });
  };

  const handleMouseLeave = () => {
    if (mouseState.isDown) {
      handleMouseUp();
    }
  };

  // Prevent scroll offset from going out of bounds
  useEffect(() => {
    if (scrollOffset) {
      const maxScrollX = Math.max(0, gridWidth - canvasSize.width);
      const maxScrollY = Math.max(0, gridHeight - canvasSize.height);

      if (
        scrollOffset.x < 0 ||
        scrollOffset.x > maxScrollX ||
        scrollOffset.y < 0 ||
        scrollOffset.y > maxScrollY
      ) {
        console.warn('Scroll offset out of bounds, resetting:', scrollOffset);
      }
    }
  }, [scrollOffset, gridWidth, gridHeight, canvasSize]);

  return (
    <div
      style={{
        width: gridWidth,
        height: gridHeight,
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
