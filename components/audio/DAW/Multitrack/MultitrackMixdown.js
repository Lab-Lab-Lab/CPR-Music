'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button, Modal, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaMixcloud } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { decodeAudioFromURL } from './AudioEngine';
import { createInstrument } from './Instruments/WebAudioInstruments';
import VoiceManager from '../../../../lib/VoiceManager';
import midiRenderCache from '../../../../lib/MIDIRenderCache';
import EnhancedSynth from '../../../../lib/EnhancedSynth';
import { processEffectsChain } from '../../../../lib/effects/UnifiedEffectsProcessor';
import { debugLog, debugWarn, debugError } from '../../../../lib/debug';
import { getPPQ, getTrackTempo, DEFAULT_PPQ, DEFAULT_TEMPO } from '../../../../lib/midiTimeUtils';

/**
 * OfflineAudioContext Manager
 * Tracks active contexts and provides cleanup functionality
 * Prevents memory leaks from orphaned audio contexts
 */
class OfflineContextManager {
  constructor() {
    this.activeContexts = new Map(); // id -> { context, createdAt, purpose }
    this.contextIdCounter = 0;
    this.maxConcurrent = 10; // Maximum concurrent contexts before warning
  }

  /**
   * Create a managed OfflineAudioContext
   * @param {number} channels - Number of channels
   * @param {number} length - Length in samples
   * @param {number} sampleRate - Sample rate
   * @param {string} purpose - Description for debugging
   * @returns {Object} { context, id, cleanup }
   */
  create(channels, length, sampleRate, purpose = 'unknown') {
    // Validate parameters
    if (!Number.isFinite(length) || length <= 0) {
      throw new Error(`Invalid OfflineAudioContext length: ${length}`);
    }
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error(`Invalid OfflineAudioContext sampleRate: ${sampleRate}`);
    }

    // Warn if too many concurrent contexts
    if (this.activeContexts.size >= this.maxConcurrent) {
      debugWarn('OfflineContextManager',
        `High number of active contexts (${this.activeContexts.size}). ` +
        `Consider cleaning up old contexts to prevent memory issues.`
      );
    }

    const id = `offline_${++this.contextIdCounter}_${Date.now()}`;
    const context = new OfflineAudioContext(channels, length, sampleRate);

    this.activeContexts.set(id, {
      context,
      createdAt: Date.now(),
      purpose,
      length,
      sampleRate,
    });

    debugLog('OfflineContextManager',
      `Created context ${id} for "${purpose}" (${(length / sampleRate).toFixed(2)}s, ${this.activeContexts.size} active)`
    );

    // Return context with cleanup function
    const cleanup = () => this.release(id);

    return { context, id, cleanup };
  }

  /**
   * Release a context and its resources
   */
  release(id) {
    const entry = this.activeContexts.get(id);
    if (!entry) return false;

    this.activeContexts.delete(id);
    debugLog('OfflineContextManager',
      `Released context ${id} (${this.activeContexts.size} remaining)`
    );

    return true;
  }

  /**
   * Release all contexts older than maxAgeMs
   */
  releaseStale(maxAgeMs = 5 * 60 * 1000) { // Default 5 minutes
    const now = Date.now();
    let released = 0;

    for (const [id, entry] of this.activeContexts.entries()) {
      if (now - entry.createdAt > maxAgeMs) {
        this.activeContexts.delete(id);
        released++;
        debugLog('OfflineContextManager', `Released stale context ${id} (age: ${((now - entry.createdAt) / 1000).toFixed(0)}s)`);
      }
    }

    if (released > 0) {
      debugLog('OfflineContextManager', `Released ${released} stale contexts`);
    }

    return released;
  }

  /**
   * Release all contexts
   */
  releaseAll() {
    const count = this.activeContexts.size;
    this.activeContexts.clear();
    debugLog('OfflineContextManager', `Released all ${count} contexts`);
    return count;
  }

  /**
   * Get stats about active contexts
   */
  getStats() {
    const stats = {
      activeCount: this.activeContexts.size,
      totalCreated: this.contextIdCounter,
      contexts: [],
    };

    for (const [id, entry] of this.activeContexts.entries()) {
      stats.contexts.push({
        id,
        purpose: entry.purpose,
        ageMs: Date.now() - entry.createdAt,
        durationSec: entry.length / entry.sampleRate,
      });
    }

    return stats;
  }

  /**
   * Render an OfflineAudioContext with timeout and progress tracking
   *
   * @param {OfflineAudioContext} context - The context to render
   * @param {Object} options - Rendering options
   * @param {number} options.timeoutMs - Maximum time to wait (default: 60000ms = 1 minute)
   * @param {Function} options.onProgress - Progress callback: (percent, elapsedMs) => void
   * @param {number} options.progressIntervalMs - How often to call onProgress (default: 500ms)
   * @returns {Promise<AudioBuffer>} The rendered audio buffer
   * @throws {Error} If rendering times out or fails
   */
  async renderWithTimeout(context, options = {}) {
    const {
      timeoutMs = 60000,
      onProgress = null,
      progressIntervalMs = 500,
    } = options;

    const startTime = Date.now();
    const expectedDuration = context.length / context.sampleRate;

    // Calculate reasonable timeout based on audio length
    // Allow at least 2x real-time for complex processing, minimum 30s
    const adaptiveTimeout = Math.max(
      timeoutMs,
      Math.max(30000, expectedDuration * 2000)
    );

    let progressInterval = null;
    let lastProgress = 0;

    // Set up progress tracking
    if (onProgress) {
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Estimate progress based on elapsed time vs expected
        // This is approximate since we can't get actual render progress
        const estimatedProgress = Math.min(
          99,
          Math.round((elapsed / (expectedDuration * 1000)) * 100)
        );

        if (estimatedProgress > lastProgress) {
          lastProgress = estimatedProgress;
          onProgress(estimatedProgress, elapsed);
        }
      }, progressIntervalMs);
    }

    try {
      // Create a promise race between rendering and timeout
      const renderPromise = context.startRendering();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(
            `Offline rendering timed out after ${adaptiveTimeout}ms ` +
            `(expected ~${expectedDuration.toFixed(1)}s of audio)`
          ));
        }, adaptiveTimeout);
      });

      const buffer = await Promise.race([renderPromise, timeoutPromise]);

      // Report completion
      if (onProgress) {
        onProgress(100, Date.now() - startTime);
      }

      const renderTime = Date.now() - startTime;
      const realtimeRatio = renderTime / (expectedDuration * 1000);

      debugLog('OfflineContextManager',
        `Rendered ${expectedDuration.toFixed(2)}s in ${renderTime}ms ` +
        `(${realtimeRatio.toFixed(2)}x real-time)`
      );

      return buffer;
    } catch (error) {
      debugError('OfflineContextManager', `Render failed: ${error.message}`);
      throw error;
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    }
  }
}

// Singleton instance
const offlineContextManager = new OfflineContextManager();

// Cleanup stale contexts periodically (every 2 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    offlineContextManager.releaseStale();
  }, 2 * 60 * 1000);

  // Cleanup all on page unload
  window.addEventListener('beforeunload', () => {
    offlineContextManager.releaseAll();
  });
}

