// components/audio/DAW/Multitrack/recording/LiveMIDIVisualizer.js
'use client';

import { useEffect, useRef, useState } from 'react';
import RecordingManager from './RecordingManager';

export default function LiveMIDIVisualizer({
  trackId,
  height = 120,
  color = '#4CAF50',
  backgroundColor = 'transparent',
  zoomLevel = 100,
  getTransportTime
}) {
  const canvasRef = useRef(null);
  const [activeNotes, setActiveNotes] = useState(new Map());
  const recordedNotesRef = useRef([]);
  const isRecordingRef = useRef(false);
  const animationFrameRef = useRef(null);
  const startPositionRef = useRef(0);

  // Subscribe to MIDI events
  useEffect(() => {
    const handleRecordingStart = ({ trackId: id, type, startPosition }) => {
      if (id === trackId && type === 'midi') {
        console.log(`🎹 LiveMIDIVisualizer: Starting visualization for track ${trackId}`);
        isRecordingRef.current = true;
        startPositionRef.current = startPosition || 0;
        recordedNotesRef.current = [];
        startDrawing();
      }
    };

    const handleRecordingStop = ({ trackId: id, type }) => {
      if (id === trackId && type === 'midi') {
        console.log(`🎹 LiveMIDIVisualizer: Stopping visualization for track ${trackId}`);
        isRecordingRef.current = false;
        setActiveNotes(new Map());
        stopDrawing();
      }
    };

    const handleNoteOn = ({ trackId: id, note, velocity, timestamp }) => {
      if (id === trackId) {
        setActiveNotes(prev => {
          const updated = new Map(prev);
          updated.set(note, { velocity, startTime: timestamp });
          return updated;
        });
      }
    };

    const handleNoteOff = ({ trackId: id, note, timestamp, duration }) => {
      if (id === trackId) {
        setActiveNotes(prev => {
          const updated = new Map(prev);
          updated.delete(note);
          return updated;
        });

        // Add to recorded notes
        recordedNotesRef.current.push({
          note,
          startTime: timestamp - duration,
          duration,
          velocity: 100 // Default velocity
        });
      }
    };

    RecordingManager.on('recording-start', handleRecordingStart);
    RecordingManager.on('recording-stop', handleRecordingStop);
    RecordingManager.on('midi-note-on', handleNoteOn);
    RecordingManager.on('midi-note-off', handleNoteOff);

    return () => {
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      RecordingManager.off('midi-note-on', handleNoteOn);
      RecordingManager.off('midi-note-off', handleNoteOff);
      stopDrawing();
    };
  }, [trackId]);

  const stopDrawing = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const startDrawing = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Calculate pixels per second
    const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
    const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * (zoomLevel / 100);

    // Set initial canvas size
    canvas.width = Math.floor(pixelsPerSecond * 120); // 2 minutes
    canvas.style.width = canvas.width + 'px';

    const draw = () => {
      if (!isRecordingRef.current || !canvasRef.current) {
        return;
      }

      // Clear canvas
      ctx.fillStyle = backgroundColor === 'transparent' ? 'rgba(0,0,0,0)' : backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Get current time
      let currentTime = startPositionRef.current;
      if (getTransportTime && typeof getTransportTime === 'function') {
        currentTime = getTransportTime();
      }

      // Draw recorded notes
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;

      recordedNotesRef.current.forEach(note => {
        const x = (startPositionRef.current + note.startTime) * pixelsPerSecond;
        const width = note.duration * pixelsPerSecond;
        const noteHeight = height / 128; // 128 MIDI notes
        const y = height - ((note.note / 128) * height);

        ctx.fillRect(x, y - noteHeight / 2, width, noteHeight);
      });

      // Draw active notes (currently being played)
      ctx.fillStyle = '#FF5722';
      ctx.globalAlpha = 0.9;

      activeNotes.forEach((noteData, note) => {
        const x = (startPositionRef.current + noteData.startTime) * pixelsPerSecond;
        const width = (currentTime - startPositionRef.current - noteData.startTime) * pixelsPerSecond;
        const noteHeight = height / 128;
        const y = height - ((note / 128) * height);

        ctx.fillRect(x, y - noteHeight / 2, Math.max(width, 2), noteHeight);
      });

      ctx.globalAlpha = 1.0;

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      style={{
        display: 'block',
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        backgroundColor: 'transparent',
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  );
}