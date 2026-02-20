// lib/BrassEnsemble.js
'use client';

/**
 * WUULF3 - Formant-Pulse Powered Synthesizer
 *
 * A unique synthetic instrument using:
 * - Dual detuned sawtooth pulse waves for rich harmonic content
 * - Multiple formant resonances for metallic character
 * - Dynamic spectral evolution for expressive performance
 * - Bell radiation filters for presence and bite
 *
 * Part of the WUULF series of signature synthesizers
 */
export default class BrassEnsemble {  // Keep class name for compatibility
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.options = {
      // Ensemble configuration
      sectionSize: options.sectionSize || 2,        // Reduced for clarity
      detuneSpread: options.detuneSpread || 3,      // Less detuning
      timingSpread: options.timingSpread || 0.003,  // Tighter timing

      // Tone configuration
      brightness: options.brightness || 0.5,         // 0-1 brightness control
      warmth: options.warmth || 0.6,                // 0-1 warmth control
      presence: options.presence || 0.4,            // 0-1 presence/bite

      // Dynamics
      velocitySensitivity: options.velocitySensitivity || 0.85,

      ...options
    };

    // Master output
    this.output = audioContext.createGain();
    // Boost gain significantly for offline rendering
    const isOfflineContext = audioContext.constructor.name === 'OfflineAudioContext';
    this.output.gain.value = isOfflineContext ? 2.0 : 0.65;
    if (isOfflineContext) {
      console.log('🎺 WUULF3: Using boosted gain (2.0) for OfflineAudioContext');
    }

    // Voice tracking
    this.activeVoices = new Map();