/** Numeric helper: safe conversion with default */
function toNumber(val, def = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

/**
 * Helpers — MIDI
 */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function freqToMidi(freq) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function noteNameToMidi(name) {
  if (typeof name !== 'string') return null;
  const m = name.trim().match(/^([A-Ga-g])([#b♯♭]?)(-?\d{1,2})$/);
  if (!m) return null;
  const letters = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const base = letters[m[1].toLowerCase()];
  const acc =
    m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const octave = Number(m[3]);
  return 12 * (octave + 1) + base + acc;
}

// Soft-clip curve for master bus (prevents render-time clipping)
function makeSoftClipCurve(samples = 4096, drive = 0.85) {
  const curve = new Float32Array(samples);
  const k = Math.max(0.001, drive) * 10 + 1;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

/**
 * Compute track-level MIDI time offset in seconds.
 *
 * OFFSET PRECEDENCE (highest to lowest priority):
 * 1. track.midiOffsetSec - Explicit offset in seconds (highest priority)
 * 2. track.midiOffsetBeats - Explicit offset in beats
 * 3. track.pianoRollOffsetSec - Piano roll specific offset in seconds
 * 4. track.pianoRollOffsetBeats - Piano roll specific offset in beats
 * 5. track.midiData.offsetSec - MIDI data embedded offset in seconds
 * 6. track.midiData.offsetBeats - MIDI data embedded offset in beats
 * 7. track.piano.offsetSec - Legacy piano offset
 * 8. track.start (only for MIDI tracks) - Track start position in seconds
 * 9. track.startBeat (only for MIDI tracks) - Track start position in beats
 *
 * IMPORTANT: Only ONE offset source should be used per category to avoid double-counting.
 * The function uses precedence-based selection, not accumulation.
 *
 * @param {Object} track - Track object containing offset information
 * @param {number} secPerBeat - Seconds per beat for beat-to-seconds conversion
 * @param {Object} options - Optional configuration
 * @param {boolean} options.warnOnMultiple - Log warning if multiple offset sources found (default: true in debug mode)
 * @returns {number} Offset in seconds (always >= 0)
 */
function getTrackMidiBaseOffsetSec(track, secPerBeat, options = {}) {
  if (!track) return 0;

  const { warnOnMultiple = true } = options;
  const foundSources = [];

  // Helper to safely convert to number
  const toSec = (val, source) => {
    const n = Number(val);
    if (Number.isFinite(n) && n !== 0) {
      foundSources.push({ source, value: n, unit: 'sec' });
      return n;
    }
    return null;
  };

  const toSecFromBeats = (val, source) => {
    const n = Number(val);
    if (Number.isFinite(n) && n !== 0 && Number.isFinite(secPerBeat)) {
      const sec = n * secPerBeat;
      foundSources.push({ source, value: n, unit: 'beats', convertedSec: sec });
      return sec;
    }
    return null;
  };

  // Determine offset using precedence (first valid value wins per category)
  let offsetSec = 0;

  // Category 1: Explicit track-level offset (prefer seconds over beats)
  const explicitSecOffset = toSec(track.midiOffsetSec, 'track.midiOffsetSec');
  const explicitBeatOffset = toSecFromBeats(track.midiOffsetBeats, 'track.midiOffsetBeats');

  if (explicitSecOffset !== null) {
    offsetSec = explicitSecOffset;
  } else if (explicitBeatOffset !== null) {
    offsetSec = explicitBeatOffset;
  }

  // Category 2: Piano roll offset (only if no explicit offset)
  if (offsetSec === 0) {
    const pianoSecOffset = toSec(track.pianoRollOffsetSec, 'track.pianoRollOffsetSec');
    const pianoBeatOffset = toSecFromBeats(track.pianoRollOffsetBeats, 'track.pianoRollOffsetBeats');

    if (pianoSecOffset !== null) {
      offsetSec = pianoSecOffset;
    } else if (pianoBeatOffset !== null) {
      offsetSec = pianoBeatOffset;
    }
  }

  // Category 3: MIDI data embedded offset (only if no higher priority offset)
  if (offsetSec === 0 && track.midiData) {
    const midiDataSecOffset = toSec(track.midiData.offsetSec, 'track.midiData.offsetSec');
    const midiDataBeatOffset = toSecFromBeats(track.midiData.offsetBeats, 'track.midiData.offsetBeats');

    if (midiDataSecOffset !== null) {
      offsetSec = midiDataSecOffset;
    } else if (midiDataBeatOffset !== null) {
      offsetSec = midiDataBeatOffset;
    }
  }

  // Category 4: Legacy piano offset
  if (offsetSec === 0 && track.piano) {
    const pianoOffsetSec = toSec(track.piano.offsetSec, 'track.piano.offsetSec');
    if (pianoOffsetSec !== null) {
      offsetSec = pianoOffsetSec;
    }
  }

  // Category 5: Track start position (only for MIDI tracks)
  if (offsetSec === 0 && (track.type === 'midi' || track.kind === 'midi')) {
    const startSecOffset = toSec(track.start, 'track.start');
    const startBeatOffset = toSecFromBeats(track.startBeat, 'track.startBeat');

    if (startSecOffset !== null) {
      offsetSec = startSecOffset;
    } else if (startBeatOffset !== null) {
      offsetSec = startBeatOffset;
    }
  }

  // Warn if multiple offset sources were found (potential data inconsistency)
  if (warnOnMultiple && foundSources.length > 1) {
    debugWarn('MultitrackMixdown',
      `Track "${track.name || track.id || 'unknown'}" has ${foundSources.length} offset sources defined. ` +
      `Using highest priority: ${foundSources[0]?.source}. ` +
      `Other sources: ${foundSources.slice(1).map(s => s.source).join(', ')}`
    );
  }

  // Validate result
  const result = Math.max(0, offsetSec);

  // Warn if offset seems unreasonably large (> 10 minutes)
  if (result > 600) {
    debugWarn('MultitrackMixdown',
      `Track "${track.name || track.id || 'unknown'}" has unusually large offset: ${result.toFixed(2)}s`
    );
  }

  return result;
}

// NOTE: getPPQ is now imported from midiTimeUtils.js for consistency
// It provides the same functionality with documented precedence

function collectTrackMidiNotes(track, tempo = { bpm: 120, stepsPerBeat: 4 }) {
  const out = [];

  // Tempo & conversion helpers
  const bpm =
    Number(tempo?.bpm) ||
    Number(track?.midiData?.tempo || track?.midiData?.bpm) ||
    120;
  const secPerBeat = 60 / bpm;
  const stepsPerBeat = Number(tempo?.stepsPerBeat) || 4; // for step sequencers

  const ppq = getPPQ(track);
  const secPerTick = secPerBeat / ppq;

  const baseOffsetSec = getTrackMidiBaseOffsetSec(track, secPerBeat);

  const timeFromNote = (n) => {
    // Check if we have startTime
    if (Number.isFinite(n.startTime)) {
      return Math.max(0, n.startTime * secPerBeat);
    }

    // Then check other beat-based fields
    const tb = toNumber(n.timeBeats ?? n.startBeat ?? n.beat, NaN);
    if (Number.isFinite(tb)) return Math.max(0, tb * secPerBeat);

    const tk = toNumber(n.ticks ?? n.tick ?? n.startTick, NaN);
    if (Number.isFinite(tk)) return Math.max(0, tk * secPerTick);

    // Only use these fields if they're actually in seconds
    const ts = toNumber(
      n.time ??
        n.start ??
        n.t ??
        n.timeSec ??
        n.startSec ??
        n.ts ??
        n.pos ??
        n.position ??
        n.absSec ??
        n.posSec ??
        n.positionSec ??
        n.startTimeSec,
      NaN,
    );
    if (Number.isFinite(ts)) return Math.max(0, ts);
    return 0;
  };

  const durationFromNote = (n, timeHint = 0) => {
    // Check if we have duration
    if (Number.isFinite(n.duration)) {
      return Math.max(0, n.duration * secPerBeat);
    }

    // Then check other beat-based fields
    const baseBeat = toNumber(
      n.timeBeats ?? n.startBeat ?? n.beat ?? n.startTime,
      NaN,
    );
    const db = toNumber(
      n.durationBeats ??
        n.lenBeats ??
        n.beats ??
        n.gateBeats ??
        (Number.isFinite(toNumber(n.endBeats ?? n.endBeat, NaN)) &&
        Number.isFinite(baseBeat)
          ? toNumber(n.endBeats ?? n.endBeat, NaN) - baseBeat
          : NaN),
      NaN,
    );
    if (Number.isFinite(db)) return Math.max(0, db * secPerBeat);

    const dtk = toNumber(
      n.durationTicks ??
        n.lenTicks ??
        n.ticksLen ??
        (Number.isFinite(toNumber(n.endTick ?? n.endTicks, NaN)) &&
        Number.isFinite(toNumber(n.startTick ?? n.tick ?? n.ticks, NaN))
          ? toNumber(n.endTick ?? n.endTicks, NaN) -
            toNumber(n.startTick ?? n.tick ?? n.ticks, NaN)
          : NaN),
      NaN,
    );
    if (Number.isFinite(dtk)) return Math.max(0, dtk * secPerTick);

    // Only use these if they're actually duration in seconds
    const ds = toNumber(n.len ?? n.length ?? n.durationSec, NaN);
    if (Number.isFinite(ds)) return Math.max(0, ds);

    const endB = toNumber(n.endBeats ?? n.endBeat, NaN);
    if (Number.isFinite(endB) && Number.isFinite(baseBeat)) {
      return Math.max(0, (endB - baseBeat) * secPerBeat);
    }

    const endTk = toNumber(n.endTick ?? n.endTicks, NaN);
    const startTk = toNumber(
      n.startTick ?? n.tick ?? n.ticks ?? n.startTime,
      NaN,
    );
    if (Number.isFinite(endTk) && Number.isFinite(startTk)) {
      return Math.max(0, (endTk - startTk) * secPerTick);
    }

    // Fallback for end time in seconds
    const startS = Number.isFinite(timeHint)
      ? timeHint
      : Math.max(
          0,
          toNumber(
            n.time ??
              n.start ??
              n.t ??
              n.startSec ??
              n.timeSec ??
              n.startTimeSec,
            0,
          ),
        );
    const endS = toNumber(n.end ?? n.endTime ?? n.endSec, NaN);
    if (Number.isFinite(endS)) return Math.max(0, endS - startS);

    return 0;
  };

  const pushNote = (n, extraOffsetSec = 0) => {
    if (!n) return;
    const timeLocal = timeFromNote(n);
    const time = Math.max(
      0,
      timeLocal +
        baseOffsetSec +
        (Number.isFinite(extraOffsetSec) ? extraOffsetSec : 0),
    );
    const dur = durationFromNote(n, timeLocal);
    if (!(dur > 0)) return;
    const vel = Math.max(
      0,
      Math.min(1, toNumber(n.velocity ?? n.vel ?? n.v, 1)),
    );

    let midi = n.midi ?? n.note ?? n.noteNumber ?? n.pitch ?? n.key;
    let freq = n.freq ?? n.frequency;
    if (typeof midi === 'string') midi = noteNameToMidi(midi);
    if (typeof midi === 'number' && !freq) freq = midiToFreq(midi);
    if (typeof freq !== 'number' || !(freq > 0)) return;

    out.push({ time, duration: Math.max(0, dur), velocity: vel, freq });
  };

  // 1) Common shapes (including midiData.notes)
  try {
    (track?.midi?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.midiNotes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.sequence?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.pattern?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.midiData?.notes || []).forEach((n) => pushNote(n));
  } catch {}

  // 2) Objects that expose getters
  try {
    if (track?.midiTrack?.getNotes) {
      (track.midiTrack.getNotes() || []).forEach((n) => pushNote(n));
    } else if (Array.isArray(track?.midiTrack?.notes)) {
      track.midiTrack.notes.forEach((n) => pushNote(n));
    }
  } catch {}

  // 2b) MIDI clips/regions where notes are clip-relative; add clip.start/beat
  try {
    const clipArrays = [];
    if (Array.isArray(track?.midiClips)) clipArrays.push(...track.midiClips);
    if (Array.isArray(track?.midiRegions))
      clipArrays.push(...track.midiRegions);
    // Some apps store MIDI clips inside generic clips if they have notes
    if (Array.isArray(track?.clips)) {
      track.clips.forEach((c) => {
        if (Array.isArray(c?.notes)) clipArrays.push(c);
      });
    }

    clipArrays.forEach((clip) => {
      const clipOffsetSec =
        Math.max(0, toNumber(clip?.start ?? clip?.startSec, 0)) +
        (Number.isFinite(
          toNumber(clip?.startBeat ?? clip?.timeBeats ?? clip?.beat, NaN),
        )
          ? toNumber(clip?.startBeat ?? clip?.timeBeats ?? clip?.beat)
          : 0) *
          secPerBeat;

      (clip?.notes || []).forEach((n) => pushNote(n, clipOffsetSec));

      // If events are clip-local and self-contained with duration, push them as notes
      const evs = (clip?.events || clip?.midiEvents || []).filter(Boolean);
      evs.forEach((e) => {
        if (e && (e.duration != null || e.durationBeats != null)) {
          pushNote(e, clipOffsetSec);
        }
      });
    });
  } catch {}

  // 3) Pair note-on/off from event streams
  try {
    const evs = (
      track?.events ||
      track?.midiEvents ||
      track?.eventQueue ||
      []
    ).filter(Boolean);
    if (evs.length) {
      const active = new Map(); // key: midi (or freq), value: {time, velocity, freq}
      const normType = (t) => String(t || '').toLowerCase();

      for (const e of evs) {
        const type = normType(e.type || e.kind || e.name);
        let midi = e.midi ?? e.note ?? e.noteNumber ?? e.pitch ?? e.key;
        if (typeof midi === 'string') midi = noteNameToMidi(midi);
        let freq = e.freq ?? e.frequency;
        if (typeof midi === 'number' && !freq) freq = midiToFreq(midi);
        const key =
          typeof midi === 'number'
            ? `m${midi}`
            : typeof freq === 'number'
              ? `f${freq}`
              : null;
        if (!key) continue;

        // Time/velocity — prefer beats → ticks → seconds
        let t;
        const tb = toNumber(e.timeBeats ?? e.startBeat ?? e.beat, NaN);
        if (Number.isFinite(tb)) {
          t = tb * secPerBeat;
        } else {
          const tk = toNumber(e.ticks ?? e.tick ?? e.startTick, NaN);
          if (Number.isFinite(tk)) {
            t = tk * secPerTick;
          } else {
            const ts = toNumber(
              e.time ??
                e.start ??
                e.t ??
                e.timeSec ??
                e.startSec ??
                e.ts ??
                e.pos ??
                e.position ??
                e.posSec ??
                e.positionSec,
              NaN,
            );
            t = Number.isFinite(ts) ? ts : 0;
          }
        }
        t = Math.max(0, t + baseOffsetSec);
        const v = Math.max(
          0,
          Math.min(1, toNumber(e.velocity ?? e.vel ?? e.v, 1)),
        );

        if (type.includes('noteon') || type === 'on' || type === 'down') {
          active.set(key, {
            time: t,
            velocity: v,
            freq:
              freq || (typeof midi === 'number' ? midiToFreq(midi) : undefined),
          });
        } else if (
          type.includes('noteoff') ||
          type === 'off' ||
          type === 'up'
        ) {
          const a = active.get(key);
          if (a) {
            let d = toNumber(e.duration, NaN);
            if (!Number.isFinite(d)) d = toNumber(e.len, NaN);
            if (!Number.isFinite(d)) d = toNumber(e.length, NaN);
            if (!Number.isFinite(d)) {
              const db =
                e.durationBeats != null
                  ? e.durationBeats
                  : e.lenBeats != null
                    ? e.lenBeats
                    : e.beats != null
                      ? e.beats
                      : e.gateBeats != null
                        ? e.gateBeats
                        : null;
              d = db != null ? toNumber(db, 0) * secPerBeat : t - a.time;
            }
            if (!Number.isFinite(d)) {
              const dtk = toNumber(
                e.durationTicks ??
                  e.lenTicks ??
                  (Number.isFinite(toNumber(e.endTick ?? e.endTicks, NaN)) &&
                  Number.isFinite(
                    toNumber(e.startTick ?? e.tick ?? e.ticks, NaN),
                  )
                    ? toNumber(e.endTick ?? e.endTicks, NaN) -
                      toNumber(e.startTick ?? e.tick ?? e.ticks, NaN)
                    : NaN),
                NaN,
              );
              if (Number.isFinite(dtk)) d = dtk * secPerTick;
            }
            const dur = Math.max(0, d);
            if (dur > 0)
              out.push({
                time: a.time,
                duration: dur,
                velocity: a.velocity,
                freq: a.freq,
              });
            active.delete(key);
          }
        } else if (e.duration != null || e.durationBeats != null) {
          const d = durationFromNote(e);
          if (d > 0) pushNote({ time: t, duration: d, velocity: v, freq });
        }
      }
      // Any hanging notes – short default
      for (const [, a] of active) {
        const dur = 0.2;
        out.push({
          time: a.time,
          duration: dur,
          velocity: a.velocity,
          freq: a.freq,
        });
      }
    }
  } catch {}

  // 4) Step sequencer grids → seconds using tempo hints
  try {
    const seq = track?.stepSequencer || track?.sequencer || track?.steps;
    const steps = Array.isArray(seq?.steps)
      ? seq.steps
      : Array.isArray(seq)
        ? seq
        : [];
    if (steps && steps.length) {
      const secPerStep = secPerBeat / stepsPerBeat;

      steps.forEach((row) => {
        const cells = Array.isArray(row?.cells)
          ? row.cells
          : Array.isArray(row)
            ? row
            : [];
        const pitch = row?.pitch ?? row?.midi ?? row?.note ?? row?.key;
        const baseMidi =
          typeof pitch === 'string'
            ? noteNameToMidi(pitch)
            : typeof pitch === 'number'
              ? pitch
              : null;
        const baseFreq = baseMidi != null ? midiToFreq(baseMidi) : undefined;

        cells.forEach((cell, i) => {
          const on = !!(
            cell?.on ??
            cell?.active ??
            (cell === 1 || cell === true)
          );
          if (!on) return;
          const lenSteps = toNumber(cell?.len ?? cell?.length ?? cell?.gate, 1);
          const vel = Math.max(
            0,
            Math.min(1, toNumber(cell?.vel ?? cell?.velocity, 1)),
          );
          let freq = cell?.freq ?? cell?.frequency;
          if (!freq) {
            let m = cell?.midi ?? cell?.note ?? cell?.noteNumber ?? baseMidi;
            if (typeof m === 'string') m = noteNameToMidi(m);
            if (typeof m === 'number') freq = midiToFreq(m);
            else if (baseFreq) freq = baseFreq;
          }
          if (!freq) return;
          const t =
            toNumber(cell?.i ?? cell?.index ?? i, 0) * secPerStep +
            baseOffsetSec;
          const dur = Math.max(
            0,
            toNumber(cell?.duration ?? cell?.lenSec, lenSteps * secPerStep),
          );
          if (dur > 0)
            out.push({ time: t, duration: dur, velocity: vel, freq });
        });
      });
    }
  } catch {}

  // De-duplicate identical notes that may exist in multiple containers (e.g., midiData.notes & notes)
  out.sort(
    (a, b) => a.time - b.time || a.freq - b.freq || a.duration - b.duration,
  );
  const seen = new Set();
  const dedup = [];
  const r = (x, p) => Math.round(x * p) / p; // fixed precision keying
  for (const n of out) {
    const key = `${r(n.time, 1000)}|${r(n.duration, 1000)}|${r(n.freq, 10)}`; // 1ms / 1ms / 0.1Hz
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(n);
  }
  try {
    if (typeof window !== 'undefined' && window.__MIXDOWN_DEBUG__) {
      console.log(
        '[Mixdown MIDI]',
        track?.name || track?.id || 'track',
        'notes:',
        dedup.slice(0, 24),
      );
    }
  } catch {}
  return dedup;
}

/**
 * Calculate adaptive gain staging based on mix complexity
 */
function calculateAdaptiveGain(trackCount, midiTrackCount, analogTrackCount) {
  // PROFESSIONAL GAIN STAGING - balanced for quality
  // Start with appropriate gain for clear audio
  let baseGain = 0.5; // Balanced starting point for good quality
  
  // More gentle reduction as track count increases
  const trackScale = Math.max(0.4, 1 - (Math.log(trackCount + 1) / Math.log(20)) * 0.3); // Less aggressive scaling
  
  // MIDI vs analog considerations
  const midiRatio = midiTrackCount / Math.max(1, trackCount);
  const analogRatio = analogTrackCount / Math.max(1, trackCount);
  
  // Less headroom adjustment - let the safety limiter handle peaks gracefully
  const headroomAdjust = analogRatio * 0.05; // Much smaller adjustment
  
  // Final adaptive gain with higher minimum
  const adaptiveGain = Math.max(0.2, baseGain * trackScale - headroomAdjust); // Higher minimum
  
  console.log(`🎚️ Conservative Adaptive Gain: ${trackCount} tracks (${midiTrackCount} MIDI, ${analogTrackCount} analog) → ${adaptiveGain.toFixed(3)}`);
  
  return adaptiveGain;
}

/**
 * Create intelligent EQ compensation for dense mixes
 */
function createMixEQ(audioContext, trackCount, midiTrackCount) {
  const eq = {
    lowCut: audioContext.createBiquadFilter(),
    lowShelf: audioContext.createBiquadFilter(),
    midBoost: audioContext.createBiquadFilter(),
    highShelf: audioContext.createBiquadFilter(),
    highCut: audioContext.createBiquadFilter()
  };
  
  // DC blocking high-pass (always active)
  eq.lowCut.type = 'highpass';
  eq.lowCut.frequency.value = 20;
  eq.lowCut.Q.value = 0.707;
  
  // VERY SUBTLE Low-frequency cleanup for dense mixes
  eq.lowShelf.type = 'lowshelf';
  eq.lowShelf.frequency.value = 60; // Lower frequency, more subtle
  eq.lowShelf.Q.value = 0.5; // Gentler slope
  if (trackCount > 8) {
    // Very gentle reduction only for very dense mixes
    eq.lowShelf.gain.value = -0.5; // Much more subtle
  } else {
    eq.lowShelf.gain.value = 0; // No change for most mixes
  }
  
  // VERY SUBTLE Mid-frequency presence adjustment
  eq.midBoost.type = 'peaking';
  eq.midBoost.frequency.value = 3000; // Slightly higher for clarity
  eq.midBoost.Q.value = 0.7; // Much broader, more musical
  if (midiTrackCount > trackCount * 0.7) {
    // Very subtle boost only for heavily MIDI mixes
    eq.midBoost.gain.value = 0.5; // Much more subtle
  } else {
    eq.midBoost.gain.value = 0;
  }
  
  // VERY SUBTLE High-frequency management  
  eq.highShelf.type = 'highshelf';
  eq.highShelf.frequency.value = 10000; // Higher frequency, more subtle
  eq.highShelf.Q.value = 0.5; // Gentler slope
  if (trackCount > 10) {
    // Very dense mixes only - tiny high reduction
    eq.highShelf.gain.value = -0.25; // Much more subtle
  } else if (midiTrackCount > 3) {
    // MIDI tracks - tiny presence boost
    eq.highShelf.gain.value = 0.25; // Much more subtle
  } else {
    eq.highShelf.gain.value = 0; // Most mixes get no processing
  }
  
  // Anti-aliasing/harsh digital high cut
  eq.highCut.type = 'lowpass';
  eq.highCut.frequency.value = 18000;
  eq.highCut.Q.value = 0.707;
  
  // Chain the EQ stages
  eq.lowCut.connect(eq.lowShelf);
  eq.lowShelf.connect(eq.midBoost);
  eq.midBoost.connect(eq.highShelf);
  eq.highShelf.connect(eq.highCut);
  
  console.log(`Mix EQ: ${trackCount} tracks, ${midiTrackCount} MIDI - Low: ${eq.lowShelf.gain.value}dB, Mid: ${eq.midBoost.gain.value}dB, High: ${eq.highShelf.gain.value}dB`);
  
  return {
    input: eq.lowCut,
    output: eq.highCut,
    chain: eq
  };
}

/**
 * Calculate intelligent panning to reduce center channel buildup
 */
function calculateIntelligentPanning(tracks) {
  const panAdjustments = new Map();
  
  // Count tracks by type for intelligent distribution
  const tracksByType = {
    midi: tracks.filter(t => t.type === 'midi'),
    analog: tracks.filter(t => t.type !== 'midi'),
    all: tracks
  };
  
  // If 4 or fewer tracks, keep original panning (user preference respected)
  if (tracks.length <= 4) {
    tracks.forEach(track => {
      panAdjustments.set(track.id, track.pan || 0);
    });
    console.log('Intelligent Panning: Few tracks detected, preserving user panning');
    return panAdjustments;
  }
  
  // For dense mixes, apply intelligent distribution
  const centerThreshold = 0.1; // Tracks within ±10% are considered "center"
  const centerTracks = tracks.filter(t => Math.abs(t.pan || 0) <= centerThreshold);
  
  if (centerTracks.length <= 2) {
    // Light center buildup - minor adjustments
    tracks.forEach(track => {
      panAdjustments.set(track.id, track.pan || 0);
    });
    console.log('Intelligent Panning: Light center buildup, preserving user panning');
    return panAdjustments;
  }
  
  // Heavy center buildup - apply intelligent spreading
  console.log(`Intelligent Panning: ${centerTracks.length} center tracks detected, applying intelligent spread`);
  
  const panPositions = [];
  const spreadWidth = 0.7; // Max spread ±70%
  
  // Create spread positions (avoid extreme L/R for most content)
  for (let i = 0; i < centerTracks.length; i++) {
    const position = (i / Math.max(1, centerTracks.length - 1) - 0.5) * spreadWidth;
    panPositions.push(position);
  }
  
  // Apply intelligent panning based on track characteristics
  centerTracks.forEach((track, index) => {
    let newPan = panPositions[index];
    
    // MIDI tracks can be spread wider as they're more predictable
    if (track.type === 'midi') {
      newPan *= 1.2; // Slightly wider spread for MIDI
    }
    
    // Clamp to valid range
    newPan = Math.max(-0.9, Math.min(0.9, newPan));
    panAdjustments.set(track.id, newPan);
    
    console.log(`  → Track ${track.name}: ${(track.pan || 0).toFixed(2)} → ${newPan.toFixed(2)}`);
  });
  
  // Keep non-center tracks as they are (user deliberately panned them)
  tracks.filter(t => Math.abs(t.pan || 0) > centerThreshold).forEach(track => {
    panAdjustments.set(track.id, track.pan || 0);
  });
  
  return panAdjustments;
}

/**
 * Create automatic headroom management system
 */
function createHeadroomManager(audioContext, trackCount, midiTrackCount) {
  // Calculate optimal headroom based on mix complexity
  let targetHeadroom = -3; // Default -3dB headroom
  
  // Adjust based on track count
  if (trackCount > 12) {
    targetHeadroom = -6; // More headroom for very dense mixes
  } else if (trackCount > 8) {
    targetHeadroom = -4.5; // Extra headroom for dense mixes
  } else if (trackCount <= 4) {
    targetHeadroom = -1.5; // Less headroom needed for sparse mixes
  }
  
  // MIDI tracks have more predictable levels
  const midiRatio = midiTrackCount / Math.max(1, trackCount);
  if (midiRatio > 0.7) {
    targetHeadroom += 1.5; // Less headroom needed for MIDI-heavy mixes
  }
  
  // Create adaptive compressor for headroom management
  const headroomCompressor = audioContext.createDynamicsCompressor();
  
  // Configure compressor for transparent headroom control
  headroomCompressor.threshold.value = targetHeadroom;
  headroomCompressor.knee.value = 6; // Soft knee for transparent compression
  headroomCompressor.ratio.value = 4; // Moderate ratio to preserve dynamics
  headroomCompressor.attack.value = 0.003; // Fast enough to catch peaks
  headroomCompressor.release.value = 0.1; // Quick release to avoid pumping
  
  // Create makeup gain to compensate for compression
  const makeupGain = audioContext.createGain();
  const compressionAmount = Math.abs(targetHeadroom) / 4; // Estimate compression
  makeupGain.gain.value = Math.pow(10, compressionAmount / 20); // Convert dB to linear
  
  // Chain compressor -> makeup gain
  headroomCompressor.connect(makeupGain);
  
  console.log(`Headroom Manager: ${trackCount} tracks (${midiTrackCount} MIDI) → Target: ${targetHeadroom}dB, Makeup: +${compressionAmount.toFixed(1)}dB`);
  
  return {
    input: headroomCompressor,
    output: makeupGain,
    targetHeadroom: targetHeadroom,
    compressor: headroomCompressor,
    makeupGain: makeupGain
  };
}

/**
 * Analyze mix quality and provide feedback
 */
function analyzeMixQuality(tracks, duration, adaptiveGain, targetHeadroom, panAdjustments) {
  const analysis = {
    trackCount: tracks.length,
    midiTracks: tracks.filter(t => t.type === 'midi').length,
    analogTracks: tracks.filter(t => t.type !== 'midi').length,
    duration: duration,
    adaptiveGain: adaptiveGain,
    targetHeadroom: targetHeadroom,
    quality: 'good',
    recommendations: [],
    panningChanges: 0
  };
  
  // Count panning changes made
  let panChanges = 0;
  for (const [trackId, newPan] of panAdjustments) {
    const track = tracks.find(t => t.id === trackId);
    if (track && Math.abs(newPan - (track.pan || 0)) > 0.01) {
      panChanges++;
    }
  }
  analysis.panningChanges = panChanges;
  
  // Assess overall quality based on mix complexity
  if (analysis.trackCount <= 4) {
    analysis.quality = 'excellent';
    analysis.recommendations.push('✓ Clean, focused mix with good headroom');
  } else if (analysis.trackCount <= 8) {
    analysis.quality = 'very-good';
    analysis.recommendations.push('✓ Well-balanced mix with adequate complexity');
  } else if (analysis.trackCount <= 12) {
    analysis.quality = 'good';
    analysis.recommendations.push('• Dense mix handled with intelligent processing');
    if (panChanges > 0) {
      analysis.recommendations.push(`• Applied intelligent panning to ${panChanges} tracks to reduce center buildup`);
    }
  } else {
    analysis.quality = 'complex';
    analysis.recommendations.push('• Very dense mix - extra processing applied for clarity');
    analysis.recommendations.push(`• Reduced gain to ${adaptiveGain.toFixed(2)} for optimal headroom`);
    if (panChanges > 0) {
      analysis.recommendations.push(`• Redistributed panning on ${panChanges} tracks to improve stereo image`);
    }
  }
  
  // MIDI-specific feedback
  const midiRatio = analysis.midiTracks / Math.max(1, analysis.trackCount);
  if (midiRatio > 0.8) {
    analysis.recommendations.push('• MIDI-heavy mix optimized with enhanced synthesis fallbacks');
  } else if (midiRatio > 0.5) {
    analysis.recommendations.push('• Hybrid MIDI/analog mix balanced with adaptive processing');
  }
  
  // Duration feedback
  if (duration > 300) { // 5+ minutes
    analysis.recommendations.push('• Long-form content processed with consistent quality');
  } else if (duration < 30) {
    analysis.recommendations.push('• Short-form content optimized for immediate impact');
  }
  
  // Headroom feedback
  if (targetHeadroom < -5) {
    analysis.recommendations.push('• Conservative headroom preserved for mastering flexibility');
  } else if (targetHeadroom > -2) {
    analysis.recommendations.push('• Tight headroom for maximum loudness - check for distortion');
  }
  
  return analysis;
}

/**
 * Map instrument types to enhanced synthesizer presets
 */
function mapInstrumentToSynthPreset(instrumentType, instrumentPreset) {
  // Map instrument types to wavetable and synthesis settings
  const typeMap = {
    piano: { 
      wavetable: 'sine', 
      filterFrequency: 3000, 
      filterResonance: 0.5,
      velocitySensitivity: 0.9
    },
    organ: { 
      wavetable: 'organ', 
      filterFrequency: 4000, 
      filterResonance: 0.3,
      velocitySensitivity: 0.5
    },
    strings: { 
      wavetable: 'strings', 
      filterFrequency: 2500, 
      filterResonance: 0.7,
      velocitySensitivity: 0.8
    },
    brass: { 
      wavetable: 'brass', 
      filterFrequency: 3500, 
      filterResonance: 1.2,
      velocitySensitivity: 0.9
    },
    synth: {
      wavetable: 'sawtooth',
      filterFrequency: 2000,
      filterResonance: 0.8,
      velocitySensitivity: 0.7
    },
    pad: {
      wavetable: 'pad',
      filterFrequency: 1500,
      filterResonance: 0.4,
      velocitySensitivity: 0.6
    },
    lead: {
      wavetable: 'sawtooth',
      filterFrequency: 4000,
      filterResonance: 1.5,
      velocitySensitivity: 0.8
    },
    bass: {
      wavetable: 'sawtooth',
      filterFrequency: 800,
      filterResonance: 0.6,
      velocitySensitivity: 0.7
    },
    bell: {
      wavetable: 'bell',
      filterFrequency: 5000,
      filterResonance: 0.8,
      velocitySensitivity: 1.0
    },
    pluck: {
      wavetable: 'pluck',
      filterFrequency: 2000,
      filterResonance: 0.6,
      velocitySensitivity: 0.8
    }
  };

  // Get base settings
  let settings = typeMap[instrumentType] || typeMap.synth;

  // Apply preset modifications
  if (instrumentPreset) {
    switch (instrumentPreset.toLowerCase()) {
      case 'bright':
        settings = { ...settings, filterFrequency: settings.filterFrequency * 1.5 };
        break;
      case 'warm':
        settings = { ...settings, filterFrequency: settings.filterFrequency * 0.7 };
        break;
      case 'fat':
        settings = { ...settings, filterResonance: settings.filterResonance * 1.3 };
        break;
      case 'thin':
        settings = { ...settings, filterResonance: settings.filterResonance * 0.6 };
        break;
    }
  }

  return {
    maxVoices: 8,
    filterType: 'lowpass',
    ...settings
  };
}

/**
 * Automatically render a MIDI track to audio buffer for mixdown
 */
async function renderMIDITrackToAudio(track, sampleRate = 44100, bpm = 120) {
  // Check cache first
  const cachedBuffer = midiRenderCache.getCached(track);
  if (cachedBuffer) {
    console.log(`Using cached MIDI render for track ${track.name}`);
    return cachedBuffer;
  }

  const midiNotes = collectTrackMidiNotes(track, { bpm });
  if (midiNotes.length === 0) return null;

  console.log(`🎵 MIXDOWN START: ${track.name}`, {
    instrumentType: track.midiData?.instrument?.type || 'unknown',
    instrumentPreset: track.midiData?.instrument?.preset || 'default',
    notesCount: midiNotes.length,
    firstNotes: midiNotes.slice(0, 3).map(n => ({ time: n.time.toFixed(3), dur: n.duration.toFixed(3), freq: n.freq.toFixed(1) }))
  });

  // Calculate track duration
  const endTime = Math.max(...midiNotes.map(n => n.time + n.duration));
  const duration = Math.max(1, endTime + 1); // Add 1 second tail

  console.log(`🎵 MIXDOWN: Rendering ${track.name} (${midiNotes.length} notes, duration: ${duration.toFixed(2)}s, endTime: ${endTime.toFixed(2)}s)`);

  // Create offline context for rendering using managed context
  const { context: offline, cleanup: cleanupContext } = offlineContextManager.create(
    2,
    Math.ceil(duration * sampleRate),
    sampleRate,
    `MIDI render: ${track.name}`
  );

  // Try to use existing virtual instruments first, then fall back to enhanced synth
  let instrument = null;
  let useEnhancedSynth = false;
  
  try {
    // Determine instrument type
    const instrumentType = track.midiData?.instrument?.type || 'synth';
    const instrumentPreset = track.midiData?.instrument?.preset || 'default';

    console.log(`🎵 MIXDOWN: Track ${track.name} instrument type: ${instrumentType}`);

    // CRITICAL: Always use EnhancedSynth for mixdown because WebAudioInstruments
    // don't support the duration parameter, causing notes to play forever!
    throw new Error('Forcing EnhancedSynth for proper note duration handling in mixdown');
  } catch (e) {
    console.log(`🎵 MIXDOWN: Using EnhancedSynth for ${track.name} (${e.message})`);
    
    try {
      // Fall back to enhanced synthesizer
      const instrumentType = track.midiData?.instrument?.type || 'synth';
      const instrumentPreset = track.midiData?.instrument?.preset || 'default';
      const synthOptions = mapInstrumentToSynthPreset(instrumentType, instrumentPreset);
      
      instrument = new EnhancedSynth(offline, synthOptions);
      useEnhancedSynth = true;

      console.log(`🎵 MIXDOWN: Using EnhancedSynth with ${synthOptions.wavetable} wavetable`, {
        contextType: offline.constructor.name,
        contextLength: offline.length,
        contextDuration: (offline.length / sampleRate).toFixed(2) + 's'
      });
    } catch (enhancedError) {
      console.warn('Both existing and enhanced synth failed:', enhancedError);
    }
  }

  // Use appropriate gain for individual MIDI track rendering
  const masterGain = offline.createGain();
  masterGain.gain.value = 0.6; // Balanced gain for clear audio quality

  // Add gentle limiting to prevent clipping while preserving dynamics
  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = -3; // Higher threshold - only catch peaks
  limiter.knee.value = 10;
  limiter.ratio.value = 3; // Gentler ratio for transparent limiting
  limiter.attack.value = 0.001;
  limiter.release.value = 0.2; // Slower release to reduce pumping

  masterGain.connect(limiter);
  limiter.connect(offline.destination);
  
  // Connect the instrument to masterGain (moved from above for clarity)
  if (instrument) {
    instrument.connect(masterGain);
  }

  // Schedule notes using the appropriate instrument
  if (instrument) {
    // Schedule notes
    for (const note of midiNotes) {
      const start = Math.max(0, note.time);
      const duration = Math.max(0.01, note.duration);
      const midi = Math.round(69 + 12 * Math.log2(note.freq / 440));

      // PROFESSIONAL VELOCITY SCALING: Consistent and musical
      const originalVelocity = note.velocity || 100;

      // Normalize MIDI velocity (0-127) to professional audio levels (0-1)
      // Use musical velocity curve that preserves dynamics but prevents clipping
      let normalizedVelocity;
      if (originalVelocity <= 1) {
        // Already normalized (0-1 range) - use directly
        normalizedVelocity = Math.max(0.1, Math.min(1, originalVelocity));
      } else {
        // Standard MIDI velocity (1-127) - apply musical curve
        const midiNormalized = Math.max(1, Math.min(127, originalVelocity)) / 127;
        // Apply slight curve to preserve quiet notes but control loud ones
        normalizedVelocity = Math.pow(midiNormalized, 0.8); // Gentle compression curve
      }

      // Scale to appropriate mixing level (balanced for quality)
      const scaledVelocity = normalizedVelocity * 0.6; // Proper gain staging for clear audio

      if (process.env.NODE_ENV === 'development') {
        console.log(`🎵 Note ${midi}: velocity ${originalVelocity} -> ${scaledVelocity.toFixed(3)} (normalized: ${normalizedVelocity.toFixed(3)}), start: ${start.toFixed(2)}s, dur: ${duration.toFixed(2)}s`);
      }

      try {
        if (useEnhancedSynth) {
          // Enhanced synth uses our improved API with duration
          // The duration parameter triggers automatic oscillator stops in OfflineAudioContext
          instrument.playNote(midi, scaledVelocity, start, duration);
        } else {
          // Your existing instruments - check their API
          if (typeof instrument.playNote === 'function') {
            // Most instruments support playNote(midi, velocity, time, duration)
            // The duration parameter should trigger automatic stops
            instrument.playNote(midi, scaledVelocity, start, duration);
          } else if (typeof instrument.noteOn === 'function') {
            // Some might use noteOn/noteOff pattern
            instrument.noteOn(midi, scaledVelocity, start);
            if (typeof instrument.noteOff === 'function') {
              instrument.noteOff(midi, start + duration);
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to play note ${midi} on ${useEnhancedSynth ? 'enhanced synth' : 'existing instrument'}:`, e);
      }
    }
  } else {
    // Use improved fallback synthesis if no instrument worked
    await renderMIDIWithFallbackSynth(offline, midiNotes, masterGain);
  }

  // Render and cache
  try {
    const rendered = await offline.startRendering();
    midiRenderCache.setCached(track, rendered);
    cleanupContext(); // Release the offline context
    return rendered;
  } catch (e) {
    console.error('MIDI auto-render failed:', e);
    cleanupContext(); // Release context even on failure
    return null;
  }
}

/**
 * Fallback synthesis for auto-rendering (uses our improved settings)
 */
async function renderMIDIWithFallbackSynth(offline, midiNotes, destination) {
  const voiceManager = new VoiceManager(8);
  
  for (const n of midiNotes) {
    const start = Math.max(0, n.time);
    const dur = Math.max(0.01, n.duration);
    const midiNote = Math.round(69 + 12 * Math.log2(n.freq / 440));

    // Single triangle oscillator (from our Phase 1 improvements)
    const osc = offline.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(n.freq, start);

    // Clean filter settings (no resonance to prevent artifacts)
    const filter = offline.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, start); // Fixed frequency, no velocity modulation
    filter.Q.setValueAtTime(0.3, start); // Very low Q to prevent resonance buildup

    // Proper ADSR envelope with guaranteed note-off
    const env = offline.createGain();
    const baseGain = 0.02; // Lower gain to prevent accumulation
    const peak = baseGain * Math.min(0.8, (n.velocity ?? 0.5)); // Cap velocity scaling

    // Attack - Decay - Sustain - Release
    const attackTime = 0.01;
    const decayTime = 0.05; 
    const sustainLevel = peak * 0.4; // Lower sustain
    const releaseTime = 0.2;

    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peak, start + attackTime);
    env.gain.exponentialRampToValueAtTime(sustainLevel, start + attackTime + decayTime);
    env.gain.setValueAtTime(sustainLevel, start + dur - releaseTime);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    // Connect and manage voice
    osc.connect(filter);
    filter.connect(env);
    env.connect(destination);

    const stopCallback = () => {
      try {
        osc.stop(start + dur + 0.05);
      } catch {}
    };

    voiceManager.allocateVoice(midiNote, stopCallback, env);

    try {
      osc.start(start);
    } catch {}
  }
}

/**
 * Process track effects on an audio buffer
 * Applies the track's effects chain to the given buffer
 * @param {AudioBuffer} buffer - Audio buffer to process
 * @param {Object} track - Track with effects array
 * @param {AudioContext} audioContext - Audio context for processing
 * @returns {Promise<AudioBuffer>} - Processed buffer (or original if no effects)
 */
async function processTrackEffects(buffer, track, audioContext) {
  // Skip if no effects or all effects disabled
  const enabledEffects = (track.effects || []).filter(e => e.enabled !== false);
  if (enabledEffects.length === 0) {
    return buffer;
  }

  debugLog('MultitrackMixdown', `Processing ${enabledEffects.length} effects for track: ${track.name}`);

  try {
    // Process entire buffer through effects chain
    const processedBuffer = await processEffectsChain(
      buffer,
      0, // startSample
      buffer.length, // endSample
      enabledEffects,
      audioContext
    );

    debugLog('MultitrackMixdown', `Track effects processed successfully: ${track.name}`);
    return processedBuffer;
  } catch (error) {
    debugError('MultitrackMixdown', `Failed to process effects for track ${track.name}:`, error);
    // Return original buffer if effects processing fails
    return buffer;
  }
}

/**
 * Pre-render a track's audio clips to a single buffer for effects processing
 * @param {Object} track - Track with clips
 * @param {Map} bufferMap - Map of source URLs to decoded buffers
 * @param {number} duration - Total duration in seconds
 * @param {number} sampleRate - Sample rate
 * @returns {Promise<AudioBuffer|null>} - Combined buffer or null if no clips
 */
async function prerenderTrackClipsToBuffer(track, bufferMap, duration, sampleRate) {
  const clips = track.clips || [];
  if (clips.length === 0) return null;

  // Create offline context for the track using managed context
  const { context: offline, cleanup: cleanupContext } = offlineContextManager.create(
    2,
    Math.ceil(duration * sampleRate),
    sampleRate,
    `Prerender track: ${track.name}`
  );

  const masterGain = offline.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(offline.destination);

  let hasAudio = false;

  // Schedule all clips
  clips.forEach((c) => {
    const buf = bufferMap.get(c?.src);
    if (!buf) return;

    const start = Math.max(0, toNumber(c?.start, 0));
    const offset = Math.max(0, toNumber(c?.offset, 0));
    const maxDur = Math.max(0, buf.duration - offset);
    const clipDur = Math.max(0, Math.min(toNumber(c?.duration, 0), maxDur));
    if (!(clipDur > 0)) return;

    const src = offline.createBufferSource();
    src.buffer = buf;
    src.connect(masterGain);

    try {
      src.start(start, offset, clipDur);
      hasAudio = true;
    } catch (e) {
      debugWarn('MultitrackMixdown', `Failed to schedule clip: ${e.message}`);
    }
  });

  if (!hasAudio) {
    cleanupContext(); // Release context if no audio
    return null;
  }

  try {
    const rendered = await offline.startRendering();
    cleanupContext(); // Release the context after rendering
    return rendered;
  } catch (error) {
    debugError('MultitrackMixdown', `Failed to prerender track ${track.name}:`, error);
    cleanupContext(); // Release context even on failure
    return null;
  }
}

/**
 * Mixdown engine — clip & MIDI aware, independent of WaveSurfer
 */
async function mixdownClipsAndMidi(
  tracks,
  sampleRateHint = 44100,
  onProgress = () => {},
  bpm = 120,
) {
  console.log('🚨🚨🚨 MIXDOWN FUNCTION CALLED! 🚨🚨🚨', {
    trackCount: tracks?.length,
    bpm,
    sampleRateHint
  });

  // Signal to the app that we're in mixdown mode to prevent dual synthesis
  if (typeof window !== 'undefined') {
    window.__MIXDOWN_ACTIVE__ = true;
    console.log('🎛️ Mixdown: Set __MIXDOWN_ACTIVE__ = true');
  }
  onProgress(5);
  const soloIds = new Set(tracks.filter((t) => t.soloed).map((t) => t.id));
  const included = tracks.filter((t) => {
    const hasAudio = Array.isArray(t.clips) && t.clips.length > 0;
    const hasMidi = collectTrackMidiNotes(t, { bpm }).length > 0;
    if (!hasAudio && !hasMidi) return false;
    if (soloIds.size > 0) return soloIds.has(t.id) && !t.muted;
    return !t.muted;
  });
  if (included.length === 0)
    throw new Error('No audible tracks (audio or MIDI) to mix down.');

  // Decode unique audio sources once
  onProgress(12);
  const allClips = included.flatMap((t) => t.clips || []);
  const uniqueSrc = Array.from(
    new Set(allClips.map((c) => c?.src).filter(Boolean)),
  );
  const bufferMap = new Map();

  let done = 0;
  await Promise.all(
    uniqueSrc.map(async (src) => {
      try {
        const buf = await decodeAudioFromURL(src);
        bufferMap.set(src, buf);
      } finally {
        done += 1;
        onProgress(
          12 + Math.round((done / Math.max(1, uniqueSrc.length)) * 38),
        );
      }
    }),
  );

  // Choose sample rate early (before MIDI rendering needs it)
  const highestRate = Math.max(
    sampleRateHint,
    ...Array.from(bufferMap.values()).map((b) => b.sampleRate || 0),
  );

  // Auto-render MIDI tracks to audio buffers
  onProgress(50);
  const midiBufferMap = new Map();
  
  // Debug: Check all tracks before filtering
  console.log('All included tracks for mixdown:', included.map(t => ({
    id: t.id,
    name: t.name,
    type: t.type,
    notesInTrack: t.midiData?.notes?.length || 0,
    notesCollected: t.type === 'midi' ? collectTrackMidiNotes(t, { bpm }).length : 'N/A'
  })));
  
  const midiTracks = included.filter(t => t.type === 'midi' && collectTrackMidiNotes(t, { bpm }).length > 0);
  
  console.log(`Auto-rendering ${midiTracks.length} MIDI tracks for mixdown...`);
  
  // Debug: Log each track's MIDI data
  midiTracks.forEach((track, index) => {
    const notes = collectTrackMidiNotes(track, { bpm });
    console.log(`MIDI Track ${index + 1}: "${track.name}"`, {
      trackId: track.id,
      notesInTrack: track.midiData?.notes?.length || 0,
      notesCollected: notes.length,
      firstFewNotes: notes.slice(0, 3),
      midiData: track.midiData,
    });
  });
  
  let midiDone = 0;
  await Promise.all(
    midiTracks.map(async (track) => {
      try {
        console.log(`Starting render for track: ${track.name}`);
        const buffer = await renderMIDITrackToAudio(track, highestRate, bpm);
        if (buffer) {
          console.log(`Successfully rendered MIDI track: ${track.name} (${buffer.length} samples)`);
          midiBufferMap.set(track.id, buffer);
        } else {
          console.log(`No buffer returned for MIDI track: ${track.name}`);
        }
      } catch (e) {
        console.error(`Failed to auto-render MIDI track ${track.name}:`, e);
      } finally {
        midiDone += 1;
        onProgress(
          50 + Math.round((midiDone / Math.max(1, midiTracks.length)) * 15),
        );
      }
    }),
  );

  // Compute project duration
  const projectDuration = included.reduce((maxT, track) => {
    let endAudio = 0;
    (track.clips || []).forEach((c) => {
      const buf = bufferMap.get(c?.src);
      if (!buf) return;
      const off = Math.max(0, toNumber(c?.offset, 0));
      const dur = Math.max(
        0,
        Math.min(toNumber(c?.duration, 0), Math.max(0, buf.duration - off)),
      );
      endAudio = Math.max(endAudio, toNumber(c?.start, 0) + dur);
    });

    let endMidi = 0;
    // Use pre-rendered MIDI buffer duration if available
    const midiBuffer = midiBufferMap.get(track.id);
    if (midiBuffer) {
      endMidi = midiBuffer.duration;
    } else {
      // Fallback to calculated duration
      collectTrackMidiNotes(track, { bpm }).forEach((n) => {
        endMidi = Math.max(endMidi, n.time + n.duration);
      });
    }

    return Math.max(maxT, Math.max(endAudio, endMidi));
  }, 0);

  if (!(projectDuration > 0))
    throw new Error('Project duration is 0 — nothing to render.');

  // Using the sample rate that was calculated earlier for MIDI rendering

  // Create OfflineAudioContext using managed context
  const length = Math.ceil(projectDuration * highestRate);
  const { context: offline, cleanup: cleanupMainContext } = offlineContextManager.create(
    2,
    length,
    highestRate,
    'Main mixdown render'
  );

  // Calculate adaptive gain based on mix complexity (reuse midiTracks from above)
  const analogTracks = included.filter(t => t.type !== 'midi');
  const adaptiveGain = calculateAdaptiveGain(included.length, midiTracks.length, analogTracks.length);
  
  // PROFESSIONAL MASTER BUS: Clean gain staging → gentle EQ → minimal limiting
  const masterGain = offline.createGain();
  masterGain.gain.value = adaptiveGain;

  // Create subtle EQ compensation for mix density (reduced processing)
  const mixEQ = createMixEQ(offline, included.length, midiTracks.length);
  
  // Calculate intelligent panning to reduce center buildup
  const intelligentPanning = calculateIntelligentPanning(included);
  
  // Calculate target headroom for analysis (simplified approach)
  let targetHeadroom = -3; // Default -3dB headroom
  if (included.length > 12) {
    targetHeadroom = -6; // More headroom for very dense mixes
  } else if (included.length > 8) {
    targetHeadroom = -4.5; // Extra headroom for dense mixes
  } else if (included.length <= 4) {
    targetHeadroom = -1.5; // Less headroom needed for sparse mixes
  }
  
  // MIDI tracks have more predictable levels
  const midiRatio = midiTracks.length / Math.max(1, included.length);
  if (midiRatio > 0.7) {
    targetHeadroom += 1.5; // Less headroom needed for MIDI-heavy mixes
  }
  
  // SIMPLIFIED MASTER BUS: Only essential processing to prevent artifacts
  // Remove excessive compression stages that cause pumping and static
  
  // Professional safety limiter: gentle settings to catch only extreme peaks
  const safetyLimiter = offline.createDynamicsCompressor();
  safetyLimiter.threshold.value = -1; // High threshold - only catch peaks above -1dB
  safetyLimiter.knee.value = 2; // Soft knee for musical limiting
  safetyLimiter.ratio.value = 8; // Moderate ratio, not extreme
  safetyLimiter.attack.value = 0.003; // Slower attack to preserve transients
  safetyLimiter.release.value = 0.15; // Slower release to avoid pumping

  // Gentle soft clipper for final peak control (much less aggressive)
  const gentleClipper = offline.createWaveShaper();
  gentleClipper.curve = makeSoftClipCurve(4096, 0.9); // Much gentler clipping

  // CLEAN SIGNAL CHAIN: masterGain → EQ → gentle limiter → soft clipper → output
  masterGain.connect(mixEQ.input);
  mixEQ.output.connect(safetyLimiter);
  safetyLimiter.connect(gentleClipper);
  gentleClipper.connect(offline.destination);
  
  debugLog('MultitrackMixdown', '🎛️ Professional Master Bus: Clean signal chain with minimal processing');

  // Pre-process tracks with effects (needs to happen before main render loop)
  // This creates processed buffers for tracks that have effects
  const processedTrackBuffers = new Map();

  // Check which tracks need effects processing
  const tracksWithEffects = included.filter(
    (t) => t.effects && t.effects.length > 0 && t.effects.some((e) => e.enabled !== false)
  );

  if (tracksWithEffects.length > 0) {
    debugLog('MultitrackMixdown', `Processing effects for ${tracksWithEffects.length} tracks...`);

    await Promise.all(
      tracksWithEffects.map(async (track) => {
        try {
          let trackBuffer = null;

          // For MIDI tracks, use the pre-rendered MIDI buffer
          if (track.type === 'midi' && midiBufferMap.has(track.id)) {
            trackBuffer = midiBufferMap.get(track.id);
          } else if (track.clips && track.clips.length > 0) {
            // For audio tracks, pre-render clips to a single buffer
            trackBuffer = await prerenderTrackClipsToBuffer(
              track,
              bufferMap,
              projectDuration,
              highestRate
            );
          }

          if (trackBuffer) {
            // Apply effects to the track buffer
            const processedBuffer = await processTrackEffects(
              trackBuffer,
              track,
              offline // Use offline context for processing
            );
            processedTrackBuffers.set(track.id, processedBuffer);
            debugLog('MultitrackMixdown', `Effects applied to track: ${track.name}`);
          }
        } catch (error) {
          debugError('MultitrackMixdown', `Error processing effects for ${track.name}:`, error);
        }
      })
    );
  }

  onProgress(72);

  // Process each track
  included.forEach((track) => {
    const trackGain = offline.createGain();
    trackGain.gain.value = track.muted
      ? 0
      : typeof track.volume === 'number'
        ? track.volume
        : 1;

    // Try to reuse the project's virtual instrument for offline bounce
    let offlineInstrument = null;
    try {
      const instrumentSpec = track.midiData?.instrument || {};
      offlineInstrument = createInstrument(offline, instrumentSpec);
      const instrumentOut = offlineInstrument?.output || offlineInstrument;
      if (instrumentOut && typeof instrumentOut.connect === 'function') {
        instrumentOut.connect(trackGain);
      } else {
        offlineInstrument = null; // fall back if no connectable output
      }
    } catch (e) {
      offlineInstrument = null; // factory not offline-safe → fallback
    }

    // Check if this track has a pre-processed buffer (with effects applied)
    const processedBuffer = processedTrackBuffers.get(track.id);
    const hasProcessedEffects = !!processedBuffer;

    // Check if this is a pre-rendered MIDI track (without effects)
    const midiBuffer = midiBufferMap.get(track.id);
    const isMidiTrack = track.type === 'midi' && midiBuffer && !hasProcessedEffects;

    // Set up intelligent panning
    const panner = offline.createStereoPanner
      ? offline.createStereoPanner()
      : null;
    if (panner) {
      const intelligentPan = intelligentPanning.get(track.id) || 0;
      panner.pan.value = intelligentPan;

      // Log panning adjustments if different from original
      if (Math.abs(intelligentPan - (track.pan || 0)) > 0.01) {
        debugLog('MultitrackMixdown', `Track ${track.name}: Pan adjusted ${(track.pan || 0).toFixed(2)} → ${intelligentPan.toFixed(2)}`);
      }
    }

    // Connect audio chain (simplified - no special MIDI processing needed)
    if (panner) {
      trackGain.connect(panner);
      panner.connect(masterGain);
    } else {
      trackGain.connect(masterGain);
    }

    // If track has processed effects, use the pre-processed buffer
    if (hasProcessedEffects) {
      const src = offline.createBufferSource();
      src.buffer = processedBuffer;
      src.connect(trackGain);
      try {
        src.start(0);
        debugLog('MultitrackMixdown', `Playing effects-processed buffer for: ${track.name}`);
      } catch (e) {
        debugWarn('MultitrackMixdown', `Failed to start processed buffer for ${track.name}:`, e);
      }
      return; // Skip normal clip processing for this track
    }

    // Process pre-rendered MIDI audio buffer (no effects)
    if (isMidiTrack) {
      const src = offline.createBufferSource();
      src.buffer = midiBuffer;
      src.connect(trackGain);
      try {
        src.start(0); // Start at beginning of mixdown timeline
      } catch (e) {
        debugWarn('MultitrackMixdown', `Failed to start MIDI buffer for ${track.name}:`, e);
      }
    }

    // Process audio clips (for tracks without effects)
    (track.clips || []).forEach((c) => {
      const buf = bufferMap.get(c?.src);
      if (!buf) return;
      const start = Math.max(0, toNumber(c?.start, 0));
      const offset = Math.max(0, toNumber(c?.offset, 0));
      const maxDur = Math.max(0, buf.duration - offset);
      const clipDur = Math.max(0, Math.min(toNumber(c?.duration, 0), maxDur));
      if (!(clipDur > 0)) return;

      const src = offline.createBufferSource();
      src.buffer = buf;
      src.connect(trackGain);
      try {
        src.start(start, offset, clipDur);
      } catch (e) {
        try {
          src.start(start, offset);
        } catch {}
      }
    });

    // MIDI tracks are now handled as pre-rendered audio buffers above
    // No complex synthesis needed during mixdown!
  });

  onProgress(80);
  
  try {
    const rendered = await offline.startRendering();
    
    // Analyze mix quality and provide feedback
    const mixAnalysis = analyzeMixQuality(
      included,
      projectDuration,
      adaptiveGain,
      targetHeadroom,
      intelligentPanning
    );
    
    console.log('\nMix Quality Analysis:');
    console.log(`Quality Rating: ${mixAnalysis.quality.toUpperCase()}`);
    console.log(`Tracks: ${mixAnalysis.trackCount} (${mixAnalysis.midiTracks} MIDI, ${mixAnalysis.analogTracks} analog)`);
    console.log(`Duration: ${Math.round(mixAnalysis.duration)}s`);
    console.log(`Adaptive Gain: ${mixAnalysis.adaptiveGain.toFixed(2)}`);
    console.log(`Target Headroom: ${mixAnalysis.targetHeadroom}dB`);
    if (mixAnalysis.panningChanges > 0) {
      console.log(`Panning Adjustments: ${mixAnalysis.panningChanges} tracks`);
    }
    console.log('\nProcessing Applied:');
    mixAnalysis.recommendations.forEach(rec => console.log(`  ${rec}`));
    
    onProgress(100);
    cleanupMainContext(); // Release the main mixdown context
    return rendered;
  } catch (renderError) {
    cleanupMainContext(); // Release context even on failure
    throw renderError;
  } finally {
    // Always clear the mixdown flag, even if rendering fails
    if (typeof window !== 'undefined') {
      window.__MIXDOWN_ACTIVE__ = false;
      console.log('🎛️ Mixdown: Cleared __MIXDOWN_ACTIVE__ = false');
    }
  }
}

// Fallback basic synth that's still better than single oscillator
function createBasicSynth(audioContext) {
  const synth = {
    output: audioContext.createGain(),
    voices: new Map(),

    connect(destination) {
      this.output.connect(destination);
    },

    playNote(midiNote, velocity = 1, time = 0) {
      const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

      // Single oscillator with gentler waveform to match mixdown improvements
      const osc = audioContext.createOscillator();
      osc.type = 'triangle'; // Gentler than dual sawtooth
      osc.frequency.value = freq;

      // Darker filter with lower Q to prevent resonant peaks
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.min(1500, 800 + velocity * 700); // Match mixdown settings
      filter.Q.value = 0.8; // Lower Q

      // Gentler envelope with lower gain
      const envelope = audioContext.createGain();
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(velocity * 0.15, time + 0.01); // Reduced gain
      envelope.gain.exponentialRampToValueAtTime(velocity * 0.1, time + 0.1);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + 1);

      // Connect
      osc.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.output);

      // Start/stop
      osc.start(time);
      osc.stop(time + 1.5);

      return { osc, envelope };
    },

    stopNote(midiNote, time = 0) {
      // Note: In offline context, we typically let notes play out their full envelope
      // This is more for compatibility with the interface
    },
  };

  return synth;
}

/** Convert AudioBuffer to WAV blob */
function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF header
  setUint32(0x46464952); // RIFF
  setUint32(length - 8);
  setUint32(0x45564157); // WAVE

  // fmt  chunk
  setUint32(0x20746d66); // fmt
  setUint32(16);
  setUint16(1);
  setUint16(buffer.numberOfChannels);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
  setUint16(buffer.numberOfChannels * 2);
  setUint16(16);

  // data chunk
  setUint32(0x61746164); // data
  setUint32(length - pos - 4);

  // interleave
  const interleaved = new Float32Array(buffer.length * buffer.numberOfChannels);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++)
    channels[ch] = buffer.getChannelData(ch);
  offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++)
      interleaved[offset++] = channels[ch][i];
  }

  // float -> 16-bit PCM with TPDF dither (1 LSB)
  const volume = 0.95;
  offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    // TPDF dither: sum of two uniforms in [-0.5, 0.5] scaled to 1 LSB
    const dither = (Math.random() + Math.random() - 1) / 32768;
    let s = interleaved[i] * volume + dither;
    // clamp after adding dither
    s = Math.max(-1, Math.min(1, s));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default function MultitrackMixdown({ logOperation = null }) {
  const { tracks, addTrack, soloTrackId, bpm: contextBpm } = useMultitrack();
  const bpm = Number(contextBpm) || 120;
  const [showModal, setShowModal] = useState(false);
  const [mixdownName, setMixdownName] = useState('Mixdown');
  const [addToProject, setAddToProject] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Derive which tracks would be included right now (mute/solo, has audio or MIDI)
  const includedTracks = useMemo(() => {
    const soloSet = soloTrackId ? new Set([soloTrackId]) : null;
    return tracks
      .filter((t) => {
        const hasAudio = Array.isArray(t.clips) && t.clips.length > 0;
        const hasMidiNotes = collectTrackMidiNotes(t, { bpm }).length > 0;
        const looksLikeMidi = !!(
          t?.midi ||
          t?.midiTrack ||
          t?.notes ||
          t?.midiNotes ||
          t?.sequence ||
          t?.pattern ||
          t?.events ||
          t?.midiEvents ||
          t?.eventQueue ||
          t?.stepSequencer ||
          t?.sequencer ||
          t?.steps ||
          t?.type === 'midi' ||
          t?.kind === 'midi'
        );
        if (!hasAudio && !hasMidiNotes && !looksLikeMidi) return false;
        if (soloSet) return soloSet.has(t.id) && !t.muted;
        return !t.muted;
      })
      .map((t) => ({ ...t, soloed: soloSet ? soloSet.has(t.id) : false }));
  }, [tracks, soloTrackId, bpm]);

  const canMixdown = includedTracks.length > 0;

  const handleMixdown = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const onProgress = (p) => setProgress(Math.min(100, Math.max(0, p)));
      const rendered = await mixdownClipsAndMidi(
        includedTracks,
        44100,
        onProgress,
        bpm,
      );

      const blob = audioBufferToWav(rendered);
      const audioURL = URL.createObjectURL(blob);

      if (addToProject) {
        const clipId = `clip-mixdown-${Date.now()}`;
        const newClip = {
          id: clipId,
          start: 0,
          duration: rendered.duration,
          color: '#ff6b6b',
          src: audioURL,
          offset: 0,
          name: mixdownName || 'Mixdown',
        };
        addTrack({
          name: mixdownName || 'Mixdown',
          isMixdown: true,
          color: '#ff6b6b',
          volume: 1,
          pan: 0,
          muted: false,
          audioURL,
          clips: [newClip],
        });

        // Log for study protocol (Activity 3)
        if (logOperation) {
          logOperation('mixdown_created', {
            name: mixdownName,
            trackCount: includedTracks.length,
            duration: rendered.duration
          });
        }
      } else {
        const a = document.createElement('a');
        a.href = audioURL;
        a.download = `${mixdownName || 'mixdown'}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(audioURL), 100);
      }

      setProgress(100);
      setTimeout(() => {
        setShowModal(false);
        setIsProcessing(false);
        setProgress(0);
      }, 400);
    } catch (err) {
      console.error('Mixdown error:', err);
      setError(err.message || String(err));
      setIsProcessing(false);
    }
  }, [includedTracks, addToProject, mixdownName, addTrack, bpm]);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!canMixdown}
        title={
          canMixdown
            ? 'Mix all audible audio & MIDI to stereo'
            : 'Add unmuted tracks with clips or MIDI to enable mixdown'
        }
      >
        <FaMixcloud /> Mixdown
      </Button>

      <Modal
        show={showModal}
        onHide={() => !isProcessing && setShowModal(false)}
      >
        <Modal.Header closeButton={!isProcessing}>
          <Modal.Title>Mixdown Tracks</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Mixdown Name</Form.Label>
              <Form.Control
                type="text"
                value={mixdownName}
                onChange={(e) => setMixdownName(e.target.value)}
                disabled={isProcessing}
                placeholder="Enter mixdown name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Destination</Form.Label>
              <Form.Check
                type="checkbox"
                label="Add mixdown as new track"
                checked={addToProject}
                onChange={(e) => setAddToProject(e.target.checked)}
                disabled={isProcessing}
              />
            </Form.Group>

            <div className="mb-3">
              <strong>Tracks to Mix:</strong>
              <ul className="mt-2">
                {includedTracks.map((t) => (
                  <li key={t.id}>
                    {t.name}
                    {t.volume !== 1 &&
                      ` (vol: ${Math.round((t.volume || 1) * 100)}%)`}
                    {t.pan !== 0 &&
                      ` (pan: ${t.pan > 0 ? 'R' : 'L'}${Math.abs(Math.round((t.pan || 0) * 100))}%)`}
                    {collectTrackMidiNotes(t, { bpm }).length > 0 ||
                    t?.type === 'midi' ||
                    t?.kind === 'midi' ||
                    t?.midi ||
                    t?.midiTrack ||
                    t?.notes ||
                    t?.midiNotes ||
                    t?.sequence ||
                    t?.pattern ||
                    t?.events ||
                    t?.midiEvents ||
                    t?.eventQueue ||
                    t?.stepSequencer ||
                    t?.sequencer ||
                    t?.steps
                      ? ' [MIDI]'
                      : ''}
                    {Array.isArray(t.clips) && t.clips.length > 0
                      ? ' [AUDIO]'
                      : ''}
                    {t.soloed ? ' [solo]' : ''}
                  </li>
                ))}
              </ul>
            </div>

            {isProcessing && (
              <ProgressBar
                now={progress}
                label={`${progress}%`}
                animated
                striped
              />
            )}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowModal(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleMixdown}
            disabled={isProcessing || !canMixdown}
          >
            {isProcessing
              ? 'Processing…'
              : addToProject
                ? 'Create Mixdown'
                : 'Export WAV'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
