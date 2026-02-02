/**
 * Unified Effects Processor
 *
 * Central effects processing engine that consolidates all effect types
 * into a single, reusable module for both single-track and multitrack DAW.
 *
 * Key Features:
 * - Pure functions (no React dependencies)
 * - Processes audio clips with effect chains
 * - Supports all 24 effects from single-track DAW
 * - Non-destructive (returns new buffer)
 */

/**
 * Effect processing result with status and optional error info
 * @typedef {Object} EffectResult
 * @property {AudioBuffer} buffer - Processed audio buffer (original if failed)
 * @property {boolean} success - Whether the effect processed successfully
 * @property {string|null} error - Error message if failed
 * @property {string} effectType - The effect type that was processed
 */

/**
 * Process a single effect on an audio buffer region
 * @param {AudioBuffer} audioBuffer - Full audio buffer
 * @param {number} startSample - Region start sample
 * @param {number} endSample - Region end sample
 * @param {string} effectType - Type of effect to apply
 * @param {Object} parameters - Effect-specific parameters
 * @param {AudioContext} audioContext - Web Audio context
 * @param {Object} options - Processing options
 * @param {boolean} options.throwOnError - Throw errors instead of returning original buffer (default: false)
 * @returns {Promise<AudioBuffer|EffectResult>} - Processed audio buffer or result object
 */
export async function processEffect(
  audioBuffer,
  startSample,
  endSample,
  effectType,
  parameters,
  audioContext,
  options = {}
) {
  const { throwOnError = false, returnResult = false } = options;

  const processors = {
    eq: processEQ,
    reverb: processReverb,
    echo: processEcho,
    delay: processAdvancedDelay,
    chorus: processChorus,
    flanger: processFlanger,
    phaser: processPhaser,
    distortion: processDistortion,
    compressor: processCompressor,
    gate: processGate,
    limiter: processLimiter,
    filter: processFilter,
    tremolo: processTremolo,
    autopan: processAutoPan,
    autowah: processAutoWah,
    ringmod: processRingModulator,
    pitchshift: processPitchShifter,
    freqshift: processFrequencyShifter,
    stereowide: processStereoWidener,
    glitch: processGlitch,
    granular: processGranularFreeze,
    paulstretch: processPaulstretch,
    spectral: processSpectralFilter,
    reverseverb: processReverseReverb,
  };

  const processor = processors[effectType];
  if (!processor) {
    const errorMsg = `Unknown effect type: ${effectType}`;
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    console.error(`[UnifiedEffectsProcessor] ${errorMsg}`);
    return returnResult
      ? { buffer: audioBuffer, success: false, error: errorMsg, effectType }
      : audioBuffer;
  }

  try {
    const result = await processor(
      audioBuffer,
      startSample,
      endSample,
      parameters,
      audioContext
    );
    return returnResult
      ? { buffer: result, success: true, error: null, effectType }
      : result;
  } catch (error) {
    const errorMsg = `Effect "${effectType}" failed: ${error.message}`;
    console.error(`[UnifiedEffectsProcessor] ${errorMsg}`, error);

    if (throwOnError) {
      throw error;
    }

    // Return original buffer on error (graceful degradation)
    return returnResult
      ? { buffer: audioBuffer, success: false, error: errorMsg, effectType }
      : audioBuffer;
  }
}

/**
 * Effects chain processing result
 * @typedef {Object} EffectsChainResult
 * @property {AudioBuffer} buffer - Final processed audio buffer
 * @property {boolean} success - Whether all effects processed successfully
 * @property {Array} results - Array of per-effect results
 * @property {Array} errors - Array of error messages from failed effects
 * @property {number} processedCount - Number of effects successfully processed
 * @property {number} skippedCount - Number of disabled effects skipped
 * @property {number} failedCount - Number of effects that failed
 */

