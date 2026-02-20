// components/audio/DAW/Multitrack/Instruments/WebAudioInstruments.js

/**
 * playNote returns a handle (voice object); stopNote accepts either a handle (to stop one voice) or a time (to stop all voices for the note).
 */
'use client';

/**
 * Collection of Web Audio instruments for MIDI playback
 * Updated to accept external AudioContext for better performance
 */

// Base instrument class
class BaseInstrument {
  constructor(audioContext) {
    this.audioContext = audioContext; // Use provided context
    // Map<midiNote, Set<Voice>>; each Voice is an object with nodes/params
    this.activeNotes = new Map();
    this.output = audioContext.createGain();
    this.output.gain.value = 0.8;
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  // Must be implemented by subclasses
  playNote(midiNote, velocity, time) {
    throw new Error('playNote must be implemented');
  }

  stopNote(midiNote, time) {
    throw new Error('stopNote must be implemented');
  }

  stopAllNotes(time = this.audioContext.currentTime) {
    this.activeNotes.forEach((voices, midiNote) => {
      if (!voices) return;
      // Stop all voices for this note at the given time
      this.stopNote(midiNote, time);
    });
  }

  dispose() {
    this.stopAllNotes();
    this.disconnect();
  }
}

// Simple Subtractive Synthesizer
export class SubtractiveSynth extends BaseInstrument {
  constructor(audioContext, preset = 'default') {
    super(audioContext);

    // Preset configurations
    this.presets = {
      default: {
        oscillatorType: 'sawtooth',
        filterFrequency: 2000,
        filterResonance: 5,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        detune: 0,
      },
      bass: {
        oscillatorType: 'sawtooth',
        filterFrequency: 800,
        filterResonance: 10,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.8,
        release: 0.1,
        detune: 5,
      },
      lead: {
        oscillatorType: 'square',
        filterFrequency: 3000,
        filterResonance: 15,
        attack: 0.005,
        decay: 0.1,
        sustain: 0.6,
        release: 0.5,
        detune: 8,
      },
      pad: {
        oscillatorType: 'sawtooth',
        filterFrequency: 1500,
        filterResonance: 2,
        attack: 0.8,
        decay: 0.3,
        sustain: 0.7,
        release: 1.5,
        detune: 12,
      },
      pluck: {
        oscillatorType: 'triangle',
        filterFrequency: 4000,
        filterResonance: 5,
        attack: 0.001,
        decay: 0.3,
        sustain: 0.0,
        release: 0.5,
        detune: 0,
      },
    };

    this.setPreset(preset);
  }

  setPreset(presetName) {
    this.config = this.presets[presetName] || this.presets.default;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    // Support overlapping voices of the same note; no auto-stop here

    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Create oscillators (2 for detune effect)
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    osc1.type = this.config.oscillatorType;
    osc2.type = this.config.oscillatorType;
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency;
    osc2.detune.value = this.config.detune;

    // Create filter
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.config.filterFrequency;
    filter.Q.value = this.config.filterResonance;

    // Create envelope
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;

    // Connect nodes
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.output);

    // Apply ADSR envelope
    const attackTime = time + this.config.attack;
    const decayTime = attackTime + this.config.decay;
    const sustainLevel = velocity * this.config.sustain * 0.3;
    const peakLevel = velocity * 0.3;

    // Start just above 0 so micro‑notes don’t step upward at release
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(peakLevel, attackTime);
    envelope.gain.exponentialRampToValueAtTime(sustainLevel + 0.001, decayTime);

    // Start oscillators
    osc1.start(time);
    osc2.start(time);

    const voice = {
      oscillators: [osc1, osc2],
      envelope,
      filter,
      sustainLevel,
      startTime: time,
      release: this.config.release,
    };
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);
    return voice; // handle
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { oscillators, envelope, release = this.config.release } = voice;
      const p = envelope.gain;
      const end = when + release;
      if (typeof p.cancelAndHoldAtTime === 'function') {
        p.cancelAndHoldAtTime(when);
      } else {
        p.cancelScheduledValues(when);
        const tc = Math.max(0.01, release * 0.3);
        p.setTargetAtTime(0.0001, when, tc);
      }
      p.exponentialRampToValueAtTime(0.0001, end);
      oscillators.forEach((osc) => {
        try {
          osc.stop(end);
        } catch {}
      });
      setTimeout(
        () => {
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (release + 0.1) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      // Treat as a handle → stop just this voice now
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      // Treat as a time number → stop all voices for this note at that time
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// WUULF - Ethereal Time-Warping Synthesizer
export class WuulfSynth extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Create effects chain
    this.reverb = this.createReverb();
    this.delay = this.createDelay();
    this.chorus = this.createChorus();
    this.shimmer = this.createShimmer();

    // Master limiter to prevent clipping
    this.limiter = audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    // Signal routing
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.3;

    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.7;

    // Connect effects chain
    this.output.connect(this.dryGain);
    this.output.connect(this.chorus);
    this.chorus.connect(this.shimmer);
    this.shimmer.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    this.dryGain.connect(this.limiter);
    this.wetGain.connect(this.limiter);
  }

  connect(destination) {
    this.limiter.connect(destination);
  }

  disconnect() {
    this.limiter.disconnect();
  }

  createReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 4; // 4 second reverb
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Ethereal reverb with exponential decay and random reflections
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  createDelay() {
    // Multi-tap delay for spaciousness
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    // Create multiple delay taps
    const delayTimes = [0.375, 0.5, 0.75, 1.0]; // Musical divisions
    const feedbacks = [0.4, 0.3, 0.2, 0.15];

    delayTimes.forEach((delayTime, i) => {
      const delay = this.audioContext.createDelay(5);
      const feedback = this.audioContext.createGain();
      const tapGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      // Each tap has different characteristics
      delay.delayTime.value = delayTime;
      feedback.gain.value = feedbacks[i];
      tapGain.gain.value = 0.5 - i * 0.1;

      // Progressively darker delays
      filter.type = 'lowpass';
      filter.frequency.value = 3000 - i * 500;

      input.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(tapGain);
      tapGain.connect(output);
    });

    return output;
  }

  createChorus() {
    // More complex chorus with 6 voices
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const delays = [];
    const lfos = [];
    const gains = [];

    // Create 6 chorus voices for ultra-lush sound
    for (let i = 0; i < 6; i++) {
      const delay = this.audioContext.createDelay(0.1);
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      const voiceGain = this.audioContext.createGain();

      // Varied delay times for thickness
      delay.delayTime.value = 0.015 + i * 0.008;

      // Multiple LFO shapes for complex modulation
      lfo.type = ['sine', 'triangle', 'sine', 'triangle', 'sine', 'triangle'][
        i
      ];
      lfo.frequency.value = 0.3 + i * 0.17; // Different rates
      lfoGain.gain.value = 0.003 + i * 0.0005;

      // Different levels for each voice
      voiceGain.gain.value = 0.7 - i * 0.08;

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      delay.connect(voiceGain);
      voiceGain.connect(output);

      delays.push(delay);
      lfos.push(lfo);
      gains.push(voiceGain);
    }

    // Add dry signal for presence
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.5;
    input.connect(dryGain);
    dryGain.connect(output);

    return input;
  }

  createShimmer() {
    // Pitch shifter for ethereal shimmer
    const shifter = this.audioContext.createGain();
    return shifter; // Simplified for now, would need granular synthesis for true pitch shift
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Create a complex voice with multiple oscillators
    const voice = {
      oscillators: [],
      filters: [],
      gains: [],
      lfos: [],
      panners: [],
      startTime: time,
    };

    // Main tone - MORE detuned oscillators for super lush sound
    const detunes = [-12, -7, -3, 0, 3, 7, 12]; // Cents
    for (let i = 0; i < detunes.length; i++) {
      const osc = this.audioContext.createOscillator();
      const filter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      // Mix of waveforms for complexity
      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.value = frequency;
      osc.detune.value = detunes[i] + (Math.random() - 0.5) * 4; // Slight random detune

      // Warmer, more musical filter
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 400 + midiNote * 10;
      filter.Q.value = 2 + Math.random() * 3;

      // Spread voices across stereo field
      panner.pan.value = (i - 3) * 0.25; // -0.75 to +0.75

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.filters.push(filter);
      voice.gains.push(gain);
      voice.panners.push(panner);
    }

    // Sub oscillator - TWO octaves for deep lushness
    for (let oct = 1; oct <= 2; oct++) {
      const subOsc = this.audioContext.createOscillator();
      const subGain = this.audioContext.createGain();
      const subPanner = this.audioContext.createStereoPanner();

      subOsc.type = 'sine';
      subOsc.frequency.value = frequency / (oct * 2);
      subOsc.detune.value = (Math.random() - 0.5) * 5; // Slight detune for warmth

      // Slight stereo spread on subs
      subPanner.pan.value = oct === 1 ? -0.2 : 0.2;

      subOsc.connect(subGain);
      subGain.connect(subPanner);
      subPanner.connect(this.output);

      voice.oscillators.push(subOsc);
      voice.gains.push(subGain);
      voice.panners.push(subPanner);
    }

    // Ethereal high harmonics - MORE of them!
    const harmonics = [3, 5, 7, 9, 11, 13]; // More harmonics
    harmonics.forEach((harmonic, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();
      const filter = this.audioContext.createBiquadFilter();

      // Mix of sine and triangle for softer harmonics
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = frequency * harmonic;
      osc.detune.value = (Math.random() - 0.5) * 10; // More detune variation

      // Gentle highpass to remove muddiness
      filter.type = 'highpass';
      filter.frequency.value = 200;

      // Spread harmonics in stereo field
      panner.pan.value = Math.sin(i * 0.7) * 0.8;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
      voice.panners.push(panner);
    });

    // MULTIPLE LFOs for rich modulation
    // Filter modulation LFO
    const filterLfo = this.audioContext.createOscillator();
    const filterLfoGain = this.audioContext.createGain();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 0.1 + Math.random() * 0.2;
    filterLfoGain.gain.value = 200 + midiNote * 8;

    filterLfo.connect(filterLfoGain);
    voice.filters.forEach((filter) => {
      filterLfoGain.connect(filter.frequency);
    });
    filterLfo.start(time);
    voice.lfos.push(filterLfo);

    // Amplitude modulation LFO for shimmer
    const ampLfo = this.audioContext.createOscillator();
    const ampLfoGain = this.audioContext.createGain();
    ampLfo.type = 'triangle';
    ampLfo.frequency.value = 3 + Math.random() * 2; // Faster tremolo
    ampLfoGain.gain.value = 0.1;

    const ampModulator = this.audioContext.createGain();
    ampModulator.gain.value = 1;

    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(ampModulator.gain);
    ampLfo.start(time);
    voice.lfos.push(ampLfo);

    // Pan modulation for movement
    const panLfo = this.audioContext.createOscillator();
    panLfo.type = 'sine';
    panLfo.frequency.value = 0.2 + Math.random() * 0.1;

    voice.panners.forEach((panner, i) => {
      if (i < 3) {
        // Only modulate main oscillators
        const panGain = this.audioContext.createGain();
        panGain.gain.value = 0.3;
        panLfo.connect(panGain);
        panGain.connect(panner.pan);
      }
    });
    panLfo.start(time);
    voice.lfos.push(panLfo);

    // Complex envelope with multiple stages
    const attack = 1.2 + Math.random() * 0.8; // Even slower attack
    const decay = 1.5;
    const sustain = 0.7;
    const peak = velocity * 0.12; // Slightly lower for headroom

    // Main oscillators envelope - staggered attacks for lushness
    voice.gains.slice(0, 7).forEach((gain, i) => {
      const stagger = i * 0.05; // Slight time offset
      const gainScale = 1 - i * 0.05; // Slightly different levels
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        peak * gainScale,
        time + attack + stagger,
      );
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * gainScale + 0.001,
        time + attack + decay + stagger,
      );
    });

