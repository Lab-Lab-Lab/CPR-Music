// components/audio/DAW/Multitrack/ImprovedNoteScheduler.js
'use client';

import audioContextManager from './AudioContextManager';
import { beatsToSeconds, secondsToBeats, beatToAudioTime, validateMidiNotes } from '../../../../lib/midiTimeUtils';
import { debugLog, debugWarn } from '../../../../lib/debug';

/**
 * Performance presets for different system capabilities
 * Lower lookahead = lower latency but higher CPU/more timing risk
 * Higher lookahead = more reliable but higher latency
 */
const PERFORMANCE_PRESETS = {
  low_latency: {
    lookaheadTime: 0.1,    // 100ms - tight timing, needs fast system
    scheduleInterval: 15,   // 15ms - more frequent scheduling
    description: 'Low latency mode - requires fast system',
  },
  balanced: {
    lookaheadTime: 0.2,    // 200ms - good balance
    scheduleInterval: 25,   // 25ms - reasonable frequency
    description: 'Balanced mode - recommended for most systems',
  },
  reliable: {
    lookaheadTime: 0.35,   // 350ms - very reliable
    scheduleInterval: 40,   // 40ms - less CPU usage
    description: 'Reliable mode - for slower systems or complex projects',
  },
  high_latency: {
    lookaheadTime: 0.5,    // 500ms - maximum reliability
    scheduleInterval: 50,   // 50ms - minimal CPU usage
    description: 'High latency mode - maximum reliability for stressed systems',
  },
};

/**
 * Improved Note Scheduler using Web Audio API timing
 * Provides sample-accurate scheduling for MIDI playback
 *
 * Configuration:
 * - lookaheadTime: How far ahead to schedule notes (seconds). Default: 0.2 (200ms)
 *   - Lower values = lower latency but more CPU and timing risk
 *   - Higher values = more reliable but noticeable latency
 * - scheduleInterval: How often to check for notes to schedule (ms). Default: 25
 *   - Should be less than lookaheadTime * 1000 / 2 for smooth scheduling
 *
 * Performance presets available via setPerformancePreset():
 * - 'low_latency': 100ms lookahead, 15ms interval (fast systems)
 * - 'balanced': 200ms lookahead, 25ms interval (recommended)
 * - 'reliable': 350ms lookahead, 40ms interval (slower systems)
 * - 'high_latency': 500ms lookahead, 50ms interval (stressed systems)
 */
export default class ImprovedNoteScheduler {
  constructor(instrument, options = {}) {
    this.instrument = instrument;
    this.tempo = options.tempo || 120;

    // Timing configuration with validation
    this.lookaheadTime = this._validateLookahead(options.lookaheadTime, 0.2);
    this.scheduleInterval = this._validateInterval(options.scheduleInterval, 25);

    this.isPlaying = false;
    this.startTime = 0;
    this.pauseTime = 0;
    this.currentBeat = 0;
    this.notes = [];
    this.scheduledNotes = new Map(); // Track scheduled notes
    this.schedulerTimer = null;

    // Performance monitoring
    this.performanceStats = {
      schedulingCalls: 0,
      notesScheduled: 0,
      lateNotes: 0,          // Notes scheduled after their intended time
      missedNotes: 0,        // Notes that couldn't be scheduled
      lastScheduleTime: 0,
      avgScheduleLatency: 0,
    };

    // Debug mode for logging every scheduled note
    this.debugMode = options.debugMode || false;

    // Get audio context for timing
    this.audioContext = audioContextManager.getContext();

    debugLog('ImprovedNoteScheduler',
      `Initialized with lookahead=${this.lookaheadTime}s, interval=${this.scheduleInterval}ms`
    );
  }

