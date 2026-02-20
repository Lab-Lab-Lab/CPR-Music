// components/audio/DAW/Multitrack/WalkingWaveform.js
'use client';

import { useEffect, useRef } from 'react';
import { getAudioContext } from './AudioEngine';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function WalkingWaveform({
  mediaStream,
  isRecording,
  trackId,
  height = 120,
  color = '#ff6b6b',
  backgroundColor = '#2a2a2a',
  startPosition = 0,
  zoomLevel = 100,
  duration = 30,
}) {
  console.log('🎤 WalkingWaveform: Render', {
    isRecording,
    hasMediaStream: !!mediaStream,
    trackId,
    startPosition,
    timestamp: Date.now()
  });

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const waveformDataRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Get transport time from context
  const { getTransportTime } = useMultitrack();

  // Cleanup function
  const cleanup = () => {
    console.log('🎤 WalkingWaveform: Cleanup called');

    // Stop animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect audio nodes
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      analyserRef.current = null;
    }

    isDrawingRef.current = false;
    waveformDataRef.current = [];
  };

  // Main effect to handle recording
  useEffect(() => {
    console.log('🎤 WalkingWaveform: Main effect running', {
      isRecording,
      hasMediaStream: !!mediaStream,
      hasCanvas: !!canvasRef.current
    });

    // Cleanup if not recording
    if (!isRecording || !mediaStream) {
      console.log('🎤 WalkingWaveform: Not recording or no stream, cleaning up');
      cleanup();
      return;
    }

    // Setup audio analysis and start drawing
    const setupAndDraw = async () => {
      console.log('🎤 WalkingWaveform: Setting up audio analysis', {
        hasCanvas: !!canvasRef.current,
        hasMediaStream: !!mediaStream,
        isRecording,
        canvasElement: canvasRef.current
      });

      // Check canvas is ready
      if (!canvasRef.current) {
        console.log('🎤 WalkingWaveform: Canvas not ready yet');
        return;
      }

      try {
        // Get or create audio context
        audioContextRef.current = getAudioContext();

        // Resume if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('🎤 WalkingWaveform: Audio context resumed');
        }

        // Create audio source from media stream
        sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);

        // Create and configure analyser
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Connect source to analyser
        sourceRef.current.connect(analyserRef.current);

        console.log('🎤 WalkingWaveform: Audio pipeline connected');

        // Initialize recording start time
        recordingStartTimeRef.current = audioContextRef.current.currentTime;
        waveformDataRef.current = [];

        // Get canvas context
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Calculate pixels per second
        const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
        const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * (zoomLevel / 100);

        // Set initial canvas size
        const initialWidth = Math.floor(pixelsPerSecond * 120); // 2 minutes
        canvas.width = initialWidth;
        canvas.style.width = initialWidth + 'px';

        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        console.log('🎤 WalkingWaveform: Canvas initialized', {
          width: canvas.width,
          height: canvas.height,
          pixelsPerSecond
        });

        // Start drawing loop
        if (!isDrawingRef.current) {
          isDrawingRef.current = true;
          console.log('🎤 WalkingWaveform: Starting draw loop');

          let frameCount = 0;

          const draw = () => {
            // Check if we should continue drawing
            if (!isDrawingRef.current || !analyserRef.current || !canvasRef.current) {
              console.log('🎤 WalkingWaveform: Draw loop stopping');
              return;
            }

            frameCount++;

            // Get current time
            let currentT = startPosition;
            if (getTransportTime && typeof getTransportTime === 'function') {
              currentT = getTransportTime();
            } else if (audioContextRef.current && recordingStartTimeRef.current !== null) {
              const elapsed = audioContextRef.current.currentTime - recordingStartTimeRef.current;
              currentT = startPosition + elapsed;
            }

            // Calculate X position
            const currentX = currentT * pixelsPerSecond;

            // Log progress every 30 frames (0.5 second)
            if (frameCount % 30 === 0) {
              console.log('🎤 WalkingWaveform: Drawing', {
                frame: frameCount,
                time: currentT.toFixed(2),
                x: currentX.toFixed(0),
                dataPoints: waveformDataRef.current.length
              });
            }

            // Resize canvas if needed
            if (currentX > canvas.width - (10 * pixelsPerSecond)) {
              const newWidth = canvas.width + Math.floor(60 * pixelsPerSecond);

              // Save current content
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

              // Resize
              canvas.width = newWidth;
              canvas.style.width = newWidth + 'px';

              // Restore content
              ctx.putImageData(imageData, 0, 0);

              console.log('🎤 WalkingWaveform: Canvas resized to', newWidth);
            }

            // Get audio data
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteTimeDomainData(dataArray);

            // Calculate amplitude (RMS)
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              const normalized = (dataArray[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / bufferLength);
            const amplitude = Math.min(rms * 3, 1);

            // Store data point
            waveformDataRef.current.push({
              time: currentT,
              amplitude: amplitude,
              x: currentX
            });

            // Draw waveform
            if (waveformDataRef.current.length > 1) {
              const dataLength = waveformDataRef.current.length;
              const prevData = waveformDataRef.current[dataLength - 2];
              const currData = waveformDataRef.current[dataLength - 1];

              // Set drawing style
              ctx.fillStyle = color;
              ctx.globalAlpha = 0.8;

              // Draw vertical bar for current sample
              const barHeight = currData.amplitude * canvas.height * 0.8;
              const barY = (canvas.height - barHeight) / 2;

              ctx.fillRect(
                currData.x - 1,
                barY,
                2,
                barHeight
              );

              // Connect to previous sample if close enough
              const gap = currData.x - prevData.x;
              if (gap > 0 && gap < 10) {
                // Draw connecting shape
                ctx.beginPath();

                const prevHeight = prevData.amplitude * canvas.height * 0.8;
                const prevY = (canvas.height - prevHeight) / 2;

                ctx.moveTo(prevData.x, prevY);
                ctx.lineTo(currData.x, barY);
                ctx.lineTo(currData.x, barY + barHeight);
                ctx.lineTo(prevData.x, prevY + prevHeight);
                ctx.closePath();

                ctx.fill();
              }

              ctx.globalAlpha = 1.0;
            }

            // Continue animation
            animationFrameRef.current = requestAnimationFrame(draw);
          };

          // Start the animation loop
          draw();
        }

      } catch (error) {
        console.error('🎤 WalkingWaveform: Setup error:', error);
        cleanup();
      }
    };

    // Small delay to ensure canvas is in DOM
    const setupTimer = setTimeout(() => {
      console.log('🎤 WalkingWaveform: Timeout fired, calling setupAndDraw');
      setupAndDraw();
    }, 50);

    // Cleanup function for this effect
    return () => {
      clearTimeout(setupTimer);
      cleanup();
    };
  }, [isRecording, mediaStream]); // Only re-run when recording state or stream changes

  // Log mount/unmount
  useEffect(() => {
    console.log('🎤 WalkingWaveform: MOUNTED');
    return () => {
      console.log('🎤 WalkingWaveform: UNMOUNTING');
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      style={{
        display: 'block',
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        backgroundColor: 'transparent',
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  );
}