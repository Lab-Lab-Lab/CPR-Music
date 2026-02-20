// lib/EnhancedSynth.js
'use client';

import WavetableSynth from './WavetableSynth';
import ADSREnvelope from './ADSREnvelope';
import WUULF4 from './WUULF4';  // Inverted space-time synthesizer
import WUULF3 from './WUULF3';  // Formant-pulse powered synthesizer

/**
 * Enhanced Synthesizer combining wavetables, ADSR, and velocity sensitivity
 * This is the main synthesis engine for MIDI tracks
 */
export class EnhancedSynth {
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.options = {
      maxVoices: 8,
      wavetable: 'sine',
      filterType: 'lowpass',
      filterFrequency: 2000,
      filterResonance: 1,
      velocitySensitivity: 0.8,
      ...options
    };

    // Create master output
    this.output = audioContext.createGain();
    // Boost gain significantly for offline rendering to compensate for envelope timing
    const isOfflineContext = audioContext.constructor.name === 'OfflineAudioContext';
    this.output.gain.value = isOfflineContext ? 2.5 : 0.7;
    if (isOfflineContext) {
      console.log('EnhancedSynth: Using boosted gain (2.5) for OfflineAudioContext');
    }
    
    // Voice management
    this.voices = new Map(); // midiNote -> voice object
    this.voiceCount = 0;
    
    // Get wavetable synth instance
    this.wavetableSynth = new WavetableSynth(audioContext, {
      maxVoices: this.options.maxVoices
    });
    
    // Initialize WUULF series synthesizers
    console.log('EnhancedSynth: Creating WUULF4 synthesizer...');
    this.stringEnsemble = new WUULF4(audioContext);  // WUULF4 - inverted space-time synth
    this.stringEnsemble.connect(this.output);
    console.log('EnhancedSynth: WUULF4 created and connected');

    console.log('EnhancedSynth: Creating WUULF3 synthesizer...');
    this.brassEnsemble = new WUULF3(audioContext);  // Keep variable name for compatibility
    this.brassEnsemble.connect(this.output);
    console.log('EnhancedSynth: WUULF3 created and connected');

