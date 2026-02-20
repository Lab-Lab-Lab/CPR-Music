// lib/midiTimeUtils.js
/**
 * Unified MIDI time conversion utilities
 * Single source of truth for beat ↔ second ↔ pixel conversions
 * Ensures consistent timing across scheduler, renderer, and playhead
 *
 * ## Edge Cases & Testing Considerations
 *
 * ### Zero and Negative Values
 * - tempo=0: Will cause division by zero in secondsToTicks/Beats
 * - ppq=0: Will cause division by zero
 * - pixelsPerBeat=0: Will cause division by zero in pixelsToBeats
 * - Negative times: Most functions allow negative (for scrubbing before start)
 *
 * ### Floating Point Precision
 * - beatsToTicks rounds to nearest integer
 * - Accumulated floating point error may occur in long sequences
 * - Use Math.round() when converting final pixel positions
 *
 * ### Extreme Values
 * - Very high tempo (>300 BPM): Sub-millisecond timing precision issues
 * - Very low tempo (<20 BPM): Large lookahead windows needed
 * - Very high PPQ (>960): Increased memory for tick arrays
 *
 * ### MIDI Note Validation
 * - validateMidiNote returns null for invalid notes (unless strict mode)
 * - Duration of 0 is invalid (must be positive)
 * - Velocity is clamped to 0-1 range
 * - MIDI pitch must be 0-127 (standard MIDI range)
 *
 * PPQ/Tempo Configuration:
 * - DEFAULT_PPQ: 480 ticks per quarter note (industry standard)
 * - Tempo comes from DAWProvider context (single source of truth for playback)
 * - Track-level tempo/PPQ can override for imported MIDI files
 *
 * Precedence for PPQ (highest to lowest):
 * 1. track.midiData.ppq (imported MIDI file's original resolution)
 * 2. track.ppq (manually set)
 * 3. DEFAULT_PPQ (480)
 *
 * Precedence for Tempo (highest to lowest):
 * 1. Global DAW tempo (from DAWProvider - used for playback)
 * 2. track.midiData.tempo (imported MIDI file's tempo)
 * 3. DEFAULT_TEMPO (120 BPM)
 */

/**
 * Default PPQ (Pulses Per Quarter note / ticks per beat)
 * 480 is the industry standard for most DAWs and MIDI files
 */
export const DEFAULT_PPQ = 480;

/**
 * Default tempo in BPM
 */
export const DEFAULT_TEMPO = 120;

/**
 * Get PPQ from a track object with clear precedence
 * @param {Object} track - Track object that may contain ppq
 * @returns {number} PPQ value (defaults to 480)
 */
export function getPPQ(track) {
  // Priority 1: Imported MIDI file's PPQ
  const midiPPQ = Number(track?.midiData?.ppq);
  if (Number.isFinite(midiPPQ) && midiPPQ > 0) {
    return midiPPQ;
  }

  // Priority 2: Track-level PPQ
  const trackPPQ = Number(track?.ppq);
  if (Number.isFinite(trackPPQ) && trackPPQ > 0) {
    return trackPPQ;
  }

  // Default
  return DEFAULT_PPQ;
}

/**
 * Get tempo for a track, with clear precedence
 * @param {Object} track - Track object that may contain tempo info
 * @param {number} globalTempo - Global DAW tempo (takes precedence for playback)
 * @returns {number} Tempo in BPM
 */
export function getTrackTempo(track, globalTempo = null) {
  // For playback, global tempo always takes precedence
  if (globalTempo !== null) {
    const global = Number(globalTempo);
    if (Number.isFinite(global) && global > 0) {
      return global;
    }
  }

  // Fallback to track's MIDI data tempo
  const midiTempo = Number(track?.midiData?.tempo ?? track?.midiData?.bpm);
  if (Number.isFinite(midiTempo) && midiTempo > 0) {
    return midiTempo;
  }

  // Default
  return DEFAULT_TEMPO;
}

/**
 * Convert ticks to seconds
 * @param {number} ticks - Time in MIDI ticks
 * @param {number} tempo - Tempo in BPM
 * @param {number} ppq - Pulses per quarter note
 * @returns {number} Time in seconds
 */
export function ticksToSeconds(ticks, tempo = DEFAULT_TEMPO, ppq = DEFAULT_PPQ) {
  const secondsPerBeat = 60 / tempo;
  const secondsPerTick = secondsPerBeat / ppq;
  return ticks * secondsPerTick;
}

/**
 * Convert seconds to ticks
 * @param {number} seconds - Time in seconds
 * @param {number} tempo - Tempo in BPM
 * @param {number} ppq - Pulses per quarter note
 * @returns {number} Time in MIDI ticks
 */
