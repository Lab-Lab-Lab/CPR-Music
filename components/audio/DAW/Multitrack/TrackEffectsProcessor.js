// components/audio/DAW/Multitrack/TrackEffectsProcessor.js

/**
 * TrackEffectsProcessor - Adapter for using single-track effects in multitrack
 *
 * This processor extracts the core audio processing logic from existing effects
 * without their React dependencies or context manipulation
 */

class TrackEffectsProcessor {
  /**
   * Process a region with any effect from the single-track DAW
   * @param {AudioBuffer} inputBuffer - The full track audio
   * @param {number} startTime - Region start in seconds
   * @param {number} endTime - Region end in seconds
   * @param {string} effectType - Type of effect to apply
   * @param {Object} parameters - Effect parameters
   * @param {AudioContext} audioContext - Web Audio context
   * @returns {Promise<AudioBuffer>} - Full buffer with processed region
   */
  static async processRegion(
    inputBuffer,
    startTime,
    endTime,
    effectType,
    parameters,
    audioContext,
  ) {
    const sampleRate = inputBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);

    // Map of effect types to their processing logic
    const effectProcessors = {
      reverb: this.processReverb,
      echo: this.processEcho,
      delay: this.processAdvancedDelay,
      chorus: this.processChorus,
      flanger: this.processFlanger,
      phaser: this.processPhaser,
      distortion: this.processDistortion,
      autowah: this.processAutoWah,
      ringmod: this.processRingModulator,
      tremolo: this.processTremolo,
      autopan: this.processAutoPan,
      pitch: this.processPitchShifter,
      freqshift: this.processFrequencyShifter,
      stereo: this.processStereoWidener,
      glitch: this.processGlitch,
      granular: this.processGranularFreeze,
      paulstretch: this.processPaulstretch,
      spectral: this.processSpectralFilter,
      reverseverb: this.processReverseReverb,
      compressor: this.processCompressor,
      gate: this.processGate,
      eq: this.processEQ,
    };

    const processor = effectProcessors[effectType];
    if (!processor) {
      throw new Error(`Unknown effect type: ${effectType}`);
    }

