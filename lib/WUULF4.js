// lib/StringEnsemble.js
'use client';

/**
 * WUULF4 - Inverted Space-Time Synthesizer
 *
 * The sonic opposite of WUULF3 - where WUULF3 is bright and aggressive,
 * WUULF4 is dark and ethereal. A complete inversion of synthesis parameters:
 *
 * - Slow, swelling attacks instead of sharp transients
 * - Sine/triangle waves instead of sawtooth/square
 * - Hollow wooden resonances instead of metallic formants
 * - Phase-drifting oscillators for fluid movement
 * - Inverse velocity response (quieter = brighter)
 * - Dark ambient textures instead of bright breath noise
 *
 * Part of the WUULF series of signature synthesizers
 */
export default class StringEnsemble {  // Keep class name for compatibility
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.options = {
      // Ensemble configuration - looser than WUULF3
      sectionSize: options.sectionSize || 4,          // More voices for thickness
      detuneSpread: options.detuneSpread || 15,       // Much wider detuning
      timingSpread: options.timingSpread || 0.025,    // Loose, flowing timing

      // Tone configuration - inverted from WUULF3
      darkness: options.darkness || 0.7,              // 0-1 darkness control
      hollowness: options.hollowness || 0.6,          // 0-1 hollow/wooden quality
      etherealness: options.etherealness || 0.8,      // 0-1 phase drift amount

      // Inverted dynamics
      inverseVelocity: options.inverseVelocity || true,
      velocitySensitivity: options.velocitySensitivity || 0.85,

      ...options
    };

    // Master output
    this.output = audioContext.createGain();
    // Boost gain significantly for offline rendering
    const isOfflineContext = audioContext.constructor.name === 'OfflineAudioContext';
    this.output.gain.value = isOfflineContext ? 2.5 : 0.85;
    if (isOfflineContext) {
      console.log('🌙 WUULF4: Using boosted gain (2.5) for OfflineAudioContext');
    }

    // Voice tracking
    this.activeVoices = new Map();

    // Create shared convolution reverb for ethereal space
    this.setupSpatialProcessing();

