import { createImpulseBuffer } from './impulseResponses';

/**
 * ReverbProcessor - Handles real-time reverb processing using Web Audio API
 */
export class ReverbProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.isConnected = false;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.convolver = audioContext.createConvolver();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    this.preDelay = audioContext.createDelay(1); // max 1 second pre-delay
    
    // Add filters for damping
    this.highShelf = audioContext.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.value = 4000;
    
    this.lowShelf = audioContext.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = 200;
    
    // Stereo width control
    this.stereoSeparator = audioContext.createChannelSplitter(2);
    this.stereoMerger = audioContext.createChannelMerger(2);
    this.widthGainL = audioContext.createGain();
    this.widthGainR = audioContext.createGain();
    
    // Default settings
    this.wetGain.gain.value = 0.3;
    this.dryGain.gain.value = 0.7;
    this.preDelay.delayTime.value = 0;
    this.output.gain.value = 1;
    this.highShelf.gain.value = 0;
    this.lowShelf.gain.value = 0;
    
    // Connect nodes
    this.connectNodes();
    
    // Load default impulse response
    this.loadPreset('mediumHall');
  }
  
  connectNodes() {
    // Dry path: input -> dryGain -> output
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    
    // Wet path: input -> preDelay -> filters -> convolver -> stereo width -> wetGain -> output
    this.input.connect(this.preDelay);
    this.preDelay.connect(this.lowShelf);
    this.lowShelf.connect(this.highShelf);
    this.highShelf.connect(this.convolver);
    
    // Stereo width processing
    this.convolver.connect(this.stereoSeparator);
    this.stereoSeparator.connect(this.widthGainL, 0);
    this.stereoSeparator.connect(this.widthGainR, 1);
    this.widthGainL.connect(this.stereoMerger, 0, 0);
    this.widthGainR.connect(this.stereoMerger, 0, 1);
    
    this.stereoMerger.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }
  
  /**
   * Load an impulse response preset
   */
  loadPreset(presetKey) {
    try {
      const impulseBuffer = createImpulseBuffer(this.context, presetKey);
      this.convolver.buffer = impulseBuffer;
      this.currentPreset = presetKey;
    } catch (error) {
      console.error('Error loading reverb preset:', error);
    }
  }
  
  /**
   * Set wet/dry mix (0-1)
   */
  setWetDryMix(wetAmount) {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.setValueAtTime(wet, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(dry, this.context.currentTime);
  }
  
  /**
   * Set pre-delay in milliseconds (0-1000)
   */
  setPreDelay(delayMs) {
    const delaySec = Math.max(0, Math.min(1000, delayMs)) / 1000;
    this.preDelay.delayTime.setValueAtTime(delaySec, this.context.currentTime);
  }
  
  /**
   * Set output gain (0-2)
   */
  setOutputGain(gain) {
    const gainValue = Math.max(0, Math.min(2, gain));
    this.output.gain.setValueAtTime(gainValue, this.context.currentTime);
  }
  
  /**
   * Set high frequency damping (-1 to 1, negative = cut, positive = boost)
   */
  setHighDamping(value) {
    const gain = Math.max(-1, Math.min(1, value)) * 12; // ±12dB range
    this.highShelf.gain.setValueAtTime(-gain, this.context.currentTime); // Negative for damping
  }
  
  /**
   * Set low frequency damping (-1 to 1, negative = cut, positive = boost)
   */
  setLowDamping(value) {
    const gain = Math.max(-1, Math.min(1, value)) * 12; // ±12dB range
    this.lowShelf.gain.setValueAtTime(-gain, this.context.currentTime); // Negative for damping
  }
  
  /**
   * Set stereo width (0 = mono, 1 = normal, 2 = extra wide)
   */
  setStereoWidth(width) {
    const w = Math.max(0, Math.min(2, width));
    
    if (w === 0) {
      // Mono: mix both channels equally
      this.widthGainL.gain.setValueAtTime(0.5, this.context.currentTime);
      this.widthGainR.gain.setValueAtTime(0.5, this.context.currentTime);
    } else {
      // Stereo with width control
      this.widthGainL.gain.setValueAtTime(1, this.context.currentTime);
      this.widthGainR.gain.setValueAtTime(w, this.context.currentTime);
    }
  }
  
  /**
   * Set early/late reflections balance (0 = all early, 1 = all late)
   * Note: This is a simplified implementation
   */
  setEarlyLateBalance(balance) {
    // This would require more complex impulse response manipulation
    // For now, we'll store it for offline processing
    this.earlyLateBalance = Math.max(0, Math.min(1, balance));
  }
  
  /**
   * Connect reverb to audio graph
   */
  connect(destination) {
    this.output.connect(destination);
    this.isConnected = true;
  }
  
  /**
   * Disconnect reverb from audio graph
   */
  disconnect() {
    this.output.disconnect();
    this.isConnected = false;
  }
  
  /**
   * Process a region of audio (for offline processing)
   * This is for when we want to "print" the reverb permanently
   */
  async processRegion(inputBuffer, startSample, endSample) {
    const regionLength = endSample - startSample;
    const sampleRate = inputBuffer.sampleRate;
    
    // Add extra samples for reverb tail
    const tailSamples = Math.floor(sampleRate * 2); // 2 seconds of tail
    const totalLength = regionLength + tailSamples;
    
    // Create offline context
    const offlineContext = new OfflineAudioContext(
      inputBuffer.numberOfChannels,
      totalLength,
      sampleRate
    );
    
    // Create source
    const source = offlineContext.createBufferSource();
    
    // Extract region from input buffer
    const regionBuffer = offlineContext.createBuffer(
      inputBuffer.numberOfChannels,
      regionLength,
      sampleRate
    );
    
    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
      const inputData = inputBuffer.getChannelData(channel);
      const regionData = regionBuffer.getChannelData(channel);
      
      for (let i = 0; i < regionLength; i++) {
        regionData[i] = inputData[startSample + i];
      }
    }
    
    source.buffer = regionBuffer;
    
    // Create reverb in offline context
    const reverb = new ReverbProcessor(offlineContext);
    reverb.loadPreset(this.currentPreset);
    reverb.setWetDryMix(this.wetGain.gain.value);
    reverb.setPreDelay(this.preDelay.delayTime.value * 1000);
    reverb.setOutputGain(this.output.gain.value);
    reverb.setHighDamping(this.highShelf.gain.value / -12); // Convert back from dB
    reverb.setLowDamping(this.lowShelf.gain.value / -12);
    reverb.setStereoWidth(this.widthGainR.gain.value);
    reverb.setEarlyLateBalance(this.earlyLateBalance || 0.5);
    
    // Connect and render
    source.connect(reverb.input);
    reverb.connect(offlineContext.destination);
    
    source.start(0);
    
    const renderedBuffer = await offlineContext.startRendering();
    
    return {
      buffer: renderedBuffer,
      tailLength: tailSamples
    };
  }
  
  /**
   * Get current parameters
   */
  getParameters() {
    return {
      preset: this.currentPreset,
      wetMix: this.wetGain.gain.value,
      preDelay: this.preDelay.delayTime.value * 1000,
      outputGain: this.output.gain.value,
      highDamping: this.highShelf.gain.value / -12,
      lowDamping: this.lowShelf.gain.value / -12,
      stereoWidth: this.widthGainR.gain.value,
      earlyLateBalance: this.earlyLateBalance || 0.5
    };
  }
}