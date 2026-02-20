'use client';

import { useState, useEffect, useRef } from 'react';
import { MIDIUtils } from './MIDIScheduler';

// QWERTY → semitone offsets (anchored to the nearest lower C under startNote)
const KEY_TO_OFFSET = {
  // Lower row (Z/X/C… with sharps on S/D/G/H/J)
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
  KeyL: 13,
  Period: 14,
  Semicolon: 15,
  Slash: 16,
  // Upper row (Q/W/E… with numbers for sharps)
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
};

export default function PianoKeyboard({
  startNote = 48, // C3
  endNote = 72, // C5
  activeNotes = [],
  onNoteClick,
  width = 800,
  height = 120,
  showNoteNames = true,
  captureComputerKeyboard = false,
}) {
  const canvasRef = useRef(null);
  const [mouseDownNote, setMouseDownNote] = useState(null);
  const activeMouseNotesRef = useRef(new Set()); // Track ALL active mouse/pointer notes
  const activePointerIdsRef = useRef(new Map()); // Map pointerId -> note for multi-touch
  const containerRef = useRef(null);
  const isActiveRef = useRef(false); // only capture keys while hovered/focused
  const downCodesRef = useRef(new Set());
  const codeToNoteRef = useRef(new Map());
  const blurTimeoutRef = useRef(null);
  const visibilityTimeoutRef = useRef(null);

  // Interaction mode tracking
  const interactionModeRef = useRef(null); // 'mouse', 'pointer', or null

  // Octave shift (in 12-semitone steps, affects typing keyboard mapping only)
  const octaveShiftRef = useRef(0);

  // Map CSS pixels → canvas logical coords for accurate hit-testing when scaled
  function getLogicalCoords(evt) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = (evt.clientX ?? 0) - rect.left;
    const clientY = (evt.clientY ?? 0) - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: clientX * scaleX, y: clientY * scaleY };
  }

  // Refs for stable listeners
  const onNoteClickRef = useRef(onNoteClick);
  const startNoteRef = useRef(startNote);
  const endNoteRef = useRef(endNote);

  useEffect(() => {
    onNoteClickRef.current = onNoteClick;
  }, [onNoteClick]);

  useEffect(() => {
    startNoteRef.current = startNote;
    endNoteRef.current = endNote;
  }, [startNote, endNote]);

  // Cleanup effect to stop any stuck notes on unmount
  useEffect(() => {
    return () => {
      // Stop all active mouse/pointer notes
      activeMouseNotesRef.current.forEach(note => {
        console.log('[PianoKeyboard] Cleanup: stopping stuck note', note);
        onNoteClickRef.current?.(note, 'up');
      });
      activeMouseNotesRef.current.clear();
      activePointerIdsRef.current.clear();
    };
  }, []);

  // Computer keyboard → note on/off (optional)
  useEffect(() => {
    if (!captureComputerKeyboard) return;

    const handleKeyDown = (e) => {
      const isBracket = e.code === 'BracketLeft' || e.code === 'BracketRight';

      // Allow capture even if not hovered/focused when captureComputerKeyboard is true
      if (e.repeat && !isBracket) return;

      // Octave shift: [ lowers, ] raises
      if (isBracket) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.code === 'BracketLeft' ? -1 : 1;
        const startNote = startNoteRef.current;
        const endNote = endNoteRef.current;
        const base0 = startNote - (startNote % 12);
        const maxOffset = 24; // highest mapped key (KeyI)
        const minShift = Math.ceil((startNote - base0) / 12);
        const maxShift = Math.floor((endNote - base0 - maxOffset) / 12);
        const next = Math.max(
          minShift,
          Math.min(maxShift, (octaveShiftRef.current || 0) + delta),
        );
        octaveShiftRef.current = next;
        return;
      }

      const offset = KEY_TO_OFFSET[e.code];
      if (offset === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const startNote = startNoteRef.current;
      const endNote = endNoteRef.current;
      const base =
        startNote - (startNote % 12) + 12 * (octaveShiftRef.current || 0);
      const note = base + offset;
      if (note < startNote || note > endNote) return;
      if (downCodesRef.current.has(e.code)) return; // already down
      downCodesRef.current.add(e.code);
      codeToNoteRef.current.set(e.code, note);
      // Log diagnostic for keydown
      console.log('[PianoKeyboard] keydown', {
        code: e.code,
        note,
        t: performance.now(),
      });
      onNoteClickRef.current?.(note, 'down');
    };

    const handleKeyUp = (e) => {
      // Removed isActiveRef.current check to always release notes
      const offset = KEY_TO_OFFSET[e.code];
      if (offset === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      if (!downCodesRef.current.has(e.code)) return;
      downCodesRef.current.delete(e.code);
      const note = codeToNoteRef.current.get(e.code);
      codeToNoteRef.current.delete(e.code);
      if (note != null) {
        // Log diagnostic for keyup
        console.log('[PianoKeyboard] keyup', {
          code: e.code,
          note,
          t: performance.now(),
        });
        onNoteClickRef.current?.(note, 'up');
      }
    };

    const flushAll = (reason = 'unspecified') => {
      console.log('[PianoKeyboard] flushAll', { reason, t: performance.now() });
      for (const code of Array.from(downCodesRef.current)) {
        const note = codeToNoteRef.current.get(code);
        if (note != null) {
          try {
            onNoteClickRef.current?.(note, 'up');
          } catch {}
        }
      }
      downCodesRef.current.clear();
      codeToNoteRef.current.clear();
    };

    // Debounced blur/focus handling for spurious blur events (e.g., rrweb/Sentry Replay)
    const handleWindowBlur = () => {
      // rrweb/Sentry can cause transient blurs; wait longer before flushing.
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
        if (!document.hasFocus()) {
          flushAll('window-blur');
        }
      }, 600);
    };

    const handleWindowFocus = () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    const visHandler = () => {
      if (visibilityTimeoutRef.current)
        clearTimeout(visibilityTimeoutRef.current);
      if (document.hidden) {
        visibilityTimeoutRef.current = setTimeout(() => {
          if (document.hidden) flushAll('visibility-hidden');
        }, 600);
      } else {
        visibilityTimeoutRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      flushAll('unmount');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', visHandler);
      if (visibilityTimeoutRef.current)
        clearTimeout(visibilityTimeoutRef.current);
    };
  }, [captureComputerKeyboard]);

  // Piano key layout
  const blackKeyPattern = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#
  const whiteKeyPattern = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const blackKeyPositions = [0.65, 1.35, 2.65, 3.35, 4.35]; // Relative positions

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Keep internal buffer aligned with logical width/height for crisp math
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const whiteKeyWidth = width / getWhiteKeyCount();
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const blackKeyHeight = height * 0.65;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw white keys first
    let whiteKeyIndex = 0;
    for (let note = startNote; note <= endNote; note++) {
      const noteClass = note % 12;

      if (whiteKeyPattern.includes(noteClass)) {
        const x = whiteKeyIndex * whiteKeyWidth;
        const isActive = activeNotes.includes(note);

        // Draw white key
        ctx.fillStyle = isActive ? '#92ce84' : '#ffffff';
        ctx.fillRect(x + 1, 1, whiteKeyWidth - 2, height - 2);

        // Draw border
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x, 0, whiteKeyWidth, height);

        // Draw note name
        if (showNoteNames && noteClass === 0) {
          // Only show C notes
          ctx.fillStyle = isActive ? '#fff' : '#666';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            MIDIUtils.MIDIToNote(note),
            x + whiteKeyWidth / 2,
            height - 10,
          );
        }

        whiteKeyIndex++;
      }
    }

    // Draw black keys on top
    whiteKeyIndex = 0;
    for (let note = startNote; note <= endNote; note++) {
      const noteClass = note % 12;

      if (whiteKeyPattern.includes(noteClass)) {
        whiteKeyIndex++;
      } else if (blackKeyPattern.includes(noteClass)) {
        const octavePosition = Math.floor((note - startNote) / 12) * 7;
        const keyPosition =
          blackKeyPositions[blackKeyPattern.indexOf(noteClass)];
        const x =
          (octavePosition + keyPosition) * whiteKeyWidth - blackKeyWidth / 2;
        const isActive = activeNotes.includes(note);

        // Draw black key
        ctx.fillStyle = isActive ? '#a2de94' : '#2a2a2a';
        ctx.fillRect(x, 0, blackKeyWidth, blackKeyHeight);

        // Draw border
        ctx.strokeStyle = '#111';
        ctx.strokeRect(x, 0, blackKeyWidth, blackKeyHeight);
      }
    }
  }, [startNote, endNote, activeNotes, width, height, showNoteNames]);

  function getWhiteKeyCount() {
    let count = 0;
    for (let note = startNote; note <= endNote; note++) {
      if (whiteKeyPattern.includes(note % 12)) {
        count++;
      }
    }
    return count;
  }

  function getNoteFromPosition(x, y) {
    const whiteKeyWidth = width / getWhiteKeyCount();
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const blackKeyHeight = height * 0.65;

    // Check black keys first (they're on top)
    if (y < blackKeyHeight) {
      let whiteKeyIndex = 0;
      for (let note = startNote; note <= endNote; note++) {
        const noteClass = note % 12;

        if (whiteKeyPattern.includes(noteClass)) {
          whiteKeyIndex++;
        } else if (blackKeyPattern.includes(noteClass)) {
          const octavePosition = Math.floor((note - startNote) / 12) * 7;
          const keyPosition =
            blackKeyPositions[blackKeyPattern.indexOf(noteClass)];
          const keyX =
            (octavePosition + keyPosition) * whiteKeyWidth - blackKeyWidth / 2;

          if (x >= keyX && x < keyX + blackKeyWidth) {
            return note;
          }
        }
      }
    }

    // Check white keys
    const whiteKeyIndex = Math.floor(x / whiteKeyWidth);
    let currentWhiteKey = 0;

    for (let note = startNote; note <= endNote; note++) {
      if (whiteKeyPattern.includes(note % 12)) {
        if (currentWhiteKey === whiteKeyIndex) {
          return note;
        }
        currentWhiteKey++;
      }
    }

    return null;
  }

  // Helper to start a note (with deduplication)
  const startNoteHelper = (note) => {
    if (activeMouseNotesRef.current.has(note)) {
      console.warn('[PianoKeyboard] Note already active, skipping:', note);
      return false;
    }
    activeMouseNotesRef.current.add(note);
    onNoteClick?.(note, 'down');
    console.log('[PianoKeyboard] Started note:', note, 'Active:', Array.from(activeMouseNotesRef.current));
    return true;
  };

  // Helper to stop a note (with safety check)
  const stopNoteHelper = (note) => {
    if (!activeMouseNotesRef.current.has(note)) {
      console.log('[PianoKeyboard] Note not active, skipping stop:', note);
      return false;
    }
    activeMouseNotesRef.current.delete(note);
    onNoteClick?.(note, 'up');
    console.log('[PianoKeyboard] Stopped note:', note, 'Active:', Array.from(activeMouseNotesRef.current));
    return true;
  };

  // Stop all active notes
  const stopAllNotes = () => {
    const notes = Array.from(activeMouseNotesRef.current);
    console.log('[PianoKeyboard] Stopping all notes:', notes);
    notes.forEach(note => stopNoteHelper(note));
    activePointerIdsRef.current.clear();
    setMouseDownNote(null);
  };

  // Global event listener setup (persistent)
  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      if (interactionModeRef.current === 'mouse') {
        console.log('[PianoKeyboard] Global mouseup, stopping all notes');
        stopAllNotes();
        interactionModeRef.current = null;
      }
    };

    const handleGlobalPointerUp = (e) => {
      if (interactionModeRef.current === 'pointer') {
        const note = activePointerIdsRef.current.get(e.pointerId);
        if (note) {
          console.log('[PianoKeyboard] Global pointerup for id:', e.pointerId, 'note:', note);
          stopNoteHelper(note);
          activePointerIdsRef.current.delete(e.pointerId);
        }
        if (activePointerIdsRef.current.size === 0) {
          interactionModeRef.current = null;
        }
      }
    };

    const handleGlobalPointerCancel = (e) => {
      if (interactionModeRef.current === 'pointer') {
        console.log('[PianoKeyboard] Pointer cancelled, stopping all notes');
        stopAllNotes();
        interactionModeRef.current = null;
      }
    };

    // Handle window blur/focus to prevent stuck notes
    const handleWindowBlur = () => {
      console.log('[PianoKeyboard] Window blurred, stopping all notes');
      stopAllNotes();
      interactionModeRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[PianoKeyboard] Document hidden, stopping all notes');
        stopAllNotes();
        interactionModeRef.current = null;
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('pointerup', handleGlobalPointerUp);
    document.addEventListener('pointercancel', handleGlobalPointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleMouseDown = (e) => {
    if (interactionModeRef.current === 'pointer') return;
    e.preventDefault();

    interactionModeRef.current = 'mouse';
    const { x, y } = getLogicalCoords(e);
    const note = getNoteFromPosition(x, y);

    if (note) {
      if (startNoteHelper(note)) {
        setMouseDownNote(note);
      }
    }
  };

  const handleMouseUp = (e) => {
    // Global handler will take care of this
  };

  const handleMouseMove = (e) => {
    if (interactionModeRef.current !== 'mouse') return;
    if (activeMouseNotesRef.current.size === 0) return;

    const { x, y } = getLogicalCoords(e);
    const note = getNoteFromPosition(x, y);
    const currentNote = Array.from(activeMouseNotesRef.current)[0]; // Get first (should only be one for mouse)

    if (note && note !== currentNote) {
      console.log('[PianoKeyboard] Mouse moved from', currentNote, 'to', note);
      stopNoteHelper(currentNote);
      if (startNoteHelper(note)) {
        setMouseDownNote(note);
      }
    }
  };

  const handleMouseLeave = (e) => {
    // Don't stop notes on leave - global handler will handle it
  };

  const handlePointerDown = (e) => {
    if (interactionModeRef.current === 'mouse') return;
    e.preventDefault();

    interactionModeRef.current = 'pointer';

    try {
      canvasRef.current?.setPointerCapture?.(e.pointerId);
    } catch {}

    const { x, y } = getLogicalCoords(e);
    const note = getNoteFromPosition(x, y);

    if (note) {
      if (startNoteHelper(note)) {
        activePointerIdsRef.current.set(e.pointerId, note);
        setMouseDownNote(note);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (interactionModeRef.current !== 'pointer') return;

    const currentNote = activePointerIdsRef.current.get(e.pointerId);
    if (!currentNote) return;

    const { x, y } = getLogicalCoords(e);
    const note = getNoteFromPosition(x, y);

    if (note && note !== currentNote) {
      console.log('[PianoKeyboard] Pointer', e.pointerId, 'moved from', currentNote, 'to', note);
      stopNoteHelper(currentNote);
      if (startNoteHelper(note)) {
        activePointerIdsRef.current.set(e.pointerId, note);
        setMouseDownNote(note);
      }
    }
  };

  const handlePointerUp = (e) => {
    try {
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {}

    const note = activePointerIdsRef.current.get(e.pointerId);
    if (note) {
      console.log('[PianoKeyboard] Pointer up for id:', e.pointerId, 'note:', note);
      stopNoteHelper(note);
      activePointerIdsRef.current.delete(e.pointerId);
      setMouseDownNote(null);
    }

    if (activePointerIdsRef.current.size === 0) {
      interactionModeRef.current = null;
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  return (
    <div
      className="piano-keyboard-container"
      ref={containerRef}
      tabIndex={-1}
      data-rrweb-ignore
      data-sentry-replay-ignore
      onMouseEnter={() => {
        isActiveRef.current = true;
      }}
      onMouseLeave={() => {
        isActiveRef.current = false;
      }}
      onFocus={() => {
        isActiveRef.current = true;
      }}
      onBlur={() => {
        isActiveRef.current = false;
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          width: '100%',
          maxWidth: `${width}px`,
          height: 'auto',
        }}
      />
    </div>
  );
}
