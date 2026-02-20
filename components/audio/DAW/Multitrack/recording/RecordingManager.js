// components/audio/DAW/Multitrack/recording/RecordingManager.js
'use client';

import { EventEmitter } from 'events';

/**
 * Unified recording manager for both audio and MIDI tracks
 * Single source of truth for all recording state
 */
class RecordingManager extends EventEmitter {
  constructor() {
    super();

    // Map of active recordings by trackId
    this.activeRecordings = new Map();

    // Global recording settings
    this.countdownDuration = 3; // seconds
    this.audioContext = null;
    this.midiAccess = null;

    // Bind methods
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.stopAllRecordings = this.stopAllRecordings.bind(this);
  }

  /**
   * Initialize audio context and MIDI access
   */
  async initialize(audioContext) {
    this.audioContext = audioContext;

    // Try to get MIDI access if available
    if (navigator.requestMIDIAccess) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess();
        console.log('🎹 RecordingManager: MIDI access granted');
      } catch (error) {
        console.warn('🎹 RecordingManager: MIDI access denied:', error);
      }
    }
  }

  /**
   * Check if any track is currently recording
   */
  hasActiveRecordings() {
    return this.activeRecordings.size > 0;
  }

  /**
   * Check if a specific track is recording
   */
  isTrackRecording(trackId) {
    return this.activeRecordings.has(trackId);
  }

  /**
   * Get recording state for a track
   */
  getTrackRecordingState(trackId) {
    return this.activeRecordings.get(trackId) || null;
  }

  /**
   * Start recording for a track (audio or MIDI)
   */
  async startRecording(trackId, trackType, options = {}) {
    console.log(`📍 RecordingManager: Starting recording for track ${trackId} (${trackType})`);

    // Check if already recording
    if (this.isTrackRecording(trackId)) {
      console.warn(`📍 RecordingManager: Track ${trackId} is already recording`);
      return false;
    }

    // Initialize recording state
    const recordingState = {
      trackId,
      type: trackType,
      startTime: null,
      recorder: null,
      mediaStream: options.mediaStream || null,
      midiInput: options.midiInput || null,
      tempo: options.tempo || 120, // Store tempo for MIDI beat conversion
      isCountingIn: true,
      countdownValue: this.countdownDuration,
      chunks: [], // For audio
      midiEvents: [], // For MIDI
      recordingStartPosition: options.startPosition || 0
    };

    this.activeRecordings.set(trackId, recordingState);

    // Emit countdown start event
    this.emit('countdown-start', { trackId, countdown: this.countdownDuration });

    // Start countdown
    await this.runCountdown(trackId);

    // Check if cancelled during countdown
    if (!this.activeRecordings.has(trackId)) {
      console.log(`📍 RecordingManager: Recording cancelled during countdown for track ${trackId}`);
      return false;
    }

    // Start actual recording based on type
    if (trackType === 'audio') {
      await this.startAudioRecording(trackId);
    } else if (trackType === 'midi') {
      await this.startMIDIRecording(trackId);
    }

    return true;
  }

  /**
   * Run countdown timer
   */
  async runCountdown(trackId) {
    const recordingState = this.activeRecordings.get(trackId);
    if (!recordingState) return;

    for (let i = this.countdownDuration; i > 0; i--) {
      // Check if cancelled
      if (!this.activeRecordings.has(trackId)) {
        return;
      }

      // Update countdown value
      recordingState.countdownValue = i;
      this.emit('countdown-update', { trackId, value: i });

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Countdown complete
    recordingState.isCountingIn = false;
    recordingState.countdownValue = 0;
    this.emit('countdown-complete', { trackId });
  }

  /**
   * Start audio recording
   */
  async startAudioRecording(trackId) {
    const recordingState = this.activeRecordings.get(trackId);
    if (!recordingState || !recordingState.mediaStream) {
      console.error(`📍 RecordingManager: Cannot start audio recording - no media stream`);
      this.stopRecording(trackId);
      return;
    }

    console.log(`🎤 RecordingManager: Starting audio recording for track ${trackId}`);

    try {
      // Determine best audio format
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      // Create MediaRecorder
      const recorder = new MediaRecorder(recordingState.mediaStream, {
        mimeType,
        audioBitsPerSecond: 320000 // 320 kbps
      });

      // Handle data available
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingState.chunks.push(event.data);
          this.emit('audio-data', {
            trackId,
            data: event.data,
            timestamp: performance.now()
          });
        }
      };

      // Handle recorder stop
      recorder.onstop = () => {
        console.log(`🎤 RecordingManager: Audio recording stopped for track ${trackId}`);
        this.handleAudioRecordingComplete(trackId);
      };

      // Handle recorder start
      recorder.onstart = () => {
        console.log(`🎤 RecordingManager: Audio recording started for track ${trackId}`);
        // Use performance.now() for consistency with recording timer and playhead
        recordingState.startTime = performance.now() / 1000;
        this.emit('recording-start', {
          trackId,
          type: 'audio',
          startTime: recordingState.startTime,
          startPosition: recordingState.recordingStartPosition
        });
      };

      // Store recorder and start
      recordingState.recorder = recorder;
      recorder.start(100); // Collect data every 100ms

    } catch (error) {
      console.error(`📍 RecordingManager: Error starting audio recording:`, error);
      this.stopRecording(trackId);
    }
  }

  /**
   * Start MIDI recording
   */
  async startMIDIRecording(trackId) {
    const recordingState = this.activeRecordings.get(trackId);
    if (!recordingState) {
      console.error(`📍 RecordingManager: Cannot start MIDI recording - no recording state`);
      return;
    }

    console.log(`🎹 RecordingManager: Starting MIDI recording for track ${trackId}`);

    // Create MIDI recorder object
    const tempo = recordingState.tempo || 120;
    const midiRecorder = {
      isRecording: true,
      startTime: performance.now() / 1000,
      tempo: tempo,
      notes: [],
      activeNotes: new Map(), // For tracking note on/off pairs

      handleMIDIMessage: (event) => {
        if (!midiRecorder.isRecording) return;

        const [status, note, velocity] = event.data;
        const timestamp = (performance.now() / 1000) - midiRecorder.startTime;

        // Note on
        if (status >= 144 && status < 160 && velocity > 0) {
          const noteData = { note, velocity, startTime: timestamp };
          midiRecorder.activeNotes.set(note, noteData);

          console.log(`🎹 RecordingManager: Note ON - pitch=${note}, startTime=${timestamp.toFixed(3)}s, tempo=${midiRecorder.tempo}`);

          this.emit('midi-note-on', {
            trackId,
            note,
            velocity,
            timestamp
          });
        }
        // Note off (or note on with velocity 0)
        else if ((status >= 128 && status < 144) ||
                 (status >= 144 && status < 160 && velocity === 0)) {
          const activeNote = midiRecorder.activeNotes.get(note);
          if (activeNote) {
            const duration = timestamp - activeNote.startTime;
            const recordedNote = {
              ...activeNote,
              duration,
              endTime: timestamp
            };
            midiRecorder.notes.push(recordedNote);
            midiRecorder.activeNotes.delete(note);

            console.log(`🎹 RecordingManager: Note OFF - pitch=${note}, startTime=${activeNote.startTime.toFixed(3)}s, duration=${duration.toFixed(3)}s`);

            this.emit('midi-note-off', {
              trackId,
              note,
              timestamp,
              duration
            });
          }
        }
      },

      stop: () => {
        midiRecorder.isRecording = false;
        // Handle any stuck notes
        midiRecorder.activeNotes.forEach((noteData, note) => {
          const timestamp = (performance.now() / 1000) - midiRecorder.startTime;
          const duration = timestamp - noteData.startTime;
          midiRecorder.notes.push({
            ...noteData,
            duration,
            endTime: timestamp
          });
        });
        midiRecorder.activeNotes.clear();
      }
    };

    // Set up MIDI input listeners
    if (this.midiAccess && recordingState.midiInput) {
      const input = this.midiAccess.inputs.get(recordingState.midiInput);
      if (input) {
        input.onmidimessage = midiRecorder.handleMIDIMessage;
      }
    }

    // Store recorder
    recordingState.recorder = midiRecorder;
    recordingState.startTime = midiRecorder.startTime;
    recordingState.midiEvents = midiRecorder.notes;

    // Emit start event
    this.emit('recording-start', {
      trackId,
      type: 'midi',
      startTime: recordingState.startTime,
      startPosition: recordingState.recordingStartPosition
    });
  }

  /**
   * Stop recording for a track
   */
  stopRecording(trackId) {
    const recordingState = this.activeRecordings.get(trackId);
    if (!recordingState) {
      console.warn(`📍 RecordingManager: No recording found for track ${trackId}`);
      return;
    }

    console.log(`📍 RecordingManager: Stopping recording for track ${trackId}`);

    // Stop the appropriate recorder
    if (recordingState.type === 'audio' && recordingState.recorder) {
      if (recordingState.recorder.state === 'recording') {
        recordingState.recorder.stop();
      }
    } else if (recordingState.type === 'midi' && recordingState.recorder) {
      recordingState.recorder.stop();
      this.handleMIDIRecordingComplete(trackId);
    }

    // Clean up MIDI input listeners
    if (recordingState.midiInput && this.midiAccess) {
      const input = this.midiAccess.inputs.get(recordingState.midiInput);
      if (input) {
        input.onmidimessage = null;
      }
    }

    // Don't delete audio recordings yet - let the onstop handler complete first
    // For MIDI, we can delete now since we handle completion synchronously
    if (recordingState.type === 'midi') {
      this.activeRecordings.delete(trackId);
    }

    // Emit stop event
    this.emit('recording-stop', { trackId, type: recordingState.type });
  }

  /**
   * Stop all active recordings
   */
  stopAllRecordings() {
    console.log(`📍 RecordingManager: Stopping all recordings`);
    const trackIds = Array.from(this.activeRecordings.keys());
    trackIds.forEach(trackId => this.stopRecording(trackId));
  }

  /**
   * Handle completed audio recording
   */
  async handleAudioRecordingComplete(trackId) {
    console.log(`📍 RecordingManager: handleAudioRecordingComplete called for track ${trackId}`);

    const recordingState = this.activeRecordings.get(trackId);
    if (!recordingState) {
      console.warn(`📍 RecordingManager: No recording state found for track ${trackId}`);
      return;
    }

    console.log(`📍 RecordingManager: Found recording state, chunks: ${recordingState.chunks?.length || 0}`);

    // Create blob from chunks
    const blob = new Blob(recordingState.chunks, {
      type: recordingState.recorder?.mimeType || 'audio/webm'
    });

    console.log(`📍 RecordingManager: Created blob, size: ${blob.size}`);

    // Decode audio to get duration
    let duration = 0;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      duration = audioBuffer.duration;
      console.log(`📍 RecordingManager: Decoded audio, duration: ${duration}`);
    } catch (error) {
      console.error('📍 RecordingManager: Error decoding audio:', error);
      duration = 10; // Fallback duration
    }

    const audioURL = URL.createObjectURL(blob);
    console.log(`📍 RecordingManager: Created audioURL: ${audioURL}`);

    // Emit completion event
    console.log(`📍 RecordingManager: Emitting audio-recording-complete event`, {
      trackId,
      duration,
      startPosition: recordingState.recordingStartPosition
    });
    this.emit('audio-recording-complete', {
      trackId,
      blob,
      duration,
      startPosition: recordingState.recordingStartPosition,
      audioURL  // Changed from 'url' to 'audioURL' to match AudioTrack expectations
    });

    // Clean up recording state after completion
    this.activeRecordings.delete(trackId);
    console.log(`📍 RecordingManager: Cleaned up recording state for track ${trackId}`);
  }

  /**
   * Handle completed MIDI recording
   */
  handleMIDIRecordingComplete(trackId) {
    const recordingState = this.activeRecordings.get(trackId);
    if (!recordingState) return;

    // Get recorded notes
    const notes = recordingState.recorder?.notes || [];

    console.log(`🎹 RecordingManager: MIDI recording complete`, {
      trackId,
      noteCount: notes.length,
      firstNote: notes[0],
      lastNote: notes[notes.length - 1],
      allNotes: notes
    });

    // Calculate duration
    const duration = notes.reduce((max, note) =>
      Math.max(max, (note.startTime + note.duration) || 0), 0
    );

    console.log(`🎹 RecordingManager: Emitting midi-recording-complete`, {
      trackId,
      noteCount: notes.length,
      duration,
      startPosition: recordingState.recordingStartPosition
    });

    // Emit completion event
    this.emit('midi-recording-complete', {
      trackId,
      notes,
      duration,
      startPosition: recordingState.recordingStartPosition
    });
  }

  /**
   * Get all active recording track IDs
   */
  getActiveTrackIds() {
    return Array.from(this.activeRecordings.keys());
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopAllRecordings();
    this.removeAllListeners();
    this.activeRecordings.clear();
  }
}

// Export as singleton
export default new RecordingManager();