/**
 * Process an effects chain (multiple effects in sequence)
 * @param {AudioBuffer} audioBuffer - Full audio buffer
 * @param {number} startSample - Region start sample
 * @param {number} endSample - Region end sample
 * @param {Array} effectsChain - Array of {type, parameters, enabled, id}
 * @param {AudioContext} audioContext - Web Audio context
 * @param {Object} options - Processing options
 * @param {boolean} options.stopOnError - Stop processing on first error (default: false)
 * @param {boolean} options.returnDetails - Return detailed results object (default: false)
 * @param {Function} options.onProgress - Callback for progress updates: (effectIndex, effectType, status)
 * @returns {Promise<AudioBuffer|EffectsChainResult>} - Processed audio buffer or detailed result
 */
export async function processEffectsChain(
  audioBuffer,
  startSample,
  endSample,
  effectsChain,
  audioContext,
  options = {}
) {
  const { stopOnError = false, returnDetails = false, onProgress } = options;

  // Validate inputs
  if (!audioBuffer) {
    const error = 'processEffectsChain: No audio buffer provided';
    console.error(`[UnifiedEffectsProcessor] ${error}`);
    if (returnDetails) {
      return {
        buffer: null,
        success: false,
        results: [],
        errors: [error],
        processedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }
    return null;
  }

  if (!Array.isArray(effectsChain) || effectsChain.length === 0) {
    return returnDetails
      ? {
          buffer: audioBuffer,
          success: true,
          results: [],
          errors: [],
          processedCount: 0,
          skippedCount: 0,
          failedCount: 0,
        }
      : audioBuffer;
  }

  let processedBuffer = audioBuffer;
  const results = [];
  const errors = [];
  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < effectsChain.length; i++) {
    const effect = effectsChain[i];

    // Skip disabled effects
    if (!effect.enabled) {
      skippedCount++;
      if (onProgress) {
        onProgress(i, effect.type, 'skipped');
      }
      results.push({
        effectId: effect.id,
        effectType: effect.type,
        status: 'skipped',
        error: null,
      });
      continue;
    }

    if (onProgress) {
      onProgress(i, effect.type, 'processing');
    }

    try {
      const result = await processEffect(
        processedBuffer,
        startSample,
        endSample,
        effect.type,
        effect.parameters,
        audioContext,
        { returnResult: true }
      );

      if (result.success) {
        processedBuffer = result.buffer;
        processedCount++;
        results.push({
          effectId: effect.id,
          effectType: effect.type,
          status: 'success',
          error: null,
        });
        if (onProgress) {
          onProgress(i, effect.type, 'success');
        }
      } else {
        failedCount++;
        errors.push(result.error);
        results.push({
          effectId: effect.id,
          effectType: effect.type,
          status: 'failed',
          error: result.error,
        });
        if (onProgress) {
          onProgress(i, effect.type, 'failed');
        }

        if (stopOnError) {
          console.warn(
            `[UnifiedEffectsProcessor] Stopping chain at effect ${i} (${effect.type}) due to error`
          );
          break;
        }
        // Continue with the last successful buffer
      }
    } catch (error) {
      // Unexpected error (shouldn't happen with returnResult, but be safe)
      failedCount++;
      const errorMsg = `Unexpected error in effect "${effect.type}": ${error.message}`;
      errors.push(errorMsg);
      results.push({
        effectId: effect.id,
        effectType: effect.type,
        status: 'failed',
        error: errorMsg,
      });
      console.error(`[UnifiedEffectsProcessor] ${errorMsg}`, error);

      if (onProgress) {
        onProgress(i, effect.type, 'failed');
      }

      if (stopOnError) {
        break;
      }
    }
  }

  if (returnDetails) {
    return {
      buffer: processedBuffer,
      success: failedCount === 0,
      results,
      errors,
      processedCount,
      skippedCount,
      failedCount,
    };
  }

  return processedBuffer;
}

// ============================================================================
// EFFECT PROCESSORS - Core audio processing logic extracted from single-track
// ============================================================================

/**
 * EQ - Parametric Equalizer
 */