    console.log('🌙 WUULF4 initialized:', this.options.sectionSize, 'ethereal voices');
  }

  /**
   * Setup spatial processing for ethereal quality
   */
  setupSpatialProcessing() {
    // Pre-delay for spaciousness
    this.preDelay = this.audioContext.createDelay(1);
    this.preDelay.delayTime.value = 0.03;

    // Multiple comb filters for hollow resonance
    this.combFilters = [];
    const combFreqs = [110, 165, 220, 277]; // Hollow, wooden frequencies

    combFreqs.forEach(freq => {
      const comb = this.audioContext.createBiquadFilter();
      comb.type = 'peaking';
      comb.frequency.value = freq;
      comb.Q.value = 4; // Reduced Q for cleaner mixdown
      comb.gain.value = 3; // Reduced gain for less resonance
      this.combFilters.push(comb);
    });

    // Chain the comb filters
    let lastNode = this.preDelay;
    this.combFilters.forEach(comb => {
      lastNode.connect(comb);
      lastNode = comb;
    });

    // Final darkening filter
    this.darkeningFilter = this.audioContext.createBiquadFilter();
    this.darkeningFilter.type = 'highshelf';
    this.darkeningFilter.frequency.value = 3000;
    this.darkeningFilter.gain.value = -6; // Reduced attenuation for audibility

    lastNode.connect(this.darkeningFilter);
    this.darkeningFilter.connect(this.output);
  }

  /**
   * Play a note with WUULF4's inverted characteristics
   * @param {number} midiNote - MIDI note number
   * @param {number} velocity - Velocity 0-1
   * @param {number} time - Start time
   * @param {number|null} duration - Duration in seconds (if provided, auto-stops note)
   */
  playNote(midiNote, velocity = 0.7, time = this.audioContext.currentTime, duration = null) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    console.log(`🌙 WUULF4: Playing note ${midiNote} (${frequency.toFixed(2)}Hz) with velocity ${velocity.toFixed(2)}`);

    // Clean up any existing note
    this.stopNote(midiNote, time);

    const voices = [];

    // Create each voice with loose timing
    for (let i = 0; i < this.options.sectionSize; i++) {
      // Much looser timing than WUULF3
      const voiceTime = time + (Math.random() * this.options.timingSpread);
      const voice = this.createEtherealVoice(frequency, velocity, voiceTime, i);
      voices.push(voice);
    }

    this.activeVoices.set(midiNote, voices);
    console.log(`🌙 WUULF4: Created ${voices.length} voices for note ${midiNote}`);

    // Schedule automatic note-off if duration is provided
    if (duration !== null && duration > 0) {
      const stopTime = time + duration;

      // Store the scheduled stop for this note
      if (!this.scheduledStops) {
        this.scheduledStops = new Map();
      }
      this.scheduledStops.set(midiNote, stopTime);

      const releaseTime = 1.5; // WUULF4's longer release
      const actualStopTime = stopTime + releaseTime + 0.5;

      console.log(`🌙 WUULF4: Scheduling note ${midiNote} to stop at ${actualStopTime.toFixed(3)}s (duration: ${duration}s, release: ${releaseTime}s)`);

      // Calculate sustain level (matches createEtherealVoice envelope calculation)
      const invertedVelocity = this.options.inverseVelocity ?
        (1 - velocity * 0.7) : velocity;
      const sustainLevel = Math.max(0.5, 0.7 * invertedVelocity);

      // For offline contexts, we need to schedule the stop
      if (this.audioContext.constructor.name === 'OfflineAudioContext') {
        voices.forEach(voice => {
          // Schedule envelope release
          if (voice.envelope) {
            // Hold at sustain level until release time
            voice.envelope.gain.setValueAtTime(sustainLevel, stopTime);

            // Release from sustain to silence
            voice.envelope.gain.exponentialRampToValueAtTime(0.001, stopTime + releaseTime);
          }

          // CRITICAL: In OfflineAudioContext, we MUST call oscillator.stop()
          // Envelope fades alone don't stop oscillators from running
          if (voice.oscillators) {
            voice.oscillators.forEach(osc => {
              if (osc && osc.stop) {
                try {
                  osc.stop(actualStopTime);
                } catch (e) {
                  console.warn(`WUULF4: Failed to stop oscillator:`, e);
                }
              }
            });
          }

          // CRITICAL: Stop all buffer sources (looping noise generators)
          if (voice.bufferSources) {
            voice.bufferSources.forEach(bufferSource => {
              try {
                bufferSource.stop(actualStopTime);
              } catch (e) {
                console.warn(`WUULF4: Failed to stop buffer source:`, e);
              }
            });
          }
        });
      } else {
        // For real-time contexts, use setTimeout
        setTimeout(() => {
          this.stopNote(midiNote);
        }, duration * 1000);
      }
    }
  }

  /**
   * Create a single ethereal voice (opposite of brass voice)
   */
  createEtherealVoice(frequency, velocity, time, voiceIndex) {
    // === INVERTED VELOCITY RESPONSE ===
    const invertedVelocity = this.options.inverseVelocity ?
      (1 - velocity * 0.7) : velocity;

    // === WIDE DETUNING FOR PHASE DRIFT ===
    const detuneCents = (Math.random() - 0.5) * this.options.detuneSpread * 2;
    const voiceFreq = frequency * Math.pow(2, detuneCents / 1200);

    // === VOICE GAIN STRUCTURE ===
    const voiceGain = this.audioContext.createGain();
    // Boost base gain significantly for offline rendering
    const isOfflineContext = this.audioContext.constructor.name === 'OfflineAudioContext';
    const baseGain = isOfflineContext ? (1.5 / this.options.sectionSize) : (0.5 / this.options.sectionSize);

    // Inverted frequency response (higher notes are quieter)
    let freqDamp = 1.0;
    if (frequency > 520) freqDamp = 0.7;      // Above C5 (less damping)
    else if (frequency > 260) freqDamp = 0.85; // C4-C5
    else if (frequency > 130) freqDamp = 0.95; // C3-C4

    voiceGain.gain.value = baseGain * freqDamp;

    // === SOUND GENERATION (INVERTED) ===

    // 1. Slow swell instead of sharp attack
    const swell = this.createSlowSwell(voiceFreq, invertedVelocity, time);
    swell.node.connect(voiceGain);

    // 2. Pure, hollow tone instead of bright harmonics
    const tone = this.createHollowTone(voiceFreq, invertedVelocity, time);
    tone.output.connect(voiceGain);

    // 3. Dark ambient texture instead of bright breath
    const ambient = this.createDarkAmbience(voiceFreq, invertedVelocity, time);
    ambient.node.connect(voiceGain);

    // === INVERSE FILTERING ===
    // Start bright and filter down (opposite of WUULF3)
    const inverseFilt = this.audioContext.createBiquadFilter();
    inverseFilt.type = 'lowpass';
    // Lower velocity = higher cutoff (brighter)
    inverseFilt.frequency.value = 500 + (1 - velocity) * 3000;
    inverseFilt.Q.value = 0.5; // Low Q for smooth filtering

    voiceGain.connect(inverseFilt);

    // === PHASE MODULATION FOR ETHEREALNESS ===
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.frequency.value = 0.1 + Math.random() * 0.3; // Slow phase drift
    lfoGain.gain.value = 5 + voiceIndex * 2; // Different drift per voice

    lfo.connect(lfoGain);
    lfoGain.connect(inverseFilt.frequency);
    lfo.start(time);

    // === VOICE ENVELOPE ===
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;

    // Moderately slow attack (still much slower than WUULF3's 0.003s)
    const attack = 0.05 + Math.random() * 0.05; // Reduced from 0.3-0.5 to 0.05-0.1
    const decay = 0.2;
    const sustain = Math.max(0.5, 0.7 * invertedVelocity); // Higher minimum sustain

    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + attack);
    envelope.gain.exponentialRampToValueAtTime(sustain, time + attack + decay);

    // === OUTPUT (fixed routing) ===
    inverseFilt.connect(envelope);
    envelope.connect(this.preDelay);

    return {
      envelope: envelope,
      oscillators: [...swell.oscillators, ...tone.oscillators, lfo],
      bufferSources: [ambient.source],
      gains: [voiceGain, envelope]
    };
  }

  /**
   * Create slow swell (opposite of sharp attack)
   */
  createSlowSwell(frequency, velocity, time) {
    const swell = this.audioContext.createGain();

    // Use triangle wave (softest waveform)
    const osc = this.audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency * 0.5; // Sub-octave for depth

    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;

    // Very slow swell
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(velocity * 0.3, time + 0.5);
    envelope.gain.exponentialRampToValueAtTime(velocity * 0.15, time + 1.0);

    osc.connect(envelope);
    envelope.connect(swell);
    osc.start(time);

    // Add subtle sub-bass rumble
    const subOsc = this.audioContext.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = frequency * 0.25; // Two octaves down

    const subGain = this.audioContext.createGain();
    subGain.gain.value = velocity * 0.1;

    subOsc.connect(subGain);
    subGain.connect(swell);
    subOsc.start(time);

    // Return the oscillators so they can be stopped later
    return {
      node: swell,
      oscillators: [osc, subOsc]
    };
  }

  /**
   * Create hollow, wooden tone (opposite of metallic pulse)
   */
  createHollowTone(frequency, velocity, time) {
    const mixer = this.audioContext.createGain();
    mixer.gain.value = 1;

    const oscillators = [];

    // === SINE/TRIANGLE CORE (opposite of sawtooth/square) ===
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = frequency;

    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = frequency * 1.01; // Slight beating

    const gain1 = this.audioContext.createGain();
    const gain2 = this.audioContext.createGain();

    // Stronger levels for audibility
    gain1.gain.value = 0.8 * velocity;
    gain2.gain.value = 0.7 * velocity;

    // Faster fade-in for quicker response
    gain1.gain.setValueAtTime(0, time);
    gain1.gain.linearRampToValueAtTime(0.8 * velocity, time + 0.05);

    gain2.gain.setValueAtTime(0, time);
    gain2.gain.linearRampToValueAtTime(0.7 * velocity, time + 0.06);

    // === HOLLOW BODY RESONANCE ===
    // Use notch filters to create hollow spots
    const notch1 = this.audioContext.createBiquadFilter();
    notch1.type = 'notch';
    notch1.frequency.value = frequency * 3; // Remove 3rd harmonic
    notch1.Q.value = 10;

    const notch2 = this.audioContext.createBiquadFilter();
    notch2.type = 'notch';
    notch2.frequency.value = frequency * 5; // Remove 5th harmonic
    notch2.Q.value = 10;

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(notch1);
    gain2.connect(notch1);
    notch1.connect(notch2);
    notch2.connect(mixer);

    osc1.start(time);
    osc2.start(time);

    oscillators.push(osc1, osc2);

    // === WOODEN OVERTONES ===
    // Add specific wooden resonances
    const woodFreqs = [1.5, 2.2, 3.7]; // Non-harmonic ratios for wood

    woodFreqs.forEach((ratio, i) => {
      const woodOsc = this.audioContext.createOscillator();
      woodOsc.type = 'sine';
      woodOsc.frequency.value = frequency * ratio;

      const woodGain = this.audioContext.createGain();
      woodGain.gain.value = velocity * 0.05 / (i + 1);

      // Slow, random amplitude modulation
      const ampMod = this.audioContext.createOscillator();
      const ampModGain = this.audioContext.createGain();
      ampMod.frequency.value = 0.05 + Math.random() * 0.1;
      ampModGain.gain.value = woodGain.gain.value * 0.3;

      ampMod.connect(ampModGain);
      ampModGain.connect(woodGain.gain);

      woodOsc.connect(woodGain);
      woodGain.connect(mixer);

      woodOsc.start(time);
      ampMod.start(time);

      oscillators.push(woodOsc, ampMod);
    });

    return { output: mixer, oscillators };
  }

  /**
   * Create dark ambient texture (opposite of bright breath)
   */
  createDarkAmbience(frequency, velocity, time) {
    const ambient = this.audioContext.createGain();
    ambient.gain.value = velocity * 0.15;

    // Create dark noise
    const bufferSize = this.audioContext.sampleRate * 2;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    // Pink noise generation (darker than white)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      noiseData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Heavy low-pass filtering for darkness
    const darkFilter = this.audioContext.createBiquadFilter();
    darkFilter.type = 'lowpass';
    darkFilter.frequency.value = 200 + velocity * 100; // Very dark
    darkFilter.Q.value = 1;

    // Resonant band for rumble
    const rumbleFilter = this.audioContext.createBiquadFilter();
    rumbleFilter.type = 'bandpass';
    rumbleFilter.frequency.value = frequency * 0.5;
    rumbleFilter.Q.value = 5;

    noise.connect(darkFilter);
    darkFilter.connect(rumbleFilter);
    rumbleFilter.connect(ambient);

    noise.start(time);

    return {
      node: ambient,
      source: noise
    };
  }

  /**
   * Stop a playing note with long, gentle release
   */
  stopNote(midiNote, time = this.audioContext.currentTime) {
    const voices = this.activeVoices.get(midiNote);
    if (!voices) return;

    // Ensure time is valid
    if (!isFinite(time) || time === null || time === undefined) {
      time = this.audioContext.currentTime;
    }

    time = Math.max(0, Math.min(time, this.audioContext.currentTime + 10));

    // Much longer release than WUULF3 (1.5s vs 0.18s)
    const releaseTime = 1.5;

    voices.forEach(voice => {
      if (voice.envelope) {
        voice.envelope.gain.cancelScheduledValues(time);
        voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, time);
        // Gentle exponential release
        voice.envelope.gain.exponentialRampToValueAtTime(0.001, time + releaseTime);
      }

      if (voice.oscillators) {
        voice.oscillators.forEach(osc => {
          if (osc && osc.stop) {
            osc.stop(time + releaseTime + 0.5);
          }
        });
      }
    });

    // Cleanup after release
    setTimeout(() => {
      this.activeVoices.delete(midiNote);
    }, (releaseTime + 0.6) * 1000);
  }

  /**
   * Stop all playing notes
   */
  stopAllNotes(time = this.audioContext.currentTime) {
    // Ensure time is valid
    if (!isFinite(time) || time === null || time === undefined) {
      time = this.audioContext.currentTime;
    }

    this.activeVoices.forEach((voices, midiNote) => {
      this.stopNote(midiNote, time);
    });
  }

  /**
   * Connect output
   */
  connect(destination) {
    this.output.connect(destination);
  }

  /**
   * Disconnect output
   */
  disconnect() {
    this.output.disconnect();
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.stopAllNotes();
    this.disconnect();
    this.activeVoices.clear();
  }
}