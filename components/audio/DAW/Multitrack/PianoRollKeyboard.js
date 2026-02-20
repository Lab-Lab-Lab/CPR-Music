// components/audio/DAW/Multitrack/PianoRollKeyboard.js
'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from 'react';

const NOTE_HEIGHT = 20;
const MIN_NOTE = 21; // A0
const MAX_NOTE = 108; // C8

const PianoRollKeyboard = forwardRef(
  (
    {
      scrollOffset = { x: 0, y: 0 },
      zoom = { x: 150, y: 1 },
      activeNote,
      onNoteClick,
    },
    ref,
  ) => {
    const canvasRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // Note name mapping
    const getNoteInfo = (midiNote) => {
      const noteNames = [
        'C',
        'C#',
        'D',
        'D#',
        'E',
        'F',
        'F#',
        'G',
        'G#',
        'A',
        'A#',
        'B',
      ];
      const octave = Math.floor(midiNote / 12) - 1;
      const noteName = noteNames[midiNote % 12];
      const isBlack = noteName.includes('#');
      return {
        name: noteName,
        octave,
        isBlack,
        fullName: `${noteName}${octave}`,
      };
    };

    // Draw the keyboard
    const drawKeyboard = () => {
      const canvas = canvasRef.current;
      if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;

      const ctx = canvas.getContext('2d');
      const width = canvasSize.width;
      const height = canvasSize.height;
      const noteHeight = NOTE_HEIGHT * zoom.y;

      // Clear canvas
      ctx.fillStyle = '#232323';
      ctx.fillRect(0, 0, width, height);

      // Draw keys
      for (let note = MAX_NOTE; note >= MIN_NOTE; note--) {
        const noteInfo = getNoteInfo(note);
        const y = (MAX_NOTE - note) * noteHeight - scrollOffset.y;

        // Skip if outside visible area
        if (y + noteHeight < 0 || y > height) continue;

        // Key color
        if (note === activeNote) {
          ctx.fillStyle = '#92ce84';
        } else if (noteInfo.isBlack) {
          ctx.fillStyle = '#1a1a1a';
        } else {
          ctx.fillStyle = '#f0f0f0';
        }

        // Draw key
        ctx.fillRect(0, y, width - 1, noteHeight - 1);

        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y, width - 1, noteHeight - 1);

        // Draw note label for C notes and active note
        if (noteInfo.name === 'C' || note === activeNote) {
          ctx.fillStyle = noteInfo.isBlack ? '#ccc' : '#333';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(noteInfo.fullName, width - 5, y + noteHeight / 2);
        }
      }

      // Draw middle C indicator
      const middleC = 60;
      const middleCY = (MAX_NOTE - middleC) * noteHeight - scrollOffset.y;
      if (middleCY >= 0 && middleCY <= height) {
        ctx.strokeStyle = '#4a7c9e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, middleCY);
        ctx.lineTo(10, middleCY);
        ctx.stroke();
      }
    };

    // Redraw when dependencies change
    useEffect(() => {
      drawKeyboard();
    }, [scrollOffset, zoom, activeNote, canvasSize]);

    // Set up canvas size
    useEffect(() => {
      const updateSize = () => {
        if (canvasRef.current && canvasRef.current.parentElement) {
          const parent = canvasRef.current.parentElement;
          const newWidth = parent.clientWidth || 100; // Default width
          const newHeight = parent.clientHeight || 600; // Default height

          // Update canvas actual size
          canvasRef.current.width = newWidth;
          canvasRef.current.height = newHeight;

          // Update state to trigger redraw
          setCanvasSize({ width: newWidth, height: newHeight });
        }
      };

      // Initial size
      updateSize();

      // Add a small delay to ensure parent is fully rendered
      const timeoutId = setTimeout(updateSize, 100);

      // Listen for resize
      window.addEventListener('resize', updateSize);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateSize);
      };
    }, []);

    const handleMouseDown = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const noteHeight = NOTE_HEIGHT * zoom.y;
      const note = MAX_NOTE - Math.floor((y + scrollOffset.y) / noteHeight);

      if (note >= MIN_NOTE && note <= MAX_NOTE && onNoteClick) {
        onNoteClick(note);
      }
    };

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: '600px', // Ensure minimum height
        }}
      />
    );
  },
);

PianoRollKeyboard.displayName = 'PianoRollKeyboard';

export default PianoRollKeyboard;
