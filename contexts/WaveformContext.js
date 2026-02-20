'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from '../lib/audio/AudioEngine';
import { PeakGenerator } from '../lib/audio/PeakGenerator';
import { useAudio, useEffects } from './DAWProvider';

const WaveformContext = createContext();

export const useWaveform = () => {
  const context = useContext(WaveformContext);
  if (!context) {
    throw new Error('useWaveform must be used within WaveformProvider');
  }
  return context;
};

export const WaveformProvider = ({ children, logOperation = null }) => {
  // Get global audio state
  const { audioURL, addToEditHistory, wavesurferRef, activityLogger } = useAudio();
  const { setCutRegion } = useEffects();

  // Audio engine instances
  const audioEngineRef = useRef(null);
  const peakGeneratorRef = useRef(null);

  // Audio state
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [duration, setDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(44100);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // View state
  const [zoomLevel, setZoomLevel] = useState(100); // pixels per second (will be recalculated to fit)
  const [scrollPosition, setScrollPosition] = useState(0); // scroll position in seconds
  const [containerWidth, setContainerWidth] = useState(0);
  const [initialZoomSet, setInitialZoomSet] = useState(false);

  // Peaks data
  const [peaks, setPeaks] = useState(null);
  const [peaksCache, setPeaksCache] = useState({});

  // Region state
  const [regions, setRegions] = useState([]);
  const [activeRegion, setActiveRegion] = useState(null);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);

  // Initialize engines
  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    peakGeneratorRef.current = new PeakGenerator();

    // Set up callbacks
    audioEngineRef.current.onTimeUpdate = (time) => {
      setCurrentTime(time);
    };

    audioEngineRef.current.onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(duration);
    };

    audioEngineRef.current.onError = (error) => {
      console.error('Audio engine error:', error);
    };

    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.destroy();
      }
      if (peakGeneratorRef.current) {
        peakGeneratorRef.current.destroy();
      }
    };
  }, []);

  // Load audio when URL changes
  useEffect(() => {
    if (!audioURL || !audioEngineRef.current) return;

    const loadAudio = async () => {
      try {
        console.log('Loading audio into WaveformContext:', audioURL);

        // Load and decode audio
        const audioInfo = await audioEngineRef.current.loadAudio(audioURL);
        const buffer = audioEngineRef.current.getAudioBuffer();

        setAudioBuffer(buffer);
        setDuration(audioInfo.duration);
        setSampleRate(audioInfo.sampleRate);

        // Generate peaks with proper zoom level
        if (containerWidth > 0 && peakGeneratorRef.current) {
          // IMPORTANT: Clear the peak cache to ensure we generate new peaks from new audio
          peakGeneratorRef.current.clearCache();
          console.log('Cleared peak cache before generating new peaks');

          // Calculate the visible width based on zoom level
          const visibleWidth = Math.max(containerWidth, audioInfo.duration * zoomLevel);
          const samplesPerPixel = buffer.length / visibleWidth;

          const peakData = peakGeneratorRef.current.generatePeaks(
            buffer,
            samplesPerPixel,
            Math.ceil(visibleWidth)
          );

          // Show actual levels with minimal normalization
          // This way effects like reverb/compression will be visible
          if (peakData && peakData.merged) {
            // Calculate the actual max peak for debugging
            let actualMaxPeak = 0;
            for (let i = 0; i < peakData.merged.max.length; i++) {
              actualMaxPeak = Math.max(actualMaxPeak, Math.abs(peakData.merged.max[i]), Math.abs(peakData.merged.min[i]));
            }
            console.log('Actual max peak level:', actualMaxPeak.toFixed(4), '(1.0 = full scale)');

            // Apply different normalization strategies based on peak levels
            if (actualMaxPeak > 1.0) {
              // Peaks exceed 1.0, normalize to prevent clipping
              console.log('Peaks exceed 1.0, normalizing to prevent clipping');
              const normalized = peakGeneratorRef.current.normalizePeaks(peakData.merged, 0.95);
              if (normalized) {
                peakData.merged = normalized;
              }
            } else if (actualMaxPeak < 0.15) {
              // Very quiet audio - apply gentle boost for visibility
              console.log('Very quiet audio (< 0.15), applying 2x boost for visibility');
              const scaleFactor = Math.min(2.0, 0.3 / actualMaxPeak); // Boost to at least 0.3 height
              for (let i = 0; i < peakData.merged.max.length; i++) {
                peakData.merged.max[i] *= scaleFactor;
                peakData.merged.min[i] *= scaleFactor;
              }
            }
            // Otherwise keep original levels (0.15 - 1.0 range)
          }

          setPeaks(peakData);
          console.log('Peaks updated after loading audio');
        }

        // Reset playback state
        setCurrentTime(0);
        setIsPlaying(false);

        // Don't reset zoom when loading the same audio with effects applied
        // Only reset zoom for completely new audio files
        // setInitialZoomSet(false); // Commented out to preserve zoom on effect application

        console.log('Audio loaded successfully:', audioInfo);
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    loadAudio();
  }, [audioURL, containerWidth]);

  // Set initial zoom level to fit waveform to container
  // Also recalculate when duration changes (after deletions/cuts)
  useEffect(() => {
    if (duration > 0 && containerWidth > 0) {
      const fitZoom = containerWidth / duration;

      // Always recalculate zoom to fit when duration changes
      // This ensures the waveform fills the canvas after deletions/cuts
      if (!initialZoomSet) {
        setZoomLevel(fitZoom);
        setInitialZoomSet(true);
        console.log(`Setting initial zoom to fit: ${fitZoom} pixels/second for ${duration}s duration in ${containerWidth}px container`);
      } else {
        // Duration changed (likely from deletion) - recalculate zoom to fit
        const currentFitZoom = containerWidth / duration;
        setZoomLevel(currentFitZoom);
        setScrollPosition(0); // Reset scroll to start
        console.log(`Recalculating zoom after duration change: ${currentFitZoom} pixels/second for ${duration}s duration`);
      }
    }
  }, [duration, containerWidth, initialZoomSet]);

  // Update peaks when container width or zoom changes
  useEffect(() => {
    if (!audioBuffer || !peakGeneratorRef.current || containerWidth === 0) return;

    // Clear cache when zoom changes to ensure fresh peak generation
    peakGeneratorRef.current.clearCache();

    // Calculate the visible width based on zoom level
    const visibleWidth = Math.max(containerWidth, duration * zoomLevel);
    const samplesPerPixel = audioBuffer.length / visibleWidth;

    const peakData = peakGeneratorRef.current.generatePeaks(
      audioBuffer,
      samplesPerPixel,
      Math.ceil(visibleWidth)
    );

    // Show actual levels with minimal normalization
    // This way effects like reverb/compression will be visible
    if (peakData && peakData.merged) {
      // Calculate the actual max peak for debugging
      let actualMaxPeak = 0;
      for (let i = 0; i < peakData.merged.max.length; i++) {
        actualMaxPeak = Math.max(actualMaxPeak, Math.abs(peakData.merged.max[i]), Math.abs(peakData.merged.min[i]));
      }
      console.log('Actual max peak level (zoom/resize):', actualMaxPeak.toFixed(4), '(1.0 = full scale)');

      // Apply different normalization strategies based on peak levels
      if (actualMaxPeak > 1.0) {
        // Peaks exceed 1.0, normalize to prevent clipping
        console.log('Peaks exceed 1.0, normalizing to prevent clipping');
        const normalized = peakGeneratorRef.current.normalizePeaks(peakData.merged, 0.95);
        if (normalized) {
          peakData.merged = normalized;
        }
      } else if (actualMaxPeak < 0.15) {
        // Very quiet audio - apply gentle boost for visibility
        console.log('Very quiet audio (< 0.15), applying 2x boost for visibility');
        const scaleFactor = Math.min(2.0, 0.3 / actualMaxPeak); // Boost to at least 0.3 height
        for (let i = 0; i < peakData.merged.max.length; i++) {
          peakData.merged.max[i] *= scaleFactor;
          peakData.merged.min[i] *= scaleFactor;
        }
      }
      // Otherwise keep original levels (0.15 - 1.0 range)
    }

    setPeaks(peakData);
  }, [audioBuffer, containerWidth, zoomLevel, duration]);

  // Playback control methods
  const play = useCallback(() => {
    if (!audioEngineRef.current || !audioBuffer) return;

    audioEngineRef.current.play(currentTime);
    setIsPlaying(true);

    // Log playback action
    try {
      if (activityLogger?.isActive) {
        activityLogger.logPlaybackAction('play');
      }
    } catch (error) {
      console.error('📊 Error logging play action:', error);
    }
  }, [audioBuffer, currentTime, activityLogger]);

  const pause = useCallback(() => {
    if (!audioEngineRef.current) return;

    audioEngineRef.current.pause();
    setIsPlaying(false);

    // Log playback action
    try {
      if (activityLogger?.isActive) {
        activityLogger.logPlaybackAction('pause');
      }
    } catch (error) {
      console.error('📊 Error logging pause action:', error);
    }
  }, [activityLogger]);

  const stop = useCallback(() => {
    if (!audioEngineRef.current) return;

    audioEngineRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);

    // Log playback action
    try {
      if (activityLogger?.isActive) {
        activityLogger.logPlaybackAction('stop');
      }
    } catch (error) {
      console.error('📊 Error logging stop action:', error);
    }
  }, [activityLogger]);

  const seek = useCallback((time) => {
    if (!audioEngineRef.current) return;

    const clampedTime = Math.max(0, Math.min(time, duration));
    audioEngineRef.current.seek(clampedTime);
    setCurrentTime(clampedTime);
  }, [duration]);

  const setPlaybackSpeed = useCallback((rate) => {
    if (!audioEngineRef.current) return;

    audioEngineRef.current.setPlaybackRate(rate);
    setPlaybackRate(rate);
  }, []);

  // Zoom control
  const setZoom = useCallback((level) => {
    const clampedZoom = Math.max(10, Math.min(3000, level));
    setZoomLevel(clampedZoom);

    // Adjust scroll position to keep current time in view if playing
    if (isPlaying && containerWidth > 0) {
      const visibleDuration = containerWidth / clampedZoom;
      if (currentTime < scrollPosition || currentTime > scrollPosition + visibleDuration) {
        setScrollPosition(Math.max(0, currentTime - visibleDuration / 2));
      }
    }
  }, [isPlaying, currentTime, containerWidth]);

  const zoomIn = useCallback(() => {
    // Zoom in by 1.5x, max 50x the fit-to-view level
    const fitZoom = containerWidth / duration;
    const maxZoom = Math.max(3000, fitZoom * 50);
    const newZoom = Math.min(maxZoom, zoomLevel * 1.5);
    setZoom(newZoom);

    // Log zoom operation
    try {
      if (activityLogger?.isActive) {
        activityLogger.logZoomOperation(newZoom, 'in');
      }
    } catch (error) {
      console.error('📊 Error logging zoom in:', error);
    }
  }, [zoomLevel, setZoom, containerWidth, duration, activityLogger]);

  const zoomOut = useCallback(() => {
    // Zoom out by 1.5x, min is fit-to-view
    const fitZoom = containerWidth / duration;
    const newZoom = Math.max(fitZoom, zoomLevel / 1.5);
    setZoom(newZoom);

    // Log zoom operation
    try {
      if (activityLogger?.isActive) {
        activityLogger.logZoomOperation(newZoom, 'out');
      }
    } catch (error) {
      console.error('📊 Error logging zoom out:', error);
    }
  }, [zoomLevel, setZoom, containerWidth, duration, activityLogger]);

  const resetZoom = useCallback(() => {
    // Calculate zoom to fit entire waveform in view
    if (duration > 0 && containerWidth > 0) {
      const fitZoom = containerWidth / duration;
      setZoom(fitZoom);
      setScrollPosition(0);

      // Log zoom operation
      try {
        if (activityLogger?.isActive) {
          activityLogger.logZoomOperation(fitZoom, 'reset');
        }
      } catch (error) {
        console.error('📊 Error logging zoom reset:', error);
      }
    }
  }, [duration, containerWidth, setZoom, activityLogger]);

  // Region management
  const createRegion = useCallback((start, end) => {
    const region = {
      id: `region_${Date.now()}`,
      start: Math.min(start, end),
      end: Math.max(start, end),
      color: 'rgba(155, 115, 215, 0.4)'
    };

    setRegions([region]); // Only one region at a time for now
    setActiveRegion(region);

    // Update effects context with the region
    if (setCutRegion) {
      setCutRegion(region);
    }

    // Log region creation (general analytics)
    try {
      if (activityLogger?.isActive) {
        activityLogger.logRegionCreated(region.start, region.end);
      }
    } catch (error) {
      console.error('📊 Error logging region creation:', error);
    }

    // Log for study protocol tracking
    if (logOperation) {
      console.log('🎯 Logging region_created operation:', { start: region.start, end: region.end });
      logOperation('region_created', { start: region.start, end: region.end });
    } else {
      console.warn('⚠️ logOperation is not available for region_created');
    }

    return region;
  }, [setCutRegion, activityLogger, logOperation]);

  const updateRegion = useCallback((id, updates) => {
    setRegions(regions =>
      regions.map(r => r.id === id ? { ...r, ...updates } : r)
    );

    // Update active region if it's the one being updated
    if (activeRegion?.id === id) {
      const updatedRegion = { ...activeRegion, ...updates };
      setActiveRegion(updatedRegion);

      if (setCutRegion) {
        setCutRegion(updatedRegion);
      }
    }
  }, [activeRegion, setCutRegion]);

  const deleteRegion = useCallback((id) => {
    setRegions(regions => regions.filter(r => r.id !== id));

    if (activeRegion?.id === id) {
      setActiveRegion(null);
      if (setCutRegion) {
        setCutRegion(null);
      }
    }
  }, [activeRegion, setCutRegion]);

  const clearRegions = useCallback(() => {
    const hadRegion = regions.length > 0;

    setRegions([]);
    setActiveRegion(null);
    if (setCutRegion) {
      setCutRegion(null);
    }

    // Log for study protocol tracking (region deselected)
    if (hadRegion && logOperation) {
      console.log('🎯 Logging region_deselected operation');
      logOperation('region_deselected', {});
    } else if (hadRegion) {
      console.warn('⚠️ logOperation is not available for region_deselected');
    }
  }, [setCutRegion, logOperation, regions]);

  // Export audio buffer for effects processing
  const getAudioForProcessing = useCallback(() => {
    return audioBuffer;
  }, [audioBuffer]);

  // Apply processed audio back
  const applyProcessedAudio = useCallback(async (processedBuffer) => {
    if (!audioEngineRef.current || !peakGeneratorRef.current) return;

    console.log('applyProcessedAudio called with buffer:', processedBuffer);
    console.log('Buffer sample rate:', processedBuffer.sampleRate, 'channels:', processedBuffer.numberOfChannels);

    // Check the buffer immediately
    const beforeData = processedBuffer.getChannelData(0);
    console.log('First 10 samples on arrival:', Array.from(beforeData.slice(0, 10)));

    let beforeSum = 0;
    for (let i = 0; i < Math.min(10000, beforeData.length); i++) {
      beforeSum += beforeData[i] * beforeData[i];
    }
    console.log('Buffer RMS on arrival in applyProcessedAudio:', Math.sqrt(beforeSum / Math.min(10000, beforeData.length)));

    // Create WAV blob from processed buffer
    const wav = await audioBufferToWav(processedBuffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    // Clear regions before updating audio
    clearRegions();

    // Update the audioURL through the proper channels
    // This will trigger the audio loading cycle in the useEffect
    // which will properly load the audio, generate peaks, etc.
    if (addToEditHistory) {
      console.log('Updating audioURL through addToEditHistory to trigger reload');
      // Pass effect name from metadata if available
      const effectName = processedBuffer.effectName || 'Effect Applied';
      const effectParameters = processedBuffer.effectParameters || {};

      addToEditHistory(url, effectName, {
        type: 'effect',
        timestamp: Date.now()
      });

      // Log effect application
      try {
        if (activityLogger?.isActive) {
          activityLogger.logEffectApplied(effectName, effectParameters);
        }
      } catch (error) {
        console.error('📊 Error logging effect application:', error);
      }
    } else {
      console.error('addToEditHistory not available, cannot update audio');
    }

    console.log('Effect applied, audio reload triggered');
  }, [clearRegions, addToEditHistory, activityLogger]);

  // Auto-scroll during playback to keep cursor in view
  useEffect(() => {
    if (!isPlaying || containerWidth === 0) return;

    const visibleDuration = containerWidth / zoomLevel;
    const visibleEnd = scrollPosition + visibleDuration;

    // Check if current time is outside visible area
    if (currentTime < scrollPosition || currentTime > visibleEnd) {
      // Scroll to keep cursor visible (centered if possible)
      const newScrollPosition = Math.max(0, Math.min(
        duration - visibleDuration,
        currentTime - visibleDuration / 2
      ));
      setScrollPosition(newScrollPosition);
    }
  }, [currentTime, isPlaying, containerWidth, zoomLevel, scrollPosition, duration]);

  // Store ref for backward compatibility
  useEffect(() => {
    if (wavesurferRef) {
      wavesurferRef.current = {
        // Provide compatibility methods
        play: () => play(),
        pause: () => pause(),
        stop: () => stop(),
        seekTo: (progress) => seek(progress * duration),
        getCurrentTime: () => currentTime,
        getDuration: () => duration,
        isPlaying: () => isPlaying,
        setPlaybackRate: (rate) => setPlaybackSpeed(rate),
        zoom: (level) => setZoom(level * 100),
        load: async (url) => {
          // This will be handled by audioURL change
        },
        once: (event, callback) => {
          // Simple implementation for 'ready' event
          if (event === 'ready' && audioBuffer) {
            setTimeout(callback, 0);
          }
        }
      };
    }
  }, [wavesurferRef, play, pause, stop, seek, currentTime, duration, isPlaying, setPlaybackSpeed, setZoom, audioBuffer]);

  const value = {
    // Audio state
    audioBuffer,
    duration,
    sampleRate,

    // Playback state
    isPlaying,
    currentTime,
    playbackRate,

    // View state
    zoomLevel,
    scrollPosition,
    containerWidth,
    setContainerWidth,
    setScrollPosition,

    // Peaks data
    peaks,
    peaksCache,

    // Region state
    regions,
    activeRegion,
    isDraggingRegion,
    setIsDraggingRegion,

    // Methods
    play,
    pause,
    stop,
    seek,
    setPlaybackSpeed,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    createRegion,
    updateRegion,
    deleteRegion,
    clearRegions,
    getAudioForProcessing,
    applyProcessedAudio,

    // Engine refs for direct access if needed
    audioEngine: audioEngineRef.current,
    peakGenerator: peakGeneratorRef.current,

    // Expose AudioContext for buffer operations
    audioContext: audioEngineRef.current?.audioContext,

    // Study protocol tracking
    logOperation
  };

  return (
    <WaveformContext.Provider value={value}>
      {children}
    </WaveformContext.Provider>
  );
};

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(audioBuffer) {
  const { audioBufferToWav } = await import('../lib/audioUtils');
  return audioBufferToWav(audioBuffer);
}