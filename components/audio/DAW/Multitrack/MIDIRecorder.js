// components/audio/DAW/Multitrack/ImprovedMIDIRecorder.js
'use client';

import audioContextManager from './AudioContextManager';

/**
 * Improved MIDI Recorder with accurate timing
 */
export default class ImprovedMIDIRecorder {
  constructor(options = {}) {
    this.isRecording = false;
    this.isCountingIn = false;
    this.recordedNotes = [];
    this.activeNotes = new Map(); // Track currently pressed notes
    this.startTime = 0;
    this.countInBeats = options.countInBeats || 4;
    this.tempo = options.tempo || 120;
    this.quantize = options.quantize || null;
    this.overdub = options.overdub || false;
    this.onNoteCallback = options.onNote || null;
    this.onCountInCallback = options.onCountIn || null;
    this.onStartCallback = options.onStart || null;
    this.onStopCallback = options.onStop || null;

    // Use audio context time for accurate timing
    this.audioContext = audioContextManager.getContext();
  }

  // Start recording
  start(options = {}) {
    const { countIn = true, existingNotes = [] } = options;

    if (this.overdub && existingNotes) {
      this.recordedNotes = [...existingNotes];
    } else {
      this.recordedNotes = [];
    }

    if (countIn) {
      this.startCountIn();
    } else {
      this.startActualRecording();
    }
  }

  // Count-in before recording
  startCountIn() {
    this.isCountingIn = true;
    const beatDuration = 60 / this.tempo; // seconds per beat
    let currentBeat = 0;

    if (this.onCountInCallback) {
      this.onCountInCallback({
        beat: currentBeat + 1,
        total: this.countInBeats,
      });
    }

    const countInStartTime = this.audioContext.currentTime;

    // Schedule count-in beats using audio context timing
    for (let i = 1; i <= this.countInBeats; i++) {
      const beatTime = countInStartTime + (i - 1) * beatDuration;

      audioContextManager.scheduleAtTime(() => {
        if (i < this.countInBeats) {
          if (this.onCountInCallback) {
            this.onCountInCallback({ beat: i + 1, total: this.countInBeats });
          }
        } else {
          // Last beat - start recording
          this.isCountingIn = false;
          this.startActualRecording();
        }
      }, beatTime);
    }
  }

  // Start actual recording
  startActualRecording() {
    this.isRecording = true;
    this.startTime = this.audioContext.currentTime;
    this.activeNotes.clear();

    if (this.onStartCallback) {
      this.onStartCallback({ time: this.startTime });
    }
  }

  // Stop recording
  stop() {
    if (!this.isRecording) return this.recordedNotes;

    this.isRecording = false;
    const endTime = this.getCurrentTime();

    // Stop any notes that are still held
    this.activeNotes.forEach((note, noteNumber) => {
      note.duration = endTime - note.startTime;
      note.wasHeldAtStop = true;
      this.recordedNotes.push({
        note: noteNumber,
        velocity: note.velocity,
        startTime: note.startTime,
        duration: note.duration,
        wasHeldAtStop: true,
      });
    });

    this.activeNotes.clear();

    if (this.onStopCallback) {
      this.onStopCallback({
        notes: this.recordedNotes,
        duration: endTime,
      });
    }

    return this.recordedNotes;
  }

  // Get current time in seconds relative to recording start
  getCurrentTime() {
    return this.audioContext.currentTime - this.startTime;
  }

  // Handle incoming MIDI messages
  handleMIDIMessage(message) {
    if (!this.isRecording || this.isCountingIn) return;

    const currentTime = this.getCurrentTime();

    switch (message.type) {
      case 'noteon':
        if (message.velocity > 0) {
          this.handleNoteOn(message.note, message.velocity, currentTime);
        } else {
          // Some devices send note-on with velocity 0 as note-off
          this.handleNoteOff(message.note, currentTime);
        }
        break;

      case 'noteoff':
        this.handleNoteOff(message.note, currentTime);
        break;
    }
  }

  // Handle note on
  handleNoteOn(noteNumber, velocity, time) {
    // Check if this note is already playing
    if (this.activeNotes.has(noteNumber)) {
      this.handleNoteOff(noteNumber, time);
    }

    // Convert MIDI velocity (0-127) to normalized (0-1)
    const normalizedVelocity = velocity / 127;

    // Apply quantization if enabled
    const quantizedTime = this.quantize ? this.quantizeTime(time) : time;

    // Store active note
    this.activeNotes.set(noteNumber, {
      startTime: quantizedTime,
      velocity: normalizedVelocity,
      originalStartTime: time,
    });

    // Notify callback for live playback
    if (this.onNoteCallback) {
      this.onNoteCallback({
        type: 'noteon',
        note: noteNumber,
        velocity: normalizedVelocity,
        time: quantizedTime,
      });
    }
  }

  // Handle note off
  handleNoteOff(noteNumber, time) {
    const activeNote = this.activeNotes.get(noteNumber);
    if (!activeNote) return;

    const duration = time - activeNote.originalStartTime;

    // Only record notes with meaningful duration
    if (duration > 0.01) {
      this.recordedNotes.push({
        note: noteNumber,
        velocity: activeNote.velocity,
        startTime: activeNote.startTime,
        duration: this.quantize ? this.quantizeDuration(duration) : duration,
      });
    }

    this.activeNotes.delete(noteNumber);

    // Notify callback
    if (this.onNoteCallback) {
      this.onNoteCallback({
        type: 'noteoff',
        note: noteNumber,
        time: time,
      });
    }
  }

  // Quantize time to nearest grid division
  quantizeTime(time) {
    if (!this.quantize) return time;

    const beatLength = 60 / this.tempo;
    const gridSize = beatLength * this.quantize; // e.g., 1/16 note
    return Math.round(time / gridSize) * gridSize;
  }

  // Quantize duration
  quantizeDuration(duration) {
    if (!this.quantize) return duration;

    const beatLength = 60 / this.tempo;
    const gridSize = beatLength * this.quantize;
    const quantized = Math.round(duration / gridSize) * gridSize;
    return Math.max(gridSize, quantized); // Minimum one grid unit
  }

  // Clear all recorded notes
  clear() {
    this.recordedNotes = [];
    this.activeNotes.clear();
  }

  // Get recording state
  getState() {
    return {
      isRecording: this.isRecording,
      isCountingIn: this.isCountingIn,
      noteCount: this.recordedNotes.length,
      activeNotes: this.activeNotes.size,
    };
  }
}
