'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMultitrack, useRecording } from '../../../../contexts/DAWProvider';
import styles from './MultitrackWaveform.module.css';

/**
 * Custom waveform visualization using Canvas with live recording support
 */
export function CanvasWaveform({ track, height = 80, pixelsPerSecond = 50 }) {
  const canvasRef = useRef(null);
  const [waveformData, setWaveformData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTime, duration } = useMultitrack();
  const { isRecording } = useRecording();
  
  // For live recording visualization
  const liveDataRef = useRef([]);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  
  // Track previous armed state to detect when recording completes
  const prevArmedRef = useRef(track.armed);
  const prevAudioURLRef = useRef(track.audioURL);
  
  // Load and analyze audio for existing tracks (including newly recorded ones)
  useEffect(() => {
    // Skip if track is currently armed for recording
    if (track.armed) {
      prevArmedRef.current = true;
      return;
    }
    
    // Detect when track was just disarmed (recording complete) or audio URL changed
    const wasJustDisarmed = prevArmedRef.current === true && track.armed === false;
    const audioURLChanged = track.audioURL !== prevAudioURLRef.current;
    
    // Load waveform if we have audio and either:
    // 1. Track was just disarmed (recording complete)
    // 2. Audio URL changed
    // 3. Initial load with audio URL
    if (track.audioURL && (wasJustDisarmed || audioURLChanged || !waveformData)) {
      console.log('Loading waveform for track:', track.name, {
        wasJustDisarmed,
        audioURLChanged,
        audioURL: track.audioURL
      });
      
      setIsLoading(true);
      
      const loadAudio = async () => {
        try {
          const response = await fetch(track.audioURL);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          console.log('Audio buffer decoded:', {
            duration: audioBuffer.duration,
            numberOfChannels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate
          });
          
          // Downsample for visualization
          const samples = Math.floor(audioBuffer.duration * pixelsPerSecond);
          const blockSize = Math.floor(audioBuffer.length / samples);
          const filteredData = [];
          
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const channelFiltered = [];
            
            for (let i = 0; i < samples; i++) {
              const blockStart = blockSize * i;
              let max = 0;
              
              for (let j = 0; j < blockSize; j++) {
                const amplitude = Math.abs(channelData[blockStart + j] || 0);
                if (amplitude > max) max = amplitude;
              }
              
              channelFiltered.push(max);
            }
            
            filteredData.push(channelFiltered);
          }
          
          setWaveformData({
            data: filteredData,
            duration: audioBuffer.duration,
            samples
          });
          
          // Clear live recording data when switching to recorded waveform
          liveDataRef.current = [];
          
        } catch (error) {
          console.error('Error loading audio:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadAudio();
    }
    
    // Update refs for next render
    prevArmedRef.current = track.armed;
    prevAudioURLRef.current = track.audioURL;
    
  }, [track.audioURL, track.armed, track.name, pixelsPerSecond]);
  
  // Setup live recording visualization for armed tracks
  useEffect(() => {
    console.log(`Track ${track.name} - armed: ${track.armed}, isRecording: ${isRecording}`);
    
    if (!track.armed || !isRecording) {
      // Clean up when not recording
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      return;
    }
    
    console.log('Setting up live recording visualization for track:', track.name);
    
    // Setup audio analysis
    const setupLiveRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create analyser node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        // Connect microphone to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        analyserRef.current = analyser;
        sourceRef.current = source;
        
        // Clear previous live data
        liveDataRef.current = [];
        
        // Start visualization
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let frameCount = 0;
        
        const visualize = () => {
          if (!track.armed || !isRecording) {
            console.log('Stopping live visualization');
            return;
          }
          
          analyser.getByteTimeDomainData(dataArray);
          
          // Calculate peak amplitude
          let max = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = Math.abs((dataArray[i] - 128) / 128);
            if (normalized > max) max = normalized;
          }
          
          // Add sample every few frames (to match pixelsPerSecond)
          frameCount++;
          if (frameCount % 2 === 0) { // Adjust this to control sampling rate
            liveDataRef.current.push(max);
            
            // Trigger canvas redraw
            drawWaveform();
          }
          
          animationRef.current = requestAnimationFrame(visualize);
        };
        
        visualize();
        
      } catch (error) {
        console.error('Error setting up live recording:', error);
      }
    };
    
    setupLiveRecording();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [track.armed, track.name, isRecording]);
  
  // Draw waveform function
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = Math.max((duration || 10) * pixelsPerSecond, 1000);
    const actualHeight = height;
    
    // Set canvas size
    canvas.width = width;
    canvas.height = actualHeight;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, actualHeight);
    
    // Draw existing waveform data if available and not currently armed
    if (waveformData && !track.armed) {
      const channelHeight = actualHeight / waveformData.data.length;
      
      waveformData.data.forEach((channelData, channelIndex) => {
        const centerY = channelHeight * channelIndex + channelHeight / 2;
        
        // Use track color with transparency for muted tracks
        ctx.fillStyle = track.mute ? `${track.color}44` : track.color;
        
        for (let i = 0; i < channelData.length; i++) {
          const x = (i / channelData.length) * (waveformData.duration * pixelsPerSecond);
          const amplitude = channelData[i];
          const barHeight = amplitude * (channelHeight * 0.8);
          
          ctx.fillRect(x, centerY - barHeight / 2, 1, barHeight);
        }
      });
    }
    
    // Draw live recording data if armed and recording
    if (track.armed && isRecording) {
      console.log(`Drawing live waveform for ${track.name}, samples: ${liveDataRef.current.length}`);
      const centerY = actualHeight / 2;
      
      // Draw live waveform data if available
      if (liveDataRef.current.length > 0) {
        // Draw with a red color for recording
        ctx.fillStyle = '#ff4444';
        
        liveDataRef.current.forEach((amplitude, i) => {
          const x = i * 2; // Adjust spacing based on sampling rate
          const barHeight = amplitude * (actualHeight * 0.8);
          
          ctx.fillRect(x, centerY - barHeight / 2, 2, barHeight);
        });
      }
      
      // Always draw recording indicator when armed and recording
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(width - 20, 20, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Add "REC" text
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText('REC', width - 60, 24);
    }
    
    // Draw progress overlay for playback
    if (duration > 0 && currentTime > 0 && !track.armed) {
      const progressX = currentTime * pixelsPerSecond;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, progressX, actualHeight);
    }
  }, [waveformData, track.armed, track.mute, track.color, height, pixelsPerSecond, currentTime, duration, isRecording]);
  
  // Regular redraw for existing waveforms and updates
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loading} style={{ height: `${height}px` }}>
        Loading waveform...
      </div>
    );
  }
  
  // Empty track state
  if (!track.audioURL && !track.armed) {
    return (
      <div className={styles.empty} style={{ height: `${height}px` }}>
        <span>Empty track - record or import audio</span>
      </div>
    );
  }
  
  // Render canvas
  return (
    <div className={styles.waveformContainer} style={{ height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        className={styles.waveformCanvas}
        style={{ height: `${height}px` }}
      />
    </div>
  );
}