export function secondsToTicks(seconds, tempo = DEFAULT_TEMPO, ppq = DEFAULT_PPQ) {
  const beatsPerSecond = tempo / 60;
  const ticksPerSecond = beatsPerSecond * ppq;
  return seconds * ticksPerSecond;
}

/**
 * Convert ticks to beats
 * @param {number} ticks - Time in MIDI ticks
 * @param {number} ppq - Pulses per quarter note
 * @returns {number} Time in beats
 */
export function ticksToBeats(ticks, ppq = DEFAULT_PPQ) {
  return ticks / ppq;
}

/**
 * Convert beats to ticks
 * @param {number} beats - Time in beats
 * @param {number} ppq - Pulses per quarter note
 * @returns {number} Time in MIDI ticks (rounded)
 */
export function beatsToTicks(beats, ppq = DEFAULT_PPQ) {
  return Math.round(beats * ppq);
}

/**
 * Convert beats to seconds
 * @param {number} beats - Time in beats
 * @param {number} tempo - Tempo in BPM
 * @returns {number} Time in seconds
 */
export function beatsToSeconds(beats, tempo = 120) {
  const secondsPerBeat = 60 / tempo;
  return beats * secondsPerBeat;
}

/**
 * Convert seconds to beats
 * @param {number} seconds - Time in seconds
 * @param {number} tempo - Tempo in BPM
 * @returns {number} Time in beats
 */
export function secondsToBeats(seconds, tempo = 120) {
  const beatsPerSecond = tempo / 60;
  return seconds * beatsPerSecond;
}

/**
 * Convert beats to pixels
 * @param {number} beats - Time in beats
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Position in pixels
 */
export function beatsToPixels(beats, pixelsPerBeat) {
  return beats * pixelsPerBeat;
}

/**
 * Convert pixels to beats
 * @param {number} pixels - Position in pixels
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Time in beats
 */
export function pixelsToBeats(pixels, pixelsPerBeat) {
  return pixels / pixelsPerBeat;
}

/**
 * Convert seconds to pixels (composite conversion)
 * @param {number} seconds - Time in seconds
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Position in pixels
 */
export function secondsToPixels(seconds, tempo, pixelsPerBeat) {
  const beats = secondsToBeats(seconds, tempo);
  return beatsToPixels(beats, pixelsPerBeat);
}

/**
 * Convert pixels to seconds (composite conversion)
 * @param {number} pixels - Position in pixels
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Time in seconds
 */
export function pixelsToSeconds(pixels, tempo, pixelsPerBeat) {
  const beats = pixelsToBeats(pixels, pixelsPerBeat);
  return beatsToSeconds(beats, tempo);
}

/**
 * Snap time to grid
 * @param {number} time - Time in beats
 * @param {number} snapValue - Grid value in beats (e.g., 0.25 for 1/16 note)
 * @returns {number} Snapped time in beats
 */
export function snapToGrid(time, snapValue) {
  if (snapValue === 0) return time;
  return Math.round(time / snapValue) * snapValue;
}

/**
 * Calculate playhead position in pixels
 * @param {number} currentTimeSeconds - Current time in seconds
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Playhead position in pixels
 */
export function calculatePlayheadPosition(currentTimeSeconds, tempo, pixelsPerBeat) {
  return secondsToPixels(currentTimeSeconds, tempo, pixelsPerBeat);
}

/**
 * Calculate note visual properties for rendering
 * @param {Object} note - Note object with startTime (beats) and duration (beats)
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @param {number} viewportFirstBeat - First visible beat in viewport
 * @returns {Object} Object with x, width in pixels
 */
export function calculateNoteVisuals(note, pixelsPerBeat, viewportFirstBeat = 0) {
  const x = beatsToPixels(note.startTime - viewportFirstBeat, pixelsPerBeat);
  const width = Math.max(1, beatsToPixels(note.duration, pixelsPerBeat));

  return { x, width };
}

/**
 * Get audio context time for a beat position
 * Used for sample-accurate scheduling
 * @param {number} beat - Beat position
 * @param {number} tempo - Tempo in BPM
 * @param {number} startTime - Audio context start time reference
 * @returns {number} Audio context time
 */
export function beatToAudioTime(beat, tempo, startTime) {
  return startTime + beatsToSeconds(beat, tempo);
}

/**
 * MIDI Note Formats:
 *
 * Format A: Beat-based (used by PianoRoll, pattern editor)
 *   { note: 60, startTime: 0, duration: 1, velocity: 0.8 }
 *   - startTime: position in beats
 *   - duration: length in beats
 *
 * Format B: Seconds-based (used by scheduler after conversion)
 *   { note: 60, startTime: 0.5, duration: 0.5, velocity: 0.8 }
 *   - startTime: position in seconds
 *   - duration: length in seconds
 *
 * Both formats share: note (MIDI pitch 0-127), velocity (0-1)
 */