async function processEQ(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  let currentNode = source;
  const bands = parameters.bands || [];

  // Create filter chain from EQ bands
  for (const band of bands) {
    if (band.enabled === false || (band.gain === 0 && !['highpass', 'lowpass', 'bandpass'].includes(band.type))) {
      continue;
    }

    const filter = offlineContext.createBiquadFilter();
    filter.type = band.type || 'peaking';
    filter.frequency.value = band.frequency;
    filter.gain.value = band.gain || 0;
    filter.Q.value = band.q || 1;

    currentNode.connect(filter);
    currentNode = filter;
  }

  // Apply output gain if specified
  if (parameters.outputGain !== undefined && parameters.outputGain !== 0) {
    const outputGain = offlineContext.createGain();
    outputGain.gain.value = Math.pow(10, parameters.outputGain / 20);
    currentNode.connect(outputGain);
    currentNode = outputGain;
  }

  currentNode.connect(offlineContext.destination);
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Reverb - Convolution reverb
 */
async function processReverb(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const convolver = offlineContext.createConvolver();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  // Create simple impulse response
  const impulseLength = offlineContext.sampleRate * 2; // 2 second reverb
  const impulse = offlineContext.createBuffer(2, impulseLength, offlineContext.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < impulseLength; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
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

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Echo - Simple delay with feedback
 */
async function processEcho(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
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

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Advanced Delay - Stereo delay with filters
 */
async function processAdvancedDelay(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const delayL = offlineContext.createDelay(2);
  const delayR = offlineContext.createDelay(2);
  const feedbackGainL = offlineContext.createGain();
  const feedbackGainR = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  delayL.delayTime.value = parameters.time / 1000;
  delayR.delayTime.value = parameters.time / 1000;
  feedbackGainL.gain.value = parameters.feedback || 0.5;
  feedbackGainR.gain.value = parameters.feedback || 0.5;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);

  const splitter = offlineContext.createChannelSplitter(2);
  const merger = offlineContext.createChannelMerger(2);

  source.connect(splitter);
  source.connect(dryGain);
  dryGain.connect(offlineContext.destination);

  if (parameters.pingPong) {
    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);
    delayL.connect(feedbackGainL);
    delayR.connect(feedbackGainR);
    feedbackGainL.connect(delayR);
    feedbackGainR.connect(delayL);
  } else {
    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);
    delayL.connect(feedbackGainL);
    delayR.connect(feedbackGainR);
    feedbackGainL.connect(delayL);
    feedbackGainR.connect(delayR);
  }

  feedbackGainL.connect(merger, 0, 0);
  feedbackGainR.connect(merger, 0, 1);
  merger.connect(wetGain);
  wetGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Chorus - Multi-voice modulated delay
 */
async function processChorus(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create multiple voices
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
  }

  // Dry signal
  const dryGain = offlineContext.createGain();
  dryGain.gain.value = 0.5;
  source.connect(dryGain);
  dryGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Flanger - Modulated comb filtering
 */
async function processFlanger(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const delay = offlineContext.createDelay(0.02);
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();
  const feedback = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  delay.delayTime.value = parameters.delay || 0.005;
  lfo.frequency.value = parameters.rate || 0.5;
  lfoGain.gain.value = parameters.depth || 0.002;
  feedback.gain.value = parameters.feedback || 0.5;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);

  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);

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
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Phaser - All-pass filter modulation
 */
async function processPhaser(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
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
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Distortion - Waveshaping
 */
async function processDistortion(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
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
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }

  waveshaper.curve = curve;
  waveshaper.oversample = '4x';
  outputGain.gain.value = parameters.outputGain || 0.7;

  source.connect(waveshaper);
  waveshaper.connect(outputGain);
  outputGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Compressor - Dynamic range compression
 */
async function processCompressor(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
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

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Gate - Noise gate
 */
async function processGate(audioBuffer, startSample, endSample, parameters, audioContext) {
  const threshold = parameters.threshold || -40;
  const thresholdLinear = Math.pow(10, threshold / 20);

  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < audioBuffer.length; i++) {
      if (i >= startSample && i < endSample) {
        outputData[i] = Math.abs(inputData[i]) > thresholdLinear ? inputData[i] : 0;
      } else {
        outputData[i] = inputData[i];
      }
    }
  }

  return outputBuffer;
}

/**
 * Limiter - Peak limiting
 */
async function processLimiter(audioBuffer, startSample, endSample, parameters, audioContext) {
  // Use compressor with infinity ratio for limiting
  return processCompressor(audioBuffer, startSample, endSample, {
    ...parameters,
    ratio: 20,
    attack: 0.001,
    release: 0.05
  }, audioContext);
}

/**
 * Filter - Lowpass/Highpass/Bandpass
 */
async function processFilter(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offlineContext.createBiquadFilter();
  filter.type = parameters.type || 'lowpass';
  filter.frequency.value = parameters.frequency || 1000;
  filter.Q.value = parameters.resonance || 1;

  source.connect(filter);
  filter.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Tremolo - Amplitude modulation
 */
async function processTremolo(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const gainNode = offlineContext.createGain();
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();

  lfo.frequency.value = parameters.rate || 5;
  lfoGain.gain.value = parameters.depth || 0.5;
  gainNode.gain.value = 1 - (parameters.depth || 0.5);

  lfo.connect(lfoGain);
  lfoGain.connect(gainNode.gain);

  source.connect(gainNode);
  gainNode.connect(offlineContext.destination);

  source.start(0);
  lfo.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Auto Pan - Stereo panning modulation
 */
async function processAutoPan(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
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
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

// Stub implementations for advanced effects (to be implemented later)
async function processAutoWah(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('AutoWah not fully implemented, returning original audio');
  return audioBuffer;
}

async function processRingModulator(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Ring Modulator not fully implemented, returning original audio');
  return audioBuffer;
}

async function processPitchShifter(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Pitch Shifter not fully implemented, returning original audio');
  return audioBuffer;
}

async function processFrequencyShifter(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Frequency Shifter not fully implemented, returning original audio');
  return audioBuffer;
}

async function processStereoWidener(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Stereo Widener not fully implemented, returning original audio');
  return audioBuffer;
}

async function processGlitch(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Glitch not fully implemented, returning original audio');
  return audioBuffer;
}

async function processGranularFreeze(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Granular Freeze not fully implemented, returning original audio');
  return audioBuffer;
}

async function processPaulstretch(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Paulstretch parameters
  const stretch = parameters.stretchFactor || parameters.stretch || 8;
  const windowSizeSamples = Math.floor(
    (parameters.windowSize || 0.25) * sampleRate
  );

  // Make sure window size is a power of 2 for FFT
  const fftSize = Math.pow(2, Math.ceil(Math.log2(windowSizeSamples)));

  // Output length after stretching
  const outputLength = Math.floor(regionLength * stretch);

  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length - regionLength + outputLength,
    sampleRate
  );

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy before region
    for (let i = 0; i < startSample; i++) {
      outputData[i] = inputData[i];
    }

    // Extract region data
    const regionData = new Float32Array(regionLength);
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }

    // Paulstretch processing
    const stretchedData = paulstretchChannel(
      regionData,
      outputLength,
      windowSizeSamples,
      fftSize,
      stretch
    );

    // Copy stretched data to output
    for (let i = 0; i < outputLength; i++) {
      outputData[startSample + i] = stretchedData[i];
    }

    // Copy after region
    for (let i = endSample; i < inputData.length; i++) {
      const outputIndex = startSample + outputLength + (i - endSample);
      if (outputIndex < outputData.length) {
        outputData[outputIndex] = inputData[i];
      }
    }
  }

  return outputBuffer;
}

// Helper class for FFT (same as in Paulstretch.js)
class FFT {
  constructor(size) {
    if ((size & (size - 1)) !== 0) {
      throw new Error('FFT size must be a power of two');
    }
    this.size = size;

    const bits = Math.log2(size) | 0;
    this.reverseTable = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let j = 0;
      for (let k = 0; k < bits; k++) {
        j = (j << 1) | ((i >>> k) & 1);
      }
      this.reverseTable[i] = j;
    }
  }

  _transformInPlace(data, inverse) {
    const N = this.size;

    // Bit-reversed reordering
    for (let i = 0; i < N; i++) {
      const j = this.reverseTable[i];
      if (j > i) {
        const i2 = i << 1;
        const j2 = j << 1;
        const tr = data[i2];
        const ti = data[i2 + 1];
        data[i2] = data[j2];
        data[i2 + 1] = data[j2 + 1];
        data[j2] = tr;
        data[j2 + 1] = ti;
      }
    }

    // Cooley-Tukey FFT
    for (let len = 2; len <= N; len <<= 1) {
      const ang = ((inverse ? 2 : -2) * Math.PI) / len;
      const wLenR = Math.cos(ang);
      const wLenI = Math.sin(ang);

      for (let i = 0; i < N; i += len) {
        let wR = 1;
        let wI = 0;
        const half = len >> 1;

        for (let j = 0; j < half; j++) {
          const i0 = (i + j) << 1;
          const i1 = (i + j + half) << 1;

          const uR = data[i0];
          const uI = data[i0 + 1];
          const vR = data[i1];
          const vI = data[i1 + 1];

          const tR = vR * wR - vI * wI;
          const tI = vR * wI + vI * wR;

          data[i0] = uR + tR;
          data[i0 + 1] = uI + tI;
          data[i1] = uR - tR;
          data[i1 + 1] = uI - tI;

          const nwR = wR * wLenR - wI * wLenI;
          const nwI = wR * wLenI + wI * wLenR;
          wR = nwR;
          wI = nwI;
        }
      }
    }

    if (inverse) {
      const invN = 1 / N;
      for (let i = 0; i < N; i++) {
        const idx = i << 1;
        data[idx] *= invN;
        data[idx + 1] *= invN;
      }
    }
  }

  forward(signal) {
    const N = this.size;
    const data = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const idx = i << 1;
      data[idx] = signal[i] || 0;
      data[idx + 1] = 0;
    }
    this._transformInPlace(data, false);
    return data;
  }

  inverse(spectrum) {
    const N = this.size;
    const data = new Float32Array(N * 2);
    data.set(spectrum);
    this._transformInPlace(data, true);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      out[i] = data[i << 1];
    }
    return out;
  }
}

