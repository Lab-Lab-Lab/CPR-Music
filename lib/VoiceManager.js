// lib/VoiceManager.js
'use client';

/**
 * Voice Manager for MIDI synthesis
 * Handles polyphony limits, note stealing, and voice allocation
 */
export default class VoiceManager {
  constructor(maxVoices = 8) {
    this.maxVoices = maxVoices;
    this.activeVoices = new Map(); // midiNote -> { startTime, stopCallback, envelope }
    this.voiceQueue = []; // for LRU tracking
  }

  /**
   * Allocate a voice for a MIDI note
   * Returns true if voice was allocated, false if stolen
   */
  allocateVoice(midiNote, stopCallback, envelope) {
    const now = Date.now();
    
    // If note is already playing, stop the old one first
    if (this.activeVoices.has(midiNote)) {
      this.releaseVoice(midiNote);
    }

    // Check if we need to steal a voice
    if (this.activeVoices.size >= this.maxVoices) {
      this.stealOldestVoice();
    }

    // Allocate the voice
    this.activeVoices.set(midiNote, {
      startTime: now,
      stopCallback,
      envelope,
    });

    // Update LRU queue
    this.voiceQueue = this.voiceQueue.filter(note => note !== midiNote);
    this.voiceQueue.push(midiNote);

    return true;
  }

  /**
   * Release a voice by MIDI note
   */
  releaseVoice(midiNote) {
    const voice = this.activeVoices.get(midiNote);
    if (!voice) return false;

    // Fade out envelope to prevent clicking
    if (voice.envelope && voice.envelope.gain) {
      try {
        const audioContext = voice.envelope.context;
        const now = audioContext.currentTime;
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
        voice.envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.02); // 20ms fade
        
        // Schedule cleanup
        setTimeout(() => {
          if (voice.stopCallback) {
            voice.stopCallback();
          }
        }, 25);
      } catch (e) {
        // Fallback: immediate stop
        if (voice.stopCallback) {
          voice.stopCallback();
        }
      }
    } else {
      // No envelope, stop immediately
      if (voice.stopCallback) {
        voice.stopCallback();
      }
    }

    // Remove from tracking
    this.activeVoices.delete(midiNote);
    this.voiceQueue = this.voiceQueue.filter(note => note !== midiNote);
    
    return true;
  }

  /**
   * Steal the oldest (least recently used) voice
   */
  stealOldestVoice() {
    if (this.voiceQueue.length === 0) return;
    
    const oldestNote = this.voiceQueue[0];
    console.log(`VoiceManager: Stealing voice for note ${oldestNote}`);
    this.releaseVoice(oldestNote);
  }

  /**
   * Release all voices (panic/all notes off)
   */
  releaseAllVoices() {
    const notesToRelease = Array.from(this.activeVoices.keys());
    notesToRelease.forEach(note => this.releaseVoice(note));
  }

  /**
   * Get current voice usage info
   */
  getVoiceUsage() {
    return {
      active: this.activeVoices.size,
      max: this.maxVoices,
      usage: (this.activeVoices.size / this.maxVoices) * 100,
      activeNotes: Array.from(this.activeVoices.keys()).sort((a, b) => a - b),
    };
  }

  /**
   * Update max voices (useful for performance scaling)
   */
  setMaxVoices(maxVoices) {
    this.maxVoices = Math.max(1, maxVoices);
    
    // If we now have too many voices, steal extras
    while (this.activeVoices.size > this.maxVoices) {
      this.stealOldestVoice();
    }
  }

  /**
   * Clean up expired voices (for garbage collection)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    const expiredNotes = [];
    for (const [note, voice] of this.activeVoices) {
      if (now - voice.startTime > maxAge) {
        expiredNotes.push(note);
      }
    }
    
    expiredNotes.forEach(note => this.releaseVoice(note));
  }
}