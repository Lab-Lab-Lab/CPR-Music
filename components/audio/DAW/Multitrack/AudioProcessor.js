// components/audio/DAW/Multitrack/AudioProcessor.js
'use client';

import { decodeAudioFromURL } from './AudioEngine';
import { debugLog, debugWarn, debugError, debugGroup, debugGroupEnd, DebugTimer } from '../../../../lib/debug';

// Audio processing constants
const AUDIO_CONSTANTS = {
  /** Default sample rate for audio processing (CD quality) */
  DEFAULT_SAMPLE_RATE: 44100,
  /** Default samples per pixel for waveform peak generation */
  DEFAULT_SAMPLES_PER_PIXEL: 256,
  /** Worker processing timeout in milliseconds */
  WORKER_TIMEOUT_MS: 30000,
  /** Bytes per sample for Float32 audio data */
  BYTES_PER_SAMPLE: 4,
  /** Conversion factor for bytes to kilobytes */
  BYTES_TO_KB: 1024,
};

/**
 * Hybrid Audio Processor - Uses Web Workers when available, falls back to main thread
 * Provides consistent API regardless of implementation method
 */
class AudioProcessor {
  constructor() {
    this.worker = null;
    this.workerSupported = this.checkWorkerSupport();
    this.processingQueue = new Map(); // clipId -> { resolve, reject, onProgress }
    this.stats = { workerJobs: 0, mainThreadJobs: 0, errors: 0, fallbacks: 0, workerRestarts: 0 };

    // Worker recovery configuration
    this.workerRecovery = {
      maxRetries: 3,              // Maximum worker restart attempts
      currentRetries: 0,         // Current retry count
      cooldownMs: 5000,          // Initial cooldown before retry (5 seconds)
      maxCooldownMs: 60000,      // Maximum cooldown (1 minute)
      recoveryScheduled: false,  // Whether recovery is scheduled
      lastFailureTime: null,     // Last failure timestamp
      consecutiveFailures: 0,    // Consecutive failures without success
    };

    debugLog('AudioProcessor', '🎛️ Initializing hybrid audio processing system');
    debugLog('AudioProcessor', `🔍 Worker Support: ${this.workerSupported ? '✅ Available' : '❌ Not available'}`);

    if (this.workerSupported) {
      this.initializeWorker();
    } else {
      debugLog('AudioProcessor', '🔄 Will use main thread fallback for all audio processing');
    }
  }

  /**
   * Check if Web Workers are supported and available
   */
  checkWorkerSupport() {
    try {
      return typeof Worker !== 'undefined' &&
             typeof OfflineAudioContext !== 'undefined' &&
             typeof window !== 'undefined';
    } catch (e) {
      debugWarn('AudioProcessor', '🔄 Web Workers not supported, using fallback method');
      return false;
    }
  }