// sqrt-Hann window for analysis/synthesis
function sqrtHannWindow(length) {
  const w = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const h = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    w[i] = Math.sqrt(h);
  }
  return w;
}

// Paulstretch processing for a single channel
function paulstretchChannel(regionData, outputLength, windowSizeSamples, fftSize, stretch) {
  const stretchedData = new Float32Array(outputLength);
  const frameWindow = sqrtHannWindow(windowSizeSamples);
  const olaWeight = new Float32Array(outputLength);

  // For smooth ethereal sound, use 4x overlap (standard paulstretch)
  const overlapFactor = 4;
  const hopSize = Math.floor(windowSizeSamples / overlapFactor);
  const outputHopSize = Math.floor(hopSize * stretch);

  let inputPos = 0;
  let outputPos = 0;

  const fft = new FFT(fftSize);
  const regionLength = regionData.length;

  while (
    inputPos + windowSizeSamples < regionLength &&
    outputPos + windowSizeSamples < outputLength
  ) {
    // Extract windowed segment and zero-pad to fftSize
    const segment = new Float32Array(fftSize);
    let dc = 0;
    let count = 0;
    for (let i = 0; i < windowSizeSamples; i++) {
      if (inputPos + i < regionLength) {
        dc += regionData[inputPos + i];
        count++;
      }
    }
    dc = count > 0 ? dc / count : 0;
    for (let i = 0; i < windowSizeSamples; i++) {
      if (inputPos + i < regionLength) {
        const s = regionData[inputPos + i] - dc;
        segment[i] = s * frameWindow[i];
      }
    }

    // FFT
    const spectrum = fft.forward(segment);

    // Randomize phases (keep magnitudes, randomize phases)
    const N = fftSize;
    const half = N >> 1;

    // Force DC and Nyquist imaginary parts to zero
    spectrum[1] = 0;
    spectrum[half * 2 + 1] = 0;

    for (let k = 1; k < half; k++) {
      const i = k * 2;
      const re = spectrum[i];
      const im = spectrum[i + 1];
      const mag = Math.hypot(re, im);

      const phase = Math.random() * 2 * Math.PI;
      const reNew = mag * Math.cos(phase);
      const imNew = mag * Math.sin(phase);

      spectrum[i] = reNew;
      spectrum[i + 1] = imNew;

      // Mirror to negative frequency (complex conjugate)
      const j = (N - k) * 2;
      spectrum[j] = reNew;
      spectrum[j + 1] = -imNew;
    }

    // IFFT
    const stretched = fft.inverse(spectrum);

    // RMS gain compensation
    let rmsIn = 0;
    let rmsOut = 0;
    for (let i = 0; i < windowSizeSamples; i++) {
      const a = segment[i];
      const b = stretched[i];
      rmsIn += a * a;
      rmsOut += b * b;
    }
    rmsIn = Math.sqrt(rmsIn / Math.max(1, windowSizeSamples));
    rmsOut = Math.sqrt(rmsOut / Math.max(1, windowSizeSamples));
    const eps = 1e-12;
    const gain = rmsOut > eps ? rmsIn / rmsOut : 1;
    if (Math.abs(gain - 1) > 1e-6) {
      for (let i = 0; i < windowSizeSamples; i++) {
        stretched[i] *= gain;
      }
    }

    // Add to output with overlap-add
    for (let i = 0; i < windowSizeSamples; i++) {
      if (outputPos + i < outputLength) {
        stretchedData[outputPos + i] += stretched[i] * frameWindow[i];
        olaWeight[outputPos + i] += frameWindow[i] * frameWindow[i];
      }
    }

    inputPos += hopSize;
    outputPos += outputHopSize;
  }

  // Normalize by overlap-add weights
  for (let i = 0; i < outputLength; i++) {
    if (olaWeight[i] > 0) {
      stretchedData[i] /= olaWeight[i];
    }
  }

  // Apply makeup gain and soft limiter
  const makeupDb = 0; // Can be parameterized if needed
  const limiterDb = -1;
  const makeupLinear = Math.pow(10, makeupDb / 20);
  const limiterThresh = Math.pow(10, limiterDb / 20);

  for (let i = 0; i < outputLength; i++) {
    let s = stretchedData[i] * makeupLinear;
    s = limiterThresh * Math.tanh(s / Math.max(1e-12, limiterThresh));
    stretchedData[i] = s;
  }

  return stretchedData;
}

