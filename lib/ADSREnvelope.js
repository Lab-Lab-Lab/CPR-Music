// lib/ADSREnvelope.js
'use client';

/**
 * Advanced ADSR Envelope Generator
 * Provides configurable Attack, Decay, Sustain, Release envelopes
 * with different curve types and velocity sensitivity
 */
export class ADSREnvelope {
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    
    // Default ADSR parameters (in seconds for A, D, R; level 0-1 for S)
    this.attack = options.attack || 0.01;
    this.decay = options.decay || 0.1;
    this.sustain = options.sustain || 0.7;
    this.release = options.release || 0.3;
    
    // Curve types: 'linear', 'exponential', 'logarithmic'
    this.attackCurve = options.attackCurve || 'exponential';
    this.decayCurve = options.decayCurve || 'exponential';
    this.releaseCurve = options.releaseCurve || 'exponential';
    
    // Velocity sensitivity (0 = no sensitivity, 1 = full sensitivity)
    this.velocitySensitivity = options.velocitySensitivity || 0.7;
    
    // Create the gain node
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 0.0001; // Start silent
    
    // State tracking
    this.isActive = false;
    this.currentPhase = 'idle'; // 'attack', 'decay', 'sustain', 'release', 'idle'
    this.startTime = 0;
    this.velocity = 1;
    this.peakLevel = 1;
  }

  /**
   * Start the envelope (note on)
   */
  start(time = 0, velocity = 1, duration = null) {
    time = time || this.audioContext.currentTime;
    this.startTime = time;
    this.velocity = velocity;
    this.isActive = true;
    this.currentPhase = 'attack';

    // Calculate peak level based on velocity
    this.peakLevel = this.velocitySensitivity * velocity + (1 - this.velocitySensitivity);

    const gain = this.gainNode.gain;

    // Cancel any previous scheduling
    gain.cancelScheduledValues(time);
    // Higher initial value to prevent clicks in offline rendering
    gain.setValueAtTime(0.01, time);

    // Attack phase
    if (this.attack > 0) {
      this.scheduleCurve(gain, 0.01, this.peakLevel, time, time + this.attack, this.attackCurve);
    } else {
      gain.setValueAtTime(this.peakLevel, time);
    }

    // Decay phase
    const decayStart = time + this.attack;
    const sustainLevel = this.sustain * this.peakLevel;

    if (this.decay > 0 && sustainLevel < this.peakLevel) {
      this.scheduleCurve(gain, this.peakLevel, sustainLevel, decayStart, decayStart + this.decay, this.decayCurve);
    } else if (sustainLevel !== this.peakLevel) {
      gain.setValueAtTime(sustainLevel, decayStart);
    }

    // If duration is specified, schedule release
    if (duration !== null && duration > 0) {
      // CRITICAL: Ensure release doesn't interrupt attack/decay phases
      const envelopePhaseEnd = time + this.attack + this.decay;
      const releaseTime = Math.max(time + duration, envelopePhaseEnd);
      this.scheduleRelease(releaseTime, true);
    }
  }

  /**
   * Stop the envelope (note off)
   */
  stop(time = 0) {
    if (!this.isActive) return;

    time = time || this.audioContext.currentTime;
    this.scheduleRelease(time, false);
  }

  /**
   * Schedule the release phase
   * @param {number} time - When to start release
   * @param {boolean} isPreScheduled - Whether this was scheduled from start() with duration
   */
  scheduleRelease(time, isPreScheduled = false) {
    if (!this.isActive) return;

    const gain = this.gainNode.gain;
    this.currentPhase = 'release';

    const envelopePhaseEnd = this.startTime + this.attack + this.decay;

    if (!isPreScheduled) {
      // Manual release (from stop/noteOff) - interrupt at current level
      const currentLevel = this.getCurrentLevel(time);
      gain.cancelScheduledValues(time);
      gain.setValueAtTime(currentLevel, time);

      // Release phase from current level
      if (this.release > 0) {
        this.scheduleCurve(gain, currentLevel, 0.01, time, time + this.release, this.releaseCurve);
      } else {
        gain.setValueAtTime(0.01, time);
      }
    } else {
      // Pre-scheduled release (from duration) - append to envelope
      const sustainLevel = this.sustain * this.peakLevel;

      // Only set sustain level if we're past the decay phase
      if (time >= envelopePhaseEnd) {
        gain.setValueAtTime(sustainLevel, time);
      }
      // Otherwise the decay will naturally reach sustain level

      // Release phase from sustain level
      if (this.release > 0) {
        this.scheduleCurve(gain, sustainLevel, 0.01, time, time + this.release, this.releaseCurve);
      } else {
        gain.setValueAtTime(0.01, time + 0.001);
      }
    }

    // Mark as inactive after release (only works in real-time contexts)
    // In OfflineAudioContext this won't fire, but that's okay
    setTimeout(() => {
      this.isActive = false;
      this.currentPhase = 'idle';
    }, this.release * 1000 + 100);
  }

  /**
   * Schedule a curve between two values
   */
  scheduleCurve(gainParam, startValue, endValue, startTime, endTime, curveType) {
    if (startTime >= endTime || startValue <= 0 || endValue <= 0) {
      gainParam.setValueAtTime(Math.max(0.0001, endValue), endTime);
      return;
    }
    
    switch (curveType) {
      case 'linear':
        gainParam.linearRampToValueAtTime(endValue, endTime);
        break;
        
      case 'exponential':
        // Ensure values are positive for exponential ramps
        const safeStart = Math.max(0.0001, startValue);
        const safeEnd = Math.max(0.0001, endValue);
        gainParam.exponentialRampToValueAtTime(safeEnd, endTime);
        break;
        
      case 'logarithmic':
        // Simulate logarithmic curve with multiple exponential segments
        this.scheduleLogarithmicCurve(gainParam, startValue, endValue, startTime, endTime);
        break;
        
      default:
        gainParam.exponentialRampToValueAtTime(Math.max(0.0001, endValue), endTime);
    }
  }

  /**
   * Create a logarithmic curve using multiple segments
   */
  scheduleLogarithmicCurve(gainParam, startValue, endValue, startTime, endTime) {
    const segments = 8;
    const duration = endTime - startTime;
    const segmentDuration = duration / segments;
    
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      // Logarithmic curve: fast at start, slow at end
      const curve = 1 - Math.pow(1 - t, 2);
      const value = startValue + (endValue - startValue) * curve;
      const time = startTime + i * segmentDuration;
      
      gainParam.linearRampToValueAtTime(Math.max(0.0001, value), time);
    }
  }

  /**
   * Get the current envelope level at a given time
   */
  getCurrentLevel(time) {
    if (!this.isActive) return 0.0001;
    
    const elapsed = time - this.startTime;
    
    if (elapsed < 0) return 0.0001;
    
    // Attack phase
    if (elapsed < this.attack) {
      const progress = elapsed / this.attack;
      return this.interpolateCurve(0.0001, this.peakLevel, progress, this.attackCurve);
    }
    
    // Decay phase
    const decayEnd = this.attack + this.decay;
    if (elapsed < decayEnd) {
      const progress = (elapsed - this.attack) / this.decay;
      const sustainLevel = this.sustain * this.peakLevel;
      return this.interpolateCurve(this.peakLevel, sustainLevel, progress, this.decayCurve);
    }
    
    // Sustain phase (if still active)
    return this.sustain * this.peakLevel;
  }

  /**
   * Interpolate between two values using different curve types
   */
  interpolateCurve(start, end, progress, curveType) {
    progress = Math.max(0, Math.min(1, progress));
    
    switch (curveType) {
      case 'linear':
        return start + (end - start) * progress;
        
      case 'exponential':
        // Exponential curve
        const curve = progress * progress;
        return start + (end - start) * curve;
        
      case 'logarithmic':
        // Logarithmic curve (inverse of exponential)
        const logCurve = 1 - Math.pow(1 - progress, 2);
        return start + (end - start) * logCurve;
        
      default:
        return start + (end - start) * progress * progress;
    }
  }

  /**
   * Update ADSR parameters
   */
  setADSR(attack, decay, sustain, release) {
    this.attack = Math.max(0, attack);
    this.decay = Math.max(0, decay);
    this.sustain = Math.max(0, Math.min(1, sustain));
    this.release = Math.max(0, release);
  }

  /**
   * Set curve types
   */
  setCurves(attackCurve, decayCurve, releaseCurve) {
    const validCurves = ['linear', 'exponential', 'logarithmic'];
    
    if (validCurves.includes(attackCurve)) this.attackCurve = attackCurve;
    if (validCurves.includes(decayCurve)) this.decayCurve = decayCurve;
    if (validCurves.includes(releaseCurve)) this.releaseCurve = releaseCurve;
  }

  /**
   * Set velocity sensitivity
   */
  setVelocitySensitivity(sensitivity) {
    this.velocitySensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    this.gainNode.connect(destination);
  }

  /**
   * Disconnect from all destinations
   */
  disconnect() {
    this.gainNode.disconnect();
  }

  /**
   * Get the gain node for connecting sources
   */
  get input() {
    return this.gainNode;
  }

  /**
   * Get the gain node for connecting destinations
   */
  get output() {
    return this.gainNode;
  }

  /**
   * Create preset envelopes
   */
  static presets = {
    piano: { attack: 0.001, decay: 0.1, sustain: 0.3, release: 0.5 },
    organ: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
    strings: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.4 },
    brass: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.2 },
    pad: { attack: 0.3, decay: 0.2, sustain: 0.6, release: 1.0 },
    pluck: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.1 },
    bell: { attack: 0.001, decay: 1.0, sustain: 0.3, release: 2.0 },
  };

  /**
   * Apply a preset
   */
  applyPreset(presetName) {
    const preset = ADSREnvelope.presets[presetName];
    if (preset) {
      this.setADSR(preset.attack, preset.decay, preset.sustain, preset.release);
    }
  }
}

export default ADSREnvelope;