    // Sub oscillators envelope (even slower attack)
    voice.gains.slice(7, 9).forEach((gain, i) => {
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        peak * 0.6 * (1 - i * 0.2),
        time + attack * 2,
      );
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * 0.4 * (1 - i * 0.2) + 0.001,
        time + attack * 2 + decay,
      );
    });

    // Harmonic envelope - cascading bell-like decays
    const harmonicGains = voice.gains.slice(9);
    harmonicGains.forEach((gain, i) => {
      const harmonicAmp = (peak * 0.03) / (i * 0.5 + 1);
      const attackTime = 0.005 + i * 0.002; // Slightly staggered
      const decayTime = 0.8 + i * 0.3; // Longer decays for higher harmonics

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(harmonicAmp, time + attackTime);
      gain.gain.exponentialRampToValueAtTime(
        harmonicAmp * 0.1 + 0.001,
        time + decayTime,
      );
    });

    // Start all oscillators
    voice.oscillators.forEach((osc) => osc.start(time));

    // Store voice
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);

    return voice;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const releaseTime = 3.0; // Long ethereal release

      // Fade out all gains
      voice.gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + releaseTime);
      });

      // Stop oscillators and LFOs after release
      setTimeout(
        () => {
          voice.oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          voice.lfos.forEach((lfo) => {
            try {
              lfo.stop();
            } catch {}
          });
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (releaseTime + 0.5) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// WUULF2 :: fractal oscillator structures, granular shimmer with time-stretching,
// chaotic modulation networks, formant synthesis for otherworldly "voices",
// enhanced randomness, and a warp field effect for true time-bending.
export class Wuulf2Synth extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Portamento settings
    this.portamentoTime = 0.5; // Time in seconds for pitch glide (adjustable)
    this.currentFrequency = 0; // Tracks the last played base frequency for gliding

    // Store feedback references for control
    this.delayFeedbacks = [];
    this.reverbFeedbackGain = null;

    // Enhanced effects chain with new warp field
    this.reverb = this.createReverb();
    this.delay = this.createDelay();
    this.chorus = this.createChorus();
    this.shimmer = this.createGranularShimmer();
    this.warpField = this.createWarpField();
    this.phaser = this.createPhaser();

    // Master limiter with controlled settings to prevent runaway
    this.limiter = audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    // Signal routing with much more dry signal
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.7;

    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.3;

    // Add envelope control to wet signal for automatic fade
    this.wetEnvelope = audioContext.createGain();
    this.wetEnvelope.gain.value = 1;

    // Add master gate to cut all sound
    this.masterGate = audioContext.createGain();
    this.masterGate.gain.value = 1;

    // Connect effects chain - properly connect input/output objects
    this.output.connect(this.dryGain);
    this.output.connect(this.chorus.input);
    this.chorus.output.connect(this.shimmer.input);
    this.shimmer.output.connect(this.delay.input);
    this.delay.output.connect(this.phaser);
    this.phaser.connect(this.warpField.input);
    this.warpField.output.connect(this.reverb);
    this.reverb.connect(this.wetGain);
    this.wetGain.connect(this.wetEnvelope);

    // REMOVED FEEDBACK LOOP - this was causing the persistent overdrive
    // No feedback from reverb to shimmer

    // Add a high-pass filter to remove low frequency buildup
    this.highpass = audioContext.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 100;
    this.highpass.Q.value = 0.7;

    this.dryGain.connect(this.highpass);
    this.wetEnvelope.connect(this.highpass);
    this.highpass.connect(this.masterGate);
    this.masterGate.connect(this.limiter);
  }

  connect(destination) {
    this.limiter.connect(destination);
  }

  disconnect() {
    this.limiter.disconnect();
  }

  // Kill all feedback loops
  killFeedback() {
    // Kill all delay feedback loops
    if (this.delayFeedbacks) {
      this.delayFeedbacks.forEach((feedback) => {
        feedback.gain.cancelScheduledValues(this.audioContext.currentTime);
        feedback.gain.setValueAtTime(0, this.audioContext.currentTime);
      });
    }
  }

  // Restore feedback loops
  restoreFeedback() {
    if (this.delayFeedbacks) {
      const feedbackValues = [0.15, 0.12, 0.1, 0.08, 0.06, 0.04, 0.02]; // Lower values
      this.delayFeedbacks.forEach((feedback, i) => {
        feedback.gain.value = feedbackValues[i] || 0.05;
      });
    }
  }

  createReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 8;
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const noise =
          (Math.random() * 2 - 1) * Math.sin((i / length) * Math.PI);
        channelData[i] =
          noise * Math.pow(1 - i / length, 3) * (1 + Math.sin(i * 0.01));
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  createDelay() {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    const delayTimes = [0.25, 0.375, 0.5, 0.625, 0.75, 1.0, 1.25];
    const feedbacks = [0.15, 0.12, 0.1, 0.08, 0.06, 0.04, 0.02]; // Much lower feedback

    delayTimes.forEach((delayTime, i) => {
      const delay = this.audioContext.createDelay(10);
      const feedback = this.audioContext.createGain();
      const tapGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();

      delay.delayTime.value = delayTime;
      feedback.gain.value = feedbacks[i];
      tapGain.gain.value = 0.4 - i * 0.05;

      filter.type = 'lowpass';
      filter.frequency.value = 4000 - i * 600;

      // Modulate delay time for warping
      lfo.type = 'sine';
      lfo.frequency.value = 0.1 + i * 0.05;
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(tapGain);
      tapGain.connect(output);

      // Store feedback reference
      this.delayFeedbacks.push(feedback);
    });

    return { input, output };
  }

  createChorus() {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    for (let i = 0; i < 12; i++) {
      const delay = this.audioContext.createDelay(0.2);
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      const voiceGain = this.audioContext.createGain();

      delay.delayTime.value = 0.01 + i * 0.005;

      lfo.type = ['sine', 'triangle', 'sawtooth', 'square'][i % 4];
      lfo.frequency.value = 0.2 + i * 0.1;
      lfoGain.gain.value = 0.002 + i * 0.0003;

      voiceGain.gain.value = (0.8 - i * 0.05) * 0.5;

      // Nested modulation
      const metaLfo = this.audioContext.createOscillator();
      const metaLfoGain = this.audioContext.createGain();
      metaLfo.type = 'sine';
      metaLfo.frequency.value = 0.05;
      metaLfoGain.gain.value = 0.05;
      metaLfo.connect(metaLfoGain);
      metaLfoGain.connect(lfo.frequency);
      metaLfo.start();

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      delay.connect(voiceGain);
      voiceGain.connect(output);
    }

    // Dry signal
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.3;
    input.connect(dryGain);
    dryGain.connect(output);

    return { input, output };
  }

  createGranularShimmer() {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    const grainCount = 8;
    for (let i = 0; i < grainCount; i++) {
      const delay = this.audioContext.createDelay(0.5);
      const pitchShift = this.audioContext.createWaveShaper();
      const grainGain = this.audioContext.createGain();

      delay.delayTime.value = i * 0.05;
      grainGain.gain.value = (0.2 - i * 0.02) * 0.5;

      // Waveshaper curve for +1 octave shift
      const curve = new Float32Array(1024);
      for (let j = 0; j < 1024; j++) {
        curve[j] =
          Math.sin((j / 1024) * Math.PI * 2) * (1 + Math.random() * 0.1);
      }
      pitchShift.curve = curve;

      // Random time-stretch simulation
      const stretchLfo = this.audioContext.createOscillator();
      stretchLfo.type = 'sine';
      stretchLfo.frequency.value = 1 + Math.random();
      const stretchGain = this.audioContext.createGain();
      stretchGain.gain.value = 0.1;
      stretchLfo.connect(stretchGain);
      stretchGain.connect(delay.delayTime);
      stretchLfo.start();

      input.connect(delay);
      delay.connect(pitchShift);
      pitchShift.connect(grainGain);
      grainGain.connect(output);
    }

    return { input, output };
  }

  createWarpField() {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    const warpDelay = this.audioContext.createDelay(2);
    const rateLfo = this.audioContext.createOscillator();
    const rateGain = this.audioContext.createGain();

    rateLfo.type = 'sawtooth';
    rateLfo.frequency.value = 0.5;
    rateGain.gain.value = 0.5;
    rateLfo.connect(rateGain);
    rateGain.connect(warpDelay.delayTime);
    rateLfo.start();

    input.connect(warpDelay);
    warpDelay.connect(output);

    return { input, output };
  }

  createPhaser() {
    const phaser = this.audioContext.createBiquadFilter();
    phaser.type = 'allpass';
    phaser.frequency.value = 440;
    phaser.Q.value = 0.5;

    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 1000;
    lfo.connect(lfoGain);
    lfoGain.connect(phaser.frequency);
    lfo.start();

    return phaser;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    // Restore feedback when playing notes
    if (this.activeNotes.size === 0) {
      this.restoreFeedback();
    }

    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Portamento
    let startFrequency = this.currentFrequency || frequency;
    if (this.currentFrequency === 0) startFrequency = frequency;

    const voice = {
      oscillators: [],
      filters: [],
      gains: [],
      lfos: [],
      panners: [],
      startTime: time,
    };

    // Ultra-controlled envelopes with gentle overdrive tickle
    const attack = 0.5;
    const decay = 1.0;
    const sustain = 0.2;
    const peak = velocity * 0.05;

    // Trigger wet envelope fade on each note
    this.wetEnvelope.gain.cancelScheduledValues(time);
    this.wetEnvelope.gain.setValueAtTime(0, time);
    this.wetEnvelope.gain.linearRampToValueAtTime(1, time + 0.2);
    this.wetEnvelope.gain.linearRampToValueAtTime(0.7, time + 1);
    this.wetEnvelope.gain.exponentialRampToValueAtTime(0.001, time + 3);

    // Fractal main tones
    const baseDetunes = [-15, -10, -5, 0, 5, 10, 15];
    for (let i = 0; i < baseDetunes.length; i++) {
      const osc = this.audioContext.createOscillator();
      const filter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      osc.type = ['sawtooth', 'square', 'triangle'][i % 3];
      osc.frequency.setValueAtTime(startFrequency, time);
      osc.frequency.exponentialRampToValueAtTime(
        frequency,
        time + this.portamentoTime,
      );
      osc.detune.value = baseDetunes[i] + (Math.random() - 0.5) * 6;

      const fractalLfo = this.audioContext.createOscillator();
      fractalLfo.type = 'sine';
      fractalLfo.frequency.value = 0.5 + Math.random();
      const fractalGain = this.audioContext.createGain();
      fractalGain.gain.value = 10;
      fractalLfo.connect(fractalGain);
      fractalGain.connect(osc.detune);
      fractalLfo.start(time);

      filter.type = 'lowpass';
      filter.frequency.value = 500 + Math.random() * 500 + midiNote * 15;
      filter.Q.value = 3 + Math.random() * 4;

      panner.pan.value = (i - 3) * 0.3;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.filters.push(filter);
      voice.gains.push(gain);
      voice.panners.push(panner);
      voice.lfos.push(fractalLfo);
    }

    // Apply envelopes
    voice.gains.slice(0, baseDetunes.length).forEach((gain, i) => {
      const stagger = i * 0.03;
      const gainScale = (1 - i * 0.1) * 0.5;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        peak * gainScale,
        time + attack + stagger,
      );
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * gainScale + 0.001,
        time + attack + decay + stagger,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, time + 2.0 + stagger);
    });

    // Start all oscillators
    voice.oscillators.forEach((osc) => osc.start(time));

    // Store voice
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);

    // Update current frequency for next portamento glide
    this.currentFrequency = frequency;

    return voice;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const releaseTime = 0.1;

      // Stop all oscillators
      voice.oscillators.forEach((osc) => {
        try {
          osc.stop(when + releaseTime);
        } catch (e) {}
      });

      voice.lfos.forEach((lfo) => {
        try {
          lfo.stop(when + releaseTime);
        } catch (e) {}
      });

      // Very fast gain fade
      voice.gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        gain.gain.setValueAtTime(gain.gain.value || 0.001, when);
        gain.gain.linearRampToValueAtTime(0, when + releaseTime);
      });

      // Cleanup
      setTimeout(
        () => {
          voices.delete(voice);
          if (voices.size === 0) {
            this.activeNotes.delete(midiNote);

            // KILL ALL FEEDBACK WHEN NO NOTES ARE PLAYING
            this.killFeedback();

            // Silence everything
            this.output.gain.cancelScheduledValues(
              this.audioContext.currentTime,
            );
            this.output.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.wetEnvelope.gain.value = 0;
            this.masterGate.gain.value = 0;

            // Reset after a moment
            setTimeout(() => {
              this.output.gain.value = 0.8;
              this.masterGate.gain.value = 1;
            }, 200);
          }
        },
        releaseTime * 1000 + 50,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }

    // Reset portamento if no notes active
    if (this.activeNotes.size === 0) {
      this.currentFrequency = 0;
    }
  }

  dispose() {
    // Stop all notes
    this.stopAllNotes();

    // Kill all feedback
    this.killFeedback();

    // Silence everything
    this.output.gain.value = 0;
    this.masterGate.gain.value = 0;
    this.wetEnvelope.gain.value = 0;

    // Disconnect everything
    try {
      this.limiter.disconnect();
      this.masterGate.disconnect();
      this.highpass.disconnect();
      this.dryGain.disconnect();
      this.wetGain.disconnect();
      this.wetEnvelope.disconnect();
      this.output.disconnect();
      this.reverb.disconnect();
      this.phaser.disconnect();

      // Disconnect complex effect objects
      if (this.delay.output) this.delay.output.disconnect();
      if (this.delay.input) this.delay.input.disconnect();
      if (this.chorus.output) this.chorus.output.disconnect();
      if (this.chorus.input) this.chorus.input.disconnect();
      if (this.shimmer.output) this.shimmer.output.disconnect();
      if (this.shimmer.input) this.shimmer.input.disconnect();
      if (this.warpField.output) this.warpField.output.disconnect();
      if (this.warpField.input) this.warpField.input.disconnect();
    } catch (e) {
      console.error('Error disposing Wuulf2Synth:', e);
    }
  }

  // Override stopAllNotes to be more aggressive
  stopAllNotes(time = this.audioContext.currentTime) {
    // Stop all active notes
    this.activeNotes.forEach((voices, midiNote) => {
      this.stopNote(midiNote, time);
    });

    // Clear everything
    this.activeNotes.clear();

    // Kill feedback immediately
    this.killFeedback();

    // Silence all outputs immediately
    this.output.gain.cancelScheduledValues(time);
    this.output.gain.setValueAtTime(0, time);
    this.masterGate.gain.cancelScheduledValues(time);
    this.masterGate.gain.setValueAtTime(0, time);
    this.wetEnvelope.gain.cancelScheduledValues(time);
    this.wetEnvelope.gain.setValueAtTime(0, time);

    // Reset after a moment
    setTimeout(() => {
      this.output.gain.value = 0.8;
      this.masterGate.gain.value = 1;
      this.currentFrequency = 0;
    }, 500);
  }
}