async function processSpectralFilter(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Spectral Filter not fully implemented, returning original audio');
  return audioBuffer;
}

async function processReverseReverb(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Reverse Reverb not fully implemented, returning original audio');
  return audioBuffer;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Merge processed region back into full buffer
 */
function mergeProcessedRegion(originalBuffer, processedBuffer, startSample, endSample, audioContext, tailLength = 0) {
  const outputLength = Math.max(originalBuffer.length, startSample + processedBuffer.length);
  const outputBuffer = audioContext.createBuffer(
    originalBuffer.numberOfChannels,
    outputLength,
    originalBuffer.sampleRate
  );

  for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const processedData = processedBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy before region
    for (let i = 0; i < startSample; i++) {
      outputData[i] = originalData[i];
    }

    // Copy processed region
    for (let i = 0; i < processedData.length && startSample + i < outputLength; i++) {
      outputData[startSample + i] = processedData[i];
    }

    // Copy after region (if needed)
    const afterStart = Math.max(endSample, startSample + processedData.length);
    for (let i = afterStart; i < originalData.length; i++) {
      if (i < outputLength) {
        outputData[i] = originalData[i];
      }
    }
  }

  return outputBuffer;
}

/**
 * Convert AudioBuffer to WAV blob
 */
export async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

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

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const int16 = Math.max(-32768, Math.min(32767, sample * 32768));
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