  /**
   * Initialize Web Worker if supported
   */
  initializeWorker() {
    try {
      // Create worker from inline script to avoid external file dependencies
      const workerCode = this.getWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      debugLog('AudioProcessor', '🚀 Web Worker initialized successfully');

      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(workerUrl), 1000);

    } catch (e) {
      debugWarn('AudioProcessor', '🔄 Failed to initialize Web Worker, using fallback:', e);
      this.workerSupported = false;
      this.worker = null;
    }
  }

  /**
   * Handle messages from Web Worker
   */
  handleWorkerMessage(event) {
    const { type, clipId, ...data } = event.data;
    const processing = this.processingQueue.get(clipId);
    
    if (!processing) return;

    switch (type) {
      case 'progress':
        processing.onProgress?.(data.stage, data.progress);
        break;
        
      case 'success':
        processing.resolve({
          duration: data.duration,
          peaks: data.peaks,
          method: 'worker'
        });
        this.processingQueue.delete(clipId);
        break;
        
      case 'error':
        processing.reject(new Error(data.error));
        this.processingQueue.delete(clipId);
        break;
    }
  }

  /**
   * Handle Web Worker errors with recovery mechanism
   */
  handleWorkerError(error) {
    debugError('AudioProcessor', '🔥 Web Worker error:', error);

    // Track failure
    this.workerRecovery.lastFailureTime = Date.now();
    this.workerRecovery.consecutiveFailures++;

    // Fallback all pending operations to main thread
    const pendingOps = Array.from(this.processingQueue.entries());
    this.processingQueue.clear();
    this.stats.fallbacks += pendingOps.length;

    debugLog('AudioProcessor', `🔄 Falling back ${pendingOps.length} pending operations to main thread`);

    for (const [clipId, { resolve, reject, onProgress, audioUrl }] of pendingOps) {
      debugLog('AudioProcessor', `🔄 Fallback processing: ${clipId}`);
      this.processOnMainThread(audioUrl, clipId, onProgress)
        .then(resolve)
        .catch(reject);
    }

    // Terminate failed worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Determine if we should attempt recovery
    const canRecover = this.workerRecovery.currentRetries < this.workerRecovery.maxRetries;

    if (canRecover && !this.workerRecovery.recoveryScheduled) {
      this.scheduleWorkerRecovery();
    } else if (!canRecover) {
      // Permanently disable worker after max retries
      this.workerSupported = false;
      debugWarn('AudioProcessor', `⚠️ Web Worker permanently disabled after ${this.workerRecovery.maxRetries} failed recovery attempts`);
    }
  }

  /**
   * Schedule worker recovery with exponential backoff
   */
  scheduleWorkerRecovery() {
    if (this.workerRecovery.recoveryScheduled) return;

    this.workerRecovery.recoveryScheduled = true;
    this.workerRecovery.currentRetries++;

    // Calculate cooldown with exponential backoff
    const backoffMultiplier = Math.pow(2, this.workerRecovery.currentRetries - 1);
    const cooldownMs = Math.min(
      this.workerRecovery.cooldownMs * backoffMultiplier,
      this.workerRecovery.maxCooldownMs
    );

    debugLog('AudioProcessor', `🔄 Scheduling worker recovery attempt ${this.workerRecovery.currentRetries}/${this.workerRecovery.maxRetries} in ${cooldownMs / 1000}s`);

    setTimeout(() => {
      this.attemptWorkerRecovery();
    }, cooldownMs);
  }

  /**
   * Attempt to recover the Web Worker
   */
  attemptWorkerRecovery() {
    this.workerRecovery.recoveryScheduled = false;

    if (!this.workerSupported) {
      debugLog('AudioProcessor', '🔄 Recovery skipped - worker support disabled');
      return;
    }

    debugLog('AudioProcessor', `🔄 Attempting worker recovery (attempt ${this.workerRecovery.currentRetries}/${this.workerRecovery.maxRetries})`);

    try {
      this.initializeWorker();

      if (this.worker) {
        this.stats.workerRestarts++;
        debugLog('AudioProcessor', '✅ Worker recovery successful!');
        // Reset consecutive failures on successful recovery
        this.workerRecovery.consecutiveFailures = 0;
      } else {
        debugWarn('AudioProcessor', '❌ Worker recovery failed - worker initialization returned null');
        // Schedule another recovery if we have retries left
        if (this.workerRecovery.currentRetries < this.workerRecovery.maxRetries) {
          this.scheduleWorkerRecovery();
        } else {
          this.workerSupported = false;
          debugWarn('AudioProcessor', '⚠️ Web Worker permanently disabled after exhausting recovery attempts');
        }
      }
    } catch (e) {
      debugError('AudioProcessor', '❌ Worker recovery threw error:', e);
      // Schedule another recovery if we have retries left
      if (this.workerRecovery.currentRetries < this.workerRecovery.maxRetries) {
        this.scheduleWorkerRecovery();
      } else {
        this.workerSupported = false;
        debugWarn('AudioProcessor', '⚠️ Web Worker permanently disabled after exhausting recovery attempts');
      }
    }
  }

  /**
   * Reset worker recovery state (call after sustained successful operations)
   */
  resetRecoveryState() {
    if (this.workerRecovery.consecutiveFailures === 0 &&
        this.workerRecovery.currentRetries > 0 &&
        this.stats.workerJobs > 5) {
      debugLog('AudioProcessor', '✅ Resetting worker recovery state after sustained success');
      this.workerRecovery.currentRetries = 0;
    }
  }

  /**
   * Main API: Process audio file with automatic worker/fallback selection
   */
  async processAudioFile(audioUrl, clipId, onProgress = () => {}) {
    const timer = new DebugTimer('AudioProcessor', `Processing ${clipId}`);
    debugLog('AudioProcessor', `🎵 Starting processing for ${clipId}`);
    debugLog('AudioProcessor', `📁 File URL: ${audioUrl.substring(0, 50)}...`);

    try {
      let result;

      if (this.workerSupported && this.worker) {
        debugLog('AudioProcessor', `🚀 Using Web Worker for ${clipId}`);
        this.stats.workerJobs++;
        result = await this.processWithWorker(audioUrl, clipId, onProgress);
        // Reset recovery state after successful worker operations
        this.resetRecoveryState();
      } else {
        debugLog('AudioProcessor', `🔄 Using main thread fallback for ${clipId}`);
        this.stats.mainThreadJobs++;
        result = await this.processOnMainThread(audioUrl, clipId, onProgress);
      }

      timer.end();
      debugLog('AudioProcessor', `📊 Duration: ${result.duration?.toFixed(2)}s, Peaks: ${result.peaks?.length || 0} samples`);
      debugLog('AudioProcessor', `📈 Stats: Worker=${this.stats.workerJobs}, MainThread=${this.stats.mainThreadJobs}, Errors=${this.stats.errors}, Fallbacks=${this.stats.fallbacks}, Restarts=${this.stats.workerRestarts}`);

      return result;

    } catch (error) {
      this.stats.errors++;
      timer.end();
      debugError('AudioProcessor', `❌ Failed ${clipId}:`, error);
      debugLog('AudioProcessor', `📈 Stats: Worker=${this.stats.workerJobs}, MainThread=${this.stats.mainThreadJobs}, Errors=${this.stats.errors}, Fallbacks=${this.stats.fallbacks}`);
      throw error;
    }
  }

  /**
   * Process using Web Worker (true non-blocking)
   */
  processWithWorker(audioUrl, clipId, onProgress) {
    return new Promise((resolve, reject) => {
      // Store processing context
      this.processingQueue.set(clipId, { 
        resolve, 
        reject, 
        onProgress, 
        audioUrl,
        method: 'worker'
      });

      // Send work to worker
      this.worker.postMessage({
        type: 'process',
        clipId,
        audioUrl
      });

      // Timeout safety net
      setTimeout(() => {
        if (this.processingQueue.has(clipId)) {
          this.processingQueue.delete(clipId);
          reject(new Error('Worker processing timeout'));
        }
      }, AUDIO_CONSTANTS.WORKER_TIMEOUT_MS);
    });
  }

  /**
   * Fallback: Process on main thread (progressive loading approach)
   */
  async processOnMainThread(audioUrl, clipId, onProgress) {
    const timer = new DebugTimer('AudioProcessor', `Main Thread - ${clipId}`);
    debugLog('AudioProcessor', `🔄 Main Thread: Starting ${clipId}`);

    try {
      onProgress('reading', 10);
      debugLog('AudioProcessor', `📖 Main Thread: Reading file for ${clipId}`);

      // Still show progress updates even though it's blocking
      await this.delay(50); // Allow UI to update
      onProgress('reading', 30);

      await this.delay(50);
      onProgress('decoding', 50);

      debugLog('AudioProcessor', `🔧 Main Thread: Starting audio decode for ${clipId} (THIS MAY BLOCK UI)`);
      timer.checkpoint('decode-start');

      // This is the blocking operation
      const audioBuffer = await decodeAudioFromURL(audioUrl);
      const duration = audioBuffer ? audioBuffer.duration : 0;
      timer.checkpoint(`decode-complete (${duration?.toFixed(2)}s)`);

      onProgress('generating-peaks', 80);
      await this.delay(50);

      debugLog('AudioProcessor', `🌊 Main Thread: Generating peaks for ${clipId}`);

      // Generate simple peaks (could be optimized further)
      const peaks = this.generateSimplePeaks(audioBuffer);
      timer.checkpoint(`peaks-generated (${peaks.length} samples)`);

      onProgress('complete', 100);
      timer.end();

      return {
        duration,
        peaks,
        method: 'main-thread'
      };

    } catch (error) {
      timer.end();
      debugError('AudioProcessor', `❌ Main Thread: Failed ${clipId}:`, error);
      onProgress('error', 100);
      throw error;
    }
  }

  /**
   * Generate simple peaks on main thread
   * Optimized to pre-allocate array and avoid repeated object creation in hot loop
   */
  generateSimplePeaks(audioBuffer, samplesPerPixel = AUDIO_CONSTANTS.DEFAULT_SAMPLES_PER_PIXEL) {
    if (!audioBuffer) return [];

    const ch = 0; // use first channel
    const data = audioBuffer.getChannelData(ch);
    const total = data.length;
    const step = Math.max(1, Math.floor(total / Math.max(1, Math.floor(total / samplesPerPixel))));

    // Pre-calculate array size and allocate upfront to avoid repeated reallocation
    const peakCount = Math.ceil(total / step);
    const peaks = new Array(peakCount);

    let peakIndex = 0;
    for (let i = 0; i < total; i += step) {
      let min = 1.0;
      let max = -1.0;
      const end = Math.min(i + step, total);

      for (let j = i; j < end; j++) {
        const v = data[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }

      peaks[peakIndex++] = [min, max];
    }

    // Trim if we over-allocated (shouldn't happen but defensive)
    if (peakIndex < peakCount) {
      peaks.length = peakIndex;
    }

    return peaks;
  }

  /**
   * Utility: Non-blocking delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Web Worker code as string (to avoid external file dependencies)
   */
  getWorkerCode() {
    return `
      // Audio processing worker constants
      const WORKER_CONSTANTS = {
        DEFAULT_SAMPLE_RATE: 44100,
        DEFAULT_SAMPLES_PER_PIXEL: 256,
        BYTES_TO_KB: 1024,
      };

      // Audio processing worker
      console.log('🚀 Worker: Audio processing worker initialized');

      self.onmessage = async function(event) {
        const { type, clipId, audioUrl } = event.data;

        if (type === 'process') {
          const startTime = performance.now();
          console.log('🚀 Worker: Starting processing for', clipId);
          console.log('📁 Worker: File URL:', audioUrl.substring(0, 50) + '...');

          try {
            // Report progress
            self.postMessage({ type: 'progress', clipId, stage: 'reading', progress: 20 });
            console.log('📖 Worker: Reading file for', clipId);

            const fetchStart = performance.now();
            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error('Failed to fetch audio');
            const fetchTime = Math.round(performance.now() - fetchStart);
            console.log('📖 Worker: File fetched in', fetchTime + 'ms for', clipId);

            self.postMessage({ type: 'progress', clipId, stage: 'reading', progress: 40 });

            const bufferStart = performance.now();
            const arrayBuffer = await response.arrayBuffer();
            const bufferTime = Math.round(performance.now() - bufferStart);
            console.log('📖 Worker: ArrayBuffer created in', bufferTime + 'ms for', clipId, '(' + Math.round(arrayBuffer.byteLength / WORKER_CONSTANTS.BYTES_TO_KB) + 'KB)');

            self.postMessage({ type: 'progress', clipId, stage: 'decoding', progress: 60 });
            console.log('🔧 Worker: Starting audio decode for', clipId);

            // Use OfflineAudioContext in worker
            const decodeStart = performance.now();
            const sampleRate = WORKER_CONSTANTS.DEFAULT_SAMPLE_RATE;
            const offlineCtx = new OfflineAudioContext(2, sampleRate, sampleRate);
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            const decodeTime = Math.round(performance.now() - decodeStart);
            console.log('🔧 Worker: Decode completed in', decodeTime + 'ms for', clipId, '(duration:', audioBuffer.duration.toFixed(2) + 's)');

            self.postMessage({ type: 'progress', clipId, stage: 'generating-peaks', progress: 85 });
            console.log('🌊 Worker: Generating peaks for', clipId);

            // Generate peaks
            const peaksStart = performance.now();
            const peaks = generatePeaks(audioBuffer, WORKER_CONSTANTS.DEFAULT_SAMPLES_PER_PIXEL);
            const peaksTime = Math.round(performance.now() - peaksStart);
            console.log('🌊 Worker: Peaks generated in', peaksTime + 'ms for', clipId, '(' + peaks.length + ' samples)');

            const totalTime = Math.round(performance.now() - startTime);
            console.log('✅ Worker: Completed', clipId, 'in', totalTime + 'ms total');

            self.postMessage({
              type: 'success',
              clipId,
              duration: audioBuffer.duration,
              peaks
            });

          } catch (error) {
            const totalTime = Math.round(performance.now() - startTime);
            console.error('❌ Worker: Failed', clipId, 'after', totalTime + 'ms:', error);
            self.postMessage({
              type: 'error',
              clipId,
              error: error.message
            });
          }
        }
      };

      function generatePeaks(audioBuffer, samplesPerPixel = WORKER_CONSTANTS.DEFAULT_SAMPLES_PER_PIXEL) {
        const ch = 0;
        const data = audioBuffer.getChannelData(ch);
        const total = data.length;
        const step = Math.max(1, Math.floor(total / Math.max(1, Math.floor(total / samplesPerPixel))));
        const peaks = [];

        for (let i = 0; i < total; i += step) {
          let min = 1.0;
          let max = -1.0;
          
          for (let j = 0; j < step && i + j < total; j++) {
            const v = data[i + j];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          
          peaks.push([min, max]);
        }
        
        return peaks;
      }
    `;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      workerSupported: this.workerSupported,
      workerActive: !!(this.workerSupported && this.worker),
      pendingJobs: this.processingQueue.size,
      recovery: {
        retriesUsed: this.workerRecovery.currentRetries,
        maxRetries: this.workerRecovery.maxRetries,
        consecutiveFailures: this.workerRecovery.consecutiveFailures,
        recoveryPending: this.workerRecovery.recoveryScheduled,
        lastFailure: this.workerRecovery.lastFailureTime,
      }
    };
  }

  /**
   * Print comprehensive stats to console
   */
  printStats() {
    const stats = this.getStats();
    debugGroup('AudioProcessor', '📊 Performance Stats');
    debugLog('AudioProcessor', `🚀 Web Worker Jobs: ${stats.workerJobs}`);
    debugLog('AudioProcessor', `🔄 Main Thread Jobs: ${stats.mainThreadJobs}`);
    debugLog('AudioProcessor', `❌ Failed Jobs: ${stats.errors}`);
    debugLog('AudioProcessor', `🔄 Fallback Operations: ${stats.fallbacks}`);
    debugLog('AudioProcessor', `🔁 Worker Restarts: ${stats.workerRestarts}`);
    debugLog('AudioProcessor', `⚡ Worker Support: ${stats.workerSupported ? '✅' : '❌'}`);
    debugLog('AudioProcessor', `🔧 Worker Active: ${stats.workerActive ? '✅' : '❌'}`);
    debugLog('AudioProcessor', `⏳ Pending Jobs: ${stats.pendingJobs}`);
    debugLog('AudioProcessor', `📈 Total Jobs: ${stats.workerJobs + stats.mainThreadJobs}`);
    debugLog('AudioProcessor', `💪 Worker Usage: ${stats.workerJobs + stats.mainThreadJobs > 0 ? Math.round((stats.workerJobs / (stats.workerJobs + stats.mainThreadJobs)) * 100) : 0}%`);
    debugLog('AudioProcessor', `🔄 Recovery: ${stats.recovery.retriesUsed}/${stats.recovery.maxRetries} retries used, ${stats.recovery.consecutiveFailures} consecutive failures`);
    debugGroupEnd();
  }

  /**
   * Cleanup resources
   */
  dispose() {
    debugLog('AudioProcessor', '🧹 Cleaning up resources...');
    this.printStats();

    if (this.worker) {
      debugLog('AudioProcessor', '🚀 Terminating Web Worker...');
      this.worker.terminate();
      this.worker = null;
    }

    if (this.processingQueue.size > 0) {
      debugWarn('AudioProcessor', `⚠️ Disposing with ${this.processingQueue.size} pending operations`);
    }

    this.processingQueue.clear();
    debugLog('AudioProcessor', '✅ Cleanup complete');
  }
}

// Create singleton instance
let audioProcessor = null;

export function getAudioProcessor() {
  if (!audioProcessor) {
    audioProcessor = new AudioProcessor();
  }
  return audioProcessor;
}

export default AudioProcessor;