    console.log('EnhancedSynth: Initialized with wavetables:', this.wavetableSynth.getWavetableNames());
    console.log('EnhancedSynth: WUULF3 and WUULF4 synthesizers available');
  }

  /**
   * Create a complete voice with wavetable, envelope, and filter
   */
  createVoice(midiNote, velocity, time, duration = null) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Create oscillator with wavetable
    const osc = this.audioContext.createOscillator();
    const wavetable = this.options.wavetable || 'sine';
    
    // Set up wavetable
    const periodicWave = this.wavetableSynth.createPeriodicWave(wavetable);
    if (periodicWave) {
      osc.setPeriodicWave(periodicWave);
    } else {
      osc.type = this.getOscillatorType(wavetable);
    }
    
    osc.frequency.setValueAtTime(frequency, time);
    
    // Create filter with velocity-sensitive cutoff
    const filter = this.audioContext.createBiquadFilter();
    filter.type = this.options.filterType;
    
    // Velocity affects filter cutoff
    const baseCutoff = this.options.filterFrequency;
    const velocityMod = this.options.velocitySensitivity * velocity + (1 - this.options.velocitySensitivity);
    const cutoff = Math.min(20000, baseCutoff * velocityMod);
    
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(this.options.filterResonance, time);
    
    // Get and store envelope settings
    const envelopeSettings = this.getEnvelopeSettings(wavetable);

    // Create ADSR envelope
    const envelope = new ADSREnvelope(this.audioContext, {
      ...envelopeSettings,
      velocitySensitivity: this.options.velocitySensitivity
    });

    // Create voice object
    const voice = {
      oscillator: osc,
      filter: filter,
      envelope: envelope,
      envelopeSettings: envelopeSettings, // Store for later reference
      midiNote: midiNote,
      velocity: velocity,
      startTime: time,
      frequency: frequency,
      wavetable: wavetable,
      isActive: true
    };
    
    // Connect audio chain: osc -> filter -> envelope -> output
    osc.connect(filter);
    filter.connect(envelope.input);
    envelope.connect(this.output);
    
    // Start envelope
    envelope.start(time, velocity, duration);

    // Start oscillator
    osc.start(time);

    // CRITICAL: Schedule oscillator stop if duration is provided
    if (duration !== null && duration > 0) {
      // Get envelope release time (default to 0.3s if not available)
      const releaseTime = envelopeSettings.release || 0.3;
      const actualStopTime = time + duration + releaseTime + 0.1; // Add buffer after release

      // In OfflineAudioContext, we MUST stop the oscillator at a specific time
      if (this.audioContext.constructor.name === 'OfflineAudioContext') {
        try {
          osc.stop(actualStopTime);
          console.log(`EnhancedSynth: Scheduled oscillator stop for note ${midiNote} at ${actualStopTime.toFixed(3)}s (OfflineAudioContext)`);
        } catch (e) {
          console.warn(`EnhancedSynth: Failed to schedule oscillator stop:`, e);
        }
      } else {
        // For real-time contexts, use setTimeout to avoid audio glitches
        setTimeout(() => {
          try {
            osc.stop();
            console.log(`EnhancedSynth: Stopped oscillator for note ${midiNote} (real-time)`);
          } catch (e) {
            // Oscillator may have already been stopped
          }
        }, (duration + releaseTime + 0.1) * 1000);
      }
    }

    return voice;
  }

  /**
   * Get appropriate envelope settings for wavetable type
   */
  getEnvelopeSettings(wavetable) {
    const presets = {
      sine: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
      triangle: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
      sawtooth: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.2 },
      square: { attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.15 },
      organ: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
      strings: { attack: 0.12, decay: 0.25, sustain: 0.85, release: 0.5 },
      brass: { attack: 0.08, decay: 0.15, sustain: 0.75, release: 0.25 },
      pad: { attack: 0.3, decay: 0.2, sustain: 0.6, release: 1.0 },
      bell: { attack: 0.001, decay: 1.0, sustain: 0.3, release: 2.0 },
      pluck: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.1 },
    };
    
    return presets[wavetable] || presets.sine;
  }

  /**
   * Fallback oscillator types for basic Web Audio API
   */
  getOscillatorType(wavetable) {
    const typeMap = {
      sine: 'sine',
      triangle: 'triangle',
      sawtooth: 'sawtooth',
      square: 'square',
      organ: 'sine',
      strings: 'sawtooth',
      brass: 'sawtooth',
      pad: 'triangle',
      bell: 'sine',
      pluck: 'sawtooth'
    };
    
    return typeMap[wavetable] || 'sine';
  }

  /**
   * Play a note
   */
  playNote(midiNote, velocity = 1, time = 0, duration = null) {
    time = time || this.audioContext.currentTime;
    
    // Stop existing note if playing
    if (this.voices.has(midiNote)) {
      this.stopNote(midiNote, time);
    }
    
    // Voice stealing if at limit
    if (this.voices.size >= this.options.maxVoices) {
      this.stealOldestVoice();
    }
    
    // Use WUULF4 for strings
    if (this.options.wavetable === 'strings') {
      console.log(`EnhancedSynth: WUULF4 TRIGGERED for note ${midiNote}`);
      // Use the WUULF4 inverted space-time synthesizer - FORWARD DURATION
      this.stringEnsemble.playNote(midiNote, velocity, time, duration);

      // Create a simple voice object for tracking
      const voice = {
        midiNote: midiNote,
        velocity: velocity,
        startTime: time,
        duration: duration, // Store duration for tracking
        frequency: 440 * Math.pow(2, (midiNote - 69) / 12),
        wavetable: 'wuulf4',
        isActive: true,
        isPhysicalModel: false,  // It's a synth, not physical modeling
        modelType: 'wuulf4'
      };

      this.voices.set(midiNote, voice);
      console.log(`EnhancedSynth: Playing note ${midiNote} with WUULF4 for ${duration}s`);
      return voice;
    }
    
    // Use WUULF3 synth (brass preset)
    if (this.options.wavetable === 'brass') {
      console.log(`EnhancedSynth: WUULF3 TRIGGERED for note ${midiNote}`);
      // Use the WUULF3 formant-pulse synthesizer - FORWARD DURATION
      this.brassEnsemble.playNote(midiNote, velocity, time, duration);

      // Create a simple voice object for tracking
      const voice = {
        midiNote: midiNote,
        velocity: velocity,
        startTime: time,
        duration: duration, // Store duration for tracking
        frequency: 440 * Math.pow(2, (midiNote - 69) / 12),
        wavetable: 'wuulf3',
        isActive: true,
        isPhysicalModel: false,  // It's a synth, not physical modeling
        modelType: 'wuulf3'
      };

      this.voices.set(midiNote, voice);
      console.log(`EnhancedSynth: Playing note ${midiNote} with WUULF3 for ${duration}s`);
      return voice;
    }
    
    // Create and store voice using wavetables for non-strings
    const voice = this.createVoice(midiNote, velocity, time, duration);
    this.voices.set(midiNote, voice);
    
    console.log(`EnhancedSynth: Playing note ${midiNote} (${voice.frequency.toFixed(2)}Hz) with ${voice.wavetable} wavetable`);
    
    return voice;
  }

  /**
   * Stop a note
   */
  stopNote(midiNote, time = 0) {
    const voice = this.voices.get(midiNote);
    if (!voice || !voice.isActive) return;
    
    time = time || this.audioContext.currentTime;
    
    // Handle WUULF synths
    if (voice.modelType === 'wuulf3' || voice.modelType === 'wuulf4' || voice.modelType === 'brass' || voice.modelType === 'strings') {
      if (voice.modelType === 'wuulf4' || voice.modelType === 'strings') {
        this.stringEnsemble.stopNote(midiNote, time);
      } else if (voice.modelType === 'brass' || voice.modelType === 'wuulf3') {
        this.brassEnsemble.stopNote(midiNote, time);
      }
      voice.isActive = false;
      this.voices.delete(midiNote);
      console.log(`EnhancedSynth: Stopping ${voice.modelType} note ${midiNote}`);
      return;
    }
    
    // Handle wavetable synthesis voices
    voice.envelope.stop(time);
    voice.isActive = false;

    // Get release time from envelope
    const releaseTimeSec = voice.envelope.release || 0.3;
    const actualStopTime = time + releaseTimeSec + 0.1;

    // Handle OfflineAudioContext differently than real-time
    if (this.audioContext.constructor.name === 'OfflineAudioContext') {
      // For offline rendering, must schedule stop immediately
      try {
        if (voice.oscillator && voice.oscillator.stop) {
          voice.oscillator.stop(actualStopTime);
        }
      } catch (e) {
        // Oscillator might already be stopped
      }
      // Clean up voice tracking immediately
      this.voices.delete(midiNote);
    } else {
      // For real-time contexts, use setTimeout
      const releaseTimeMs = releaseTimeSec * 1000 + 100;
      setTimeout(() => {
        try {
          if (voice.oscillator && voice.oscillator.stop) {
            voice.oscillator.stop();
          }
        } catch (e) {
          // Oscillator might already be stopped
        }

        // Clean up connections
        this.disconnectVoice(voice);
        this.voices.delete(midiNote);
      }, releaseTimeMs);
    }
    
    console.log(`EnhancedSynth: Stopping note ${midiNote}`);
  }

  /**
   * Steal the oldest active voice
   */
  stealOldestVoice() {
    let oldestTime = Infinity;
    let oldestNote = null;
    
    for (const [midiNote, voice] of this.voices) {
      if (voice.startTime < oldestTime) {
        oldestTime = voice.startTime;
        oldestNote = midiNote;
      }
    }
    
    if (oldestNote !== null) {
      console.log(`EnhancedSynth: Stealing voice for note ${oldestNote}`);
      this.stopNote(oldestNote);
    }
  }

  /**
   * Disconnect voice from audio graph
   */
  disconnectVoice(voice) {
    try {
      voice.oscillator?.disconnect();
      voice.filter?.disconnect();
      voice.envelope?.disconnect();
    } catch (e) {
      // May already be disconnected
    }
  }

  /**
   * Stop all notes (panic)
   */
  stopAllNotes(time = 0) {
    // Stop physical modeling instruments
    if (this.stringEnsemble) {
      this.stringEnsemble.stopAllNotes(time);
    }
    if (this.brassEnsemble) {
      this.brassEnsemble.stopAllNotes(time);
    }
    
    // Stop wavetable voices
    const notesToStop = Array.from(this.voices.keys());
    for (const midiNote of notesToStop) {
      this.stopNote(midiNote, time);
    }
  }

  /**
   * Set wavetable type
   */
  setWavetable(wavetableName) {
    if (this.wavetableSynth.getWavetableNames().includes(wavetableName)) {
      this.options.wavetable = wavetableName;
      console.log(`EnhancedSynth: Switched to ${wavetableName} wavetable`);
    }
  }

  /**
   * Set filter parameters
   */
  setFilter(type, frequency, resonance) {
    this.options.filterType = type;
    this.options.filterFrequency = frequency;
    this.options.filterResonance = resonance;
    
    // Update active voices
    for (const voice of this.voices.values()) {
      if (voice.filter) {
        voice.filter.type = type;
        voice.filter.frequency.value = frequency;
        voice.filter.Q.value = resonance;
      }
    }
  }

  /**
   * Set velocity sensitivity
   */
  setVelocitySensitivity(sensitivity) {
    this.options.velocitySensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    this.output.connect(destination);
  }

  /**
   * Disconnect from all destinations
   */
  disconnect() {
    this.output.disconnect();
  }

  /**
   * Dispose of synthesizer
   */
  dispose() {
    this.stopAllNotes();
    this.disconnect();
    this.wavetableSynth?.dispose();
    this.stringEnsemble?.dispose();
    this.brassEnsemble?.dispose();
    this.voices.clear();
  }

  /**
   * Get synthesis statistics
   */
  getStats() {
    return {
      activeVoices: this.voices.size,
      maxVoices: this.options.maxVoices,
      currentWavetable: this.options.wavetable,
      availableWavetables: this.wavetableSynth.getWavetableNames(),
    };
  }

  /**
   * Create instrument presets
   */
  static presets = {
    piano: {
      wavetable: 'sine',
      filterType: 'lowpass',
      filterFrequency: 3000,
      filterResonance: 0.5,
      velocitySensitivity: 0.9
    },
    organ: {
      wavetable: 'organ',
      filterType: 'lowpass', 
      filterFrequency: 4000,
      filterResonance: 0.3,
      velocitySensitivity: 0.5
    },
    strings: {
      wavetable: 'strings',
      filterType: 'lowpass',
      filterFrequency: 3200, // Higher to preserve string brightness
      filterResonance: 0.4,   // Lower resonance for more natural sound
      velocitySensitivity: 0.9 // High sensitivity for dynamic bowing
    },
    brass: {
      wavetable: 'brass',
      filterType: 'lowpass',
      filterFrequency: 2800, // Lower cutoff to tame harshness
      filterResonance: 0.8,   // Reduced resonance for more natural sound
      velocitySensitivity: 1.0 // Full velocity sensitivity for dynamic response
    },
    pad: {
      wavetable: 'pad',
      filterType: 'lowpass',
      filterFrequency: 1500,
      filterResonance: 0.4,
      velocitySensitivity: 0.6
    },
    bell: {
      wavetable: 'bell',
      filterType: 'lowpass',
      filterFrequency: 5000,
      filterResonance: 0.8,
      velocitySensitivity: 1.0
    },
    pluck: {
      wavetable: 'pluck',
      filterType: 'lowpass',
      filterFrequency: 2000,
      filterResonance: 0.6,
      velocitySensitivity: 0.8
    }
  };

  /**
   * Apply a preset
   */
  applyPreset(presetName) {
    const preset = EnhancedSynth.presets[presetName];
    if (preset) {
      Object.assign(this.options, preset);
      console.log(`EnhancedSynth: Applied ${presetName} preset`);
    }
  }
}

export default EnhancedSynth;