/**
 * Validate a single MIDI note object
 * @param {Object} note - Note object to validate
 * @param {Object} options - Validation options
 * @param {string} options.format - Expected format: 'beats' or 'seconds'
 * @param {boolean} options.strict - Throw on invalid note vs return null
 * @param {number} options.maxDuration - Maximum valid duration (default: 3600 for seconds, 1000 for beats)
 * @returns {Object|null} Validated note or null if invalid
 */
export function validateMidiNote(note, options = {}) {
  const { format = 'beats', strict = false, maxDuration } = options;
  const maxDur = maxDuration || (format === 'seconds' ? 3600 : 1000);

  const errors = [];

  // Check if note object exists
  if (!note || typeof note !== 'object') {
    if (strict) throw new Error('MIDI note must be an object');
    return null;
  }

  // Validate pitch (MIDI note number)
  const pitch = Number(note.note);
  if (!Number.isFinite(pitch) || pitch < 0 || pitch > 127) {
    errors.push(`Invalid MIDI pitch: ${note.note} (expected 0-127)`);
  }

  // Validate startTime
  const startTime = Number(note.startTime);
  if (!Number.isFinite(startTime) || startTime < 0) {
    errors.push(`Invalid startTime: ${note.startTime} (expected non-negative number)`);
  }

  // Validate duration
  const duration = Number(note.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    errors.push(`Invalid duration: ${note.duration} (expected positive number)`);
  } else if (duration > maxDur) {
    errors.push(`Duration ${duration} exceeds maximum ${maxDur}`);
  }

  // Validate velocity (optional, defaults to 0.8)
  const velocity = note.velocity !== undefined ? Number(note.velocity) : 0.8;
  if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) {
    errors.push(`Invalid velocity: ${note.velocity} (expected 0-1)`);
  }

  if (errors.length > 0) {
    if (strict) {
      throw new Error(`Invalid MIDI note: ${errors.join(', ')}`);
    }
    return null;
  }

  // Return normalized note
  return {
    note: Math.round(pitch),
    startTime,
    duration,
    velocity: Math.max(0, Math.min(1, velocity)),
  };
}

/**
 * Validate and filter an array of MIDI notes
 * @param {Array} notes - Array of note objects
 * @param {Object} options - Validation options (see validateMidiNote)
 * @returns {Object} { valid: Array, invalid: Array, warnings: Array }
 */
export function validateMidiNotes(notes, options = {}) {
  const { format = 'beats', strict = false, maxDuration, warnOnInvalid = true } = options;

  if (!Array.isArray(notes)) {
    if (strict) throw new Error('Notes must be an array');
    return { valid: [], invalid: [], warnings: ['Notes input was not an array'] };
  }

  const valid = [];
  const invalid = [];
  const warnings = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const validated = validateMidiNote(note, { format, strict: false, maxDuration });

    if (validated) {
      valid.push(validated);
    } else {
      invalid.push({ index: i, original: note });
      if (warnOnInvalid) {
        warnings.push(`Note at index ${i} is invalid: ${JSON.stringify(note)}`);
      }
    }
  }

  return { valid, invalid, warnings };
}

/**
 * Convert notes from beats format to seconds format
 * @param {Array} notes - Array of notes in beats format
 * @param {number} tempo - Tempo in BPM
 * @param {Object} options - Validation options
 * @returns {Array} Notes in seconds format
 */
export function convertNotesToSeconds(notes, tempo, options = {}) {
  const { validate = true } = options;

  let notesToConvert = notes;

  // Optionally validate first
  if (validate) {
    const { valid, warnings } = validateMidiNotes(notes, { format: 'beats', ...options });
    notesToConvert = valid;
    if (warnings.length > 0 && options.onWarning) {
      warnings.forEach(w => options.onWarning(w));
    }
  }

  return notesToConvert.map(note => ({
    note: note.note,
    startTime: beatsToSeconds(note.startTime, tempo),
    duration: beatsToSeconds(note.duration, tempo),
    velocity: note.velocity,
  }));
}

/**
 * Convert notes from seconds format to beats format
 * @param {Array} notes - Array of notes in seconds format
 * @param {number} tempo - Tempo in BPM
 * @param {Object} options - Validation options
 * @returns {Array} Notes in beats format
 */
export function convertNotesToBeats(notes, tempo, options = {}) {
  const { validate = true } = options;

  let notesToConvert = notes;

  // Optionally validate first
  if (validate) {
    const { valid, warnings } = validateMidiNotes(notes, { format: 'seconds', ...options });
    notesToConvert = valid;
    if (warnings.length > 0 && options.onWarning) {
      warnings.forEach(w => options.onWarning(w));
    }
  }

  return notesToConvert.map(note => ({
    note: note.note,
    startTime: secondsToBeats(note.startTime, tempo),
    duration: secondsToBeats(note.duration, tempo),
    velocity: note.velocity,
  }));
}
