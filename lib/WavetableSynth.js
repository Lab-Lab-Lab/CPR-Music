// lib/WavetableSynth.js
'use client';

/**
 * Advanced Wavetable Synthesizer for MIDI tracks
 * Provides rich, harmonic waveforms instead of basic oscillators
 */
export class WavetableSynth {
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Wavetable parameters
    this.wavetableSize = options.wavetableSize || 2048;
    this.wavetables = new Map();
    
    // Synthesis parameters
    this.maxVoices = options.maxVoices || 8;
    this.activeVoices = new Map(); // note -> voice data
    
    // Master output
    this.output = audioContext.createGain();
    this.output.gain.value = 0.7;
    
    // Initialize wavetables
    this.createWavetables();
  }

  /**
   * Create various wavetable types
   */
  createWavetables() {
    const size = this.wavetableSize;
    
    // Basic waveforms (improved versions)
    this.wavetables.set('sine', this.createSineWavetable(size));
    this.wavetables.set('triangle', this.createTriangleWavetable(size));
    this.wavetables.set('sawtooth', this.createSawtoothWavetable(size));
    this.wavetables.set('square', this.createSquareWavetable(size));
    
    // Rich harmonic waveforms
    this.wavetables.set('organ', this.createOrganWavetable(size));
    this.wavetables.set('strings', this.createStringsWavetable(size));
    this.wavetables.set('brass', this.createBrassWavetable(size));
    this.wavetables.set('pad', this.createPadWavetable(size));
    
    // Percussive waveforms
    this.wavetables.set('bell', this.createBellWavetable(size));
    this.wavetables.set('pluck', this.createPluckWavetable(size));
    
    console.log(`WavetableSynth: Created ${this.wavetables.size} wavetables`);
  }

  /**
   * Create enhanced sine wavetable with slight harmonic content
   */
  createSineWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      // Pure sine with tiny bit of 3rd harmonic for warmth
      buffer[i] = Math.sin(t) + 0.05 * Math.sin(3 * t);
    }
    return buffer;
  }

  /**
   * Create band-limited triangle wave
   */
  createTriangleWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      // Add harmonics up to Nyquist
      for (let h = 1; h < 20; h += 2) {
        const harmonic = h;
        const amplitude = 1 / (harmonic * harmonic);
        const phase = harmonic * t;
        sample += amplitude * Math.sin(phase) * (h % 4 === 1 ? 1 : -1);
      }
      buffer[i] = sample * 0.8; // Scale down to prevent clipping
    }
    return buffer;
  }

  /**
   * Create band-limited sawtooth wave
   */
  createSawtoothWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      // Add harmonics up to reasonable limit
      for (let h = 1; h <= 30; h++) {
        const amplitude = 1 / h;
        sample += amplitude * Math.sin(h * t);
      }
      buffer[i] = sample * 0.6; // Scale down
    }
    return buffer;
  }

  /**
   * Create band-limited square wave
   */
  createSquareWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      // Add odd harmonics only
      for (let h = 1; h <= 25; h += 2) {
        const amplitude = 1 / h;
        sample += amplitude * Math.sin(h * t);
      }
      buffer[i] = sample * 0.7;
    }
    return buffer;
  }

  /**
   * Create organ-like waveform (drawbar organ simulation)
   */
  createOrganWavetable(size) {
    const buffer = new Float32Array(size);
    // Simulate drawbar settings: 16', 8', 4', 2', 1-3/5', 1-1/3', 1'
    const drawbars = [0.8, 1.0, 0.6, 0.4, 0.3, 0.2, 0.1];
    const harmonics = [0.5, 1, 2, 4, 2.4, 3, 8]; // Corresponding harmonic ratios
    
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      
      for (let d = 0; d < drawbars.length; d++) {
        sample += drawbars[d] * Math.sin(harmonics[d] * t);
      }
      
      buffer[i] = sample * 0.3;
    }
    return buffer;
  }

  /**
   * Create string-like waveform (fallback for compatibility - use StringEnsemble for realistic strings)
   */
  createStringsWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      
      // Simple string-like harmonics as fallback
      const harmonics = [1, 2, 3, 4, 5];
      const amplitudes = [1.0, 0.7, 0.5, 0.3, 0.2];
      
      for (let h = 0; h < harmonics.length; h++) {
        sample += amplitudes[h] * Math.sin(harmonics[h] * t);
      }
      
      buffer[i] = sample * 0.3;
    }
    return buffer;
  }

  /**
   * Create brass-like waveform (fallback for compatibility - use BrassSection for realistic brass)
   */
  createBrassWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      
      // Simple brass-like harmonics as fallback
      const harmonics = [1, 2, 3, 4, 5, 6];
      const amplitudes = [1.0, 0.8, 0.6, 0.4, 0.3, 0.2];
      
      for (let h = 0; h < harmonics.length; h++) {
        sample += amplitudes[h] * Math.sin(harmonics[h] * t);
      }
      
      buffer[i] = sample * 0.3;
    }
    return buffer;
  }

  /**
   * Create pad-like waveform (rich, smooth harmonics)
   */
  createPadWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      
      // Multiple sine waves with slight detuning for thickness
      const frequencies = [1, 1.01, 2, 2.02, 3, 4.01, 5];
      const amplitudes = [1.0, 0.8, 0.5, 0.4, 0.3, 0.2, 0.1];
      
      for (let f = 0; f < frequencies.length; f++) {
        sample += amplitudes[f] * Math.sin(frequencies[f] * t);
      }
      
      buffer[i] = sample * 0.3;
    }
    return buffer;
  }

  /**
   * Create bell-like waveform with inharmonic partials
   */
  createBellWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      
      // Bell partials (not harmonic)
      const partials = [1, 2.76, 5.4, 8.93];
      const amplitudes = [1.0, 0.4, 0.2, 0.1];
      
      for (let p = 0; p < partials.length; p++) {
        sample += amplitudes[p] * Math.sin(partials[p] * t);
      }
      
      buffer[i] = sample * 0.6;
    }
    return buffer;
  }

  /**
   * Create plucked string waveform
   */
  createPluckWavetable(size) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / size) * 2 * Math.PI;
      let sample = 0;
      
      // Exponentially decaying harmonics
      for (let h = 1; h <= 20; h++) {
        const amplitude = Math.pow(0.8, h - 1) / h;
        sample += amplitude * Math.sin(h * t);
      }
      
      buffer[i] = sample * 0.5;
    }
    return buffer;
  }

  /**
   * Get wavetable by name with fallback
   */
  getWavetable(name) {
    return this.wavetables.get(name) || this.wavetables.get('sine');
  }

  /**
   * Create periodic wave from wavetable
   */
  createPeriodicWave(wavetableName) {
    const wavetable = this.getWavetable(wavetableName);
    const size = wavetable.length;
    
    // Convert to Fourier coefficients for PeriodicWave
    const real = new Float32Array(size / 2);
    const imag = new Float32Array(size / 2);
    
    // Simple approach: use wavetable directly as real part
    // In production, you'd do proper FFT
    real[0] = 0; // DC component
    for (let i = 1; i < real.length; i++) {
      real[i] = wavetable[i] * 0.5;
    }
    
    try {
      return this.audioContext.createPeriodicWave(real, imag);
    } catch (e) {
      console.warn('Failed to create PeriodicWave, falling back to sine');
      return null;
    }
  }

  /**
   * Play a note with wavetable synthesis
   */
  playNote(midiNote, velocity = 1, time = 0, wavetableName = 'sine') {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Create oscillator with wavetable
    const osc = this.audioContext.createOscillator();
    const periodicWave = this.createPeriodicWave(wavetableName);
    
    if (periodicWave) {
      osc.setPeriodicWave(periodicWave);
    } else {
      // Fallback to basic waveform
      osc.type = 'sine';
    }
    
    osc.frequency.setValueAtTime(frequency, time);
    
    // Create envelope
    const envelope = this.audioContext.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    
    // Connect
    osc.connect(envelope);
    envelope.connect(this.output);
    
    // Store voice
    const voice = {
      oscillator: osc,
      envelope: envelope,
      startTime: time,
      frequency: frequency,
      wavetable: wavetableName,
    };
    
    this.activeVoices.set(midiNote, voice);
    
    // Start oscillator
    osc.start(time);
    
    return voice;
  }

  /**
   * Stop a note
   */
  stopNote(midiNote, time = 0) {
    const voice = this.activeVoices.get(midiNote);
    if (!voice) return;
    
    // Quick fade out to prevent clicks
    const fadeTime = 0.02;
    voice.envelope.gain.cancelScheduledValues(time);
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, time);
    voice.envelope.gain.linearRampToValueAtTime(0.0001, time + fadeTime);
    
    // Stop oscillator
    voice.oscillator.stop(time + fadeTime + 0.01);
    
    // Clean up
    this.activeVoices.delete(midiNote);
  }

  /**
   * Stop all notes (panic)
   */
  stopAllNotes(time = 0) {
    for (const [midiNote] of this.activeVoices) {
      this.stopNote(midiNote, time);
    }
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
   * Dispose of the synthesizer
   */
  dispose() {
    this.stopAllNotes();
    this.disconnect();
    this.wavetables.clear();
  }

  /**
   * Get available wavetable names
   */
  getWavetableNames() {
    return Array.from(this.wavetables.keys());
  }
}

export default WavetableSynth;