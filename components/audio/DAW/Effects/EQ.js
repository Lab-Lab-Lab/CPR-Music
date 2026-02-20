'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Badge,
  Modal,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Professional EQ filter types with enhanced characteristics
 */
const FilterTypes = {
  peaking: { name: 'Bell', description: 'Peaking/Notching filter' },
  lowpass: { name: 'Low Pass', description: 'Removes frequencies above cutoff' },
  highpass: { name: 'High Pass', description: 'Removes frequencies below cutoff' },
  lowshelf: { name: 'Low Shelf', description: 'Boosts/cuts low frequencies' },
  highshelf: { name: 'High Shelf', description: 'Boosts/cuts high frequencies' },
  notch: { name: 'Notch', description: 'Narrow cut filter' },
  bandpass: { name: 'Band Pass', description: 'Allows only band to pass' }
};

/**
 * EQ Presets with comprehensive settings
 */
const EQPresets = {
  flat: {
    name: 'Flat (Default)',
    description: 'No EQ processing',
    bands: [
      { frequency: 60, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 150, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 0, q: 0.7, type: 'peaking', enabled: true }
    ],
    outputGain: 0
  },
  vocalPresence: {
    name: 'Vocal Presence',
    description: 'Enhance vocal clarity and presence',
    bands: [
      { frequency: 60, gain: 0, q: 1.0, type: 'highpass', enabled: true },
      { frequency: 150, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 1, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: 0
  },
  warmBass: {
    name: 'Warm Bass',
    description: 'Rich low-end enhancement',
    bands: [
      { frequency: 60, gain: 4, q: 0.7, type: 'lowshelf', enabled: true },
      { frequency: 150, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: -3, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: -2
  },
  brightAir: {
    name: 'Air & Brightness',
    description: 'Add sparkle and air to the mix',
    bands: [
      { frequency: 60, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 150, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 2, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: 0
  },
  loudnessSmile: {
    name: 'Loudness (Smile)',
    description: 'Classic smile curve for fuller sound',
    bands: [
      { frequency: 60, gain: 3, q: 0.7, type: 'lowshelf', enabled: true },
      { frequency: 150, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 3, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: -1
  },
  telephoneMidrange: {
    name: 'Telephone/Radio',
    description: 'Band-limited midrange focus',
    bands: [
      { frequency: 60, gain: 0, q: 2.0, type: 'highpass', enabled: true },
      { frequency: 150, gain: 0, q: 1.0, type: 'highpass', enabled: true },
      { frequency: 350, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 4, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 0, q: 1.0, type: 'lowpass', enabled: true },
      { frequency: 16000, gain: 0, q: 2.0, type: 'lowpass', enabled: true }
    ],
    outputGain: -3
  },
  acoustic: {
    name: 'Acoustic Guitar',
    description: 'Enhance acoustic guitar tone',
    bands: [
      { frequency: 60, gain: 0, q: 1.0, type: 'highpass', enabled: true },
      { frequency: 150, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 2, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: 0
  },
  dance: {
    name: 'Dance/EDM',
    description: 'Punchy bass and crisp highs',
    bands: [
      { frequency: 60, gain: 5, q: 0.7, type: 'lowshelf', enabled: true },
      { frequency: 150, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 350, gain: 0, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 700, gain: -2, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 1500, gain: -1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 3500, gain: 1, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 8000, gain: 3, q: 0.7, type: 'peaking', enabled: true },
      { frequency: 16000, gain: 4, q: 0.7, type: 'highshelf', enabled: true }
    ],
    outputGain: -2
  }
};

/**
 * Tooltip definitions for EQ controls
 */
const EQTooltips = {
  frequency: "Sets the center frequency this band affects. Use logarithmic scaling for natural, musical intervals.",
  gain: "Boost or cut the selected frequency by up to ±24dB. Positive values boost, negative values cut.",
  q: "Controls the bandwidth (Q factor). Lower values (0.1-0.7) affect a wider frequency range, higher values (2-10) create narrow, surgical adjustments.",
  outputGain: "Master output level after all EQ processing. Use this to compensate for overall level changes from your EQ adjustments.",
  bypass: "Temporarily disable all EQ processing to A/B compare with the original signal without losing your settings.",
  linearPhase: "Prevents phase distortion for transparent sound. Uses more CPU but maintains phase relationships between frequencies.",
  spectrum: "Display real-time frequency analysis overlaid on the EQ curve to see your audio's frequency content.",
  midSide: "Process center (mono) and stereo content separately. Great for widening mixes or focusing vocals.",
  midGain: "Adjust the level of center/mono content. Boost to bring vocals forward, cut to widen the mix.",
  sideGain: "Adjust the level of side/stereo content. Boost for width, cut for mono compatibility.",
  stereoLink: "Link left and right channels for matched processing or unlink for independent channel EQ.",
  bandEnable: "Enable or disable this frequency band. Disabled bands won't affect the audio signal.",
  filterType: {
    peaking: "Bell curve that boosts or cuts around the center frequency. Most versatile for general EQ.",
    lowpass: "Allows only frequencies below the cutoff to pass. Use to remove high-frequency content.",
    highpass: "Allows only frequencies above the cutoff to pass. Use to remove rumble and low-end mud.",
    lowshelf: "Boosts or cuts all frequencies below the target frequency. Good for overall bass control.",
    highshelf: "Boosts or cuts all frequencies above the target frequency. Good for brightness and air.",
    notch: "Very narrow cut to remove specific problem frequencies like hum or resonances.",
    bandpass: "Allows only a specific frequency band to pass. Useful for isolating frequency ranges."
  }
};

/**
 * Knob component with optional tooltip
 */
function KnobWithTooltip({ tooltip, label, ...knobProps }) {
  const knob = <Knob label={label} {...knobProps} />;

  if (!tooltip || !label) {
    return knob;
  }

  return (
    <OverlayTrigger
      placement="top"
      delay={{ show: 2000, hide: 250 }}
      overlay={
        <Tooltip id={`tooltip-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {tooltip}
        </Tooltip>
      }
    >
      <div>{knob}</div>
    </OverlayTrigger>
  );
}

/**
 * Switch component with tooltip
 */
function SwitchWithTooltip({ tooltip, label, id, ...switchProps }) {
  const switchElement = (
    <Form.Check
      type="switch"
      id={id}
      label={label}
      {...switchProps}
    />
  );

  if (!tooltip) {
    return switchElement;
  }

  return (
    <OverlayTrigger
      placement="top"
      delay={{ show: 2000, hide: 250 }}
      overlay={
        <Tooltip id={`tooltip-${id}`}>
          {tooltip}
        </Tooltip>
      }
    >
      <div>{switchElement}</div>
    </OverlayTrigger>
  );
}

/**
 * Calculate frequency response for visualization
 * Properly implements biquad filter transfer functions
 */
function calculateFrequencyResponse(bands, sampleRate, numPoints = 512) {
  const frequencies = [];
  const magnitudes = [];

  // Generate logarithmic frequency array (20Hz to 20kHz)
  for (let i = 0; i < numPoints; i++) {
    const freq = 20 * Math.pow(20000 / 20, i / (numPoints - 1));
    frequencies.push(freq);
  }

  // Calculate combined response at each frequency
  frequencies.forEach(freq => {
    let totalGainDB = 0; // Sum gains in dB

    bands.forEach(band => {
      // Skip disabled bands only
      if (band.enabled === false) return;

      // Calculate normalized frequency (0 to 0.5)
      const omega = 2 * Math.PI * band.frequency / sampleRate;
      const sin_omega = Math.sin(omega);
      const cos_omega = Math.cos(omega);

      // Bandwidth/Q factor
      const Q = band.q || 1;
      const A = Math.pow(10, band.gain / 40); // Convert dB to linear amplitude
      const alpha = sin_omega / (2 * Q);


      // Calculate biquad coefficients based on filter type
      let b0, b1, b2, a0, a1, a2;

      switch (band.type) {
          case 'peaking':
            // Peaking EQ filter coefficients
            b0 = 1 + alpha * A;
            b1 = -2 * cos_omega;
            b2 = 1 - alpha * A;
            a0 = 1 + alpha / A;
            a1 = -2 * cos_omega;
            a2 = 1 - alpha / A;
            break;

          case 'lowshelf':
            // Low shelf filter coefficients
            const sqrt2A = Math.sqrt(2 * A);
            const AmP1 = A + 1;
            const AmM1 = A - 1;
            const AmP1cos = AmP1 * cos_omega;
            const AmM1cos = AmM1 * cos_omega;

            b0 = A * (AmP1 - AmM1cos + sqrt2A * alpha);
            b1 = 2 * A * (AmM1 - AmP1cos);
            b2 = A * (AmP1 - AmM1cos - sqrt2A * alpha);
            a0 = AmP1 + AmM1cos + sqrt2A * alpha;
            a1 = -2 * (AmM1 + AmP1cos);
            a2 = AmP1 + AmM1cos - sqrt2A * alpha;
            break;

          case 'highshelf':
            // High shelf filter coefficients
            const sqrt2A_hs = Math.sqrt(2 * A);
            const AmP1_hs = A + 1;
            const AmM1_hs = A - 1;
            const AmP1cos_hs = AmP1_hs * cos_omega;
            const AmM1cos_hs = AmM1_hs * cos_omega;

            b0 = A * (AmP1_hs + AmM1cos_hs + sqrt2A_hs * alpha);
            b1 = -2 * A * (AmM1_hs + AmP1cos_hs);
            b2 = A * (AmP1_hs + AmM1cos_hs - sqrt2A_hs * alpha);
            a0 = AmP1_hs - AmM1cos_hs + sqrt2A_hs * alpha;
            a1 = 2 * (AmM1_hs - AmP1cos_hs);
            a2 = AmP1_hs - AmM1cos_hs - sqrt2A_hs * alpha;
            break;

          case 'highpass':
            // High pass filter coefficients
            b0 = (1 + cos_omega) / 2;
            b1 = -(1 + cos_omega);
            b2 = (1 + cos_omega) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cos_omega;
            a2 = 1 - alpha;
            break;

          case 'lowpass':
            // Low pass filter coefficients
            b0 = (1 - cos_omega) / 2;
            b1 = 1 - cos_omega;
            b2 = (1 - cos_omega) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cos_omega;
            a2 = 1 - alpha;
            break;

          case 'notch':
            // Notch filter coefficients
            b0 = 1;
            b1 = -2 * cos_omega;
            b2 = 1;
            a0 = 1 + alpha;
            a1 = -2 * cos_omega;
            a2 = 1 - alpha;
            break;

          case 'bandpass':
            // Band pass filter coefficients
            b0 = alpha;
            b1 = 0;
            b2 = -alpha;
            a0 = 1 + alpha;
            a1 = -2 * cos_omega;
            a2 = 1 - alpha;
            break;

          default:
            // Pass through - no filtering
            b0 = 1; b1 = 0; b2 = 0;
            a0 = 1; a1 = 0; a2 = 0;
        }

        // Normalize coefficients
        b0 /= a0;
        b1 /= a0;
        b2 /= a0;
        a1 /= a0;
        a2 /= a0;

        // Calculate frequency response at current evaluation frequency (not band frequency!)
        // H(e^jw) = (b0 + b1*e^-jw + b2*e^-j2w) / (1 + a1*e^-jw + a2*e^-j2w)
        const w = 2 * Math.PI * freq / sampleRate; // freq is the evaluation point, not band.frequency
        const cos_w = Math.cos(w);
        const sin_w = Math.sin(w);
        const cos_2w = Math.cos(2 * w);
        const sin_2w = Math.sin(2 * w);

        // Numerator (b coefficients)
        const num_real = b0 + b1 * cos_w + b2 * cos_2w;
        const num_imag = -b1 * sin_w - b2 * sin_2w;

        // Denominator (a coefficients)
        const den_real = 1 + a1 * cos_w + a2 * cos_2w;
        const den_imag = -a1 * sin_w - a2 * sin_2w;

        // Complex division: H = num / den
        const den_mag_sq = den_real * den_real + den_imag * den_imag;
        const H_real = (num_real * den_real + num_imag * den_imag) / den_mag_sq;
        const H_imag = (num_imag * den_real - num_real * den_imag) / den_mag_sq;

        // Convert to magnitude in dB
        const H_mag = Math.sqrt(H_real * H_real + H_imag * H_imag);
        const gainDB = 20 * Math.log10(Math.max(H_mag, 0.0001));

      totalGainDB += gainDB;
    });

    magnitudes.push(totalGainDB);
  });

  return { frequencies, magnitudes };
}

/**
 * Linear phase EQ implementation using convolution
 * Creates a symmetric FIR filter for linear phase response
 */
function createLinearPhaseFilter(audioContext, bands, sampleRate, filterLength = 2048) {
  const halfLength = filterLength / 2;
  const impulseResponse = audioContext.createBuffer(1, filterLength, sampleRate);
  const impulseData = impulseResponse.getChannelData(0);
  
  // Create frequency response from EQ bands
  const freqResponse = new Float32Array(halfLength);
  
  for (let i = 0; i < halfLength; i++) {
    const freq = (i / halfLength) * (sampleRate / 2);
    let magnitude = 1;
    
    bands.forEach(band => {
      if (band.enabled !== false && band.gain !== 0) {
        const omega = 2 * Math.PI * freq / sampleRate;
        const A = Math.pow(10, band.gain / 40);
        const Q = band.q || 1;
        
        // Apply filter response based on type
        switch (band.type) {
          case 'peaking':
            const alpha = Math.sin(omega) / (2 * Q);
            const cosOmega = Math.cos(omega);
            
            // Peaking filter transfer function
            const b0 = 1 + alpha * A;
            const b1 = -2 * cosOmega;
            const b2 = 1 - alpha * A;
            const a0 = 1 + alpha / A;
            const a1 = -2 * cosOmega;
            const a2 = 1 - alpha / A;
            
            // Frequency response magnitude
            const numerator = Math.sqrt(Math.pow(b0, 2) + Math.pow(b1, 2) + Math.pow(b2, 2) + 2*b0*b1*cosOmega + 2*b1*b2*cosOmega + 2*b0*b2*Math.cos(2*omega));
            const denominator = Math.sqrt(Math.pow(a0, 2) + Math.pow(a1, 2) + Math.pow(a2, 2) + 2*a0*a1*cosOmega + 2*a1*a2*cosOmega + 2*a0*a2*Math.cos(2*omega));
            magnitude *= numerator / denominator;
            break;
            
          case 'lowshelf':
            if (freq < band.frequency) {
              magnitude *= A;
            }
            break;
            
          case 'highshelf':
            if (freq > band.frequency) {
              magnitude *= A;
            }
            break;
            
          case 'highpass':
            const hpRatio = freq / band.frequency;
            if (hpRatio < 1) {
              magnitude *= Math.pow(hpRatio, 2 * Q);
            }
            break;
            
          case 'lowpass':
            const lpRatio = band.frequency / freq;
            if (lpRatio < 1) {
              magnitude *= Math.pow(lpRatio, 2 * Q);
            }
            break;
        }
      }
    });
    
    freqResponse[i] = magnitude;
  }
  
  // Convert frequency response to time domain using IFFT (simplified)
  // For a symmetric linear phase filter, create symmetric impulse response
  for (let n = 0; n < filterLength; n++) {
    let sample = 0;
    
    // Inverse Fourier transform (simplified)
    for (let k = 0; k < halfLength; k++) {
      const freq = (k / halfLength) * Math.PI;
      sample += freqResponse[k] * Math.cos(freq * (n - halfLength + 1)) / halfLength;
    }
    
    // Apply window function (Hann window)
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * n / (filterLength - 1)));
    impulseData[n] = sample * window;
  }
  
  return impulseResponse;
}

/**
 * Mid/Side Encoder/Decoder for professional stereo processing
 */
class MidSideProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.setupNodes();
  }
  
  setupNodes() {
    // Mid/Side encoding nodes
    this.splitter = this.context.createChannelSplitter(2);
    this.merger = this.context.createChannelMerger(2);
    
    // For M/S encoding: M = (L+R)/2, S = (L-R)/2
    this.midGain = this.context.createGain();
    this.sideGain = this.context.createGain();
    this.leftInvert = this.context.createGain();
    
    this.midGain.gain.value = 0.5;  // (L+R)/2
    this.sideGain.gain.value = 0.5; // (L-R)/2  
    this.leftInvert.gain.value = -1; // Invert for side calculation
    
    // Processing chains for Mid and Side
    this.midProcessor = this.context.createGain();
    this.sideProcessor = this.context.createGain();
    
    // Decoding nodes: L = M + S, R = M - S
    this.leftOut = this.context.createGain();
    this.rightOut = this.context.createGain();
    this.sideInvert = this.context.createGain();
    this.sideInvert.gain.value = -1;
    
    this.output = this.context.createChannelMerger(2);
  }
  
  encode(input) {
    // Split stereo input
    input.connect(this.splitter);
    
    // Calculate Mid: (L+R)/2
    this.splitter.connect(this.midGain, 0); // Left to Mid
    this.splitter.connect(this.midGain, 1); // Right to Mid
    
    // Calculate Side: (L-R)/2
    this.splitter.connect(this.sideGain, 0); // Left to Side
    this.splitter.connect(this.leftInvert, 1); // Right to invert
    this.leftInvert.connect(this.sideGain); // -Right to Side
    
    return {
      mid: this.midGain,
      side: this.sideGain
    };
  }
  
  decode(midChain, sideChain) {
    // L = M + S
    midChain.connect(this.leftOut);
    sideChain.connect(this.leftOut);
    
    // R = M - S  
    midChain.connect(this.rightOut);
    sideChain.connect(this.sideInvert);
    this.sideInvert.connect(this.rightOut);
    
    // Merge back to stereo
    this.leftOut.connect(this.output, 0, 0);
    this.rightOut.connect(this.output, 0, 1);
    
    return this.output;
  }
}

/**
 * Process EQ on an audio buffer region with Mid/Side processing
 * Professional implementation with linear phase option and M/S processing
 */
export async function processEQRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Default 8-band parametric EQ
  const defaultBands = [
    { frequency: 60, gain: 0, type: 'highpass', q: 0.7, enabled: false },
    { frequency: 100, gain: 0, type: 'lowshelf', q: 0.7, enabled: false },
    { frequency: 250, gain: 0, type: 'peaking', q: 1, enabled: false },
    { frequency: 500, gain: 0, type: 'peaking', q: 1, enabled: false },
    { frequency: 1000, gain: 0, type: 'peaking', q: 1, enabled: false },
    { frequency: 2000, gain: 0, type: 'peaking', q: 1, enabled: false },
    { frequency: 4000, gain: 0, type: 'peaking', q: 1, enabled: false },
    { frequency: 8000, gain: 0, type: 'highshelf', q: 0.7, enabled: false }
  ];

  const bands = parameters.bands || defaultBands;
  const midBands = parameters.midBands || bands; // Separate Mid bands
  const sideBands = parameters.sideBands || bands; // Separate Side bands
  const isLinearPhase = parameters.linearPhase || false;
  const midSideMode = parameters.midSideMode || false;

  // Create a buffer with just the region to process
  const regionBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  // Copy the region to the new buffer
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const regionData = regionBuffer.getChannelData(channel);
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }
  }

  // Create offline context for just the region
  const offlineContext = new OfflineAudioContext(
    regionBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  // Create source with region buffer
  const source = offlineContext.createBufferSource();
  source.buffer = regionBuffer;
  
  let currentNode = source;
  
  if (midSideMode && audioBuffer.numberOfChannels === 2) {
    // Mid/Side processing for stereo sources
    const msProcessor = new MidSideProcessor(offlineContext);
    
    // Encode to Mid/Side
    const { mid, side } = msProcessor.encode(source);
    
    // Process Mid channel
    let midChain = mid;
    if (isLinearPhase) {
      const midConvolver = offlineContext.createConvolver();
      const midImpulse = createLinearPhaseFilter(offlineContext, midBands, sampleRate);
      midConvolver.buffer = midImpulse;
      midChain.connect(midConvolver);
      midChain = midConvolver;
    } else {
      // Apply EQ bands to Mid channel
      for (const band of midBands) {
        if (band.enabled !== false && (band.gain !== 0 || ['highpass', 'lowpass', 'bandpass'].includes(band.type))) {
          const filter = offlineContext.createBiquadFilter();
          filter.type = band.type || 'peaking';
          filter.frequency.value = band.frequency;
          filter.gain.value = band.gain;
          filter.Q.value = band.q || 1;
          
          midChain.connect(filter);
          midChain = filter;
        }
      }
    }
    
    // Process Side channel
    let sideChain = side;
    if (isLinearPhase) {
      const sideConvolver = offlineContext.createConvolver();
      const sideImpulse = createLinearPhaseFilter(offlineContext, sideBands, sampleRate);
      sideConvolver.buffer = sideImpulse;
      sideChain.connect(sideConvolver);
      sideChain = sideConvolver;
    } else {
      // Apply EQ bands to Side channel
      for (const band of sideBands) {
        if (band.enabled !== false && (band.gain !== 0 || ['highpass', 'lowpass', 'bandpass'].includes(band.type))) {
          const filter = offlineContext.createBiquadFilter();
          filter.type = band.type || 'peaking';
          filter.frequency.value = band.frequency;
          filter.gain.value = band.gain;
          filter.Q.value = band.q || 1;
          
          sideChain.connect(filter);
          sideChain = filter;
        }
      }
    }
    
    // Decode back to L/R
    currentNode = msProcessor.decode(midChain, sideChain);
    
  } else {
    // Standard L/R processing
    if (isLinearPhase) {
      // Use linear phase processing (convolution)
      const convolver = offlineContext.createConvolver();
      const impulseResponse = createLinearPhaseFilter(offlineContext, bands, sampleRate);
      convolver.buffer = impulseResponse;
      
      currentNode.connect(convolver);
      currentNode = convolver;
    } else {
      // Use minimum phase processing (biquad filters)
      const filters = [];
      
      for (const band of bands) {
        if (band.enabled !== false && (band.gain !== 0 || ['highpass', 'lowpass', 'bandpass'].includes(band.type))) {
          const filter = offlineContext.createBiquadFilter();
          filter.type = band.type || 'peaking';
          filter.frequency.value = band.frequency;
          filter.gain.value = band.gain;
          filter.Q.value = band.q || 1;
          
          currentNode.connect(filter);
          currentNode = filter;
          filters.push(filter);
        }
      }
    }
  }
  
  // Apply output gain if specified
  if (parameters.outputGain !== undefined && parameters.outputGain !== 0) {
    const outputGain = offlineContext.createGain();
    outputGain.gain.value = Math.pow(10, (parameters.outputGain || 0) / 20);
    currentNode.connect(outputGain);
    currentNode = outputGain;
  }
  
  // Connect to destination
  currentNode.connect(offlineContext.destination);
  
  // Start and render
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  // Return the processed region directly
  return renderedBuffer;
}

/**
 * Professional Parametric EQ with visual frequency response
 * Features: 8-band parametric EQ, spectrum analyzer, linear phase option
 */
export default function EQ({ width, modalMode = false, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const {
    audioBuffer,
    applyProcessedAudio,
    activeRegion,
    audioContext
  } = useWaveform();

  const {
    cutRegion,
    eqLinearPhase,
    setEqLinearPhase,
    eqSpectrumAnalyzer,
    setEqSpectrumAnalyzer,
    eqBypass,
    setEqBypass,
    eqGain,
    setEqGain,
    eqMidSideMode,
    setEqMidSideMode,
    eqMidFilters,
    setEqMidFilters,
    eqSideFilters,
    setEqSideFilters,
    eqMidGain,
    setEqMidGain,
    eqSideGain,
    setEqSideGain,
    eqStereoLink,
    setEqStereoLink
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);
  const analyzerRef = useRef(null);
  const [eqBands, setEqBands] = useState([
    { frequency: 60, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 150, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 350, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 700, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 1500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 3500, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 8000, gain: 0, q: 0.7, type: 'peaking', enabled: true },
    { frequency: 16000, gain: 0, q: 0.7, type: 'peaking', enabled: true }
  ]);
  const [selectedBand, setSelectedBand] = useState(0);
  const [showGraphHelp, setShowGraphHelp] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('flat');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize with flat preset on first load
  useEffect(() => {
    if (!hasInitialized) {
      const flatPreset = EQPresets.flat;
      setEqBands(flatPreset.bands.map(band => ({ ...band })));
      setEqGain(flatPreset.outputGain);
      setHasInitialized(true);
    }
  }, [hasInitialized, setEqGain]);

  // Initialize audio context and analyzer
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!analyzerRef.current && eqSpectrumAnalyzer) {
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 2048;
      analyzerRef.current.smoothingTimeConstant = 0.8;
    }
  }, [eqSpectrumAnalyzer]);
  
  // Draw spectrum analyzer
  const drawSpectrum = useCallback((dataArray) => {
    const canvas = canvasRef.current;
    if (!canvas || !dataArray) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = dataArray.length;
    
    // Draw spectrum analyzer bars
    ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
    
    const barWidth = width / bufferLength * 2;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      // Convert FFT bin to frequency
      const freq = (i * audioContextRef.current.sampleRate) / (2 * bufferLength);
      
      // Skip DC and very low frequencies
      if (freq < 20) continue;
      if (freq > 20000) break;
      
      // Convert to logarithmic scale
      const logX = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      
      // Convert dB value to canvas coordinates
      const dbValue = dataArray[i] - 140; // Normalize from -140dB to 0dB range
      const barHeight = Math.max(0, (dbValue + 80) / 80 * height); // Map -80dB to 0dB to full height
      
      ctx.fillRect(logX, height - barHeight, barWidth, barHeight);
    }
  }, []);

  // Draw frequency response curve
  const drawFrequencyResponse = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw spectrum analyzer if enabled
    if (eqSpectrumAnalyzer && analyzerRef.current) {
      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzerRef.current.getByteFrequencyData(dataArray);
      drawSpectrum(dataArray);
    }
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Frequency grid lines (vertical)
    const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    freqs.forEach(freq => {
      const x = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    
    // Gain grid lines (horizontal)
    for (let db = -24; db <= 24; db += 6) {
      const y = height/2 - (db / 24) * (height/2 - 20);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Zero line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);
    ctx.stroke();
    
    // Calculate and draw frequency response
    const { frequencies, magnitudes } = calculateFrequencyResponse(eqBands, 48000);
    
    ctx.strokeStyle = '#92ce84';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    frequencies.forEach((freq, i) => {
      const x = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;
      const y = height/2 - (magnitudes[i] / 24) * (height/2 - 20);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw band control points - position them on the actual curve
    eqBands.forEach((band, index) => {
      if (!band.enabled) return;

      // Calculate X position (frequency)
      const x = (Math.log10(band.frequency) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * width;

      // Find the actual magnitude at this band's frequency from the frequency response
      // We need to interpolate between the calculated points
      let actualMagnitude = 0;

      // Find the closest frequency points in our response curve
      for (let i = 0; i < frequencies.length - 1; i++) {
        if (frequencies[i] <= band.frequency && frequencies[i + 1] >= band.frequency) {
          // Linear interpolation between the two closest points
          const ratio = (band.frequency - frequencies[i]) / (frequencies[i + 1] - frequencies[i]);
          actualMagnitude = magnitudes[i] + (magnitudes[i + 1] - magnitudes[i]) * ratio;
          break;
        }
      }

      // If frequency is outside range, use closest edge value
      if (band.frequency <= frequencies[0]) {
        actualMagnitude = magnitudes[0];
      } else if (band.frequency >= frequencies[frequencies.length - 1]) {
        actualMagnitude = magnitudes[magnitudes.length - 1];
      }

      // Calculate Y position based on the actual curve magnitude
      const y = height/2 - (actualMagnitude / 24) * (height/2 - 20);

      ctx.fillStyle = index === selectedBand ? '#ffff00' : '#92ce84';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [eqBands, selectedBand, eqSpectrumAnalyzer, drawSpectrum]);
  
  // Animation loop for spectrum analyzer
  useEffect(() => {
    let animationId;
    
    const animate = () => {
      if (eqSpectrumAnalyzer) {
        drawFrequencyResponse();
      }
      animationId = requestAnimationFrame(animate);
    };
    
    if (eqSpectrumAnalyzer) {
      animate();
    } else {
      drawFrequencyResponse();
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [eqSpectrumAnalyzer, drawFrequencyResponse]);
  
  // Update frequency response when bands change
  useEffect(() => {
    if (!eqSpectrumAnalyzer) {
      drawFrequencyResponse();
    }
  }, [eqBands, selectedBand, drawFrequencyResponse, eqSpectrumAnalyzer]);
  
  // Connect analyzer to audio when available
  useEffect(() => {
    if (analyzerRef.current && audioRef?.current && eqSpectrumAnalyzer) {
      try {
        // Create media element source
        const source = audioContextRef.current.createMediaElementSource(audioRef.current);
        source.connect(analyzerRef.current);
        analyzerRef.current.connect(audioContextRef.current.destination);
      } catch (error) {
        // Audio element might already be connected
        console.log('Audio analyzer connection handled elsewhere');
      }
    }
  }, [audioRef, eqSpectrumAnalyzer]);
  
  // Apply EQ to selected region using the standard effect helper
  const applyEQ = useCallback(
    createEffectApplyFunction(processEQRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        effectName: 'EQ',
        bands: eqBands,
        midBands: eqMidSideMode ? (eqMidFilters.length > 0 ? eqMidFilters : eqBands) : eqBands,
        sideBands: eqMidSideMode ? (eqSideFilters.length > 0 ? eqSideFilters : eqBands) : eqBands,
        linearPhase: eqLinearPhase,
        midSideMode: eqMidSideMode,
        outputGain: eqGain,
        midGain: eqMidGain,
        sideGain: eqSideGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, eqBands, eqLinearPhase, eqGain, eqMidSideMode, eqMidFilters, eqSideFilters, eqMidGain, eqSideGain, onApply]
  );
  
  // Update band parameter
  const updateBand = useCallback((index, updates) => {
    setEqBands(prev => prev.map((band, i) => 
      i === index ? { ...band, ...updates } : band
    ));
  }, []);
  
  
  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBand, setDraggedBand] = useState(-1);

  // Handle mouse down on canvas
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate frequency response to get actual positions
    const { frequencies, magnitudes } = calculateFrequencyResponse(eqBands, 48000);

    // Find closest band
    let closestBand = -1;
    let closestDistance = Infinity;

    eqBands.forEach((band, index) => {
      if (!band.enabled) return;

      const bandX = (Math.log10(band.frequency) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * canvas.width;

      // Find the actual magnitude at this band's frequency
      let actualMagnitude = 0;
      for (let i = 0; i < frequencies.length - 1; i++) {
        if (frequencies[i] <= band.frequency && frequencies[i + 1] >= band.frequency) {
          const ratio = (band.frequency - frequencies[i]) / (frequencies[i + 1] - frequencies[i]);
          actualMagnitude = magnitudes[i] + (magnitudes[i + 1] - magnitudes[i]) * ratio;
          break;
        }
      }

      // Edge cases
      if (band.frequency <= frequencies[0]) {
        actualMagnitude = magnitudes[0];
      } else if (band.frequency >= frequencies[frequencies.length - 1]) {
        actualMagnitude = magnitudes[magnitudes.length - 1];
      }

      const bandY = canvas.height/2 - (actualMagnitude / 24) * (canvas.height/2 - 20);
      const distance = Math.sqrt(Math.pow(x - bandX, 2) + Math.pow(y - bandY, 2));

      if (distance < 15 && distance < closestDistance) {
        closestDistance = distance;
        closestBand = index;
      }
    });

    if (closestBand >= 0) {
      setSelectedBand(closestBand);
      setDraggedBand(closestBand);
      setIsDragging(true);
    }
  }, [eqBands]);

  // Handle mouse move on canvas
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || draggedBand < 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

    // Convert x to frequency (logarithmic scale)
    const freq = Math.max(20, Math.min(20000, 20 * Math.pow(20000 / 20, x / canvas.width)));

    // Convert y to gain (linear scale)
    const gain = Math.max(-24, Math.min(24, ((canvas.height/2 - y) / (canvas.height/2 - 20)) * 24));

    // Update the dragged band
    updateBand(draggedBand, { frequency: Math.round(freq), gain: Math.round(gain * 2) / 2 });
  }, [isDragging, draggedBand, updateBand]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedBand(-1);
  }, []);
  
  return (
    <>
      <Container fluid className="p-3">
      {/* Preset Selection */}
      <Row className="mb-3">
        <Col xs={12} md={6} lg={4}>
          <Form.Label className="text-white small">
            <strong>EQ Preset</strong>
            <span className="text-muted ms-2">(Full EQ Curve)</span>
          </Form.Label>
          <Form.Select
            value={selectedPreset}
            onChange={(e) => {
              const presetKey = e.target.value;
              const preset = EQPresets[presetKey];

              if (preset) {
                setSelectedPreset(presetKey);
                // Force new array and deep clone to trigger React re-render
                setEqBands(preset.bands.map(band => ({ ...band })));
                setEqGain(preset.outputGain);
              }
            }}
            className="bg-secondary text-white border-0"
          >
            <option value="" disabled>-- Select EQ Preset --</option>
            {Object.entries(EQPresets).map(([key, preset]) => (
              <option key={key} value={key}>{preset.name}</option>
            ))}
          </Form.Select>
          <small className="text-muted">{EQPresets[selectedPreset]?.description}</small>
        </Col>
        <Col xs={12} md={6} lg={8} className="d-flex align-items-end justify-content-end gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              // Reset to flat preset
              const flatPreset = EQPresets.flat;
              setSelectedPreset('flat');
              setEqBands(flatPreset.bands.map(band => ({ ...band })));
              setEqGain(flatPreset.outputGain);
            }}
          >
            Reset EQ
          </Button>
        </Col>
      </Row>

      {/* Interactive EQ Visualization */}
      <Row className="mb-4">
        <Col xs={12}>
          <div
            className="eq-graph-container position-relative bg-dark rounded p-2"
            style={{ minHeight: '300px' }}
          >
            {/* Help Icon */}
            <div
              className="position-absolute"
              style={{
                top: '10px',
                right: '10px',
                zIndex: 10,
                cursor: 'pointer'
              }}
            >
              <FaQuestionCircle
                size={20}
                style={{
                  color: '#7bafd4',
                  opacity: 0.7,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.opacity = 1}
                onMouseLeave={(e) => e.target.style.opacity = 0.7}
                onClick={() => setShowGraphHelp(true)}
              />
            </div>

            <canvas
              ref={canvasRef}
              width={800}
              height={300}
              style={{
                width: '100%',
                height: '300px',
                cursor: selectedBand >= 0 ? 'move' : 'default',
                imageRendering: 'crisp-edges'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Frequency Labels */}
            <div className="position-absolute bottom-0 start-0 w-100 d-flex justify-content-between px-3 pb-1">
              <small className="text-muted">20Hz</small>
              <small className="text-muted">100Hz</small>
              <small className="text-muted">1kHz</small>
              <small className="text-muted">10kHz</small>
              <small className="text-muted">20kHz</small>
            </div>

            {/* Gain Labels */}
            <div className="position-absolute top-0 start-0 h-100 d-flex flex-column justify-content-between py-3">
              <small className="text-muted ms-1">+24dB</small>
              <small className="text-muted ms-1">0dB</small>
              <small className="text-muted ms-1">-24dB</small>
            </div>
          </div>
        </Col>
      </Row>

      {/* Band Controls Grid */}
      <Row className="mb-4">
        <Col xs={12}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="text-white mb-0">EQ Bands</h6>
            {selectedBand >= 0 && (
              <Badge bg="warning" text="dark">
                Editing Band {selectedBand + 1}
              </Badge>
            )}
          </div>
          <div className="d-flex gap-2 flex-wrap justify-content-center">
            {eqBands.map((band, index) => (
              <div
                key={index}
                className={`band-control text-center p-3 rounded ${
                  selectedBand === index ? 'bg-primary bg-opacity-25 border border-primary' : 'bg-dark'
                } ${!band.enabled ? 'opacity-50' : ''}`}
                onClick={() => setSelectedBand(index)}
                style={{
                  cursor: 'pointer',
                  minWidth: '90px',
                  transition: 'all 0.2s'
                }}
              >
                <div className="mb-2">
                  <Badge bg={band.enabled ? 'success' : 'secondary'} className="mb-1">
                    {index + 1}
                  </Badge>
                  <div className="text-white small fw-bold">
                    {band.frequency >= 1000 ? `${(band.frequency/1000).toFixed(1)}k` : Math.round(band.frequency)}Hz
                  </div>
                </div>
                <Knob
                  key={`${selectedPreset}-${index}`}
                  value={band.gain}
                  onChange={(val) => updateBand(index, { gain: val })}
                  min={-24}
                  max={24}
                  step={0.5}
                  label=""
                  displayValue={`${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`}
                  size={60}
                  color={selectedBand === index ? '#ffd700' : (band.enabled ? '#92ce84' : '#666666')}
                />
                <div onClick={(e) => e.stopPropagation()}>
                  <SwitchWithTooltip
                    tooltip={EQTooltips.bandEnable}
                    id={`band-enable-${index}`}
                    checked={band.enabled}
                    onChange={(e) => {
                      updateBand(index, { enabled: e.target.checked });
                    }}
                    className="mt-2"
                    label={band.enabled ? 'On' : 'Off'}
                  />
                </div>
              </div>
            ))}
          </div>
        </Col>
      </Row>

      {/* Band Settings and Global Settings Side-by-Side */}
      <Row className="border-top pt-3 mt-4">
        {/* Selected Band Detailed Controls */}
        {selectedBand >= 0 && (
          <Col xs={12} lg={6} className="mb-3">
            <div className="bg-dark rounded p-3 h-100">
              <h6 className="text-warning mb-3">Band {selectedBand + 1} Settings</h6>
              <Row>
          <Col xs={12} sm={6} md={3}>
            <Form.Group>
              <OverlayTrigger
                placement="top"
                delay={{ show: 2000, hide: 250 }}
                overlay={
                  <Tooltip id="tooltip-filter-type">
                    {EQTooltips.filterType[eqBands[selectedBand].type] || "Select a filter shape for this band"}
                  </Tooltip>
                }
              >
                <Form.Label className="text-white small">Band {selectedBand + 1} Filter Shape</Form.Label>
              </OverlayTrigger>
              <Form.Select
                size="sm"
                value={eqBands[selectedBand].type}
                onChange={(e) => updateBand(selectedBand, { type: e.target.value })}
                className="bg-secondary text-white border-secondary"
              >
                {Object.entries(FilterTypes).map(([key, filter]) => (
                  <option key={key} value={key}>{filter.name}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {FilterTypes[eqBands[selectedBand].type]?.description}
              </Form.Text>
            </Form.Group>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div className="text-center">
              <label className="text-white small d-block mb-2">Frequency</label>
              <KnobWithTooltip
                tooltip={EQTooltips.frequency}
                value={eqBands[selectedBand].frequency}
                onChange={(val) => updateBand(selectedBand, { frequency: val })}
                min={20}
                max={20000}
                step={1}
                label="Frequency"
                displayValue={
                  eqBands[selectedBand].frequency >= 1000
                    ? `${(eqBands[selectedBand].frequency/1000).toFixed(2)}kHz`
                    : `${Math.round(eqBands[selectedBand].frequency)}Hz`
                }
                size={60}
              color="#7bafd4"
              logarithmic={true}
            />
            </div>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div className="text-center">
              <label className="text-white small d-block mb-2">Q Factor / Bandwidth</label>
              <KnobWithTooltip
                tooltip={EQTooltips.q}
                value={eqBands[selectedBand].q}
                onChange={(val) => updateBand(selectedBand, { q: val })}
                min={0.1}
                max={10}
                step={0.1}
                label="Q Factor"
                displayValue={eqBands[selectedBand].q.toFixed(1)}
                size={60}
                color="#92ce84"
              />
              <Form.Text className="text-muted small d-block">
                {eqBands[selectedBand].q < 0.7 ? 'Wide' : eqBands[selectedBand].q > 2 ? 'Narrow' : 'Medium'}
              </Form.Text>
            </div>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div className="text-center">
              <label className="text-white small d-block mb-2">Gain</label>
              <KnobWithTooltip
                tooltip={EQTooltips.gain}
                value={eqBands[selectedBand].gain}
                onChange={(val) => updateBand(selectedBand, { gain: val })}
                min={-24}
                max={24}
                step={0.5}
                label="Gain"
                displayValue={`${eqBands[selectedBand].gain > 0 ? '+' : ''}${eqBands[selectedBand].gain.toFixed(1)}dB`}
                size={60}
                color="#e75b5c"
              />
            </div>
          </Col>
              </Row>
            </div>
          </Col>
        )}

        {/* Global Controls */}
        <Col xs={12} lg={selectedBand >= 0 ? 6 : 12} className="mb-3">
          <div className="bg-dark rounded p-3 h-100">
            <h6 className="text-white mb-3">Global Settings</h6>
            <Row>
        <Col xs={12} sm={6} md={3}>
          <div className="text-center">
            <label className="text-white small d-block mb-2">Output Gain</label>
            <KnobWithTooltip
              tooltip={EQTooltips.outputGain}
              value={eqGain}
              onChange={setEqGain}
              min={-12}
              max={12}
              label="Output"
              displayValue={`${eqGain > 0 ? '+' : ''}${eqGain.toFixed(1)}dB`}
              size={60}
              color="#ffd700"
            />
          </div>
        </Col>
        <Col xs={12} sm={6} md={9}>
          <div className="d-flex flex-wrap gap-3 align-items-center h-100">
            <SwitchWithTooltip
              tooltip={EQTooltips.bypass}
              id="eq-bypass"
              label="Bypass"
              checked={eqBypass}
              onChange={(e) => setEqBypass(e.target.checked)}
              className="text-white"
            />
            <SwitchWithTooltip
              tooltip={EQTooltips.linearPhase}
              id="eq-linear-phase"
              label="Linear Phase"
              checked={eqLinearPhase}
              onChange={(e) => setEqLinearPhase(e.target.checked)}
              className="text-white"
            />
            <SwitchWithTooltip
              tooltip={EQTooltips.spectrum}
              id="eq-spectrum"
              label="Spectrum"
              checked={eqSpectrumAnalyzer}
              onChange={(e) => setEqSpectrumAnalyzer(e.target.checked)}
              className="text-white"
            />
            <SwitchWithTooltip
              tooltip={EQTooltips.midSide}
              id="eq-midside"
              label="Mid/Side"
              checked={eqMidSideMode}
              onChange={(e) => setEqMidSideMode(e.target.checked)}
              className="text-white"
            />
          </div>
        </Col>
              </Row>
            </div>
          </Col>
        </Row>

      {/* Mid/Side Controls */}
      {eqMidSideMode && (
        <Row className="mt-3 border-top pt-3">
          <Col xs={12}>
            <h6 className="text-white mb-2">Mid/Side Processing</h6>
          </Col>
          <Col xs={6} sm={4} md={2}>
            <KnobWithTooltip
              tooltip={EQTooltips.midGain}
              value={eqMidGain}
              onChange={setEqMidGain}
              min={-12}
              max={12}
              step={0.1}
              label="Mid Gain"
              displayValue={`${eqMidGain > 0 ? '+' : ''}${eqMidGain.toFixed(1)}dB`}
              size={45}
              color="#e74c3c"
            />
          </Col>
          <Col xs={6} sm={4} md={2}>
            <KnobWithTooltip
              tooltip={EQTooltips.sideGain}
              value={eqSideGain}
              onChange={setEqSideGain}
              min={-12}
              max={12}
              step={0.1}
              label="Side Gain"
              displayValue={`${eqSideGain > 0 ? '+' : ''}${eqSideGain.toFixed(1)}dB`}
              size={45}
              color="#3498db"
            />
          </Col>
          <Col xs={12} sm={4} md={2}>
            <SwitchWithTooltip
              tooltip={EQTooltips.stereoLink}
              id="eq-stereo-link"
              label="Stereo Link"
              checked={eqStereoLink}
              onChange={(e) => setEqStereoLink(e.target.checked)}
              className="text-white"
            />
          </Col>
        </Row>
      )}
      
      
      {/* Quick Band Selection */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="d-flex gap-1 flex-wrap">
            {eqBands.map((band, index) => (
              <Button
                key={index}
                size="sm"
                variant={selectedBand === index ? 'warning' : 'outline-secondary'}
                onClick={() => setSelectedBand(index)}
                className={`text-white ${selectedBand === index ? 'text-dark' : ''}`}
                style={{ minWidth: '60px' }}
              >
                {index + 1}
                <br />
                <small>{band.frequency >= 1000 ? (band.frequency/1000).toFixed(1) + 'k' : band.frequency}Hz</small>
              </Button>
            ))}
          </div>
        </Col>
      </Row>
      
      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyEQ}
            disabled={eqBypass}
          >
            Apply EQ to Region
          </Button>
        </Col>
      </Row>

      </Container>

      {/* Graph Help Modal */}
    <Modal
      show={showGraphHelp}
      onHide={() => setShowGraphHelp(false)}
      size="lg"
      centered
    >
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaQuestionCircle className="me-2" />
          Understanding the EQ Graph
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white">
        <div className="mb-4">
          <h5 className="text-info mb-3">What You're Looking At</h5>
          <p>
            The graph shows how your EQ settings change the loudness of different frequencies (pitches) in your audio.
            Think of it like a sound sculpture - you're shaping which parts of the sound are louder or quieter.
          </p>
        </div>

        <div className="mb-4">
          <h5 className="text-info mb-3">Reading the Graph</h5>
          <Row>
            <Col md={6} className="mb-3">
              <h6 className="text-warning">↔️ Left to Right (Frequency)</h6>
              <ul className="small">
                <li><strong>Left side:</strong> Low frequencies (bass, kick drums)</li>
                <li><strong>Middle:</strong> Mid frequencies (vocals, guitars)</li>
                <li><strong>Right side:</strong> High frequencies (cymbals, air, sparkle)</li>
              </ul>
            </Col>
            <Col md={6} className="mb-3">
              <h6 className="text-warning">↕️ Up and Down (Gain)</h6>
              <ul className="small">
                <li><strong>Moving up:</strong> Boosts (makes louder)</li>
                <li><strong>Center line:</strong> No change (0dB)</li>
                <li><strong>Moving down:</strong> Cuts (makes quieter)</li>
              </ul>
            </Col>
          </Row>
        </div>

        <div className="mb-4">
          <h5 className="text-info mb-3">Real World Examples</h5>
          <Row>
            <Col md={6}>
              <ul className="small">
                <li><strong>60-250Hz:</strong> Bass thump and power</li>
                <li><strong>200-500Hz:</strong> Warmth (or muddiness if too much)</li>
                <li><strong>1-3kHz:</strong> Vocal clarity and presence</li>
                <li><strong>3-5kHz:</strong> Attack of drums and guitars</li>
              </ul>
            </Col>
            <Col md={6}>
              <ul className="small">
                <li><strong>5-8kHz:</strong> Brightness and definition</li>
                <li><strong>8-12kHz:</strong> Brilliance and air</li>
                <li><strong>12-20kHz:</strong> Sparkle and openness</li>
              </ul>
            </Col>
          </Row>
        </div>

        <div className="mb-3">
          <h5 className="text-info mb-3">How to Use It</h5>
          <p className="mb-2">
            <strong>The Curve:</strong> The yellow line shows exactly which frequencies are being changed and by how much.
            A flat line means no change, curves up mean boost, curves down mean cut.
          </p>
          <p>
            <strong>The Dots:</strong> Each dot represents one of your 8 EQ bands. Click and drag them on the graph to shape your sound!
            Select a band below to fine-tune with the knobs.
          </p>
        </div>

        <div className="alert alert-info mb-0">
          <strong>💡 Pro Tip:</strong> Start with small adjustments (±3dB). If you need more than ±6dB,
          you might want to fix the problem at the source (microphone placement, instrument tone, etc.)
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={() => setShowGraphHelp(false)}>
          Got it!
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF identifier
  setUint32(0x46464952);
  // file length
  setUint32(length - 8);
  // RIFF type
  setUint32(0x45564157);
  // format chunk identifier
  setUint32(0x20746d66);
  // format chunk length
  setUint32(16);
  // sample format (PCM)
  setUint16(1);
  // channel count
  setUint16(buffer.numberOfChannels);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate
  setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
  // block align
  setUint16(buffer.numberOfChannels * 2);
  // bits per sample
  setUint16(16);
  // data chunk identifier
  setUint32(0x61746164);
  // data chunk length
  setUint32(length - pos - 4);

  // Extract channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Interleave channels and convert to 16-bit PCM
  while (offset < buffer.length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return arrayBuffer;
}