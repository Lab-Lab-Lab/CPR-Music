'use client';

/**
 * SandboxSynth - A flexible synthesizer for the Instrument Sandbox
 * Supports oscillators, filters, envelopes, LFO, and effects
 */

class SandboxSynth {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.activeVoices = new Map(); // Map of voiceId -> voice object
    this.noteToVoices = new Map(); // Map of note -> Set of voiceIds
    this.voiceIdCounter = 0;

    // Master output
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    // Analyser for visualization
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Default parameters (must be before setup methods)
    this.params = {
      // Basic
      oscillatorType: 'sawtooth',
      filterCutoff: 8000,  // Higher default for better audibility
      filterResonance: 2,  // Lower default resonance
      attack: 0.01,
      decay: 0.1,
      sustain: 0.7,
      release: 0.3,
      detune: 0,
      lfoRate: 4,
      lfoAmount: 0,
      reverb: 0,
      delay: 0,
      distortion: 0,

      // Advanced parameters
      osc2Enabled: false,
      osc2Type: 'sawtooth',
      osc2Detune: 7,
      osc2Pitch: 0,
      oscMix: 50,
      fmAmount: 0,
      ringModAmount: 0,
      oscSync: false,
      subOscEnabled: false,
      subOscType: 'square',
      subOscLevel: 50,
      noiseLevel: 0,
      noiseType: 'white',
      filterType: 'lowpass',
      filterDrive: 0,
      filterEnvAmount: 0,
      filterAttack: 0.01,
      filterDecay: 0.2,
      filterSustain: 0.5,
      filterRelease: 0.3,
      pulseWidth: 50,
      pwmAmount: 0,
      pwmRate: 4,
      lfo2Target: 'off',
      lfo2Rate: 2,
      lfo2Amount: 0,
      // Experimental effects
      bitCrushBits: 16,
      bitCrushRate: 44100,
      waveFoldAmount: 0,
      feedbackAmount: 0,
      formantShift: 0,
      unisonVoices: 1,
      unisonDetune: 10,
      portamentoTime: 0,
      stereoSpread: 0,
      hardClip: 0,
      freqShift: 0,
      // Granular
      grainSize: 100,
      grainSpeed: 1.0,
      grainReverse: false,
      grainFreeze: false,
      // Comb Filter
      combFreq: 440,
      combFeedback: 0,
      combMix: 0,
      // Sample & Hold
      sampleHoldRate: 10,
      sampleHoldAmount: 0,
      sampleHoldTarget: 'pitch'
    };

    // Experimental effects setup (must be after params, before effects chain)
    this.setupExperimentalEffects();

    // Effects chain
    this.setupEffectsChain();

    // LFO setup
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    // LFO 2 setup
    this.lfo2 = audioContext.createOscillator();
    this.lfo2Gain = audioContext.createGain();
    this.lfo2.frequency.value = this.params.lfo2Rate || 2;
    this.lfo2Gain.gain.value = 0;
    this.lfo2.connect(this.lfo2Gain);
    this.lfo2.start();

    // PWM LFO setup
    this.pwmLfo = audioContext.createOscillator();
    this.pwmLfoGain = audioContext.createGain();
    this.pwmLfo.frequency.value = this.params.pwmRate || 4;
    this.pwmLfoGain.gain.value = 0;
    this.pwmLfo.connect(this.pwmLfoGain);
    this.pwmLfo.start();

