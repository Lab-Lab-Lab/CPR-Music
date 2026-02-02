// lib/Track.js
'use client';

/**
 * Track class representing a single track in the multitrack DAW
 */
export class Track {
  constructor(name = 'New Track', color = '#7bafd4') {
    this.id = generateId();
    this.name = name;
    this.color = color;
    this.audioURL = null;
    this.audioBuffer = null;

    // Track controls
    this.volume = 1.0; // 0-1
    this.pan = 0; // -1 to 1
    this.mute = false;
    this.solo = false;
    this.armed = false;

    // Audio nodes (will be created in audio context)
    this.sourceNode = null;
    this.gainNode = null;
    this.panNode = null;

    // Visual state
    this.height = 100; // pixels
    this.minimized = false;

    // Waveform state
    this.waveformPeaks = null;
    this.duration = 0;

    // Recording state
    this.isRecording = false;
    this.recordingStartTime = 0; // Where on the timeline the recording starts
    this.recordingDuration = 0; // Duration of the current recording

    // Multiple audio regions support (for future expansion)
    this.audioRegions = []; // Array of {startTime, duration, audioURL, audioBuffer}
  }

  /**
   * Set the audio URL and optionally the buffer
   */
  setAudio(url, buffer = null) {
    this.audioURL = url;
    this.audioBuffer = buffer;
    if (buffer) {
      this.duration = buffer.duration;
    }
  }

  /**
   * Start recording at a specific timeline position
   */
  startRecording(cursorPosition) {
    this.isRecording = true;
    this.recordingStartTime = cursorPosition;
    this.recordingDuration = 0;
    console.log(
      `Track ${this.name} starting recording at position ${cursorPosition}s`,
    );
  }

  /**
   * Stop recording
   */
  stopRecording() {
    this.isRecording = false;
    console.log(
      `Track ${this.name} stopped recording. Duration: ${this.recordingDuration}s`,
    );
  }

  /**
   * Set recording buffer when recording completes
   * This updates the track with the recorded audio positioned at recordingStartTime
   */
  setRecordingBuffer(audioURL, audioBuffer) {
    // For now, we'll replace the entire track audio
    // In the future, this could add to audioRegions for multi-region support
    this.audioURL = audioURL;
    this.audioBuffer = audioBuffer;
    this.duration = audioBuffer ? audioBuffer.duration : 0;

    // Store the recording position metadata
    this.audioRegions = [
      {
        startTime: this.recordingStartTime,
        duration: audioBuffer ? audioBuffer.duration : 0,
        audioURL: audioURL,
        audioBuffer: audioBuffer,
      },
    ];

    // Note: We keep recordingStartTime for the waveform positioning
    // Reset only the recording state
    this.isRecording = false;
    this.recordingDuration = 0;
  }

  /**
   * Create or update audio nodes for this track
   */
  setupAudioNodes(audioContext) {
    // Clean up existing nodes
    this.cleanup();

    // Create new nodes
    this.gainNode = audioContext.createGain();
    this.panNode = audioContext.createStereoPanner();

    // Set initial values
    this.gainNode.gain.value = this.mute ? 0 : this.volume;
    this.panNode.pan.value = this.pan;

    // Connect nodes: source -> gain -> pan -> destination
    this.gainNode.connect(this.panNode);

    return {
      input: this.gainNode,
      output: this.panNode,
    };
  }

  /**
   * Update gain based on mute/solo/volume state
   */
  updateGain(isSoloActive = false, isSoloed = false) {
    if (!this.gainNode) return;

    if (this.mute || (isSoloActive && !isSoloed)) {
      this.gainNode.gain.value = 0;
    } else {
      this.gainNode.gain.value = this.volume;
    }
  }

  /**
   * Update pan value
   */
  updatePan() {
    if (!this.panNode) return;
    this.panNode.pan.value = this.pan;
  }

  /**
   * Cleanup audio nodes
   */
  cleanup() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
      this.sourceNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.panNode) {
      this.panNode.disconnect();
      this.panNode = null;
    }
  }

  /**
   * Clone the track (for undo/redo)
   */
  clone() {
    const cloned = new Track(this.name, this.color);
    cloned.id = this.id;
    cloned.audioURL = this.audioURL;
    cloned.audioBuffer = this.audioBuffer;
    cloned.volume = this.volume;
    cloned.pan = this.pan;
    cloned.mute = this.mute;
    cloned.solo = this.solo;
    cloned.armed = this.armed;
    cloned.height = this.height;
    cloned.minimized = this.minimized;
    cloned.waveformPeaks = this.waveformPeaks;
    cloned.duration = this.duration;

    // Clone recording properties - CRITICAL for positioned recordings
    cloned.isRecording = this.isRecording;
    cloned.recordingStartTime = this.recordingStartTime;
    cloned.recordingDuration = this.recordingDuration;
    cloned.audioRegions = this.audioRegions ? [...this.audioRegions] : [];

    // Don't clone audio nodes - they need to be recreated
    cloned.sourceNode = null;
    cloned.gainNode = this.gainNode;
    cloned.panNode = this.panNode;

    return cloned;
  }

  /**
   * Serialize track for saving
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      audioURL: this.audioURL,
      volume: this.volume,
      pan: this.pan,
      mute: this.mute,
      solo: this.solo,
      armed: this.armed,
      height: this.height,
      minimized: this.minimized,
      duration: this.duration,
      recordingStartTime: this.recordingStartTime,
      audioRegions: this.audioRegions,
    };
  }

  /**
   * Create track from serialized data
   */
  static deserialize(data) {
    const track = new Track(data.name, data.color);
    track.id = data.id;
    track.audioURL = data.audioURL;
    track.volume = data.volume;
    track.pan = data.pan;
    track.mute = data.mute;
    track.solo = data.solo;
    track.armed = data.armed;
    track.height = data.height || 100;
    track.minimized = data.minimized || false;
    track.duration = data.duration || 0;
    track.recordingStartTime = data.recordingStartTime || 0;
    track.audioRegions = data.audioRegions || [];
    return track;
  }
}

// Simple ID generator (no external dependencies)
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Track utility functions
 */
export const TrackColors = [
  '#7bafd4', // Blue
  '#92ce84', // Green
  '#e75b5c', // Red
  '#cbb677', // Gold
  '#b999aa', // Purple
  '#92ceaa', // Teal
  '#f4a460', // Sandy
  '#9370db', // Medium Purple
];

export const getNextTrackColor = (existingTracks) => {
  const usedColors = existingTracks.map((t) => t.color);
  const availableColors = TrackColors.filter((c) => !usedColors.includes(c));
  return availableColors.length > 0 ? availableColors[0] : TrackColors[0];
};

export const getDefaultTrackName = (existingTracks) => {
  const trackNumbers = existingTracks
    .map((t) => {
      const match = t.name.match(/^Track (\d+)$/);
      return match ? parseInt(match[1]) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber =
    trackNumbers.length > 0 ? Math.max(...trackNumbers) + 1 : 1;

  return `Track ${nextNumber}`;
};
