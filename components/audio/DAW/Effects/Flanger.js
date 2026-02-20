'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  useAudio,
  useEffects,
  useWaveform
} from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const FlangerTooltips = {
  rate: "Speed of the sweeping motion. Slow rates (0.1-0.5Hz) create gentle jet-plane swooshes, fast rates (2-5Hz) create vibrato-like warbling.",
  depth: "How far the sweep travels. Shallow depth (0.5-2ms) is subtle, deep sweeps (3-5ms) create dramatic jet-plane effects. Higher depth = more pitch variation.",
  feedback: "Routes output back through the effect. Positive feedback creates metallic resonance, negative feedback (below 0%) creates hollower tones. Use sparingly (20-50%).",
  delay: "Center point of the sweep. Shorter delays (1-5ms) create tight, metallic flanging. Longer delays (10-20ms) create chorus-like effects with resonance.",
  mix: "Balance between dry and wet signal. 50% is classic flanging, 30-40% is subtle, 70-90% is intense. Higher mix emphasizes the sweeping effect.",
  throughZero: "Enables through-zero flanging for classic tape-style jet sounds. Creates more dramatic sweeps by allowing the delay to cross zero. Iconic 70s sound.",
  stereoPhase: "Phase offset between left and right channels. 90° creates wide stereo movement, 180° creates ping-pong effect. 0° is mono flanging.",
  manualOffset: "Manually shifts the sweep range. Use to find sweet spots or create asymmetric stereo flanging. Adds manual control beyond LFO modulation."
};

/**
 * Process flanger on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processFlangerRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  const regionDuration = (endSample - startSample) / sampleRate;
  
  // Create offline context with region length only
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Create dual delay nodes for through-zero flanging
  const delayNodeLeft = offlineContext.createDelay(0.02);
  const delayNodeRight = offlineContext.createDelay(0.02);
  const feedbackGain = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();
  const outputGain = offlineContext.createGain();
  
  // Phase inversion node for through-zero flanging
  const phaseInvert = offlineContext.createGain();
  phaseInvert.gain.value = parameters.throughZero ? -1 : 1;
  
  // Set static parameters with enhanced feedback safety
  const safeFeedback = Math.max(-0.98, Math.min(0.98, parameters.feedback || 0.5));
  feedbackGain.gain.value = safeFeedback;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);
  
  // Create LFO for modulating delay time with stereo phase offset
  const lfoLeft = offlineContext.createOscillator();
  const lfoRight = offlineContext.createOscillator();
  const lfoGainLeft = offlineContext.createGain();
  const lfoGainRight = offlineContext.createGain();
  
  lfoLeft.frequency.value = parameters.rate || 0.5;
  lfoRight.frequency.value = parameters.rate || 0.5;
  
  // Enhanced depth control with through-zero capability
  const maxDepth = parameters.throughZero ? parameters.delay || 0.005 : parameters.depth || 0.002;
  lfoGainLeft.gain.value = maxDepth;
  lfoGainRight.gain.value = maxDepth;
  
  // Apply stereo phase offset (in radians)
  const phaseOffset = (parameters.stereoPhase || 0) * Math.PI / 180;
  lfoLeft.start();
  lfoRight.start(phaseOffset / (2 * Math.PI * lfoRight.frequency.value));
  
  // Connect LFOs to delay times
  lfoLeft.connect(lfoGainLeft);
  lfoRight.connect(lfoGainRight);
  lfoGainLeft.connect(delayNodeLeft.delayTime);
  lfoGainRight.connect(delayNodeRight.delayTime);
  
  // Set base delay time with manual offset
  const baseDelay = parameters.delay || 0.005;
  const manualOffset = (parameters.manualOffset || 0) * 0.002; // Max 2ms offset
  delayNodeLeft.delayTime.value = baseDelay + manualOffset;
  delayNodeRight.delayTime.value = baseDelay - manualOffset; // Opposite offset for stereo
  
  // Create channel splitter and merger for stereo processing
  const splitter = offlineContext.createChannelSplitter(2);
  const merger = offlineContext.createChannelMerger(2);
  
  // Connect audio path with stereo processing
  source.connect(dryGain);
  source.connect(splitter);
  
  // Route left and right channels through separate delay lines
  splitter.connect(delayNodeLeft, 0);
  splitter.connect(delayNodeRight, 1);
  
  // Apply phase inversion for through-zero flanging
  delayNodeLeft.connect(phaseInvert);
  delayNodeRight.connect(phaseInvert);
  
  // Feedback loops for both channels
  phaseInvert.connect(feedbackGain);
  feedbackGain.connect(delayNodeLeft);
  feedbackGain.connect(delayNodeRight);
  
  // Merge processed channels
  phaseInvert.connect(merger, 0, 0);
  phaseInvert.connect(merger, 0, 1);
  
  // Mix wet and dry
  merger.connect(wetGain);
  dryGain.connect(outputGain);
  wetGain.connect(outputGain);
  
  outputGain.connect(offlineContext.destination);

  // Play only the region
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  // Render and return processed region directly
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer;
}

/**
 * Flanger effect component - similar to phaser but with shorter delay times
 */