    // Process the region using the existing effect logic
    return await processor.call(
      this,
      inputBuffer,
      startSample,
      endSample,
      parameters,
      audioContext,
    );
  }

  /**
   * Extract reverb processing from existing Reverb.js
   */
  static async processReverb(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    // For now, use a simple convolution reverb
    const regionLength = endSample - startSample;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const convolver = offlineContext.createConvolver();
    const wetGain = offlineContext.createGain();
    const dryGain = offlineContext.createGain();

    // Create simple impulse response
    const impulseLength = offlineContext.sampleRate * 2; // 2 second reverb
    const impulse = offlineContext.createBuffer(
      2,
      impulseLength,
      offlineContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
      }
    }

    convolver.buffer = impulse;
    wetGain.gain.value = parameters.mix || 0.3;
    dryGain.gain.value = 1 - (parameters.mix || 0.3);

    source.connect(dryGain);
    source.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(offlineContext.destination);
    wetGain.connect(offlineContext.destination);

    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process echo effect
   */
  static async processEcho(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const delay = offlineContext.createDelay(5);
    const feedback = offlineContext.createGain();
    const wetGain = offlineContext.createGain();
    const dryGain = offlineContext.createGain();

    delay.delayTime.value = (parameters.time || 250) / 1000;
    feedback.gain.value = parameters.feedback || 0.5;
    wetGain.gain.value = parameters.mix || 0.5;
    dryGain.gain.value = 1 - (parameters.mix || 0.5);

    source.connect(dryGain);
    source.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    dryGain.connect(offlineContext.destination);
    wetGain.connect(offlineContext.destination);

    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process flanger effect
   */
  static async processFlanger(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const delay = offlineContext.createDelay(0.02);
    const lfo = offlineContext.createOscillator();
    const lfoGain = offlineContext.createGain();
    const feedback = offlineContext.createGain();
    const wetGain = offlineContext.createGain();
    const dryGain = offlineContext.createGain();

    // Set parameters
    delay.delayTime.value = parameters.delay || 0.005;
    lfo.frequency.value = parameters.rate || 0.5;
    lfoGain.gain.value = parameters.depth || 0.002;
    feedback.gain.value = parameters.feedback || 0.5;
    wetGain.gain.value = parameters.mix || 0.5;
    dryGain.gain.value = 1 - (parameters.mix || 0.5);

    // Connect LFO to delay time
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);

    // Connect audio path
    source.connect(dryGain);
    source.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);

    dryGain.connect(offlineContext.destination);
    wetGain.connect(offlineContext.destination);

    source.start(0);
    lfo.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process chorus effect
   */
  static async processChorus(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create multiple voices
    const delays = [];
    const lfos = [];
    const gains = [];

    for (let i = 0; i < 3; i++) {
      const delay = offlineContext.createDelay(0.1);
      const lfo = offlineContext.createOscillator();
      const lfoGain = offlineContext.createGain();
      const voiceGain = offlineContext.createGain();

      delay.delayTime.value = 0.02 + i * 0.01;
      lfo.frequency.value = 0.5 + i * 0.1;
      lfoGain.gain.value = 0.002;
      voiceGain.gain.value = 0.3;

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      source.connect(delay);
      delay.connect(voiceGain);
      voiceGain.connect(offlineContext.destination);

      lfo.start(0);

      delays.push(delay);
      lfos.push(lfo);
      gains.push(voiceGain);
    }

    // Dry signal
    const dryGain = offlineContext.createGain();
    dryGain.gain.value = 0.5;
    source.connect(dryGain);
    dryGain.connect(offlineContext.destination);

    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process phaser effect
   */
  static async processPhaser(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create all-pass filters
    const filters = [];
    for (let i = 0; i < 4; i++) {
      const filter = offlineContext.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = 200 + i * 500;
      filters.push(filter);
    }

    // Connect filters in series
    let currentNode = source;
    filters.forEach((filter) => {
      currentNode.connect(filter);
      currentNode = filter;
    });

    // LFO to modulate filter frequencies
    const lfo = offlineContext.createOscillator();
    const lfoGain = offlineContext.createGain();
    lfo.frequency.value = parameters.rate || 0.5;
    lfoGain.gain.value = parameters.depth || 1000;

    lfo.connect(lfoGain);
    filters.forEach((filter) => {
      lfoGain.connect(filter.frequency);
    });

    // Mix wet and dry
    const wetGain = offlineContext.createGain();
    const dryGain = offlineContext.createGain();
    wetGain.gain.value = parameters.mix || 0.5;
    dryGain.gain.value = 1 - (parameters.mix || 0.5);

    currentNode.connect(wetGain);
    source.connect(dryGain);
    wetGain.connect(offlineContext.destination);
    dryGain.connect(offlineContext.destination);

    source.start(0);
    lfo.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process distortion effect
   */
  static async processDistortion(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const waveshaper = offlineContext.createWaveShaper();
    const outputGain = offlineContext.createGain();

    // Create distortion curve
    const amount = parameters.amount || 50;
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    waveshaper.curve = curve;
    waveshaper.oversample = '4x';
    outputGain.gain.value = parameters.outputGain || 0.7;

    source.connect(waveshaper);
    waveshaper.connect(outputGain);
    outputGain.connect(offlineContext.destination);

    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process tremolo effect
   */
  static async processTremolo(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = offlineContext.createGain();
    const lfo = offlineContext.createOscillator();
    const lfoGain = offlineContext.createGain();

    // Set up LFO
    lfo.frequency.value = parameters.rate || 5;
    lfoGain.gain.value = parameters.depth || 0.5;

    // Connect LFO to gain
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    // Set base gain
    gainNode.gain.value = 1 - (parameters.depth || 0.5);

    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);

    source.start(0);
    lfo.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process auto-pan effect
   */
  static async processAutoPan(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const panner = offlineContext.createStereoPanner();
    const lfo = offlineContext.createOscillator();
    const lfoGain = offlineContext.createGain();

    lfo.frequency.value = parameters.rate || 1;
    lfoGain.gain.value = parameters.depth || 0.8;

    lfo.connect(lfoGain);
    lfoGain.connect(panner.pan);

    source.connect(panner);
    panner.connect(offlineContext.destination);

    source.start(0);
    lfo.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process compressor effect
   */
  static async processCompressor(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const sampleRate = audioBuffer.sampleRate;
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const compressor = offlineContext.createDynamicsCompressor();
    const makeupGain = offlineContext.createGain();

    compressor.threshold.value = parameters.threshold || -24;
    compressor.ratio.value = parameters.ratio || 4;
    compressor.attack.value = parameters.attack || 0.003;
    compressor.release.value = parameters.release || 0.1;
    compressor.knee.value = parameters.knee || 30;

    makeupGain.gain.value = Math.pow(10, (parameters.makeup || 0) / 20);

    source.connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(offlineContext.destination);

    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Process gate effect
   */
  static async processGate(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    // Simple gate implementation
    const threshold = parameters.threshold || -40;
    const thresholdLinear = Math.pow(10, threshold / 20);

    const outputBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);

      for (let i = 0; i < audioBuffer.length; i++) {
        if (i >= startSample && i < endSample) {
          outputData[i] =
            Math.abs(inputData[i]) > thresholdLinear ? inputData[i] : 0;
        } else {
          outputData[i] = inputData[i];
        }
      }
    }

    return outputBuffer;
  }

  /**
   * Process EQ effect
   */
  static async processEQ(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create filter chain from parameters
    let currentNode = source;
    const bands = parameters.bands || [
      { frequency: 100, gain: 0 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: 0 },
    ];

    bands.forEach((band) => {
      const filter = offlineContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = 1;

      currentNode.connect(filter);
      currentNode = filter;
    });

    currentNode.connect(offlineContext.destination);
    source.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  /**
   * Extract delay processing from existing AdvancedDelay.js
   */
  static async processAdvancedDelay(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    const regionLength = endSample - startSample;
    const sampleRate = audioBuffer.sampleRate;

    // Calculate delay parameters
    const delaySamples = Math.floor((parameters.time / 1000) * sampleRate);
    const maxDelayTaps = 10;
    const totalLength = audioBuffer.length + delaySamples * maxDelayTaps;

    // Create offline context
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      totalLength,
      sampleRate,
    );

    // This mirrors the logic from AdvancedDelay.js
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const delayL = offlineContext.createDelay(2);
    const delayR = offlineContext.createDelay(2);
    const feedbackGainL = offlineContext.createGain();
    const feedbackGainR = offlineContext.createGain();
    const filterL = offlineContext.createBiquadFilter();
    const filterR = offlineContext.createBiquadFilter();
    const wetGain = offlineContext.createGain();
    const dryGain = offlineContext.createGain();

    // Apply parameters
    delayL.delayTime.value = parameters.time / 1000;
    delayR.delayTime.value = parameters.time / 1000;
    feedbackGainL.gain.value = parameters.feedback || 0.5;
    feedbackGainR.gain.value = parameters.feedback || 0.5;
    wetGain.gain.value = parameters.mix || 0.5;
    dryGain.gain.value = 1 - (parameters.mix || 0.5);

    filterL.type = parameters.filterType || 'lowpass';
    filterR.type = parameters.filterType || 'lowpass';
    filterL.frequency.value = parameters.filterFreq || 2000;
    filterR.frequency.value = parameters.filterFreq || 2000;

    // Connect nodes (simplified from original)
    const splitter = offlineContext.createChannelSplitter(2);
    const merger = offlineContext.createChannelMerger(2);

    source.connect(splitter);
    source.connect(dryGain);
    dryGain.connect(offlineContext.destination);

    if (parameters.pingPong) {
      // Ping-pong routing
      splitter.connect(delayL, 0);
      splitter.connect(delayR, 1);
      delayL.connect(filterL);
      delayR.connect(filterR);
      filterL.connect(feedbackGainL);
      filterR.connect(feedbackGainR);
      feedbackGainL.connect(delayR);
      feedbackGainR.connect(delayL);
    } else {
      // Standard routing
      splitter.connect(delayL, 0);
      splitter.connect(delayR, 1);
      delayL.connect(filterL);
      delayR.connect(filterR);
      filterL.connect(feedbackGainL);
      filterR.connect(feedbackGainR);
      feedbackGainL.connect(delayL);
      feedbackGainR.connect(delayR);
    }

    filterL.connect(merger, 0, 0);
    filterR.connect(merger, 0, 1);
    merger.connect(wetGain);
    wetGain.connect(offlineContext.destination);

    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();

    return this.mergeProcessedRegion(
      audioBuffer,
      renderedBuffer,
      startSample,
      endSample,
      0,
    );
  }

  // Add stub implementations for remaining effects
  static async processAutoWah(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn('AutoWah not fully implemented, returning original audio');
    return audioBuffer;
  }

  static async processRingModulator(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Ring Modulator not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  static async processPitchShifter(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Pitch Shifter not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  static async processFrequencyShifter(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Frequency Shifter not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  static async processStereoWidener(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Stereo Widener not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  static async processGlitch(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn('Glitch not fully implemented, returning original audio');
    return audioBuffer;
  }

  static async processGranularFreeze(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Granular Freeze not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  static async processPaulstretch(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn('Paulstretch not fully implemented, returning original audio');
    return audioBuffer;
  }

  static async processSpectralFilter(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Spectral Filter not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  static async processReverseReverb(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext,
  ) {
    console.warn(
      'Reverse Reverb not fully implemented, returning original audio',
    );
    return audioBuffer;
  }

  /**
   * Helper: Merge processed region back into full buffer
   */
  static mergeProcessedRegion(
    originalBuffer,
    processedBuffer,
    startSample,
    endSample,
    tailLength = 0,
  ) {
    const outputLength = Math.max(
      originalBuffer.length,
      startSample + processedBuffer.length,
    );
    const outputBuffer = new AudioBuffer({
      numberOfChannels: originalBuffer.numberOfChannels,
      length: outputLength,
      sampleRate: originalBuffer.sampleRate,
    });

    for (
      let channel = 0;
      channel < originalBuffer.numberOfChannels;
      channel++
    ) {
      const originalData = originalBuffer.getChannelData(channel);
      const processedData = processedBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);

      // Copy before region
      for (let i = 0; i < startSample; i++) {
        outputData[i] = originalData[i];
      }

      // Copy processed region
      for (
        let i = 0;
        i < processedData.length && startSample + i < outputLength;
        i++
      ) {
        outputData[startSample + i] = processedData[i];
      }

      // Copy after region (if needed)
      const afterStart = Math.max(
        endSample,
        startSample + processedData.length,
      );
      for (let i = afterStart; i < originalData.length; i++) {
        if (i < outputLength) {
          outputData[i] = originalData[i];
        }
      }
    }

    return outputBuffer;
  }

  /**
   * Convert AudioBuffer to WAV blob (reused from effects)
   */
  static async audioBufferToWav(buffer) {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2 * buffer.numberOfChannels, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length - 44, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const int16 = Math.max(-32768, Math.min(32767, sample * 32768));
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // Add more effect processors as needed...
  // We'll implement these by extracting the core logic from each effect component
}

export default TrackEffectsProcessor;
