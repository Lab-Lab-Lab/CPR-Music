// components/audio/DAW/Multitrack/MIDIScheduler.js
'use client';

/**
 * MIDIScheduler - Handles precise timing for MIDI playback
 * Uses Web Audio API's timing for sample-accurate scheduling
 */
export default class MIDIScheduler {
  constructor(audioContext, tempo = 120) {
    this.audioContext = audioContext;
    this.tempo = tempo;
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseTime = 0;
    this.scheduledEvents = [];
    this.lookahead = 0.1; // Schedule 100ms ahead
    this.scheduleInterval = 25; // Check every 25ms
    this.timerID = null;
  }

  // Convert beats to seconds based on tempo
  beatsToSeconds(beats) {
    return (beats / this.tempo) * 60;
  }

  // Convert seconds to beats
  secondsToBeats(seconds) {
    return (seconds / 60) * this.tempo;
  }

  // Start playback
  start(startOffset = 0) {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime - startOffset;
    
    // Start the scheduling loop
    this.scheduleLoop();
  }

  // Pause playback
  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    
    // Stop the scheduling loop
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
    
    // Cancel all scheduled events
    this.cancelScheduledEvents();
  }

  // Stop playback and reset
  stop() {
    this.pause();
    this.startTime = 0;
    this.pauseTime = 0;
  }

  // Get current playback time in seconds
  getCurrentTime() {
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseTime;
  }

  // Schedule a MIDI event
  scheduleEvent(event, callback) {
    const eventTime = this.startTime + event.time;
    
    // If the event is in the past, skip it
    if (eventTime < this.audioContext.currentTime) {
      return;
    }
    
    // Schedule the callback
    const timeUntilEvent = eventTime - this.audioContext.currentTime;
    const timerId = setTimeout(() => {
      callback(event);
      // Remove from scheduled events
      this.scheduledEvents = this.scheduledEvents.filter(e => e.id !== event.id);
    }, timeUntilEvent * 1000);
    
    this.scheduledEvents.push({
      id: event.id,
      timerId,
      eventTime
    });
  }

  // Cancel all scheduled events
  cancelScheduledEvents() {
    this.scheduledEvents.forEach(event => {
      clearTimeout(event.timerId);
    });
    this.scheduledEvents = [];
  }

  // Main scheduling loop
  scheduleLoop() {
    if (!this.isPlaying) return;
    
    const currentTime = this.getCurrentTime();
    const scheduleAheadTime = currentTime + this.lookahead;
    
    // This is where we'd call back to schedule notes
    // The actual scheduling is handled by the track components
    
    // Continue the loop
    this.timerID = setTimeout(() => {
      this.scheduleLoop();
    }, this.scheduleInterval);
  }

  // Set tempo
  setTempo(newTempo) {
    const wasPlaying = this.isPlaying;
    const currentBeat = this.secondsToBeats(this.getCurrentTime());
    
    if (wasPlaying) {
      this.pause();
    }
    
    this.tempo = newTempo;
    
    if (wasPlaying) {
      const newTime = this.beatsToSeconds(currentBeat);
      this.start(newTime);
    }
  }

  // Seek to a specific time
  seek(timeInSeconds) {
    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }
    
    this.pauseTime = timeInSeconds;
    
    if (wasPlaying) {
      this.start(timeInSeconds);
    }
  }
}

// MIDI utility functions
export const MIDIUtils = {
  // Note name to MIDI number
  noteToMIDI(noteName) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const parts = noteName.match(/([A-G]#?)(\d+)/);
    if (!parts) return 60; // Default to middle C
    
    const note = parts[1];
    const octave = parseInt(parts[2]);
    const noteIndex = notes.indexOf(note);
    
    return noteIndex + (octave + 1) * 12;
  },

  // MIDI number to note name
  MIDIToNote(midiNumber) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    
    return notes[noteIndex] + octave;
  },

  // MIDI number to frequency
  MIDIToFrequency(midiNumber) {
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
  },

  // Quantize time to grid
  quantizeTime(time, gridSize) {
    return Math.round(time / gridSize) * gridSize;
  },

  // Generate scale
  generateScale(root, scaleType) {
    const scales = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      phrygian: [0, 1, 3, 5, 7, 8, 10],
      lydian: [0, 2, 4, 6, 7, 9, 11],
      mixolydian: [0, 2, 4, 5, 7, 9, 10],
      aeolian: [0, 2, 3, 5, 7, 8, 10],
      locrian: [0, 1, 3, 5, 6, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      blues: [0, 3, 5, 6, 7, 10],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    };
    
    const intervals = scales[scaleType] || scales.major;
    return intervals.map(interval => root + interval);
  },

  // Check if note is in scale
  isNoteInScale(note, scale) {
    const noteClass = note % 12;
    return scale.some(scaleNote => scaleNote % 12 === noteClass);
  }
};