    console.log('🎺 WUULF3 initialized:', this.options.sectionSize, 'voices');
  }

  /**
   * Play a note with the brass ensemble
   * @param {number} midiNote - MIDI note number
   * @param {number} velocity - Velocity 0-1
   * @param {number} time - Start time
   * @param {number|null} duration - Duration in seconds (if provided, auto-stops note)
   */
  playNote(midiNote, velocity = 0.7, time = this.audioContext.currentTime, duration = null) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    console.log(`🎺 WUULF3 playNote called:`, {
      midiNote,
      velocity,
      time,
      duration,
      contextType: this.audioContext.constructor.name,
      currentTime: this.audioContext.currentTime
    });

    // Clean up any existing note
    this.stopNote(midiNote, time);

    const voices = [];

    // Create each player's voice
    for (let i = 0; i < this.options.sectionSize; i++) {
      const voice = this.createBrassVoice(frequency, velocity, time, i);
      voices.push(voice);
    }

    this.activeVoices.set(midiNote, voices);

    console.log(`🎺 WUULF3: Created ${voices.length} voices for note ${midiNote}`, {
      oscillatorsPerVoice: voices[0]?.oscillators?.length,
      bufferSourcesPerVoice: voices[0]?.bufferSources?.length
    });

    // Schedule automatic note-off if duration is provided
    if (duration !== null && duration > 0) {
      const stopTime = time + duration;

      // Store the scheduled stop for this note
      if (!this.scheduledStops) {
        this.scheduledStops = new Map();
      }
      this.scheduledStops.set(midiNote, stopTime);

      const releaseTime = 0.18;
      const actualStopTime = stopTime + releaseTime + 0.1;

      console.log(`🎺 WUULF3: Scheduling note ${midiNote} to stop at ${actualStopTime.toFixed(3)}s (start: ${time.toFixed(3)}s, duration: ${duration.toFixed(3)}s, release: ${releaseTime}s)`);

      // For offline contexts, we need to schedule the stop
      if (this.audioContext.constructor.name === 'OfflineAudioContext') {
        voices.forEach((voice, voiceIdx) => {
        console.log(`🎺 WUULF3: Stopping voice ${voiceIdx} for note ${midiNote}:`, {
          hasEnvelope: !!voice.envelope,
          oscillatorsCount: voice.oscillators?.length,
          bufferSourcesCount: voice.bufferSources?.length
        });
        // Schedule envelope release
        if (voice.envelope) {
          // Calculate the sustain level (matches createEnvelope: 0.75 * velocity)
          const sustainLevel = 0.75 * velocity;

          // Hold at sustain level until release time
          voice.envelope.gain.setValueAtTime(sustainLevel, stopTime);

          // Release from sustain to silence
          voice.envelope.gain.exponentialRampToValueAtTime(0.001, stopTime + releaseTime);
        }

        // CRITICAL: Stop all oscillators in this voice
        if (voice.oscillators) {
          let oscsStopped = 0;
          voice.oscillators.forEach((o, idx) => {
            console.log(`🎺 WUULF3: Examining oscillator ${idx}:`, { hasOsc: !!o.osc, isArray: Array.isArray(o.osc), type: typeof o });
            // Handle both single oscillators and arrays of oscillators
            if (o.osc) {
              if (Array.isArray(o.osc)) {
                o.osc.forEach((oscillator, subIdx) => {
                  try {
                    console.log(`🎺 WUULF3: Stopping oscillator ${idx}.${subIdx} at ${actualStopTime.toFixed(3)}s`);
                    oscillator.stop(actualStopTime);
                    oscsStopped++;
                  } catch (e) {
                    console.warn(`WUULF3: Failed to stop oscillator ${idx}.${subIdx}:`, e);
                  }
                });
              } else {
                try {
                  console.log(`🎺 WUULF3: Stopping single oscillator ${idx} at ${actualStopTime.toFixed(3)}s`);
                  o.osc.stop(actualStopTime);
                  oscsStopped++;
                } catch (e) {
                  console.warn(`WUULF3: Failed to stop oscillator ${idx}:`, e);
                }
              }
            } else {
              console.warn(`🎺 WUULF3: Oscillator ${idx} has no .osc property!`, o);
            }
          });
          console.log(`🎺 WUULF3: Stopped ${oscsStopped} oscillators for voice ${voiceIdx}`);
        }

        // CRITICAL: Stop all buffer sources (looping noise generators)
        if (voice.bufferSources) {
          let buffersStopped = 0;
          voice.bufferSources.forEach((bufferSource, idx) => {
            try {
              console.log(`🎺 WUULF3: Stopping buffer source ${idx} at ${actualStopTime.toFixed(3)}s`);
              bufferSource.stop(actualStopTime);
              buffersStopped++;
            } catch (e) {
              console.warn(`WUULF3: Failed to stop buffer source ${idx}:`, e);
            }
          });
          console.log(`🎺 WUULF3: Stopped ${buffersStopped} buffer sources for voice ${voiceIdx}`);
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
   * Create a single brass player voice
   */
  createBrassVoice(frequency, velocity, time, playerIndex) {
    // === PLAYER VARIATIONS ===
    const detuneCents = (playerIndex - this.options.sectionSize / 2) *
                       this.options.detuneSpread / this.options.sectionSize;
    const playerFreq = frequency * Math.pow(2, detuneCents / 1200);
    const playerTime = time + (playerIndex * 0.002); // Subtle timing offset

    // === GAIN STRUCTURE ===
    const voiceGain = this.audioContext.createGain();
    // Boost base gain significantly for offline rendering
    const isOfflineContext = this.audioContext.constructor.name === 'OfflineAudioContext';
    const baseGain = isOfflineContext ? (1.0 / this.options.sectionSize) : (0.25 / this.options.sectionSize);

    // Frequency-dependent gain (lower notes need boost)
    let freqBoost = 1.0;
    if (frequency < 130) freqBoost = 2.0;      // Below C3
    else if (frequency < 260) freqBoost = 1.5; // C3-C4
    else if (frequency < 520) freqBoost = 1.2; // C4-C5

    voiceGain.gain.value = baseGain * freqBoost;

    // === SOUND GENERATION ===
    // 1. Attack transient
    const attack = this.createAttackTransient(playerFreq, velocity, playerTime);
    attack.node.connect(voiceGain);

    // 2. Core tone with evolving harmonics
    const tone = this.createEvolvingTone(playerFreq, velocity, playerTime);
    tone.output.connect(voiceGain);

    // 3. Breath/air component
    const breath = this.createBreathComponent(playerFreq, velocity, playerTime);
    breath.node.connect(voiceGain);

    // === FILTERING & SHAPING ===
    // Nonlinear waveshaping for metallic edge (CRUCIAL for brass sound)
    const waveshaper = this.createMetallicWaveshaper(velocity);
    voiceGain.connect(waveshaper);

    // Dynamic brightness filter
    const brightnessFilter = this.createBrightnessFilter(playerFreq, velocity, playerTime);
    waveshaper.connect(brightnessFilter);

    // Formant/body resonance (velocity affects lip tension/formants)
    const formantFilter = this.createFormantFilter(playerFreq, velocity);
    brightnessFilter.connect(formantFilter);

    // Bell radiation filters (high frequency emphasis)
    const bellFilters = this.createBellRadiationFilters(velocity);
    formantFilter.connect(bellFilters.input);

    // === ENVELOPE ===
    const envelope = this.createEnvelope(velocity, playerTime);
    bellFilters.output.connect(envelope);
    envelope.connect(this.output);

    return {
      oscillators: tone.oscillators,
      bufferSources: [...attack.sources, ...breath.sources],
      envelope,
      voiceGain,
      time: playerTime
    };
  }

  /**
   * Create the initial attack transient (burst excitation)
   */
  createAttackTransient(frequency, velocity, time) {
    const transient = this.audioContext.createBufferSource();
    const envelope = this.audioContext.createGain();

    // Generate unfiltered white noise burst (key for brass "chiff")
    const duration = 0.003; // Very short burst (3ms)
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Pure white noise for maximum "burst" effect
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }

    transient.buffer = buffer;

    // Sharp attack spike (reduced for cleaner mixdown)
    envelope.gain.setValueAtTime(velocity * 0.25, time); // Reduced from 0.5
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.003);

    transient.connect(envelope);
    transient.start(time);

    // Also add continuous breath noise to fundamental
    const breathNoise = this.audioContext.createBufferSource();
    const breathBuffer = this.audioContext.createBuffer(1, sampleRate * 0.5, sampleRate);
    const breathData = breathBuffer.getChannelData(0);

    for (let i = 0; i < breathData.length; i++) {
      breathData[i] = (Math.random() * 2 - 1) * 0.05; // Subtle noise
    }

    breathNoise.buffer = breathBuffer;
    breathNoise.loop = true;

    const breathGain = this.audioContext.createGain();
    breathGain.gain.value = velocity * 0.08;

    breathNoise.connect(breathGain);
    breathGain.connect(envelope);
    breathNoise.start(time);

    return {
      node: envelope,
      sources: [breathNoise] // transient is not looping so stops naturally
    };
  }

  /**
   * Create the main tone with pulse-based synthesis
   */
  createEvolvingTone(frequency, velocity, time) {
    const mixer = this.audioContext.createGain();
    mixer.gain.value = 1;

    const oscillators = [];

    // === PULSE WAVE CORE (contains all harmonics naturally) ===
    const pulseOsc = this.audioContext.createOscillator();
    const pulseGain = this.audioContext.createGain();

    // Use sawtooth (contains all harmonics) as base
    pulseOsc.type = 'sawtooth';
    pulseOsc.frequency.value = frequency;

    // Create pulse wave by mixing sawtooth with phase-shifted copy
    const pulseOsc2 = this.audioContext.createOscillator();
    const pulseGain2 = this.audioContext.createGain();
    pulseOsc2.type = 'sawtooth';
    pulseOsc2.frequency.value = frequency;
    pulseOsc2.detune.value = 1; // Very slight detune, no modulation

    // Strong fundamental level (no warmth reduction!)
    pulseGain.gain.value = 0.35 * velocity;
    pulseGain2.gain.value = -0.3 * velocity; // Inverted for pulse shape

    // Dynamic envelope
    pulseGain.gain.setValueAtTime(0, time);
    pulseGain.gain.linearRampToValueAtTime(0.4 * velocity, time + 0.003);
    pulseGain.gain.exponentialRampToValueAtTime(0.35 * velocity, time + 0.03);

    pulseGain2.gain.setValueAtTime(0, time);
    pulseGain2.gain.linearRampToValueAtTime(-0.35 * velocity, time + 0.003);
    pulseGain2.gain.exponentialRampToValueAtTime(-0.3 * velocity, time + 0.03);

    // === ENHANCED FUNDAMENTAL (for body) ===
    const fundamental = this.createLipBuzzFundamental(frequency, velocity, time);
    fundamental.output.connect(mixer);
    oscillators.push(fundamental);

    // Filter the pulse to shape harmonics
    const pulseFilter = this.audioContext.createBiquadFilter();
    pulseFilter.type = 'lowpass';
    pulseFilter.frequency.value = 4000 + velocity * 8000; // Bright when loud
    pulseFilter.Q.value = 1.5;

    pulseOsc.connect(pulseGain);
    pulseOsc2.connect(pulseGain2);
    pulseGain.connect(pulseFilter);
    pulseGain2.connect(pulseFilter);
    pulseFilter.connect(mixer);

    pulseOsc.start(time);
    pulseOsc2.start(time);

    oscillators.push({ osc: [pulseOsc, pulseOsc2], gain: pulseGain });

    return { output: mixer, oscillators };
  }

  /**
   * Create lip buzz fundamental (complex waveform)
   */
  createLipBuzzFundamental(frequency, velocity, time) {
    // Two oscillators slightly detuned for buzz effect
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();
    const gain2 = this.audioContext.createGain();
    const mixer = this.audioContext.createGain();

    // Square wave gives buzz-like quality
    osc1.type = 'square';
    osc2.type = 'sawtooth';

    // Main frequency
    osc1.frequency.value = frequency;
    // Very minimal detune to avoid pitch wobble
    osc2.frequency.value = frequency * 1.001;

    // Filter to soften the harsh square
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency * 2.5;
    filter.Q.value = 1;

    // Much stronger fundamental (key to brass!)
    gain1.gain.value = 0.4;  // Square stronger
    gain2.gain.value = 0.3;   // Saw stronger
    mixer.gain.value = velocity;

    // Dynamic envelope for fundamental
    mixer.gain.setValueAtTime(0, time);
    mixer.gain.linearRampToValueAtTime(velocity * 0.5, time + 0.005);
    mixer.gain.exponentialRampToValueAtTime(velocity * 0.4, time + 0.05);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(mixer);

    osc1.start(time);
    osc2.start(time);

    return {
      output: mixer,
      osc: [osc1, osc2],
      gain: mixer
    };
  }

  /**
   * Create subtle breath/air component
   */
  createBreathComponent(frequency, velocity, time) {
    const noise = this.audioContext.createBufferSource();
    const filter = this.audioContext.createBiquadFilter();
    const envelope = this.audioContext.createGain();

    // Generate filtered noise
    const duration = 0.5;
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1;
    }

    noise.buffer = buffer;
    noise.loop = true;

    // High-pass to keep only air frequencies
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    // Very subtle level
    envelope.gain.value = velocity * 0.015 * this.options.presence;

    noise.connect(filter);
    filter.connect(envelope);
    noise.start(time);

    return {
      node: envelope,
      sources: [noise]
    };
  }

  /**
   * Create dynamic brightness filter
   */
  createBrightnessFilter(frequency, velocity, time) {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';

    // MUCH wider range for metallic brass sound
    const quietCutoff = frequency * 3;  // pp: 3x fundamental
    const loudCutoff = 12000;           // ff: very bright!

    // Velocity dramatically affects brightness (key to brass)
    const attackCutoff = quietCutoff + (loudCutoff - quietCutoff) * Math.pow(velocity, 0.7);
    const sustainCutoff = quietCutoff + (loudCutoff - quietCutoff) * Math.pow(velocity, 0.8) * 0.7;

    // Start very bright, settle to still-bright sustain
    filter.frequency.setValueAtTime(attackCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(sustainCutoff, time + 0.05);

    // Higher Q for more resonant filter sweep
    filter.Q.value = 1.0 + velocity * 0.5;

    return filter;
  }

  /**
   * Create metallic waveshaper (key to brass sound!)
   */
  createMetallicWaveshaper(velocity) {
    const shaper = this.audioContext.createWaveShaper();

    // Tanh curve for soft saturation (creates metallic harmonics)
    // REDUCED for cleaner mixdown - less aggressive distortion
    const amount = 0.15 + velocity * 0.3; // Much gentler than before (was 0.3 + 0.7)
    const samples = 2048;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * 2 - 1;
      // Tanh creates soft clipping that generates harmonics
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }

    shaper.curve = curve;
    shaper.oversample = '4x'; // High quality to avoid aliasing

    return shaper;
  }

  /**
   * Create bell radiation filters (high frequency emphasis)
   */
  createBellRadiationFilters(velocity) {
    // Brass "bite" at 2.2kHz - REDUCED for cleaner sound
    const biteFilter = this.audioContext.createBiquadFilter();
    biteFilter.type = 'peaking';
    biteFilter.frequency.value = 2200;
    biteFilter.Q.value = 0.8; // Lower Q for smoother boost (was 1.5)
    biteFilter.gain.value = 1 + velocity * 2; // 1-3dB boost (was 3-8dB)

    // High frequency "sparkle" (bell radiation) - REDUCED
    const sparkleFilter = this.audioContext.createBiquadFilter();
    sparkleFilter.type = 'highshelf';
    sparkleFilter.frequency.value = 7000;
    sparkleFilter.gain.value = 1 + velocity * 2; // 1-3dB boost (was 2-8dB)

    // Air/presence boost - REDUCED
    const airFilter = this.audioContext.createBiquadFilter();
    airFilter.type = 'peaking';
    airFilter.frequency.value = 10000;
    airFilter.Q.value = 0.5; // Lower Q (was 0.7)
    airFilter.gain.value = 0.5 + velocity * 1.5; // 0.5-2dB boost (was 1-4dB)

    // Chain them
    biteFilter.connect(sparkleFilter);
    sparkleFilter.connect(airFilter);

    return {
      input: biteFilter,
      output: airFilter
    };
  }

  /**
   * Create formant filter for brass body resonance
   */
  createFormantFilter(frequency, velocity) {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'peaking';

    // Strong formants for metallic character
    let baseFormant;
    if (frequency < 200) {
      baseFormant = 500;  // Low brass (tuba/trombone)
    } else if (frequency < 400) {
      baseFormant = 700;  // Mid brass (horn/euphonium)
    } else {
      baseFormant = 900;  // High brass (trumpet)
    }

    // Velocity strongly affects formant (lip tension)
    const formantFreq = baseFormant + (velocity * 300);

    filter.frequency.value = formantFreq;
    filter.Q.value = 1.5 + (velocity * 1.0);  // REDUCED Q for cleaner sound (was 3.0 + 2.0)
    filter.gain.value = 2 + (velocity * 2);    // REDUCED resonance 2-4dB (was 4-8dB)

    return filter;
  }

  /**
   * Create amplitude envelope
   */
  createEnvelope(velocity, time) {
    const envelope = this.audioContext.createGain();

    // Brass-appropriate ADSR
    const attack = 0.012;
    const decay = 0.04;
    const sustain = 0.75 * velocity;

    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + attack);
    envelope.gain.exponentialRampToValueAtTime(sustain, time + attack + decay);

    return envelope;
  }

  /**
   * Stop a playing note
   */
  stopNote(midiNote, time = this.audioContext.currentTime) {
    const voices = this.activeVoices.get(midiNote);
    if (!voices) return;

    // Ensure time is a valid finite number
    if (!isFinite(time) || time === null || time === undefined) {
      time = this.audioContext.currentTime;
    }

    // Clamp time to a reasonable range to avoid negative or extremely large values
    time = Math.max(0, Math.min(time, this.audioContext.currentTime + 10));

    const releaseTime = 0.18;

    voices.forEach(voice => {
      if (voice.envelope) {
        voice.envelope.gain.cancelScheduledValues(time);
        voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, time);
        voice.envelope.gain.exponentialRampToValueAtTime(0.001, time + releaseTime);
      }

      if (voice.oscillators) {
        voice.oscillators.forEach(o => {
          // Handle both single oscillators and arrays of oscillators
          if (o.osc) {
            if (Array.isArray(o.osc)) {
              o.osc.forEach(oscillator => oscillator.stop(time + releaseTime + 0.1));
            } else {
              o.osc.stop(time + releaseTime + 0.1);
            }
          }
        });
      }
    });

    setTimeout(() => {
      this.activeVoices.delete(midiNote);
    }, (releaseTime + 0.2) * 1000);
  }

  /**
   * Stop all playing notes
   */
  stopAllNotes(time = this.audioContext.currentTime) {
    // Ensure time is a valid finite number
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
}