    // Periodic cleanup to catch orphaned voices
    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanedVoices();
    }, 5000); // Every 5 seconds
  }

  cleanupOrphanedVoices() {
    const now = this.audioContext.currentTime;
    const maxAge = 10; // Voices older than 10 seconds are considered orphaned

    this.activeVoices.forEach((voice, voiceId) => {
      if (now - voice.startTime > maxAge) {
        console.warn(`[SandboxSynth] Cleaning orphaned voice ${voiceId} (age: ${now - voice.startTime}s)`);
        this.cleanupVoice(voiceId);
      }
    });

    // Log current voice count for debugging
    if (this.activeVoices.size > 0) {
      console.log(`[SandboxSynth] Active voices: ${this.activeVoices.size}`);
    }
  }

  setupExperimentalEffects() {
    // Bit Crusher - reduces bit depth and sample rate
    this.bitCrusher = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.bitCrusher.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);

      const bits = this.params.bitCrushBits || 16;
      const normFreq = (this.params.bitCrushRate || 44100) / this.audioContext.sampleRate;
      const step = Math.pow(0.5, bits - 1);
      let phaser = 0;
      let last = 0;

      for (let i = 0; i < input.length; i++) {
        phaser += normFreq;
        if (phaser >= 1.0) {
          phaser -= 1.0;
          last = step * Math.floor(input[i] / step + 0.5);
        }
        output[i] = last;
      }
    };
    this.bitCrusherGain = this.audioContext.createGain();
    this.bitCrusherGain.gain.value = 0;

    // Wave Folder - folds waveform back on itself
    this.waveFolder = this.audioContext.createWaveShaper();
    this.updateWaveFolderCurve();
    this.waveFolder.oversample = '2x';
    this.waveFolderGain = this.audioContext.createGain();
    this.waveFolderGain.gain.value = 0;

    // Feedback loop
    this.feedbackGain = this.audioContext.createGain();
    this.feedbackGain.gain.value = 0;
    this.feedbackDelay = this.audioContext.createDelay(0.1);
    this.feedbackDelay.delayTime.value = 0.01;
    this.feedbackFilter = this.audioContext.createBiquadFilter();
    this.feedbackFilter.type = 'highpass';
    this.feedbackFilter.frequency.value = 100;

    // Formant filter (vowel sounds)
    this.formantFilters = [];
    for (let i = 0; i < 3; i++) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      this.formantFilters.push(filter);
    }
    this.formantGain = this.audioContext.createGain();
    this.formantGain.gain.value = 0;
    this.updateFormantFilters();

    // Granular Buffer Effects (stutter/freeze)
    this.grainBufferSize = 8192;
    this.grainBuffer = new Float32Array(this.grainBufferSize);
    this.grainBufferIndex = 0;
    this.grainFrozen = false;
    this.grainFreezeBuffer = null;
    this.grainPhase = 0;

    this.granularProcessor = this.audioContext.createScriptProcessor(256, 1, 1);
    this.granularProcessor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);

      const grainSize = Math.max(32, Math.floor((this.params.grainSize || 100) * this.audioContext.sampleRate / 1000));
      const grainSpeed = this.params.grainSpeed || 1.0;
      const reverse = this.params.grainReverse || false;
      const freeze = this.params.grainFreeze || false;

      // Handle freeze mode
      if (freeze && !this.grainFrozen) {
        // Capture buffer on freeze start
        this.grainFreezeBuffer = new Float32Array(this.grainBuffer);
        this.grainFrozen = true;
      } else if (!freeze && this.grainFrozen) {
        this.grainFrozen = false;
        this.grainFreezeBuffer = null;
      }

      // Use frozen buffer if available
      const sourceBuffer = this.grainFrozen && this.grainFreezeBuffer ? this.grainFreezeBuffer : this.grainBuffer;

      for (let i = 0; i < input.length; i++) {
        // Update circular buffer (unless frozen)
        if (!this.grainFrozen) {
          this.grainBuffer[this.grainBufferIndex] = input[i];
          this.grainBufferIndex = (this.grainBufferIndex + 1) % this.grainBufferSize;
        }

        // Calculate grain position with speed control
        this.grainPhase += grainSpeed;
        if (this.grainPhase >= grainSize) {
          this.grainPhase = 0;
        }

        let grainPos = Math.floor(this.grainPhase);
        if (reverse) {
          grainPos = grainSize - 1 - grainPos;
        }

        // Get sample from buffer with wrapping (read backwards from current write position)
        let readPos = this.grainBufferIndex - grainSize + grainPos;
        while (readPos < 0) readPos += this.grainBufferSize;
        readPos = readPos % this.grainBufferSize;

        // Apply Hann window for smooth grains
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * grainPos / grainSize);
        output[i] = sourceBuffer[readPos] * window;
      }
    };
    this.granularGain = this.audioContext.createGain();
    this.granularGain.gain.value = 0;

    // Comb Filter (metallic resonance)
    this.combDelay = this.audioContext.createDelay(1);
    this.combFeedback = this.audioContext.createGain();
    this.combGain = this.audioContext.createGain();
    this.combGain.gain.value = 0;
    this.updateCombFilter();

    // Sample & Hold
    this.sampleHoldValue = 0;
    this.sampleHoldPhase = 0;
    this.sampleHoldRandom = () => Math.random() * 2 - 1;

    this.sampleHoldProcessor = this.audioContext.createScriptProcessor(256, 0, 1);
    this.sampleHoldProcessor.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const rate = this.params.sampleHoldRate || 10;
      const amount = (this.params.sampleHoldAmount || 0) / 100;
      const samplesPerHold = this.audioContext.sampleRate / rate;

      for (let i = 0; i < output.length; i++) {
        this.sampleHoldPhase++;
        if (this.sampleHoldPhase >= samplesPerHold) {
          this.sampleHoldPhase = 0;
          this.sampleHoldValue = this.sampleHoldRandom();
        }
        output[i] = this.sampleHoldValue * amount;
      }
    };

    this.sampleHoldGain = this.audioContext.createGain();
    this.sampleHoldGain.gain.value = 0;

    // Hard Clipper - aggressive clipping distortion
    this.hardClipper = this.audioContext.createWaveShaper();
    this.updateHardClipCurve();
    this.hardClipper.oversample = '2x';
    this.hardClipGain = this.audioContext.createGain();
    this.hardClipGain.gain.value = 0;

    // Frequency Shifter - uses single-sideband modulation for inharmonic shifting
    this.freqShifter = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.freqShiftAmount = 0;
    this.freqShiftPhase = 0;

    this.freqShifter.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      const shiftHz = this.freqShiftAmount;

      if (Math.abs(shiftHz) < 1) {
        // Bypass if no shift
        output.set(input);
        return;
      }

      const sampleRate = this.audioContext.sampleRate;
      const phaseIncrement = (2 * Math.PI * shiftHz) / sampleRate;

      for (let i = 0; i < input.length; i++) {
        // Simple ring modulation for frequency shifting
        const carrier = Math.sin(this.freqShiftPhase);
        output[i] = input[i] * carrier;
        this.freqShiftPhase += phaseIncrement;
        if (this.freqShiftPhase > 2 * Math.PI) {
          this.freqShiftPhase -= 2 * Math.PI;
        }
      }
    };
    this.freqShiftGain = this.audioContext.createGain();
    this.freqShiftGain.gain.value = 0;

    // Portamento tracking
    this.lastNoteFrequency = null;

    // Experimental effects mixer
    this.experimentalMixer = this.audioContext.createGain();
    this.experimentalMixer.gain.value = 1;
  }

  updateWaveFolderCurve() {
    if (!this.params) return;
    const amount = this.params.waveFoldAmount || 0;
    if (amount === 0) {
      this.waveFolder.curve = null;
      return;
    }

    const samples = 2048;
    const curve = new Float32Array(samples);
    const threshold = 1 - (amount / 100);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      if (Math.abs(x) < threshold) {
        curve[i] = x;
      } else {
        // Fold the signal back
        const folded = Math.abs(x) - threshold;
        const numFolds = Math.floor(folded / (threshold * 2)) + 1;
        const remainder = folded % (threshold * 2);

        if (numFolds % 2 === 0) {
          curve[i] = x > 0 ? threshold - remainder : -threshold + remainder;
        } else {
          curve[i] = x > 0 ? threshold + remainder : -threshold - remainder;
        }
      }
    }

    this.waveFolder.curve = curve;
  }

  updateHardClipCurve() {
    if (!this.params) return;
    const amount = this.params.hardClip || 0;
    if (amount === 0) {
      this.hardClipper.curve = null;
      return;
    }

    const samples = 2048;
    const curve = new Float32Array(samples);
    const threshold = 1 - (amount / 100) * 0.9; // Clip threshold based on amount

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Hard clipping - just cut off anything above threshold
      if (x > threshold) {
        curve[i] = threshold;
      } else if (x < -threshold) {
        curve[i] = -threshold;
      } else {
        curve[i] = x;
      }
    }

    this.hardClipper.curve = curve;
  }

  updateFormantFilters() {
    if (!this.params) return;
    // Vowel formant frequencies
    const vowels = {
      0: [700, 1220, 2600],    // Neutral
      1: [270, 2290, 3010],    // EE
      2: [390, 1990, 2550],    // IH
      3: [530, 1840, 2480],    // EH
      4: [660, 1720, 2410],    // AE
      5: [730, 1090, 2440],    // AH
      6: [570, 840, 2410],     // AW
      7: [440, 1020, 2240],    // UH
      8: [300, 870, 2240],     // UW
      9: [640, 1190, 2390]     // ER
    };

    const shift = Math.round(Math.abs(this.params.formantShift || 0) / 10);
    const formants = vowels[shift % 10] || vowels[0];

    this.formantFilters.forEach((filter, i) => {
      filter.frequency.value = formants[i];
      filter.Q.value = 10;
    });
  }

  updateCombFilter() {
    if (!this.params || !this.combDelay || !this.combFeedback) return;

    const freq = this.params.combFreq || 440;
    const delayTime = 1 / freq;

    // Clamp delay time to valid range (0 to 1 second)
    this.combDelay.delayTime.value = Math.min(Math.max(delayTime, 0.001), 1);

    // Feedback controls resonance (0 to 0.98 to prevent runaway feedback)
    const feedback = Math.min((this.params.combFeedback || 0) / 100 * 0.98, 0.98);
    this.combFeedback.gain.value = feedback;

    // Mix controls dry/wet
    const mix = (this.params.combMix || 0) / 100;
    this.combGain.gain.value = mix;
  }

  setupEffectsChain() {
    // Distortion
    this.distortion = this.audioContext.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(0);
    this.distortion.oversample = '4x';
    this.distortionGain = this.audioContext.createGain();
    this.distortionGain.gain.value = 0;

    // Delay
    this.delay = this.audioContext.createDelay(1);
    this.delay.delayTime.value = 0.25;
    this.delayFeedback = this.audioContext.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayGain = this.audioContext.createGain();
    this.delayGain.gain.value = 0;

    // Connect delay feedback loop
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayGain);

    // Reverb (simple convolution reverb simulation using delays)
    this.reverbGain = this.audioContext.createGain();
    this.reverbGain.gain.value = 0;
    this.reverbDelays = [];
    const reverbDelayTimes = [0.0297, 0.0371, 0.0411, 0.0437, 0.050, 0.0650];

    reverbDelayTimes.forEach(time => {
      const delay = this.audioContext.createDelay(1);
      const feedback = this.audioContext.createGain();
      const gain = this.audioContext.createGain();

      delay.delayTime.value = time;
      feedback.gain.value = 0.5;
      gain.gain.value = 0.3;

      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(gain);
      gain.connect(this.reverbGain);

      this.reverbDelays.push({ delay, feedback, gain });
    });

    // Dry signal path
    this.dryGain = this.audioContext.createGain();
    this.dryGain.gain.value = 1;

    // Connect effects chain
    this.effectsInput = this.audioContext.createGain();

    // Experimental effects routing (pre-normal effects)
    this.preEffectsGain = this.audioContext.createGain();
    this.effectsInput.connect(this.preEffectsGain);

    // Bit crusher path
    this.preEffectsGain.connect(this.bitCrusher);
    this.bitCrusher.connect(this.bitCrusherGain);

    // Wave folder path
    this.preEffectsGain.connect(this.waveFolder);
    this.waveFolder.connect(this.waveFolderGain);

    // Formant filter path
    this.preEffectsGain.connect(this.formantFilters[0]);
    this.formantFilters[0].connect(this.formantFilters[1]);
    this.formantFilters[1].connect(this.formantFilters[2]);
    this.formantFilters[2].connect(this.formantGain);

    // Granular buffer path
    this.preEffectsGain.connect(this.granularProcessor);
    this.granularProcessor.connect(this.granularGain);

    // Comb filter path (with feedback loop)
    this.combInput = this.audioContext.createGain();
    this.preEffectsGain.connect(this.combInput);
    this.combInput.connect(this.combDelay);
    this.combDelay.connect(this.combFeedback);
    this.combFeedback.connect(this.combInput); // Feedback loop back to input
    this.combDelay.connect(this.combGain); // Output

    // Hard clipper path
    this.preEffectsGain.connect(this.hardClipper);
    this.hardClipper.connect(this.hardClipGain);

    // Frequency shifter path
    this.preEffectsGain.connect(this.freqShifter);
    this.freqShifter.connect(this.freqShiftGain);

    // Mix experimental effects
    this.preEffectsGain.connect(this.experimentalMixer);
    this.bitCrusherGain.connect(this.experimentalMixer);
    this.waveFolderGain.connect(this.experimentalMixer);
    this.formantGain.connect(this.experimentalMixer);
    this.granularGain.connect(this.experimentalMixer);
    this.combGain.connect(this.experimentalMixer);
    this.hardClipGain.connect(this.experimentalMixer);
    this.freqShiftGain.connect(this.experimentalMixer);

    // Feedback loop (from experimental mixer back to itself)
    this.experimentalMixer.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.feedbackFilter);
    this.feedbackFilter.connect(this.feedbackGain);
    this.feedbackGain.connect(this.experimentalMixer);

    // Then to normal effects
    this.postExperimentalGain = this.audioContext.createGain();
    this.experimentalMixer.connect(this.postExperimentalGain);

    // Dry path
    this.postExperimentalGain.connect(this.dryGain);

    // Distortion path
    this.postExperimentalGain.connect(this.distortion);
    this.distortion.connect(this.distortionGain);

    // Delay path
    this.postExperimentalGain.connect(this.delay);

    // Reverb path
    this.postExperimentalGain.connect(this.reverbDelays[0].delay);

    // All paths connect to master
    this.dryGain.connect(this.masterGain);
    this.distortionGain.connect(this.masterGain);
    this.delayGain.connect(this.masterGain);
    this.reverbGain.connect(this.masterGain);
  }

  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  connect(destination) {
    // Connect through analyser for visualization
    this.masterGain.connect(this.analyser);
    this.analyser.connect(destination);
  }

  getAnalyser() {
    return this.analyser;
  }

  disconnect() {
    this.masterGain.disconnect();
    this.analyser.disconnect();
  }

  setVolume(value) {
    this.masterGain.gain.value = value;
  }

  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };

    // Update LFO
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = this.params.lfoAmount / 100;

    // Update LFO 2
    this.lfo2.frequency.value = this.params.lfo2Rate || 2;
    this.lfo2Gain.gain.value = (this.params.lfo2Amount || 0) / 100;

    // Update PWM LFO
    this.pwmLfo.frequency.value = this.params.pwmRate || 4;
    this.pwmLfoGain.gain.value = (this.params.pwmAmount || 0) / 100;

    // Update experimental effects
    // Bit crusher mix
    const bitCrushAmount = this.params.bitCrushBits < 16 || this.params.bitCrushRate < 44100 ? 1 : 0;
    this.bitCrusherGain.gain.value = bitCrushAmount;

    // Wave folder
    this.updateWaveFolderCurve();
    this.waveFolderGain.gain.value = this.params.waveFoldAmount > 0 ? 1 : 0;

    // Feedback
    this.feedbackGain.gain.value = Math.min(0.95, this.params.feedbackAmount / 100); // Cap at 0.95 to prevent runaway

    // Formant filter
    this.updateFormantFilters();
    this.formantGain.gain.value = this.params.formantShift > 0 ? 1 : 0;

    // Granular buffer effects
    const granularActive = (this.params.grainSize !== 100 ||
                           this.params.grainSpeed !== 1.0 ||
                           this.params.grainReverse ||
                           this.params.grainFreeze);
    this.granularGain.gain.value = granularActive ? 1 : 0;
    if (granularActive && this.params.grainSize) {
      console.log('[SandboxSynth] Granular active:', {
        grainSize: this.params.grainSize,
        grainSpeed: this.params.grainSpeed,
        reverse: this.params.grainReverse,
        freeze: this.params.grainFreeze
      });
    }

    // Comb filter
    this.updateCombFilter();
    if (this.params.combMix > 0) {
      console.log('[SandboxSynth] Comb filter active:', {
        freq: this.params.combFreq,
        feedback: this.params.combFeedback,
        mix: this.params.combMix
      });
    }

    // Sample & Hold
    const sampleHoldActive = this.params.sampleHoldAmount > 0;
    this.sampleHoldGain.gain.value = sampleHoldActive ? 1 : 0;
    if (sampleHoldActive) {
      console.log('[SandboxSynth] Sample & Hold active:', {
        rate: this.params.sampleHoldRate,
        amount: this.params.sampleHoldAmount,
        target: this.params.sampleHoldTarget
      });
    }

    // Hard Clipper
    this.updateHardClipCurve();
    this.hardClipGain.gain.value = this.params.hardClip > 0 ? 1 : 0;

    // Frequency Shifter
    this.freqShiftAmount = this.params.freqShift || 0;
    this.freqShiftGain.gain.value = Math.abs(this.params.freqShift) > 0 ? 1 : 0;

    // Adjust pre-effects gain to compensate for experimental effects
    const experimentalActive = bitCrushAmount +
                              (this.params.waveFoldAmount > 0 ? 1 : 0) +
                              (this.params.formantShift > 0 ? 1 : 0) +
                              (granularActive ? 1 : 0) +
                              (this.params.combMix > 0 ? 1 : 0) +
                              (sampleHoldActive ? 1 : 0) +
                              (this.params.hardClip > 0 ? 1 : 0) +
                              (Math.abs(this.params.freqShift) > 0 ? 1 : 0);
    // Less aggressive gain compensation - let the effects be more audible
    this.preEffectsGain.gain.value = experimentalActive > 0 ? 0.6 : 1;
    this.experimentalMixer.gain.value = experimentalActive > 0 ? 0.9 : 1;

    // Update effects levels
    this.distortionGain.gain.value = this.params.distortion / 100;
    this.delayGain.gain.value = this.params.delay / 100;
    this.reverbGain.gain.value = this.params.reverb / 100;

    // Update distortion curve
    if (this.params.distortion > 0) {
      this.distortion.curve = this.makeDistortionCurve(this.params.distortion);
    }

    // Update dry/wet mix
    const totalWet = (this.params.distortion + this.params.delay + this.params.reverb) / 300;
    this.dryGain.gain.value = Math.max(0.3, 1 - totalWet);
  }

  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  playNote(midiNote, velocity, time = this.audioContext.currentTime) {
    // Voice limit to prevent memory issues
    const MAX_VOICES = 20;
    if (this.activeVoices.size >= MAX_VOICES) {
      console.warn(`[SandboxSynth] Voice limit reached (${MAX_VOICES}), cleaning oldest voices`);
      // Clean up oldest voices
      const sortedVoices = Array.from(this.activeVoices.entries())
        .sort((a, b) => a[1].startTime - b[1].startTime);
      const toRemove = sortedVoices.slice(0, 5); // Remove oldest 5
      toRemove.forEach(([id]) => this.cleanupVoice(id));
    }

    // Stop all existing instances of this note immediately
    this.stopNote(midiNote, time);

    const frequency = this.midiToFrequency(midiNote);
    const velocityGain = velocity / 127;

    // Portamento - glide from last note to this note
    const targetFrequency = frequency;
    let startFrequency = frequency;
    const portamentoTime = (this.params.portamentoTime || 0) / 1000; // Convert ms to seconds

    if (portamentoTime > 0 && this.lastNoteFrequency) {
      startFrequency = this.lastNoteFrequency;
    }
    this.lastNoteFrequency = targetFrequency;

    // Unison - create multiple voices with detuning
    const numVoices = Math.max(1, Math.min(8, this.params.unisonVoices || 1));
    const unisonDetune = this.params.unisonDetune || 10;
    const stereoSpread = (this.params.stereoSpread || 0) / 100;

    // Create multiple voices for unison
    const voices = [];
    for (let i = 0; i < numVoices; i++) {
      const voiceId = ++this.voiceIdCounter;

      // Calculate detune for this voice
      let voiceDetune = 0;
      let voicePan = 0;
      if (numVoices > 1) {
        // Spread voices across detune range
        const spreadFactor = (i / (numVoices - 1)) - 0.5; // -0.5 to 0.5
        voiceDetune = spreadFactor * unisonDetune * 2; // Spread across range
        voicePan = spreadFactor * stereoSpread * 2; // -1 to 1 for stereo
      }

      // Create voice
      const voice = {
        id: voiceId,
        note: midiNote,
        oscillator: null,
        oscillator2: null,
        subOscillator: null,
        noiseSource: null,
        oscMixer: null,
        panner: null,
        filter: null,
        envelope: null,
        noteGain: null,
        startTime: time,
        cleanup: null,
        unisonDetune: voiceDetune,
        unisonPan: voicePan
      };
      voices.push(voice);
    }

    // Process each unison voice
    voices.forEach(voice => {
      const voiceId = voice.id;

    // Create oscillator mixer
    voice.oscMixer = this.audioContext.createGain();

    // Main Oscillator
    voice.oscillator = this.audioContext.createOscillator();

    // For square waves with PWM, we'll use a custom periodic wave
    if (this.params.oscillatorType === 'square' && this.params.pwmAmount > 0) {
      // Create a pulse wave with variable width
      const pulseWidth = this.params.pulseWidth / 100;
      const real = new Float32Array(128);
      const imag = new Float32Array(128);

      for (let i = 1; i < 128; i++) {
        const harmonic = i;
        imag[i] = (2 / (Math.PI * harmonic)) * Math.sin(Math.PI * harmonic * pulseWidth);
      }

      const pulseWave = this.audioContext.createPeriodicWave(real, imag);
      voice.oscillator.setPeriodicWave(pulseWave);

      // Store pulse wave data for PWM modulation
      voice.isPulseWave = true;
      voice.basePulseWidth = this.params.pulseWidth;
    } else if (this.params.oscSync && this.params.osc2Enabled) {
      // Oscillator Sync - create a synced waveform
      // This creates a "hard sync" effect where osc2 resets osc1's phase
      const real = new Float32Array(128);
      const imag = new Float32Array(128);
      const syncRatio = Math.pow(2, this.params.osc2Pitch / 12) * (1 + this.params.osc2Detune / 100);

      for (let i = 1; i < 128; i++) {
        // Generate harmonics with sync artifacts
        const phase = (i * syncRatio) % (2 * Math.PI);
        imag[i] = Math.sin(phase) / i;
      }

      const syncWave = this.audioContext.createPeriodicWave(real, imag);
      voice.oscillator.setPeriodicWave(syncWave);
      voice.isSyncWave = true;
    } else {
      voice.oscillator.type = this.params.oscillatorType;
      voice.isPulseWave = false;
    }

    // Set frequency with portamento and unison detuning
    if (portamentoTime > 0 && startFrequency !== targetFrequency) {
      voice.oscillator.frequency.setValueAtTime(startFrequency, time);
      voice.oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, time + portamentoTime);
    } else {
      voice.oscillator.frequency.value = targetFrequency;
    }
    voice.oscillator.detune.value = this.params.detune + voice.unisonDetune;

    // Oscillator 1 gain (controlled by mix)
    const osc1Gain = this.audioContext.createGain();
    osc1Gain.gain.value = this.params.osc2Enabled ? (100 - this.params.oscMix) / 100 : 1;
    voice.oscillator.connect(osc1Gain);
    osc1Gain.connect(voice.oscMixer);

    // Second Oscillator (if enabled)
    if (this.params.osc2Enabled) {
      voice.oscillator2 = this.audioContext.createOscillator();
      voice.oscillator2.type = this.params.osc2Type;
      voice.oscillator2.frequency.value = frequency * Math.pow(2, this.params.osc2Pitch / 12);
      voice.oscillator2.detune.value = this.params.osc2Detune;

      // FM Synthesis - Oscillator 2 modulates Oscillator 1's frequency
      if (this.params.fmAmount > 0) {
        const fmGain = this.audioContext.createGain();
        // FM modulation index (how much frequency modulation)
        fmGain.gain.value = frequency * (this.params.fmAmount / 100) * 10; // Scale for audible effect
        voice.oscillator2.connect(fmGain);
        fmGain.connect(voice.oscillator.frequency);
        voice.fmGain = fmGain;
      }

      // Ring Modulation - multiply signals together
      if (this.params.ringModAmount > 0) {
        const ringModGain = this.audioContext.createGain();
        ringModGain.gain.value = 0; // Will be modulated by osc2

        // Connect osc1 to ring mod gain
        const osc1ToRing = this.audioContext.createGain();
        osc1ToRing.gain.value = this.params.ringModAmount / 100;
        voice.oscillator.connect(osc1ToRing);
        osc1ToRing.connect(ringModGain);

        // Modulate the gain with osc2
        const ringModScale = this.audioContext.createGain();
        ringModScale.gain.value = 1;
        voice.oscillator2.connect(ringModScale);
        ringModScale.connect(ringModGain.gain);

        // Add ring mod output to mixer
        ringModGain.connect(voice.oscMixer);
        voice.ringModGain = ringModGain;
        voice.osc1ToRing = osc1ToRing;
      }

      // Normal mixing (if not doing only cross-mod)
      if (this.params.fmAmount < 100 || this.params.ringModAmount < 100) {
        const osc2Gain = this.audioContext.createGain();
        const osc2MixLevel = this.params.oscMix / 100;
        // Reduce osc2 direct level when using it for modulation
        const modReduction = Math.max(this.params.fmAmount, this.params.ringModAmount) / 100;
        osc2Gain.gain.value = osc2MixLevel * (1 - modReduction * 0.5);
        voice.oscillator2.connect(osc2Gain);
        osc2Gain.connect(voice.oscMixer);
      }
    }

    // Sub-Oscillator (if enabled)
    if (this.params.subOscEnabled) {
      voice.subOscillator = this.audioContext.createOscillator();
      voice.subOscillator.type = this.params.subOscType;
      voice.subOscillator.frequency.value = frequency / 2; // One octave below

      const subGain = this.audioContext.createGain();
      subGain.gain.value = this.params.subOscLevel / 100;
      voice.subOscillator.connect(subGain);
      subGain.connect(voice.oscMixer);
    }

    // Noise Generator (if enabled)
    if (this.params.noiseLevel > 0) {
      const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds of noise
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);

      // Generate noise based on type
      if (this.params.noiseType === 'white') {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } else if (this.params.noiseType === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }

      voice.noiseSource = this.audioContext.createBufferSource();
      voice.noiseSource.buffer = noiseBuffer;
      voice.noiseSource.loop = true;

      const noiseGain = this.audioContext.createGain();
      noiseGain.gain.value = this.params.noiseLevel / 100;
      voice.noiseSource.connect(noiseGain);
      noiseGain.connect(voice.oscMixer);
    }

    // Apply LFO to pitch
    if (this.params.lfoAmount > 0) {
      this.lfoGain.connect(voice.oscillator.frequency);
      if (voice.oscillator2) {
        this.lfoGain.connect(voice.oscillator2.frequency);
      }
    }

    // Filter - with multiple types
    voice.filter = this.audioContext.createBiquadFilter();
    voice.filter.type = this.params.filterType;

    // For sine and triangle waves, open up the filter more or bypass if cutoff is low
    let effectiveCutoff = this.params.filterCutoff;
    let effectiveResonance = this.params.filterResonance;

    if (this.params.oscillatorType === 'sine') {
      // Sine waves: ensure filter doesn't cut fundamental
      effectiveCutoff = Math.max(this.params.filterCutoff, frequency * 2, 8000);
      effectiveResonance = Math.min(this.params.filterResonance, 1); // Reduce resonance for sine
    } else if (this.params.oscillatorType === 'triangle') {
      // Triangle waves: need some harmonics but not as aggressive filtering
      effectiveCutoff = Math.max(this.params.filterCutoff, frequency * 3, 4000);
      effectiveResonance = Math.min(this.params.filterResonance, 3);
    }

    voice.filter.frequency.value = effectiveCutoff;
    voice.filter.Q.value = effectiveResonance;

    // Apply Filter Envelope if enabled
    if (this.params.filterEnvAmount && this.params.filterEnvAmount !== 0) {
      const filterEnvAmount = this.params.filterEnvAmount / 100;
      const baseFreq = effectiveCutoff;
      const maxFreq = Math.min(20000, baseFreq + (baseFreq * 4 * Math.abs(filterEnvAmount)));
      const minFreq = Math.max(20, baseFreq - (baseFreq * 0.9 * Math.abs(filterEnvAmount)));

      const targetFreq = filterEnvAmount > 0 ? maxFreq : minFreq;

      // Filter ADSR
      const filterAttackEnd = time + (this.params.filterAttack || 0.01);
      const filterDecayEnd = filterAttackEnd + (this.params.filterDecay || 0.2);
      const filterSustainLevel = this.params.filterSustain || 0.5;

      voice.filter.frequency.cancelScheduledValues(time);
      voice.filter.frequency.setValueAtTime(baseFreq, time);
      voice.filter.frequency.exponentialRampToValueAtTime(targetFreq, filterAttackEnd);
      voice.filter.frequency.exponentialRampToValueAtTime(
        baseFreq + (targetFreq - baseFreq) * filterSustainLevel,
        filterDecayEnd
      );

      // Store for release phase
      voice.filterEnvelope = {
        baseFreq,
        targetFreq,
        sustain: filterSustainLevel
      };
    }

    // Envelope
    voice.envelope = this.audioContext.createGain();
    voice.envelope.gain.value = 0;

    // Note gain (for velocity) - with waveform compensation
    voice.noteGain = this.audioContext.createGain();

    // Gain compensation for different waveforms
    let gainCompensation = 1.0;
    if (this.params.oscillatorType === 'sine') {
      gainCompensation = 1.5; // Sine waves need more gain
    } else if (this.params.oscillatorType === 'triangle') {
      gainCompensation = 1.3; // Triangle waves need some gain boost
    }

    voice.noteGain.gain.value = velocityGain * gainCompensation;

    // Create stereo panner for unison spread
    voice.panner = this.audioContext.createStereoPanner();
    voice.panner.pan.value = Math.max(-1, Math.min(1, voice.unisonPan));

    // Connect voice chain (oscMixer -> filter -> envelope -> noteGain -> panner -> effects)
    voice.oscMixer.connect(voice.filter);
    voice.filter.connect(voice.envelope);
    voice.envelope.connect(voice.noteGain);
    voice.noteGain.connect(voice.panner);
    voice.panner.connect(this.effectsInput);

    // Apply ADSR envelope
    const now = time;
    const attackEnd = now + this.params.attack;
    const decayEnd = attackEnd + this.params.decay;

    voice.envelope.gain.setValueAtTime(0, now);
    voice.envelope.gain.linearRampToValueAtTime(1, attackEnd);
    voice.envelope.gain.linearRampToValueAtTime(this.params.sustain, decayEnd);

    // Apply LFO2 routing (must be after envelope and filter creation)
    if (this.params.lfo2Target && this.params.lfo2Target !== 'off' && this.params.lfo2Amount > 0) {
      const lfo2Amount = this.params.lfo2Amount / 100;

      if (this.params.lfo2Target === 'pitch') {
        // Modulate pitch
        const pitchModGain = this.audioContext.createGain();
        pitchModGain.gain.value = frequency * 0.05 * lfo2Amount; // +/- 5% pitch mod
        this.lfo2.connect(pitchModGain);
        pitchModGain.connect(voice.oscillator.frequency);
        if (voice.oscillator2) {
          pitchModGain.connect(voice.oscillator2.frequency);
        }
        voice.lfo2PitchMod = pitchModGain;
      } else if (this.params.lfo2Target === 'filter') {
        // Modulate filter cutoff
        const filterModGain = this.audioContext.createGain();
        filterModGain.gain.value = effectiveCutoff * 0.5 * lfo2Amount;
        this.lfo2.connect(filterModGain);
        filterModGain.connect(voice.filter.frequency);
        voice.lfo2FilterMod = filterModGain;
      } else if (this.params.lfo2Target === 'amp') {
        // Modulate amplitude (tremolo)
        const ampModGain = this.audioContext.createGain();
        ampModGain.gain.value = 0.5 * lfo2Amount;
        this.lfo2.connect(ampModGain);
        ampModGain.connect(voice.envelope.gain);
        voice.lfo2AmpMod = ampModGain;
      }
    }

    // Apply Sample & Hold routing
    if (this.params.sampleHoldAmount > 0 && this.params.sampleHoldTarget) {
      const sampleHoldTarget = this.params.sampleHoldTarget || 'pitch';

      // Start the sample & hold processor if not running
      if (!this.sampleHoldRunning) {
        this.sampleHoldProcessor.connect(this.sampleHoldGain);
        this.sampleHoldRunning = true;
      }

      if (sampleHoldTarget === 'pitch') {
        // Modulate pitch with sample & hold
        const pitchModGain = this.audioContext.createGain();
        pitchModGain.gain.value = frequency * 0.15; // +/- 15% pitch variation
        this.sampleHoldGain.connect(pitchModGain);
        pitchModGain.connect(voice.oscillator.frequency);
        if (voice.oscillator2) {
          pitchModGain.connect(voice.oscillator2.frequency);
        }
        voice.sampleHoldMod = pitchModGain;
      } else if (sampleHoldTarget === 'filter') {
        // Modulate filter with sample & hold
        const filterModGain = this.audioContext.createGain();
        filterModGain.gain.value = effectiveCutoff * 0.6;
        this.sampleHoldGain.connect(filterModGain);
        filterModGain.connect(voice.filter.frequency);
        voice.sampleHoldMod = filterModGain;
      } else if (sampleHoldTarget === 'pwm') {
        // For PWM modulation, we'd need to modulate the pulse shaper's threshold
        // This is complex with square waves, so we'll modulate filter instead
        const filterModGain = this.audioContext.createGain();
        filterModGain.gain.value = effectiveCutoff * 0.4;
        this.sampleHoldGain.connect(filterModGain);
        filterModGain.connect(voice.filter.frequency);
        voice.sampleHoldMod = filterModGain;
      }
    }

    // Start all oscillators
    voice.oscillator.start(time);
    if (voice.oscillator2) {
      voice.oscillator2.start(time);
    }
    if (voice.subOscillator) {
      voice.subOscillator.start(time);
    }
    if (voice.noiseSource) {
      voice.noiseSource.start(time);
    }

      // Store voice with unique ID
      this.activeVoices.set(voiceId, voice);

      // Track voice ID by note
      if (!this.noteToVoices.has(midiNote)) {
        this.noteToVoices.set(midiNote, new Set());
      }
      this.noteToVoices.get(midiNote).add(voiceId);

      console.log(`[SandboxSynth] Started voice ${voiceId} (${i + 1}/${numVoices}) for note ${midiNote}`);
    }); // End of unison voices forEach

    // Return first voice for compatibility
    return voices[0];
  }

  stopNote(midiNote, time = this.audioContext.currentTime) {
    const voiceIds = this.noteToVoices.get(midiNote);
    if (!voiceIds || voiceIds.size === 0) return;

    // Stop all voices for this note
    voiceIds.forEach(voiceId => {
      const voice = this.activeVoices.get(voiceId);
      if (!voice) return;

      console.log(`[SandboxSynth] Stopping voice ${voiceId} for note ${midiNote}`);

      // Clear any existing cleanup timeout
      if (voice.cleanup) {
        clearTimeout(voice.cleanup);
        voice.cleanup = null;
      }

      try {
        // Apply release envelope
        const releaseTime = time + this.params.release;
        voice.envelope.gain.cancelScheduledValues(time);
        const currentGain = voice.envelope.gain.value;
        voice.envelope.gain.setValueAtTime(currentGain, time);
        voice.envelope.gain.linearRampToValueAtTime(0, releaseTime);

        // Apply filter envelope release if it exists
        if (voice.filterEnvelope) {
          const filterReleaseTime = time + (this.params.filterRelease || 0.3);
          voice.filter.frequency.cancelScheduledValues(time);
          const currentFreq = voice.filter.frequency.value;
          voice.filter.frequency.setValueAtTime(currentFreq, time);
          voice.filter.frequency.exponentialRampToValueAtTime(
            voice.filterEnvelope.baseFreq,
            filterReleaseTime
          );
        }

        // Stop all oscillators after release
        voice.oscillator.stop(releaseTime);
        if (voice.oscillator2) {
          voice.oscillator2.stop(releaseTime);
        }
        if (voice.subOscillator) {
          voice.subOscillator.stop(releaseTime);
        }
        if (voice.noiseSource) {
          voice.noiseSource.stop(releaseTime);
        }

        // Disconnect LFO if it was connected
        if (this.params.lfoAmount > 0) {
          try {
            this.lfoGain.disconnect(voice.oscillator.frequency);
          } catch (e) {
            // Ignore if already disconnected
          }
        }

        // Schedule cleanup
        voice.cleanup = setTimeout(() => {
          this.cleanupVoice(voiceId);
        }, (this.params.release + 0.1) * 1000);

      } catch (error) {
        console.error(`[SandboxSynth] Error stopping voice ${voiceId}:`, error);
        // Force immediate cleanup on error
        this.cleanupVoice(voiceId);
      }
    });
  }

  cleanupVoice(voiceId) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    console.log(`[SandboxSynth] Cleaning up voice ${voiceId}`);

    // Clear timeout if exists
    if (voice.cleanup) {
      clearTimeout(voice.cleanup);
      voice.cleanup = null;
    }

    // Disconnect all nodes
    try {
      voice.oscillator.disconnect();
      if (voice.oscillator2) voice.oscillator2.disconnect();
      if (voice.subOscillator) voice.subOscillator.disconnect();
      if (voice.noiseSource) voice.noiseSource.disconnect();
      if (voice.oscMixer) voice.oscMixer.disconnect();
      voice.filter.disconnect();
      voice.envelope.disconnect();
      voice.noteGain.disconnect();
      if (voice.panner) voice.panner.disconnect();

      // Disconnect FM modulation
      if (voice.fmGain) {
        voice.fmGain.disconnect();
      }

      // Disconnect Ring modulation
      if (voice.ringModGain) {
        voice.ringModGain.disconnect();
      }
      if (voice.osc1ToRing) {
        voice.osc1ToRing.disconnect();
      }

      // Disconnect LFO2 modulation if exists
      if (voice.lfo2PitchMod) {
        this.lfo2.disconnect(voice.lfo2PitchMod);
        voice.lfo2PitchMod.disconnect();
      }
      if (voice.lfo2FilterMod) {
        this.lfo2.disconnect(voice.lfo2FilterMod);
        voice.lfo2FilterMod.disconnect();
      }
      if (voice.lfo2AmpMod) {
        this.lfo2.disconnect(voice.lfo2AmpMod);
        voice.lfo2AmpMod.disconnect();
      }
    } catch (e) {
      // Ignore disconnection errors
    }

    // Remove from tracking
    this.activeVoices.delete(voiceId);

    // Remove from note tracking
    const voiceIds = this.noteToVoices.get(voice.note);
    if (voiceIds) {
      voiceIds.delete(voiceId);
      if (voiceIds.size === 0) {
        this.noteToVoices.delete(voice.note);
      }
    }
  }

  stopAllNotes(time = this.audioContext.currentTime) {
    // Stop all notes by iterating through noteToVoices
    const notes = Array.from(this.noteToVoices.keys());
    notes.forEach(note => {
      this.stopNote(note, time);
    });
  }

  dispose() {
    // Clear periodic cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.stopAllNotes();

    // Stop and disconnect all LFOs
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();

    this.lfo2.stop();
    this.lfo2.disconnect();
    this.lfo2Gain.disconnect();

    this.pwmLfo.stop();
    this.pwmLfo.disconnect();
    this.pwmLfoGain.disconnect();

    this.masterGain.disconnect();

    // Clean up experimental effects
    if (this.bitCrusher) {
      this.bitCrusher.disconnect();
      this.bitCrusher.onaudioprocess = null;
    }
    if (this.bitCrusherGain) this.bitCrusherGain.disconnect();
    if (this.waveFolder) this.waveFolder.disconnect();
    if (this.waveFolderGain) this.waveFolderGain.disconnect();
    if (this.feedbackGain) this.feedbackGain.disconnect();
    if (this.feedbackDelay) this.feedbackDelay.disconnect();
    if (this.feedbackFilter) this.feedbackFilter.disconnect();
    if (this.formantFilters) {
      this.formantFilters.forEach(filter => filter.disconnect());
    }
    if (this.formantGain) this.formantGain.disconnect();
    if (this.hardClipper) this.hardClipper.disconnect();
    if (this.hardClipGain) this.hardClipGain.disconnect();
    if (this.freqShifter) {
      this.freqShifter.disconnect();
      this.freqShifter.onaudioprocess = null;
    }
    if (this.freqShiftGain) this.freqShiftGain.disconnect();
    if (this.experimentalMixer) this.experimentalMixer.disconnect();
    if (this.preEffectsGain) this.preEffectsGain.disconnect();
    if (this.postExperimentalGain) this.postExperimentalGain.disconnect();

    // Clean up effects
    this.distortion.disconnect();
    this.distortionGain.disconnect();
    this.delay.disconnect();
    this.delayFeedback.disconnect();
    this.delayGain.disconnect();
    this.reverbGain.disconnect();

    this.reverbDelays.forEach(({ delay, feedback, gain }) => {
      delay.disconnect();
      feedback.disconnect();
      gain.disconnect();
    });

    this.dryGain.disconnect();
    this.effectsInput.disconnect();
  }
}

export default SandboxSynth;