// Drum Sampler
export class DrumSampler extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);
    this.samples = new Map();
    this.activeHihat = null; // Track active open hihat for choking
    this.loadDefaultKit();
  }

  async loadDefaultKit() {
    // Define the drum mapping for white keys
    // We'll map based on pitch class (C, D, E, F, G, A, B)
    this.drumMapping = {
      0: { name: 'kick', type: 'kick' }, // C (any octave)
      2: { name: 'snare', type: 'snare' }, // D
      4: { name: 'hihat', type: 'hihat' }, // E (closed)
      5: { name: 'openhat', type: 'openhat' }, // F (open)
      7: { name: 'crash', type: 'crash' }, // G
      9: { name: 'ride', type: 'ride' }, // A
      11: { name: 'tom', type: 'tom' }, // B (low tom)
    };
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    // Get the note class (0-11) regardless of octave
    const noteClass = midiNote % 12;

    // Check if this note class maps to a drum
    const drumConfig = this.drumMapping[noteClass];
    if (!drumConfig) return; // Not a white key

    // Hihat choking: closed hihat chokes open hihat
    if (drumConfig.type === 'hihat' && this.activeHihat) {
      // Choke the open hihat
      this.activeHihat.gain.gain.cancelScheduledValues(time);
      this.activeHihat.gain.gain.setValueAtTime(this.activeHihat.gain.gain.value, time);
      this.activeHihat.gain.gain.exponentialRampToValueAtTime(0.01, time + 0.02);
      this.activeHihat = null;
    }

    // Play the corresponding drum sound
    switch (drumConfig.type) {
      case 'kick':
        this.playKick(velocity, time);
        break;
      case 'snare':
        this.playSnare(velocity, time);
        break;
      case 'hihat':
        this.playHihat(velocity, time);
        break;
      case 'openhat':
        this.playOpenhat(velocity, time);
        break;
      case 'crash':
        this.playCrash(velocity, time);
        break;
      case 'ride':
        this.playRide(velocity, time);
        break;
      case 'tom':
        this.playTom(velocity, time);
        break;
    }
  }

  playKick(velocity, time) {
    // Non-linear velocity curve for more dynamic range
    const vel = Math.pow(velocity, 0.7);

    // Main body oscillator (sine wave frequency sweep)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    const oscGain = this.audioContext.createGain();

    // Fast attack, exponential decay for punch
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.05);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.3);

    oscGain.gain.setValueAtTime(vel * 1.2, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    // Attack click for punch (very short noise burst)
    const click = this.audioContext.createOscillator();
    click.type = 'square';
    click.frequency.value = 60;
    const clickGain = this.audioContext.createGain();

    clickGain.gain.setValueAtTime(vel * 0.5, time);
    clickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.01);

    // Sub bass for depth
    const sub = this.audioContext.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 50;
    const subGain = this.audioContext.createGain();

    subGain.gain.setValueAtTime(vel * 0.8, time);
    subGain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    // Connect
    osc.connect(oscGain);
    oscGain.connect(this.output);
    click.connect(clickGain);
    clickGain.connect(this.output);
    sub.connect(subGain);
    subGain.connect(this.output);

    // Play
    osc.start(time);
    osc.stop(time + 0.5);
    click.start(time);
    click.stop(time + 0.015);
    sub.start(time);
    sub.stop(time + 0.6);
  }

  playSnare(velocity, time) {
    const vel = Math.pow(velocity, 0.75);

    // Body/tone component (two oscillators for more complex timbre)
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'square';
    osc1.frequency.value = 185;
    osc2.frequency.value = 330;

    const bodyGain = this.audioContext.createGain();
    bodyGain.gain.setValueAtTime(vel * 0.6, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    // Snap/attack component (white noise through bandpass)
    const snap = this.audioContext.createBufferSource();
    const snapBuffer = this.audioContext.createBuffer(
      1,
      4096,
      this.audioContext.sampleRate,
    );
    const snapData = snapBuffer.getChannelData(0);
    for (let i = 0; i < 4096; i++) {
      snapData[i] = Math.random() * 2 - 1;
    }
    snap.buffer = snapBuffer;
    snap.loop = true;

    const snapFilter = this.audioContext.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.value = 3500;
    snapFilter.Q.value = 5;

    const snapGain = this.audioContext.createGain();
    snapGain.gain.setValueAtTime(vel * 0.8, time);
    snapGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    // Rattle/snares component (white noise highpass)
    const rattle = this.audioContext.createBufferSource();
    const rattleBuffer = this.audioContext.createBuffer(
      1,
      8192,
      this.audioContext.sampleRate,
    );
    const rattleData = rattleBuffer.getChannelData(0);
    for (let i = 0; i < 8192; i++) {
      rattleData[i] = Math.random() * 2 - 1;
    }
    rattle.buffer = rattleBuffer;

    const rattleFilter = this.audioContext.createBiquadFilter();
    rattleFilter.type = 'highpass';
    rattleFilter.frequency.value = 5000;
    rattleFilter.Q.value = 1;

    const rattleGain = this.audioContext.createGain();
    rattleGain.gain.setValueAtTime(vel * 0.4, time);
    rattleGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    // Connect
    osc1.connect(bodyGain);
    osc2.connect(bodyGain);
    bodyGain.connect(this.output);
    snap.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.output);
    rattle.connect(rattleFilter);
    rattleFilter.connect(rattleGain);
    rattleGain.connect(this.output);

    // Play
    osc1.start(time);
    osc1.stop(time + 0.2);
    osc2.start(time);
    osc2.stop(time + 0.2);
    snap.start(time);
    snap.stop(time + 0.1);
    rattle.start(time);
    rattle.stop(time + 0.2);
  }

  playHihat(velocity, time) {
    const vel = Math.pow(velocity, 0.8);

    // Multiple noise sources for metallic character
    const noise1 = this.audioContext.createBufferSource();
    const buffer1 = this.audioContext.createBuffer(1, 2048, this.audioContext.sampleRate);
    const data1 = buffer1.getChannelData(0);
    for (let i = 0; i < 2048; i++) {
      data1[i] = Math.random() * 2 - 1;
    }
    noise1.buffer = buffer1;

    // Bandpass filters for metallic overtones
    const bp1 = this.audioContext.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 5500;
    bp1.Q.value = 3;

    const bp2 = this.audioContext.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 8200;
    bp2.Q.value = 2;

    const hp = this.audioContext.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 9000;
    hp.Q.value = 1;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(vel * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    // Connect in series for complex filtering
    noise1.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(hp);
    hp.connect(gain);
    gain.connect(this.output);

    noise1.start(time);
    noise1.stop(time + 0.05);
  }

  playOpenhat(velocity, time) {
    const vel = Math.pow(velocity, 0.8);

    // Longer, washier sound
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(1, 16384, this.audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 16384; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Multiple filters for complex metallic timbre
    const bp = this.audioContext.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6500;
    bp.Q.value = 1.5;

    const hp = this.audioContext.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    hp.Q.value = 0.5;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(vel * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    noise.connect(bp);
    bp.connect(hp);
    hp.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 0.5);

    // Store for choking
    this.activeHihat = { gain, source: noise };
  }

  playCrash(velocity, time) {
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      32768,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 32768; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(velocity * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 2);
  }

  playRide(velocity, time) {
    // Similar to crash but shorter and brighter
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      16384,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 16384; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 8000;
    filter.Q.value = 2;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(velocity * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 0.5);
  }

  playTom(velocity, time) {
    const vel = Math.pow(velocity, 0.75);

    // Body oscillator (tuned lower than kick)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    const oscGain = this.audioContext.createGain();

    // Frequency sweep for tom character
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(65, time + 0.08);

    oscGain.gain.setValueAtTime(vel * 0.9, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);

    // Attack transient
    const attack = this.audioContext.createOscillator();
    attack.type = 'square';
    attack.frequency.value = 180;
    const attackGain = this.audioContext.createGain();

    attackGain.gain.setValueAtTime(vel * 0.3, time);
    attackGain.gain.exponentialRampToValueAtTime(0.01, time + 0.02);

    // Overtone for depth
    const overtone = this.audioContext.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.value = 220;
    const overtoneGain = this.audioContext.createGain();

    overtoneGain.gain.setValueAtTime(vel * 0.2, time);
    overtoneGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

    // Connect
    osc.connect(oscGain);
    oscGain.connect(this.output);
    attack.connect(attackGain);
    attackGain.connect(this.output);
    overtone.connect(overtoneGain);
    overtoneGain.connect(this.output);

    // Play
    osc.start(time);
    osc.stop(time + 0.4);
    attack.start(time);
    attack.stop(time + 0.025);
    overtone.start(time);
    overtone.stop(time + 0.3);
  }

  stopNote(midiNote, _handleOrTime = this.audioContext.currentTime) {
    // Drums are one‑shots; nothing to release.
  }
}

export class StringEnsemble extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Physical modeling parameters
    this.config = {
      // Karplus-Strong parameters
      dampingFactor: 0.9965, // slightly less sustain to reduce self-oscillation artifacts
      pluckPosition: 0.13,

      // Bow simulation
      bowPressure: 0.3,
      bowSpeed: 0.75,
      bowPosition: 0.12,

      // String coupling (sympathetic resonance)
      couplingFactor: 0.02, // less coupling → fewer muddy artifacts

      // Players
      playersPerSection: 2, // quartet-tight
      humanization: {
        pitchDrift: 0.1, // Hz
        timingJitter: 0.006,
        bowPressureVariation: 0.08,
      },
    };

    // Warmth enhancement chain
    this.warmthEQ = this.createWarmthEQ();
    this.saturation = this.createWarmSaturation();

    // Gentle section limiter to prevent harsh artifacts
    this.sectionLimiter = audioContext.createDynamicsCompressor();
    this.sectionLimiter.threshold.value = -18;
    this.sectionLimiter.knee.value = 20;
    this.sectionLimiter.ratio.value = 3;
    this.sectionLimiter.attack.value = 0.01;
    this.sectionLimiter.release.value = 0.15;

    // Signal chain: output → warmth → saturation → limiter → final
    this.finalGain = audioContext.createGain();
    this.finalGain.gain.value = 0.5;

    this.output.connect(this.warmthEQ.input);
    this.warmthEQ.output.connect(this.saturation.input);
    this.saturation.output.connect(this.sectionLimiter);
    this.sectionLimiter.connect(this.finalGain);
  }

  connect(destination) {
    this.finalGain.connect(destination);
  }

  disconnect() {
    this.finalGain.disconnect();
  }

  createWarmthEQ() {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    const hp = this.audioContext.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    hp.Q.value = 0.7;

    const mudCut = this.audioContext.createBiquadFilter();
    mudCut.type = 'peaking';
    mudCut.frequency.value = 250;
    mudCut.Q.value = 1.0;
    mudCut.gain.value = -2; // remove mud

    const nasalNotch = this.audioContext.createBiquadFilter();
    nasalNotch.type = 'peaking';
    nasalNotch.frequency.value = 700;
    nasalNotch.Q.value = 1.2;
    nasalNotch.gain.value = -3; // tame honk

    const bridge = this.audioContext.createBiquadFilter();
    bridge.type = 'peaking';
    bridge.frequency.value = 2500; // bridge hill region
    bridge.Q.value = 1.1;
    bridge.gain.value = 2.5;

    const airLP = this.audioContext.createBiquadFilter();
    airLP.type = 'lowpass';
    airLP.frequency.value = 9500; // keep highs but avoid hash
    airLP.Q.value = 0.5;

    input.connect(hp);
    hp.connect(mudCut);
    mudCut.connect(nasalNotch);
    nasalNotch.connect(bridge);
    bridge.connect(airLP);
    airLP.connect(output);

    return { input, output };
  }

  createWarmSaturation() {
    const input = this.audioContext.createGain();

    const preGain = this.audioContext.createGain();
    preGain.gain.value = 0.55; // keep headroom before shaping

    const shaper = this.audioContext.createWaveShaper();
    const curve = new Float32Array(2048);
    const k = 1.6;
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    shaper.curve = curve;
    shaper.oversample = '4x';

    const postLP = this.audioContext.createBiquadFilter();
    postLP.type = 'lowpass';
    postLP.frequency.value = 11000; // remove HF hash from shaping
    postLP.Q.value = 0.5;

    const postGain = this.audioContext.createGain();
    postGain.gain.value = 1.0; // restore level gently

    const output = this.audioContext.createGain();

    input.connect(preGain);
    preGain.connect(shaper);
    shaper.connect(postLP);
    postLP.connect(postGain);
    postGain.connect(output);

    return { input, output };
  }

  connect(destination) {
    this.finalGain.connect(destination);
  }

  disconnect() {
    this.finalGain.disconnect();
  }

  // Karplus-Strong synthesis with enhanced bow excitation
  createPhysicalString(frequency, velocity, time) {
    const sampleRate = this.audioContext.sampleRate;
    const period = sampleRate / frequency;
    const delayTime = period / sampleRate;

    // Create delay line (the "string")
    const delay = this.audioContext.createDelay(1);
    delay.delayTime.value = delayTime;

    // Damping filter - less aggressive for warmth
    const damping = this.audioContext.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.value = 6000; // Lower cutoff = warmer
    damping.Q.value = 0.3;

    // All-pass filter for fine tuning
    const allpass = this.audioContext.createBiquadFilter();
    allpass.type = 'allpass';
    allpass.frequency.value = frequency;

    // Feedback gain (sustain)
    const feedback = this.audioContext.createGain();
    feedback.gain.value = this.config.dampingFactor;

    // Create richer excitation signal
    const exciter = this.createEnhancedBowExcitation(frequency, velocity, time);

    // DC blocker
    const dcBlocker = this.audioContext.createBiquadFilter();
    dcBlocker.type = 'highpass';
    dcBlocker.frequency.value = 30;
    dcBlocker.Q.value = 0.5;

    // Enhanced body filter with multiple resonances
    const bodyFilter = this.createEnhancedBodyResonance(frequency);

    // Add a second delay line for thickness
    const delay2 = this.audioContext.createDelay(1);
    delay2.delayTime.value = delayTime * 1.003; // Slight detune
    const feedback2 = this.audioContext.createGain();
    feedback2.gain.value = this.config.dampingFactor * 0.89;

    // Connect the physical model
    exciter.connect(delay);
    exciter.connect(delay2);

    delay.connect(damping);
    damping.connect(allpass);
    allpass.connect(feedback);
    feedback.connect(delay);

    delay2.connect(feedback2);
    feedback2.connect(delay2);

    // Continuous bow-bed to sustain energy while held
    const bowBed = this.createBowBedSource(frequency);
    bowBed.output.connect(delay);
    bowBed.output.connect(delay2);

    // Subtle vibrato by modulating the allpass frequency (phase-y, string-like)
    const vibrato = this.audioContext.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 5.6 + Math.random() * 0.6; // ~5.6–6.2 Hz
    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.setValueAtTime(0, time);
    vibratoGain.gain.linearRampToValueAtTime(6, time + 0.2); // depth in Hz with gentle onset
    vibrato.connect(vibratoGain);
    vibratoGain.connect(allpass.frequency);
    vibrato.start(time);

    // Mix both strings
    const stringMix = this.audioContext.createGain();
    allpass.connect(stringMix);
    delay2.connect(stringMix);

    // Output path
    stringMix.connect(dcBlocker);
    dcBlocker.connect(bodyFilter.input);

    return {
      exciter,
      delay,
      delay2,
      damping,
      feedback,
      feedback2,
      bodyFilter,
      bowBed,
      vibrato,
      vibratoGain,
      output: bodyFilter.output,
    };
  }

  // Continuous low-level bow "bed" that keeps energy flowing while key is held
  createBowBedSource(frequency) {
    const output = this.audioContext.createGain();
    output.gain.value = 0; // ramp in on note start

    // Looping short noise buffer
    const len = Math.floor(this.audioContext.sampleRate * 0.25);
    const buf = this.audioContext.createBuffer(
      1,
      len,
      this.audioContext.sampleRate,
    );
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.22;

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    const bp = this.audioContext.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(frequency * 1.8, 1800);
    bp.Q.value = 0.9;

    // Gentle friction component at the fundamental
    const fric = this.audioContext.createOscillator();
    fric.type = 'triangle';
    fric.frequency.value = frequency;
    const fricGain = this.audioContext.createGain();
    fricGain.gain.value = 0.006;

    noise.connect(bp);
    bp.connect(output);
    fric.connect(fricGain);
    fricGain.connect(output);

    return { output, noise, fric, fricGain, gain: output };
  }

  createEnhancedBowExcitation(frequency, velocity, time) {
    const exciterGain = this.audioContext.createGain();
    exciterGain.gain.value = 0.22; // overall excitation energy

    // Sub-harmonic bed
    const subOsc = this.audioContext.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = frequency * 0.5;
    const subEnv = this.audioContext.createGain();
    subEnv.gain.setValueAtTime(0, time);
    subEnv.gain.linearRampToValueAtTime(0.06, time + 0.015);

    // Friction tone (triangle → lowpass to avoid aliasing edge)
    const friction = this.audioContext.createOscillator();
    friction.type = 'triangle';
    friction.frequency.value = frequency;
    const fricLP = this.audioContext.createBiquadFilter();
    fricLP.type = 'lowpass';
    fricLP.frequency.value = 3500;
    fricLP.Q.value = 0.7;

    // Pinkish noise component
    const noise = this.audioContext.createBufferSource();
    const noiseLength = Math.floor(0.2 * this.audioContext.sampleRate);
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      noiseLength,
      this.audioContext.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < noiseLength; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      noiseData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
      b6 = white * 0.115926;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseBP = this.audioContext.createBiquadFilter();
    noiseBP.type = 'bandpass';
    noiseBP.frequency.value = Math.min(frequency * 1.8, 1800);
    noiseBP.Q.value = 1.2;

    // Bow pressure envelope
    const pressureEnv = this.audioContext.createGain();
    pressureEnv.gain.setValueAtTime(0, time);
    pressureEnv.gain.linearRampToValueAtTime(0.12, time + 0.006);
    pressureEnv.gain.exponentialRampToValueAtTime(
      Math.max(0.06, velocity * 0.08) + 0.001,
      time + 0.03,
    );

    // Routing
    subOsc.connect(subEnv);
    subEnv.connect(exciterGain);

    friction.connect(fricLP);
    fricLP.connect(pressureEnv);

    noise.connect(noiseBP);
    noiseBP.connect(pressureEnv);

    pressureEnv.connect(exciterGain);

    // Start/stop
    subOsc.start(time);
    friction.start(time);
    noise.start(time);

    const stopTime = time + 0.08;
    subOsc.stop(stopTime);
    friction.stop(stopTime);
    noise.stop(stopTime);

    return exciterGain;
  }

  createEnhancedBodyResonance(fundamental) {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    const airMode = this.audioContext.createBiquadFilter();
    airMode.type = 'peaking';
    airMode.frequency.value = 240;
    airMode.Q.value = 4.0;
    airMode.gain.value = 6;

    const woodMode = this.audioContext.createBiquadFilter();
    woodMode.type = 'peaking';
    woodMode.frequency.value = 420;
    woodMode.Q.value = 3.0;
    woodMode.gain.value = 4;

    const bridgeMode = this.audioContext.createBiquadFilter();
    bridgeMode.type = 'peaking';
    bridgeMode.frequency.value = 2500;
    bridgeMode.Q.value = 1.2;
    bridgeMode.gain.value = 2.5;

    const airLP = this.audioContext.createBiquadFilter();
    airLP.type = 'lowpass';
    airLP.frequency.value = 9000;
    airLP.Q.value = 0.5;

    input.connect(airMode);
    airMode.connect(woodMode);
    woodMode.connect(bridgeMode);
    bridgeMode.connect(airLP);
    airLP.connect(output);

    return { input, output };
  }

  // Create coupled strings for sympathetic resonance
  createCoupledStrings(primaryFreq, midiNote) {
    const strings = [];

    // Find nearby open strings that would resonate
    const openStrings = this.getOpenStrings(midiNote);

    openStrings.forEach((openFreq) => {
      if (Math.abs(openFreq - primaryFreq) < 50) {
        // Within coupling range
        const string = this.createPhysicalString(
          openFreq,
          0.1,
          this.audioContext.currentTime,
        );

        // Very low excitation (just sympathetic vibration)
        string.feedback.gain.value *= 0.999; // Longer decay

        // Coupling gain
        const coupling = this.audioContext.createGain();
        coupling.gain.value = this.config.couplingFactor;

        strings.push({ string, coupling });
      }
    });

    return strings;
  }

  getOpenStrings(midiNote) {
    // Violin: G3, D4, A4, E5
    // Viola: C3, G3, D4, A4
    // Cello: C2, G2, D3, A3

    if (midiNote >= 64) {
      // Violin range
      return [196, 293.66, 440, 659.25]; // G3, D4, A4, E5
    } else if (midiNote >= 48) {
      // Viola range
      return [130.81, 196, 293.66, 440]; // C3, G3, D4, A4
    } else {
      // Cello range
      return [65.41, 98, 146.83, 220]; // C2, G2, D3, A3
    }
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const voices = [];

    // Create ensemble with slight variations
    for (let i = 0; i < this.config.playersPerSection; i++) {
      // Human timing variation
      const timeOffset = Math.random() * this.config.humanization.timingJitter;
      const startTime = time + timeOffset;

      // Slight pitch variation (not detuning - actual frequency drift)
      const freqDrift =
        (Math.random() - 0.5) * this.config.humanization.pitchDrift;
      const playerFreq = frequency + freqDrift;

      // Create main string
      const string = this.createPhysicalString(playerFreq, velocity, startTime);

      // Start continuous bow-bed and ramp it to a gentle sustain level
      const bedTarget = 0.03 + velocity * 0.05 + (Math.random() - 0.5) * 0.008;
      string.bowBed.noise.start(startTime);
      string.bowBed.fric.start(startTime);
      string.bowBed.gain.gain.setValueAtTime(0, startTime);
      string.bowBed.gain.gain.linearRampToValueAtTime(
        bedTarget,
        startTime + 0.06,
      );

      // Create coupled strings (sympathetic resonance)
      const coupledStrings = this.createCoupledStrings(playerFreq, midiNote);

      // Main envelope (for stopping notes)
      const envelope = this.audioContext.createGain();
      envelope.gain.value = 1 / this.config.playersPerSection;

      // Pre-envelope bow gain so tremolo cannot re-attack on release
      const bowGain = this.audioContext.createGain();
      bowGain.gain.value = 1;

      // Subtle tremolo (human bow arm)
      const tremolo = this.audioContext.createOscillator();
      tremolo.frequency.value = 4.5 + Math.random() * 1;
      tremolo.type = 'sine';
      const tremoloGain = this.audioContext.createGain();
      tremoloGain.gain.value = 0.02; // Very subtle
      tremolo.connect(tremoloGain);
      tremoloGain.connect(bowGain.gain);
      tremolo.start(startTime);

      // Connect everything: string → bowGain → envelope
      string.output.connect(bowGain);
      bowGain.connect(envelope);

      // Connect coupled strings
      coupledStrings.forEach(({ string: coupled, coupling }) => {
        string.output.connect(coupling);
        coupling.connect(coupled.delay); // Feed primary into coupled strings
        coupled.output.connect(envelope); // Mix coupled strings to output
      });

      // Panning based on section
      const panner = this.audioContext.createStereoPanner();
      if (midiNote >= 64) {
        panner.pan.value = 0.3 + i * 0.05; // Violins right
      } else if (midiNote >= 48) {
        panner.pan.value = -0.1 + i * 0.05; // Violas center-left
      } else {
        panner.pan.value = -0.4 + i * 0.05; // Cellos left
      }

      envelope.connect(panner);
      panner.connect(this.output);

      voices.push({
        string,
        coupledStrings,
        envelope,
        bowGain,
        tremolo,
        tremoloGain,
        startTime,
      });
    }

    // Store voices
    let noteVoices = this.activeNotes.get(midiNote);
    if (!noteVoices) {
      noteVoices = new Set();
      this.activeNotes.set(midiNote, noteVoices);
    }
    voices.forEach((v) => noteVoices.add(v));

    return voices;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const noteVoices = this.activeNotes.get(midiNote);
    if (!noteVoices || noteVoices.size === 0) return;

    const stopVoice = (voice, when) => {
      // Dampen the string by reducing feedback
      voice.string.feedback.gain.cancelScheduledValues(when);
      voice.string.feedback.gain.setValueAtTime(
        voice.string.feedback.gain.value,
        when,
      );
      voice.string.feedback.gain.exponentialRampToValueAtTime(
        0.001,
        when + 0.3,
      );

      // Also dampen coupled strings
      voice.coupledStrings.forEach(({ string }) => {
        string.feedback.gain.cancelScheduledValues(when);
        string.feedback.gain.setValueAtTime(string.feedback.gain.value, when);
        string.feedback.gain.exponentialRampToValueAtTime(0.001, when + 0.5);
      });

      // Close coupling sends promptly to avoid post-release bump
      try {
        voice.coupledStrings.forEach(({ coupling }) => {
          coupling.gain.cancelScheduledValues(when);
          coupling.gain.setValueAtTime(coupling.gain.value, when);
          coupling.gain.linearRampToValueAtTime(0, when + 0.1);
        });
      } catch (e) {}

      // Kill modulation depth so no bump occurs at release
      try {
        voice.tremoloGain?.gain.cancelScheduledValues(when);
        voice.tremoloGain?.gain.linearRampToValueAtTime(0, when + 0.07);
      } catch (e) {}
      try {
        voice.string.vibratoGain?.gain.cancelScheduledValues(when);
        voice.string.vibratoGain?.gain.linearRampToValueAtTime(0, when + 0.06);
      } catch (e) {}

      // Fade envelope
      voice.envelope.gain.cancelScheduledValues(when);
      voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, when);
      voice.envelope.gain.exponentialRampToValueAtTime(0.001, when + 0.4);

      // Release the continuous bow-bed and vibrato
      if (voice.string && voice.string.bowBed) {
        const bed = voice.string.bowBed;
        const bedRel = 0.18;
        try {
          bed.gain.gain.cancelScheduledValues(when);
          bed.gain.gain.setValueAtTime(bed.gain.gain.value, when);
          bed.gain.gain.exponentialRampToValueAtTime(0.0001, when + bedRel);
          setTimeout(
            () => {
              try {
                bed.noise.stop();
              } catch (e) {}
              try {
                bed.fric.stop();
              } catch (e) {}
            },
            (bedRel + 0.05) * 1000,
          );
        } catch (e) {}
      }
      try {
        voice.string.vibrato?.stop(when + 0.2);
      } catch (e) {}

      // Stop tremolo
      setTimeout(() => {
        try {
          voice.tremolo.stop();
        } catch (e) {}

        noteVoices.delete(voice);
        if (noteVoices.size === 0) {
          this.activeNotes.delete(midiNote);
        }
      }, 600);
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(noteVoices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Brass Section — Lip-reed physical model (first-pass waveguide)
export class BrassSection extends BaseInstrument {
  constructor(audioContext, opts = {}) {
    super(audioContext);
    this.audioContext = audioContext;
    this.activeNotes = new Map(); // midiNote -> Set(voice)

    this.cfg = {
      // Macro tone/level
      outputGain: opts.outputGain ?? 0.35,
      brightness: opts.brightness ?? 12000,
      bellPresenceDb: opts.bellPresenceDb ?? 5.5,
      bellPresenceHz: opts.bellPresenceHz ?? 2200,
      lossesHz: opts.lossesHz ?? 8000,
      loopGainMin: opts.loopGainMin ?? 0.965,
      loopGainMax: opts.loopGainMax ?? 0.993,
      pressureMin: opts.pressureMin ?? 0.08,
      pressureMax: opts.pressureMax ?? 0.35,

      // Dynamics / envelope
      attack: opts.attack ?? 0.018,
      decay: opts.decay ?? 0.06,
      sustain: opts.sustain ?? 0.88,
      release: opts.release ?? 0.18,

      // Nonlinearity & saturation
      shapeAmount: opts.shapeAmount ?? 0.9,

      // Vibrato / lip & bore interaction
      vibratoHz: opts.vibratoHz ?? 5.6,
      vibratoDepthCents: opts.vibratoDepthCents ?? 8,
      vibratoOnset: opts.vibratoOnset ?? 0.18,

      // Misc
      maxDelay: 1.0,
    };

    // Master chain: small bell presence, tone LPF, gentle comp, output
    const bell = (this.bell = audioContext.createBiquadFilter());
    bell.type = 'peaking';
    bell.frequency.value = this.cfg.bellPresenceHz;
    bell.Q.value = 0.9;
    bell.gain.value = this.cfg.bellPresenceDb;

    const toneLP = (this.toneLP = audioContext.createBiquadFilter());
    toneLP.type = 'lowpass';
    toneLP.frequency.value = this.cfg.brightness;
    toneLP.Q.value = 0.5;

    const airShelf = (this.airShelf = audioContext.createBiquadFilter());
    airShelf.type = 'highshelf';
    airShelf.frequency.value = 6000;
    airShelf.gain.value = 3.0;

    const comp = (this.comp = audioContext.createDynamicsCompressor());
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;

    const outGain = (this.outGain = audioContext.createGain());
    outGain.gain.value = this.cfg.outputGain;

    this.mixBus = audioContext.createGain();

    // Routing: per-voice → mixBus → bell → toneLP → comp → outGain → this.output
    this.mixBus.connect(bell);
    bell.connect(toneLP);
    toneLP.connect(airShelf);
    airShelf.connect(comp);
    comp.connect(outGain);
    outGain.connect(this.output);
  }

  connect(destination) {
    this.output.connect(destination);
  }
  disconnect() {
    this.output.disconnect();
  }

  // ---------- helpers ----------
  _midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  _makeShaper(amount = 0.9) {
    const curve = new Float32Array(1024);
    const k = amount * 2.0 + 0.001;
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    const ws = this.audioContext.createWaveShaper();
    ws.curve = curve;
    ws.oversample = '4x';
    return ws;
  }

  _createNoiseBuffer(seconds = 0.25) {
    const len = Math.max(1, Math.floor(this.audioContext.sampleRate * seconds));
    const buf = this.audioContext.createBuffer(
      1,
      len,
      this.audioContext.sampleRate,
    );
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _centsToSeconds(cents, freq) {
    const T = 1 / Math.max(1, freq);
    const ratio = Math.pow(2, cents / 1200);
    const dFrac = Math.abs(1 - 1 / ratio);
    return T * dFrac; // small delay-time modulation
  }

  // Per-voice bore loop
  _createBrassVoice(freq, velocity, time) {
    const ac = this.audioContext;

    // Summing junction at mouthpiece
    const sumIn = ac.createGain();

    // Waveguide loop
    const delay = ac.createDelay(this.cfg.maxDelay);
    const delayTime = 1 / freq; // simple round-trip
    delay.delayTime.setValueAtTime(
      Math.min(this.cfg.maxDelay, delayTime),
      time,
    );

    const lossLP = ac.createBiquadFilter();
    lossLP.type = 'lowpass';
    lossLP.frequency.value = this.cfg.lossesHz;
    lossLP.Q.value = 0.2;

    const dcBlock = ac.createBiquadFilter();
    dcBlock.type = 'highpass';
    dcBlock.frequency.value = 18;
    dcBlock.Q.value = 0.7;

    const saturate = this._makeShaper(this.cfg.shapeAmount);

    const fb = ac.createGain();
    const loopGain =
      this.cfg.loopGainMin +
      (this.cfg.loopGainMax - this.cfg.loopGainMin) * velocity;
    fb.gain.value = loopGain; // keep < 1 for stability

    // Close the loop: delay → loss → dcBlock → saturate → fb → sumIn → delay
    delay.connect(lossLP);
    lossLP.connect(dcBlock);
    dcBlock.connect(saturate);
    saturate.connect(fb);
    fb.connect(sumIn);
    sumIn.connect(delay);

    // Mouth/blowing pressure: band-limited noise + tiny buzz near lip freq
    const noise = ac.createBufferSource();
    noise.buffer = this._createNoiseBuffer(0.25);
    noise.loop = true;

    const mouthBP = ac.createBiquadFilter();
    mouthBP.type = 'bandpass';
    mouthBP.frequency.value = Math.min(2600, freq * 3.0);
    mouthBP.Q.value = 0.9;

    const mouthLP = ac.createBiquadFilter();
    mouthLP.type = 'lowpass';
    mouthLP.frequency.value = 3400;

    const mouthGain = ac.createGain();
    const press =
      this.cfg.pressureMin +
      (this.cfg.pressureMax - this.cfg.pressureMin) * velocity;
    mouthGain.gain.setValueAtTime(0.0001, time);
    mouthGain.gain.linearRampToValueAtTime(press, time + this.cfg.attack);
    mouthGain.gain.exponentialRampToValueAtTime(
      press * this.cfg.sustain + 0.0001,
      time + this.cfg.attack + this.cfg.decay,
    );

    noise.connect(mouthBP);
    mouthBP.connect(mouthLP);
    mouthLP.connect(mouthGain);
    mouthGain.connect(sumIn);

    // Lip oscillator biases the bore toward a chosen resonance
    const lip = ac.createOscillator();
    lip.type = 'square';
    lip.frequency.value = freq;
    const lipGain = ac.createGain();
    lipGain.gain.value = 0.02 + 0.025 * velocity;
    lip.connect(lipGain);
    lipGain.connect(sumIn);

    // Vibrato by modulating delay time (very small)
    const vib = ac.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = this.cfg.vibratoHz + (Math.random() - 0.5) * 0.6;
    const vibDepth = ac.createGain();
    vibDepth.gain.setValueAtTime(0, time);
    vibDepth.gain.linearRampToValueAtTime(
      this._centsToSeconds(this.cfg.vibratoDepthCents, freq),
      time + this.cfg.vibratoOnset,
    );
    vib.connect(vibDepth);
    vibDepth.connect(delay.delayTime);

    // Valve click / attack transient (very short)
    const atkNoise = ac.createBufferSource();
    atkNoise.buffer = this._createNoiseBuffer(0.02);
    const atkGain = ac.createGain();
    atkGain.gain.setValueAtTime(0.05 + 0.08 * velocity, time);
    atkGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    atkNoise.connect(atkGain);
    atkGain.connect(sumIn);

    // Voice output tap after saturation → tone sweetening before mix bus
    const bodyEQ = ac.createBiquadFilter();
    bodyEQ.type = 'peaking';
    bodyEQ.frequency.value = 1200;
    bodyEQ.Q.value = 0.8;
    bodyEQ.gain.value = 1.5;

    const voiceOut = ac.createGain();
    voiceOut.gain.value = 1.0;

    saturate.connect(bodyEQ);

    // Added: brass bite and sparkle for a touch more edge
    const biteEQ = ac.createBiquadFilter();
    biteEQ.type = 'peaking';
    biteEQ.frequency.value = 2200; // brass formant region
    biteEQ.Q.value = 1.0;
    biteEQ.gain.value = 1.8 + 2.0 * velocity; // dB, scales with velocity

    const sparkleHS = ac.createBiquadFilter();
    sparkleHS.type = 'highshelf';
    sparkleHS.frequency.value = 7000;
    sparkleHS.gain.value = 1.0 + 2.5 * velocity; // dB, scales with velocity

    bodyEQ.connect(biteEQ);
    biteEQ.connect(sparkleHS);
    sparkleHS.connect(voiceOut);
    voiceOut.connect(this.mixBus);

    // Start sources
    noise.start(time);
    lip.start(time);
    vib.start(time);
    atkNoise.start(time);

    return {
      sumIn,
      delay,
      lossLP,
      dcBlock,
      saturate,
      fb,
      mouthGain,
      noise,
      mouthBP,
      mouthLP,
      lip,
      lipGain,
      vib,
      vibDepth,
      atkNoise,
      atkGain,
      voiceOut,
      freq,
    };
  }

  // API
  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const freq = this._midiToFreq(midiNote);
    const v = Math.max(0.05, Math.min(1, velocity));
    const voice = this._createBrassVoice(freq, v, time);

    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);
    return voice; // handle is the voice object
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const rel = this.cfg.release;
      try {
        voice.mouthGain.gain.cancelScheduledValues(when);
        voice.mouthGain.gain.setValueAtTime(voice.mouthGain.gain.value, when);
        voice.mouthGain.gain.exponentialRampToValueAtTime(0.0001, when + rel);

        voice.fb.gain.cancelScheduledValues(when);
        voice.fb.gain.setValueAtTime(voice.fb.gain.value, when);
        voice.fb.gain.linearRampToValueAtTime(0.7, when + rel * 0.6);
        voice.fb.gain.linearRampToValueAtTime(0.3, when + rel);
      } catch {}

      setTimeout(
        () => {
          try {
            voice.noise.stop();
          } catch {}
          try {
            voice.lip.stop();
          } catch {}
          try {
            voice.vib.stop();
          } catch {}
          try {
            voice.atkNoise.stop();
          } catch {}
        },
        (rel + 0.05) * 1000,
      );

      voices.delete(voice);
      if (voices.size === 0) this.activeNotes.delete(midiNote);
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Simple Piano using additive synthesis
export class SimplePiano extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);
    this._polyCount = 0;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Create multiple harmonics for piano-like sound
    const harmonics = [1, 2, 3, 4, 5, 6];
    const amplitudes = [1, 0.5, 0.25, 0.125, 0.0625, 0.03125];

    const oscillators = [];
    const gainNodes = [];

    harmonics.forEach((harmonic, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.frequency.value = frequency * harmonic;
      osc.type = 'sine';

      // Slightly detune higher harmonics for richness
      if (harmonic > 1) {
        osc.detune.value = (Math.random() - 0.5) * 5 * harmonic;
      }

      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(this.output);

      oscillators.push(osc);
      gainNodes.push(gain);
    });

    // Piano-like envelope
    const attack = 0.002;
    const decay = 0.5;
    const sustain = 0.2;
    const release = 1.5;

    gainNodes.forEach((gain, i) => {
      const amp = velocity * amplitudes[i] * 0.2;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(amp, time + attack);
      gain.gain.exponentialRampToValueAtTime(
        amp * sustain + 0.001,
        time + attack + decay,
      );
    });

    // Start all oscillators
    oscillators.forEach((osc) => osc.start(time));

    const voice = { oscillators, gainNodes, startTime: time, release };
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);
    return voice; // handle
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { oscillators, gainNodes, release } = voice;
      const end = when + release;
      gainNodes.forEach((g) => {
        const p = g.gain;
        if (typeof p.cancelAndHoldAtTime === 'function') {
          p.cancelAndHoldAtTime(when);
        } else {
          // Fallback: cancel future automation and smoothly head towards zero
          p.cancelScheduledValues(when);
          const tc = Math.max(0.01, release * 0.3);
          p.setTargetAtTime(0.0001, when, tc);
        }
        // Ensure we finish very close to zero by the end
        p.exponentialRampToValueAtTime(0.0001, end);
      });
      oscillators.forEach((osc) => {
        try {
          osc.stop(end);
        } catch {}
      });
      setTimeout(
        () => {
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (release + 0.1) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Basic Pipe Organ Synthesizer
export class PipeOrgan extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Pipe organ typically has multiple ranks (sets of pipes)
    // We'll simulate different pipe footages (16', 8', 4', 2', 1')
    this.ranks = {
      16: 0.5, // Sub-octave
      8: 1, // Fundamental
      4: 2, // Octave
      2: 4, // Super-octave
      1: 8, // Two octaves up
      '5⅓': 1.5, // Quint (perfect fifth)
      '2⅔': 3, // Twelfth
    };

    // Rank volumes (drawbar-like settings)
    this.rankGains = {
      16: 0.3,
      8: 1.0, // Fundamental is loudest
      4: 0.7,
      2: 0.4,
      1: 0.2,
      '5⅓': 0.3,
      '2⅔': 0.2,
    };

    // Create a subtle reverb for church-like sound
    this.reverb = this.createOrganReverb();

    // Connect output through reverb
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.7;
    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.3;

    this.output.connect(this.dryGain);
    this.output.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    // Final output
    this.finalOutput = audioContext.createGain();
    this.dryGain.connect(this.finalOutput);
    this.wetGain.connect(this.finalOutput);
  }

  connect(destination) {
    this.finalOutput.connect(destination);
  }

  disconnect() {
    this.finalOutput.disconnect();
  }

  createOrganReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 3; // 3 second reverb
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Create a church-like reverb decay
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      gains: [],
      filters: [],
      startTime: time,
    };

    // Create oscillators for each rank
    Object.entries(this.ranks).forEach(([footage, multiplier]) => {
      // Each rank gets slight detuning for richness
      const detuneCents = (Math.random() - 0.5) * 4; // ±2 cents

      // Create the main oscillator for this rank
      const osc = this.audioContext.createOscillator();
      osc.frequency.value = frequency * multiplier;
      osc.detune.value = detuneCents;

      // Pipe organs use relatively simple waveforms
      // Mix of sine (flute pipes) and sawtooth (reed pipes)
      if (footage === '16' || footage === '8') {
        osc.type = 'sine'; // Flute pipes for fundamental tones
      } else {
        osc.type = 'sawtooth'; // Reed pipes for harmonics
      }

      // Create a bandpass filter to shape the tone
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = frequency * multiplier * 2;
      filter.Q.value = 1.5;

      // Individual gain for this rank
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;

      // Connect oscillator -> filter -> gain -> output
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
    });

    // Pipe organ envelope - very fast attack, sustained, medium release
    const attack = 0.01; // Instant speech
    const release = 0.5; // Natural pipe decay

    // Apply envelope to all ranks
    voice.gains.forEach((gain, index) => {
      const footage = Object.keys(this.ranks)[index];
      const rankGain = this.rankGains[footage] || 0.5;
      const targetGain = velocity * rankGain * 0.1; // Scale down to prevent clipping

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(targetGain, time + attack);
    });

    // Add subtle tremulant (vibrato) effect
    const tremulant = this.audioContext.createOscillator();
    tremulant.frequency.value = 4.5; // Classic tremulant speed
    tremulant.type = 'sine';

    const tremulantGain = this.audioContext.createGain();
    tremulantGain.gain.value = 2; // Very subtle pitch modulation

    tremulant.connect(tremulantGain);

    // Apply tremulant to each oscillator
    voice.oscillators.forEach((osc) => {
      tremulantGain.connect(osc.detune);
    });

    // Start all oscillators
    voice.oscillators.forEach((osc) => osc.start(time));
    tremulant.start(time);

    // Store the tremulant in voice for cleanup
    voice.tremulant = tremulant;
    voice.release = release;

    // Store voice
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);

    return voice;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { gains, oscillators, tremulant, release } = voice;
      const end = when + release;

      // Fade out all gains
      gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
      });

      // Stop oscillators after release
      setTimeout(
        () => {
          oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          try {
            tremulant.stop();
          } catch {}
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (release + 0.1) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Reed Organ/Harmonium Synthesizer
export class ReedOrgan extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Reed organs have fewer harmonics than pipe organs
    // They produce a warm, breathy, slightly nasal tone
    this.reedRanks = {
      8: 1, // Fundamental
      4: 2, // Octave
      16: 0.5, // Sub-octave (not all harmoniums have this)
    };

    // Reed organ specific characteristics
    this.reedGains = {
      8: 1.0, // Fundamental is dominant
      4: 0.3, // Gentle octave
      16: 0.4, // Subtle bass
    };

    // Create filters for the characteristic reed organ sound
    this.masterFilter = audioContext.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 2000; // Warm, mellow tone
    this.masterFilter.Q.value = 0.5;

    // Add a highpass to remove mud
    this.highpass = audioContext.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 80;
    this.highpass.Q.value = 0.7;

    // Subtle chorus for the characteristic harmonium wobble
    this.chorus = this.createHarmoniumChorus();

    // Compression for consistent reed response
    this.compressor = audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.1;

    // Signal path
    this.output.connect(this.highpass);
    this.highpass.connect(this.masterFilter);
    this.masterFilter.connect(this.chorus.input);
    this.chorus.output.connect(this.compressor);

    // Final output
    this.finalOutput = audioContext.createGain();
    this.finalOutput.gain.value = 0.7; // Prevent clipping
    this.compressor.connect(this.finalOutput);
  }

  connect(destination) {
    this.finalOutput.connect(destination);
  }

  disconnect() {
    this.finalOutput.disconnect();
  }

  createHarmoniumChorus() {
    // Harmonium has a natural chorus from multiple reeds
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    // Create two delayed paths for chorus effect
    const delay1 = this.audioContext.createDelay(0.05);
    const delay2 = this.audioContext.createDelay(0.05);

    // LFOs for delay modulation - slower than typical chorus
    const lfo1 = this.audioContext.createOscillator();
    const lfo2 = this.audioContext.createOscillator();
    const lfoGain1 = this.audioContext.createGain();
    const lfoGain2 = this.audioContext.createGain();

    lfo1.frequency.value = 0.7; // Slow wobble
    lfo2.frequency.value = 0.9; // Slightly different rate
    lfoGain1.gain.value = 0.002; // Subtle modulation
    lfoGain2.gain.value = 0.0015;

    lfo1.connect(lfoGain1);
    lfo2.connect(lfoGain2);
    lfoGain1.connect(delay1.delayTime);
    lfoGain2.connect(delay2.delayTime);

    delay1.delayTime.value = 0.012;
    delay2.delayTime.value = 0.018;

    // Mix dry and wet
    const dryGain = this.audioContext.createGain();
    const wetGain1 = this.audioContext.createGain();
    const wetGain2 = this.audioContext.createGain();

    dryGain.gain.value = 0.7;
    wetGain1.gain.value = 0.15;
    wetGain2.gain.value = 0.15;

    input.connect(dryGain);
    input.connect(delay1);
    input.connect(delay2);

    delay1.connect(wetGain1);
    delay2.connect(wetGain2);

    dryGain.connect(output);
    wetGain1.connect(output);
    wetGain2.connect(output);

    lfo1.start();
    lfo2.start();

    return { input, output };
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      gains: [],
      filters: [],
      noiseGain: null,
      startTime: time,
    };

    // Add breath noise for realism
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * 2,
      this.audioContext.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() - 0.5) * 0.2;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Filter the noise to make it breathy
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = frequency * 2;
    noiseFilter.Q.value = 5;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = 0;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.output);

    voice.noise = noise;
    voice.noiseGain = noiseGain;

    // Create oscillators for each reed rank
    Object.entries(this.reedRanks).forEach(([footage, multiplier]) => {
      // Reed organs have natural beating between reeds
      // Create two slightly detuned oscillators per rank
      for (let i = 0; i < 2; i++) {
        const osc = this.audioContext.createOscillator();
        osc.frequency.value = frequency * multiplier;

        // Natural reed detuning creates beating
        const detuneCents = (i === 0 ? -2 : 2) + (Math.random() - 0.5) * 2;
        osc.detune.value = detuneCents;

        // Reed organs produce a complex waveform
        // Mix between sawtooth (bright reeds) and triangle (mellow reeds)
        osc.type = footage === '16' ? 'triangle' : 'sawtooth';

        // Individual filter for each reed
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency * multiplier * 1.5;
        filter.Q.value = 2; // Fairly resonant

        // Add formant filter for reed character
        const formant = this.audioContext.createBiquadFilter();
        formant.type = 'peaking';
        formant.frequency.value = 700 + (Math.random() - 0.5) * 100;
        formant.Q.value = 3;
        formant.gain.value = 6;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0;

        // Connect: osc -> filter -> formant -> gain -> output
        osc.connect(filter);
        filter.connect(formant);
        formant.connect(gain);
        gain.connect(this.output);

        voice.oscillators.push(osc);
        voice.gains.push(gain);
        voice.filters.push(filter);
      }
    });

    // Reed organ envelope - slow attack (air pressure building)
    const attack = 0.08; // Slower than pipe organ
    const release = 0.3; // Quick release when bellows stop

    // Apply envelope
    const rankFootages = Object.keys(this.reedRanks);
    voice.gains.forEach((gain, index) => {
      const rankIndex = Math.floor(index / 2); // 2 oscillators per rank
      const footage = rankFootages[rankIndex];
      const rankGain = this.reedGains[footage] || 0.5;
      const targetGain = velocity * rankGain * 0.08; // Scale for multiple oscillators

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(targetGain, time + attack);
    });

    // Breath noise envelope
    const noiseLevel = velocity * 0.015; // Very subtle
    voice.noiseGain.gain.setValueAtTime(0.0001, time);
    voice.noiseGain.gain.exponentialRampToValueAtTime(
      noiseLevel,
      time + attack * 0.5,
    );

    // Add subtle pitch bend at start (air pressure stabilizing)
    voice.oscillators.forEach((osc) => {
      const startDetune = osc.detune.value;
      osc.detune.setValueAtTime(startDetune - 10, time);
      osc.detune.linearRampToValueAtTime(startDetune, time + attack);
    });

    // Start all sound sources
    voice.oscillators.forEach((osc) => osc.start(time));
    voice.noise.start(time);

    voice.release = release;

    // Store voice
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);

    return voice;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { gains, oscillators, noise, noiseGain, release } = voice;
      const end = when + release;

      // Fade out all gains
      gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
      });

      // Fade out breath noise
      noiseGain.gain.cancelScheduledValues(when);
      noiseGain.gain.setValueAtTime(noiseGain.gain.value, when);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, end);

      // Slight pitch drop as air pressure releases
      oscillators.forEach((osc) => {
        const currentDetune = osc.detune.value;
        osc.detune.setValueAtTime(currentDetune, when);
        osc.detune.linearRampToValueAtTime(currentDetune - 5, end);
      });

      // Stop all sources after release
      setTimeout(
        () => {
          oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          try {
            noise.stop();
          } catch {}
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (release + 0.1) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Theremin Synthesizer
export class Theremin extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Theremin characteristics
    this.portamentoTime = 0.1; // Glide between notes
    this.vibratoRate = 5; // Hz
    this.vibratoDepth = 15; // Cents

    // Create vibrato LFO
    this.vibratoLFO = audioContext.createOscillator();
    this.vibratoLFO.frequency.value = this.vibratoRate;
    this.vibratoLFO.type = 'sine';
    this.vibratoGain = audioContext.createGain();
    this.vibratoGain.gain.value = this.vibratoDepth;
    this.vibratoLFO.connect(this.vibratoGain);
    this.vibratoLFO.start();

    // Create tremolo for amplitude modulation
    this.tremoloLFO = audioContext.createOscillator();
    this.tremoloLFO.frequency.value = 4;
    this.tremoloLFO.type = 'sine';
    this.tremoloGain = audioContext.createGain();
    this.tremoloGain.gain.value = 0.1; // Subtle tremolo
    this.tremoloLFO.connect(this.tremoloGain);
    this.tremoloLFO.start();

    // Master filter for tone shaping
    this.toneFilter = audioContext.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 3000;
    this.toneFilter.Q.value = 2;

    // Add some resonance for character
    this.resonanceFilter = audioContext.createBiquadFilter();
    this.resonanceFilter.type = 'peaking';
    this.resonanceFilter.frequency.value = 1500;
    this.resonanceFilter.Q.value = 5;
    this.resonanceFilter.gain.value = 3;

    // Reverb for that ethereal quality
    this.reverb = this.createThereminReverb();

    // Signal routing
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.6;
    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.4;

    this.output.connect(this.toneFilter);
    this.toneFilter.connect(this.resonanceFilter);
    this.resonanceFilter.connect(this.dryGain);
    this.resonanceFilter.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    // Final output with tremolo
    this.finalOutput = audioContext.createGain();
    this.finalOutput.gain.value = 0.8;

    this.dryGain.connect(this.finalOutput);
    this.wetGain.connect(this.finalOutput);

    // Connect tremolo to final output gain
    this.tremoloGain.connect(this.finalOutput.gain);

    // Track current playing voice for portamento
    this.currentVoice = null;
    this.lastFrequency = 0;
  }

  connect(destination) {
    this.finalOutput.connect(destination);
  }

  disconnect() {
    this.finalOutput.disconnect();
  }

  createThereminReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 2;
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Smooth, ethereal reverb
        const decay = Math.pow(1 - i / length, 1.5);
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // If there's already a note playing, we'll glide to the new one
    if (this.currentVoice && this.activeNotes.size > 0) {
      // Portamento - glide the frequency
      const osc = this.currentVoice.oscillator;
      osc.frequency.cancelScheduledValues(time);
      osc.frequency.setValueAtTime(osc.frequency.value, time);
      osc.frequency.exponentialRampToValueAtTime(
        frequency,
        time + this.portamentoTime,
      );

      // Update heterodyne oscillators
      this.currentVoice.heterodyneOscs.forEach((hetOsc, i) => {
        const hetFreq = frequency + (i === 0 ? 1.5 : -1.2);
        hetOsc.frequency.cancelScheduledValues(time);
        hetOsc.frequency.setValueAtTime(hetOsc.frequency.value, time);
        hetOsc.frequency.exponentialRampToValueAtTime(
          hetFreq,
          time + this.portamentoTime,
        );
      });

      // Update the stored frequency
      this.currentVoice.frequency = frequency;
      this.lastFrequency = frequency;

      // Add to active notes but reuse the same voice
      let set = this.activeNotes.get(midiNote);
      if (!set) {
        set = new Set();
        this.activeNotes.set(midiNote, set);
      }
      set.add(this.currentVoice);

      return this.currentVoice;
    }

    // Create new voice
    const voice = {
      oscillator: null,
      heterodyneOscs: [],
      gains: [],
      frequency: frequency,
      startTime: time,
    };

    // Main oscillator - sine wave for classic theremin
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = this.lastFrequency || frequency;

    // Glide from last frequency if available
    if (this.lastFrequency && Math.abs(this.lastFrequency - frequency) > 1) {
      osc.frequency.setValueAtTime(this.lastFrequency, time);
      osc.frequency.exponentialRampToValueAtTime(
        frequency,
        time + this.portamentoTime,
      );
    } else {
      osc.frequency.setValueAtTime(frequency, time);
    }

    // Connect vibrato
    this.vibratoGain.connect(osc.detune);

    // Create heterodyne oscillators for richer tone
    // These create the characteristic theremin beating
    const hetFrequencies = [1.5, -1.2]; // Slight frequency offsets

    hetFrequencies.forEach((offset) => {
      const hetOsc = this.audioContext.createOscillator();
      hetOsc.type = 'sine';
      hetOsc.frequency.value = (this.lastFrequency || frequency) + offset;

      if (this.lastFrequency) {
        hetOsc.frequency.setValueAtTime(this.lastFrequency + offset, time);
        hetOsc.frequency.exponentialRampToValueAtTime(
          frequency + offset,
          time + this.portamentoTime,
        );
      }

      const hetGain = this.audioContext.createGain();
      hetGain.gain.value = 0.15; // Subtle beating

      hetOsc.connect(hetGain);
      hetGain.connect(this.output);

      voice.heterodyneOscs.push(hetOsc);
      voice.gains.push(hetGain);
    });

    // Main oscillator gain
    const mainGain = this.audioContext.createGain();
    mainGain.gain.value = 0;

    osc.connect(mainGain);
    mainGain.connect(this.output);

    voice.oscillator = osc;
    voice.gains.push(mainGain);

    // Theremin envelope - smooth attack and release
    const attack = 0.15;
    const release = 0.3;

    const targetGain = velocity * 0.7;
    mainGain.gain.setValueAtTime(0.0001, time);
    mainGain.gain.exponentialRampToValueAtTime(targetGain, time + attack);

    // Heterodyne gains
    voice.heterodyneOscs.forEach((_, i) => {
      const gain = voice.gains[i];
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.15 * velocity, time + attack);
    });

    // Start oscillators
    osc.start(time);
    voice.heterodyneOscs.forEach((ho) => ho.start(time));

    // Store as current voice
    this.currentVoice = voice;
    this.lastFrequency = frequency;
    voice.release = release;

    // Store in active notes
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);

    return voice;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { gains, oscillator, heterodyneOscs, release } = voice;
      const end = when + release;

      // Only stop if this is the last note
      // (Theremin is monophonic with portamento)
      const totalActiveNotes = Array.from(this.activeNotes.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      );

      if (totalActiveNotes <= 1) {
        // This is the last note, so fade out
        gains.forEach((gain) => {
          gain.gain.cancelScheduledValues(when);
          const currentValue = gain.gain.value;
          gain.gain.setValueAtTime(currentValue, when);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
        });

        // Stop oscillators after release
        setTimeout(
          () => {
            try {
              oscillator.stop();
            } catch {}
            heterodyneOscs.forEach((osc) => {
              try {
                osc.stop();
              } catch {}
            });

            // Clear current voice
            if (this.currentVoice === voice) {
              this.currentVoice = null;
            }

            voices.delete(voice);
            if (voices.size === 0) this.activeNotes.delete(midiNote);
          },
          (release + 0.1) * 1000,
        );
      } else {
        // Other notes are active, just remove this from tracking
        voices.delete(voice);
        if (voices.size === 0) this.activeNotes.delete(midiNote);
      }
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }

  // Additional methods for real-time control
  setPortamento(time) {
    this.portamentoTime = Math.max(0, Math.min(1, time));
  }

  setVibrato(rate, depth) {
    this.vibratoLFO.frequency.value = rate;
    this.vibratoGain.gain.value = depth;
  }
}

// Export instrument factory - Updated to accept external AudioContext
export function createInstrument(audioContext, type, preset) {
  switch (type) {
    case 'synth':
      return new SubtractiveSynth(audioContext, preset);
    case 'drums':
      return new DrumSampler(audioContext);
    case 'piano':
      return new SimplePiano(audioContext);
    case 'wuulf':
      return new WuulfSynth(audioContext);
    case 'wuulf2':
      return new Wuulf2Synth(audioContext);
    case 'strings':
      return new StringEnsemble(audioContext);
    case 'brass':
      return new BrassSection(audioContext);
    case 'organ':
      return new PipeOrgan(audioContext);
    case 'reedorgan':
      return new ReedOrgan(audioContext);
    case 'theremin':
      return new Theremin(audioContext);
    default:
      return new SubtractiveSynth(audioContext, 'default');
  }
}
