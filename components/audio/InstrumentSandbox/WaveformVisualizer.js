'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ButtonGroup, Button } from 'react-bootstrap';

const WaveformVisualizer = ({ analyserNode, isPlaying, activeNotes }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [visualMode, setVisualMode] = useState('oscilloscope'); // 'oscilloscope', 'spectrum', 'both'
  const [zoom, setZoom] = useState(1);

  // Color schemes for different visual modes
  const colors = {
    oscilloscope: {
      background: '#0a0a0a',
      grid: '#1a1a1a',
      wave: '#00ff00',
      waveGlow: '#00ff0080',
      trigger: '#ff0000'
    },
    spectrum: {
      background: '#0a0a0a',
      grid: '#1a1a1a',
      bars: ['#00ff00', '#ffff00', '#ff0000'], // Green -> Yellow -> Red for frequency intensity
      peak: '#ffffff'
    }
  };

  // Draw grid background
  const drawGrid = (ctx, width, height, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x < width; x += width / 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += height / 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center lines
    ctx.strokeStyle = color + '80'; // Semi-transparent
    ctx.lineWidth = 1;

    // Horizontal center
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Vertical center
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
  };

  // Draw oscilloscope visualization
  const drawOscilloscope = (ctx, dataArray, width, height) => {
    const bufferLength = dataArray.length;
    const sliceWidth = width / bufferLength * zoom;

    // Clear and setup
    ctx.fillStyle = colors.oscilloscope.background;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height, colors.oscilloscope.grid);

    // Draw waveform with glow effect
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.oscilloscope.wave;

    // Add glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = colors.oscilloscope.waveGlow;

    ctx.beginPath();

    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
      if (x > width) break;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw trigger point indicator
    if (activeNotes.length > 0) {
      ctx.fillStyle = colors.oscilloscope.trigger;
      ctx.fillRect(0, height / 2 - 1, 5, 2);
    }

    // Draw info text
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText(`Zoom: ${zoom.toFixed(1)}x`, 5, 15);
    if (activeNotes.length > 0) {
      ctx.fillText(`Active: ${activeNotes.length} notes`, 5, 28);
    }
  };

  // Draw frequency spectrum visualization
  const drawSpectrum = (ctx, dataArray, width, height) => {
    const bufferLength = dataArray.length;
    const barWidth = (width / bufferLength) * 4; // Wider bars for visibility

    // Clear and setup
    ctx.fillStyle = colors.spectrum.background;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height, colors.spectrum.grid);

    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height * 0.9;

      // Color based on frequency and intensity
      const intensity = dataArray[i] / 255;
      let color;

      if (intensity > 0.8) {
        color = colors.spectrum.bars[2]; // Red for high intensity
      } else if (intensity > 0.5) {
        color = colors.spectrum.bars[1]; // Yellow for medium
      } else {
        color = colors.spectrum.bars[0]; // Green for low
      }

      // Add gradient effect
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, color + '40');
      gradient.addColorStop(0.5, color + '80');
      gradient.addColorStop(1, color);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      // Draw peak indicator
      if (intensity > 0.9) {
        ctx.fillStyle = colors.spectrum.peak;
        ctx.fillRect(x, height - barHeight - 2, barWidth, 2);
      }

      x += barWidth + 1;
      if (x > width) break;
    }

    // Draw frequency labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText('20Hz', 5, height - 5);
    ctx.fillText('1kHz', width / 4, height - 5);
    ctx.fillText('5kHz', width / 2, height - 5);
    ctx.fillText('10kHz', 3 * width / 4, height - 5);
    ctx.fillText('20kHz', width - 35, height - 5);
  };

  // Draw both visualizations split screen
  const drawBoth = (ctx, timeData, freqData, width, height) => {
    const halfHeight = height / 2;

    // Top half: Oscilloscope
    ctx.save();
    ctx.translate(0, 0);
    ctx.beginPath();
    ctx.rect(0, 0, width, halfHeight);
    ctx.clip();
    drawOscilloscope(ctx, timeData, width, halfHeight);
    ctx.restore();

    // Divider line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, halfHeight);
    ctx.lineTo(width, halfHeight);
    ctx.stroke();

    // Bottom half: Spectrum
    ctx.save();
    ctx.translate(0, halfHeight);
    ctx.beginPath();
    ctx.rect(0, 0, width, halfHeight);
    ctx.clip();
    drawSpectrum(ctx, freqData, width, halfHeight);
    ctx.restore();
  };

  // Main animation loop
  const draw = useCallback(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Get data from analyser
    const timeBufferLength = analyserNode.fftSize;
    const timeDataArray = new Uint8Array(timeBufferLength);
    analyserNode.getByteTimeDomainData(timeDataArray);

    const freqBufferLength = analyserNode.frequencyBinCount;
    const freqDataArray = new Uint8Array(freqBufferLength);
    analyserNode.getByteFrequencyData(freqDataArray);

    // Draw based on mode
    switch (visualMode) {
      case 'oscilloscope':
        drawOscilloscope(ctx, timeDataArray, width, height);
        break;
      case 'spectrum':
        drawSpectrum(ctx, freqDataArray, width, height);
        break;
      case 'both':
        drawBoth(ctx, timeDataArray, freqDataArray, width, height);
        break;
      default:
        drawOscilloscope(ctx, timeDataArray, width, height);
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, visualMode, zoom, activeNotes]);

  // Start/stop animation based on component state
  useEffect(() => {
    if (analyserNode) {
      // Configure analyser for optimal visualization
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.8;
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -10;

      draw();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw, analyserNode]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height || 200;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className="waveform-visualizer">
      <div className="visualizer-controls d-flex justify-content-between align-items-center mb-2">
        <ButtonGroup size="sm">
          <Button
            variant={visualMode === 'oscilloscope' ? 'primary' : 'outline-secondary'}
            onClick={() => setVisualMode('oscilloscope')}
          >
            Waveform
          </Button>
          <Button
            variant={visualMode === 'spectrum' ? 'primary' : 'outline-secondary'}
            onClick={() => setVisualMode('spectrum')}
          >
            Spectrum
          </Button>
          <Button
            variant={visualMode === 'both' ? 'primary' : 'outline-secondary'}
            onClick={() => setVisualMode('both')}
          >
            Both
          </Button>
        </ButtonGroup>

        {visualMode === 'oscilloscope' && (
          <ButtonGroup size="sm">
            <Button
              variant="outline-secondary"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}
              disabled={zoom <= 0.5}
            >
              -
            </Button>
            <Button variant="outline-secondary" disabled>
              {zoom.toFixed(1)}x
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => setZoom(Math.min(4, zoom + 0.5))}
              disabled={zoom >= 4}
            >
              +
            </Button>
          </ButtonGroup>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        style={{
          width: '100%',
          height: '200px',
          backgroundColor: '#0a0a0a',
          borderRadius: '4px',
          border: '1px solid #333'
        }}
      />

      <style jsx>{`
        .waveform-visualizer {
          width: 100%;
        }

        .visualizer-canvas {
          image-rendering: crisp-edges;
          image-rendering: pixelated;
        }
      `}</style>
    </div>
  );
};

export default WaveformVisualizer;