export default function Flanger({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    flangerRate,
    setFlangerRate,
    flangerDepth,
    setFlangerDepth,
    flangerFeedback,
    setFlangerFeedback,
    flangerDelay,
    setFlangerDelay,
    flangerMix,
    setFlangerMix,
    flangerTempoSync,
    setFlangerTempoSync,
    flangerNoteDivision,
    setFlangerNoteDivision,
    flangerThroughZero,
    setFlangerThroughZero,
    flangerStereoPhase,
    setFlangerStereoPhase,
    flangerManualOffset,
    setFlangerManualOffset,
    globalBPM,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Calculate tempo-synced LFO rate
  const getEffectiveRate = () => {
    if (flangerTempoSync) {
      return (globalBPM / 60) * (4 / flangerNoteDivision);
    }
    return flangerRate;
  };
  
  // Apply flanger to selected region
  const applyFlanger = useCallback(
    createEffectApplyFunction(processFlangerRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        rate: getEffectiveRate(),
        depth: flangerDepth,
        feedback: flangerFeedback,
        delay: flangerDelay,
        mix: flangerMix,
        throughZero: flangerThroughZero,
        stereoPhase: flangerStereoPhase,
        manualOffset: flangerManualOffset
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, flangerRate, flangerDepth, flangerFeedback, flangerDelay, flangerMix, flangerThroughZero, flangerStereoPhase, flangerManualOffset, flangerTempoSync, flangerNoteDivision, globalBPM, onApply]
  );
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.rate}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerRate}
                onChange={setFlangerRate}
                min={0.1}
                max={10}
                step={0.1}
                label="Rate"
                displayValue={`${flangerRate.toFixed(1)}Hz`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.depth}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerDepth * 1000}
                onChange={(v) => setFlangerDepth(v / 1000)}
                min={0.1}
                max={5}
                step={0.1}
                label="Depth"
                displayValue={`${(flangerDepth * 1000).toFixed(1)}ms`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.feedback}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerFeedback}
                onChange={setFlangerFeedback}
                min={-0.95}
                max={0.95}
                label="Feedback"
                displayValue={`${Math.round(flangerFeedback * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.delay}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerDelay * 1000}
                onChange={(v) => setFlangerDelay(v / 1000)}
                min={1}
                max={20}
                step={0.5}
                label="Delay"
                displayValue={`${(flangerDelay * 1000).toFixed(1)}ms`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerMix}
                onChange={setFlangerMix}
                min={0}
                max={1}
                label="Mix"
                displayValue={`${Math.round(flangerMix * 100)}%`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        {/* Professional Controls */}
        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.throughZero}</Tooltip>}
          >
            <div>
              <Form.Check
                type="switch"
                id="flanger-through-zero"
                label="Thru-0"
                checked={flangerThroughZero}
                onChange={(e) => setFlangerThroughZero(e.target.checked)}
                className="text-white small"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.stereoPhase}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerStereoPhase}
                onChange={setFlangerStereoPhase}
                min={0}
                max={180}
                step={5}
                label="Phase"
                displayValue={`${flangerStereoPhase}°`}
                size={45}
                color="#9b59b6"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{FlangerTooltips.manualOffset}</Tooltip>}
          >
            <div>
              <Knob
                value={flangerManualOffset}
                onChange={setFlangerManualOffset}
                min={0}
                max={1}
                step={0.01}
                label="Offset"
                displayValue={`${Math.round(flangerManualOffset * 100)}%`}
                size={45}
                color="#e67e22"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyFlanger}
          >
            Apply to Region
          </Button>
        </Col>
      </Row>
    </Container>
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