  /**
   * Validate lookahead time (10ms - 1000ms)
   */
  _validateLookahead(value, defaultValue) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0.01 || num > 1.0) {
      if (value !== undefined) {
        debugWarn('ImprovedNoteScheduler',
          `Invalid lookaheadTime ${value}, using default ${defaultValue}s`
        );
      }
      return defaultValue;
    }
    return num;
  }

  /**
   * Validate schedule interval (5ms - 200ms)
   */
  _validateInterval(value, defaultValue) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 5 || num > 200) {
      if (value !== undefined) {
        debugWarn('ImprovedNoteScheduler',
          `Invalid scheduleInterval ${value}, using default ${defaultValue}ms`
        );
      }
      return defaultValue;
    }
    return num;
  }

  /**
   * Set timing configuration using a performance preset
   * @param {string} presetName - One of: 'low_latency', 'balanced', 'reliable', 'high_latency'
   */
  setPerformancePreset(presetName) {
    const preset = PERFORMANCE_PRESETS[presetName];
    if (!preset) {
      debugWarn('ImprovedNoteScheduler',
        `Unknown preset "${presetName}". Available: ${Object.keys(PERFORMANCE_PRESETS).join(', ')}`
      );
      return false;
    }

    const wasPlaying = this.isPlaying;
    const currentPosition = wasPlaying ? this.getCurrentBeat() : this.pauseTime;

    // Stop if playing to apply new settings
    if (wasPlaying) {
      this.pause();
    }

    this.lookaheadTime = preset.lookaheadTime;
    this.scheduleInterval = preset.scheduleInterval;

    debugLog('ImprovedNoteScheduler',
      `Applied preset "${presetName}": ${preset.description}`
    );

    // Resume if was playing
    if (wasPlaying) {
      this.start(currentPosition);
    }

    return true;
  }

  /**
   * Set custom timing configuration
   * @param {Object} config - { lookaheadTime, scheduleInterval }
   */
  setTimingConfig(config) {
    const wasPlaying = this.isPlaying;
    const currentPosition = wasPlaying ? this.getCurrentBeat() : this.pauseTime;

    if (wasPlaying) {
      this.pause();
    }

    if (config.lookaheadTime !== undefined) {
      this.lookaheadTime = this._validateLookahead(config.lookaheadTime, this.lookaheadTime);
    }
    if (config.scheduleInterval !== undefined) {
      this.scheduleInterval = this._validateInterval(config.scheduleInterval, this.scheduleInterval);
    }

    debugLog('ImprovedNoteScheduler',
      `Updated timing: lookahead=${this.lookaheadTime}s, interval=${this.scheduleInterval}ms`
    );

    if (wasPlaying) {
      this.start(currentPosition);
    }
  }

  /**
   * Get available performance presets
   */
  static getPerformancePresets() {
    return { ...PERFORMANCE_PRESETS };
  }

  /**
   * Get current timing configuration
   */
  getTimingConfig() {
    return {
      lookaheadTime: this.lookaheadTime,
      scheduleInterval: this.scheduleInterval,
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats() {
    this.performanceStats = {
      schedulingCalls: 0,
      notesScheduled: 0,
      lateNotes: 0,
      missedNotes: 0,
      lastScheduleTime: 0,
      avgScheduleLatency: 0,
    };
  }

  /**
   * Set the notes to play
   * @param {Array} notes - Array of note objects (in SECONDS format: { note, startTime, duration, velocity })
   * @param {Object} options - Options for validation
   * @param {boolean} options.validate - Whether to validate notes (default: true)
   */
  setNotes(notes, options = {}) {
    const { validate = true } = options;

    if (!notes || notes.length === 0) {
      this.notes = [];
      this.clearScheduledNotes();
      return;
    }

    if (validate) {
      // Notes passed to scheduler are expected to be in SECONDS format
      const { valid, invalid, warnings } = validateMidiNotes(notes, {
        format: 'seconds',
        warnOnInvalid: this.debugMode,
      });

      if (invalid.length > 0) {
        debugWarn('ImprovedNoteScheduler',
          `Filtered ${invalid.length} invalid notes out of ${notes.length}`,
          { invalidCount: invalid.length, totalCount: notes.length }
        );
      }

      if (this.debugMode && warnings.length > 0) {
        warnings.forEach(w => debugWarn('ImprovedNoteScheduler', w));
      }

      this.notes = valid;
    } else {
      this.notes = notes;
    }

    // Clear any previously scheduled notes when notes change
    this.clearScheduledNotes();
  }

  // Set tempo
  setTempo(tempo) {
    this.tempo = tempo;
  }

  // Start playback
  // startBeat: the current beat position in the timeline (absolute, not relative)
  start(startBeat = 0) {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentBeat = startBeat;

    // Calculate when beat 0 occurred in audio context time
    // If we're at beat X now, beat 0 was X beats ago
    const secondsElapsed = beatsToSeconds(startBeat, this.tempo);
    this.startTime = this.audioContext.currentTime - secondsElapsed;

    // Start the scheduler
    this.scheduleNotes();
    this.schedulerTimer = setInterval(() => {
      this.scheduleNotes();
    }, this.scheduleInterval);
  }

  // Stop playback
  stop() {
    this.isPlaying = false;

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Stop all currently playing notes
    this.clearScheduledNotes();

    // Reset position
    this.currentBeat = 0;
    this.startTime = 0;
  }

  // Pause playback
  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.pauseTime = this.getCurrentBeat();

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Stop all currently playing notes
    this.clearScheduledNotes();
  }

  // Resume from pause
  resume() {
    if (this.isPlaying) return;

    this.start(this.pauseTime);
  }

  // Seek to a specific beat
  seek(beat) {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.stop();
    }

    this.currentBeat = beat;

    if (wasPlaying) {
      this.start(beat);
    }
  }

  // Get current playback position in beats
  getCurrentBeat() {
    if (!this.isPlaying) return this.pauseTime;

    // Calculate elapsed time using audio context
    const elapsed = this.audioContext.currentTime - this.startTime;
    // Convert elapsed seconds to beats
    return secondsToBeats(elapsed, this.tempo);
  }

  // Schedule notes that fall within the lookahead window
  scheduleNotes() {
    if (!this.isPlaying || !this.instrument) return;

    const scheduleStartTime = performance.now();
    this.performanceStats.schedulingCalls++;

    const currentBeat = this.getCurrentBeat();
    const currentSeconds = beatsToSeconds(currentBeat, this.tempo);
    const scheduleEndSeconds = currentSeconds + this.lookaheadTime;
    const audioContextNow = this.audioContext.currentTime;

    // Find notes that need to be scheduled
    for (const note of this.notes) {
      const noteKey = `${note.note}-${note.startTime}`;

      // NOTE: note.startTime and note.duration are in SECONDS
      // Check if note should be scheduled and hasn't been already
      if (
        note.startTime >= currentSeconds &&
        note.startTime < scheduleEndSeconds &&
        !this.scheduledNotes.has(noteKey)
      ) {
        // Calculate when to play the note in audio context time
        // Notes are already in seconds, just add to startTime reference
        const noteOnTime = this.startTime + note.startTime;
        const noteOffTime = this.startTime + note.startTime + note.duration;

        // Track if note is being scheduled late
        if (noteOnTime < audioContextNow) {
          this.performanceStats.lateNotes++;
          debugWarn('ImprovedNoteScheduler',
            `Late note scheduled: pitch=${note.note}, intended=${noteOnTime.toFixed(3)}s, now=${audioContextNow.toFixed(3)}s, late by ${((audioContextNow - noteOnTime) * 1000).toFixed(1)}ms`
          );
        }

        this.performanceStats.notesScheduled++;

        // Only log in debug mode to reduce console spam
        if (this.debugMode) {
          debugLog('ImprovedNoteScheduler',
            `Scheduling note: pitch=${note.note}, startTime=${note.startTime.toFixed(3)}s, duration=${note.duration.toFixed(3)}s, noteOnTime=${noteOnTime.toFixed(3)}s, audioContextTime=${audioContextNow.toFixed(3)}s`
          );
        }

        // Schedule note on
        audioContextManager.scheduleAtTime(() => {
          if (this.isPlaying) {
            // Don't pass the scheduled time - let the instrument use current time
            // This prevents audio glitches from trying to schedule in the past
            this.instrument.playNote(
              note.note,
              note.velocity || 0.8
              // Removed noteOnTime parameter - instrument will use currentTime
            );
          }
        }, noteOnTime);

        // Schedule note off
        audioContextManager.scheduleAtTime(() => {
          if (this.isPlaying) {
            // Don't pass the scheduled time - let the instrument use current time
            this.instrument.stopNote(note.note);
          }
          // Remove from scheduled notes
          this.scheduledNotes.delete(noteKey);
        }, noteOffTime);

        // Mark as scheduled
        this.scheduledNotes.set(noteKey, {
          noteOnTime,
          noteOffTime,
          note: note.note,
        });
      }
    }

    // Clean up old scheduled notes that have finished
    const now = this.audioContext.currentTime;
    for (const [key, scheduled] of this.scheduledNotes.entries()) {
      if (scheduled.noteOffTime < now) {
        this.scheduledNotes.delete(key);
      }
    }

    // Track scheduling performance
    const scheduleEndTime = performance.now();
    const latency = scheduleEndTime - scheduleStartTime;
    this.performanceStats.lastScheduleTime = latency;

    // Update rolling average (simple exponential moving average)
    if (this.performanceStats.avgScheduleLatency === 0) {
      this.performanceStats.avgScheduleLatency = latency;
    } else {
      this.performanceStats.avgScheduleLatency =
        this.performanceStats.avgScheduleLatency * 0.9 + latency * 0.1;
    }

    // Warn if scheduling is taking too long (> 50% of interval)
    if (latency > this.scheduleInterval * 0.5) {
      debugWarn('ImprovedNoteScheduler',
        `Slow scheduling: ${latency.toFixed(1)}ms (interval: ${this.scheduleInterval}ms). ` +
        `Consider using 'reliable' or 'high_latency' preset.`
      );
    }
  }

  // Clear all scheduled notes
  clearScheduledNotes() {
    // Stop all notes immediately
    if (this.instrument && this.instrument.stopAllNotes) {
      this.instrument.stopAllNotes();
    }

    this.scheduledNotes.clear();
  }

  // Get scheduler state
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentBeat: this.getCurrentBeat(),
      tempo: this.tempo,
      scheduledNotes: this.scheduledNotes.size,
    };
  }
}
