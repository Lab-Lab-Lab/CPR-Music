'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Form, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaQuestionCircle } from 'react-icons/fa';
import { useAudio, useEffects, useWaveform } from '../../../../contexts/DAWProvider';
import { createEffectApplyFunction } from '../../../../lib/effects/effectsWaveformHelper';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const EchoTooltips = {
  delayTime: "Time between the original sound and the echo. Shorter delays (50-200ms) create slapback effects, longer delays (300-600ms) create rhythmic echoes.",
  feedback: "How much of the echo is fed back into itself. Higher values create more repetitions. Be careful with values over 80% as they can build up quickly.",
  inputGain: "Volume of the original signal going into the echo. Use lower values to make the echo more subtle.",
  outputGain: "Overall volume of the echo effect. Reduce if the echo is too loud compared to the original sound.",
  taps: "Number of echo repetitions. Each tap creates a separate echo at different times.",
  spread: "How far apart in time the multiple taps are. Creates rhythmic patterns with multiple taps.",
  modRate: "Speed of pitch modulation. Adds vintage tape-like warble to the echoes.",
  modDepth: "Amount of pitch modulation. Subtle amounts (5-15%) create analog warmth.",
  pingPong: "Alternates echoes between left and right channels for a bouncing stereo effect.",
  filter: "Shapes the tone of the echoes. High-pass removes bass, low-pass removes treble."
};

/**
 * Simple, Safe Echo Processor
 * Educational echo effect with safety limits
 */
class SimpleEchoProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;

    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();

    // Single delay line
    this.delay = audioContext.createDelay(2.0);
    this.feedbackGain = audioContext.createGain();

    // Safety limiter
    this.compressor = audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 2;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Parameters with safe defaults
    this.delayTime = 0.5; // seconds
    this.feedback = 0.5; // 50%
    this.inputGain = 1.0;
    this.outputGain = 1.0;

    this.setupRouting();
  }
  setupRouting() {
    // Simple, safe routing
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.compressor);

    // Wet path with single delay and feedback
    this.input.connect(this.delay);
    this.delay.connect(this.wetGain);
    this.delay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delay);
    this.wetGain.connect(this.compressor);

    // Safety compressor to output
    this.compressor.connect(this.output);

    // Set initial values
    this.setWetDryMix();
  }

  setWetDryMix() {
    // Balanced mix for echo
    this.wetGain.gain.setValueAtTime(this.outputGain * 0.7, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(this.inputGain, this.context.currentTime);
  }
  
  // Simple, safe parameter setters
  setDelayTime(time) {
    // Limit delay time to safe range (1ms to 2 seconds)
    this.delayTime = Math.max(0.001, Math.min(2, time / 1000));
    this.delay.delayTime.setValueAtTime(this.delayTime, this.context.currentTime);
  }

  setFeedback(feedback) {
    // Limit feedback to 80% maximum for safety
    this.feedback = Math.max(0, Math.min(0.8, feedback));
    this.feedbackGain.gain.setValueAtTime(this.feedback, this.context.currentTime);
  }

  setInputGain(gain) {
    // Limit input gain to 1.5x maximum
    this.inputGain = Math.max(0, Math.min(1.5, gain));
    this.input.gain.setValueAtTime(this.inputGain, this.context.currentTime);
    this.setWetDryMix();
  }

  setOutputGain(gain) {
    // Limit output gain to 1.5x maximum
    this.outputGain = Math.max(0, Math.min(1.5, gain));
    this.output.gain.setValueAtTime(this.outputGain, this.context.currentTime);
    this.setWetDryMix();
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Simple, safe echo processing function
 */
export async function processEchoRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Calculate processing time with echo tails
  const maxDelayTime = (parameters.delay || 500) / 1000;
  const echoTailSamples = Math.floor(maxDelayTime * sampleRate * 5); // Allow for echo decay

  // Create offline context
  const totalLength = audioBuffer.length + echoTailSamples;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    totalLength,
    sampleRate
  );

  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create simple, safe echo processor
  const echoProcessor = new SimpleEchoProcessor(offlineContext);
  echoProcessor.setDelayTime(parameters.delay || 500);
  echoProcessor.setFeedback(Math.min(0.8, parameters.feedback || 0.5)); // Safety cap at 80%
  echoProcessor.setInputGain(Math.min(1.5, parameters.inputGain || 1.0)); // Safety cap at 1.5x
  echoProcessor.setOutputGain(Math.min(1.5, parameters.outputGain || 1.0)); // Safety cap at 1.5x

  // Connect and process
  source.connect(echoProcessor.input);
  echoProcessor.connect(offlineContext.destination);

  // Play only the region (let echo tails naturally decay in the extended buffer)
  const startTime = startSample / sampleRate;
  const duration = regionLength / sampleRate;
  source.start(0, startTime, duration);

  const renderedBuffer = await offlineContext.startRendering();

  // Extract just the region length from the rendered buffer (includes echo tails within region)
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const processedData = renderedBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy the processed region (echo tails are naturally included in the processed data)
    const copyLength = Math.min(regionLength, processedData.length);
    for (let i = 0; i < copyLength; i++) {
      outputData[i] = processedData[i];
    }
  }

  return outputBuffer;
}

/**
 * Enhanced Echo effect component with advanced mode
 * Backward compatible with simple interface, expandable to advanced features
 */
export default function Echo({ width, onApply }) {
  const {
    audioRef,
    addToEditHistory,
    audioURL
  } = useAudio();

  const { audioBuffer, applyProcessedAudio, activeRegion,
    audioContext } = useWaveform();

  const {
    echoDelay,
    setEchoDelay,
    echoFeedback,
    setEchoFeedback,
    echoInputGain,
    setEchoInputGain,
    echoOutputGain,
    setEchoOutputGain,
    globalBPM,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Initialize audio context and processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!processorRef.current) {
      processorRef.current = new SimpleEchoProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setDelayTime(echoDelay);
      processorRef.current.setFeedback(echoFeedback);
      processorRef.current.setInputGain(echoInputGain);
      processorRef.current.setOutputGain(echoOutputGain);
    }
  }, [echoDelay, echoFeedback, echoInputGain, echoOutputGain]);

  // Apply echo to selected region
  const applyEcho = useCallback(
    createEffectApplyFunction(processEchoRegion, {
      audioBuffer,
      activeRegion,
      cutRegion,
      applyProcessedAudio,
      audioContext,
      parameters: {
        delay: echoDelay,
        feedback: echoFeedback,
        inputGain: echoInputGain,
        outputGain: echoOutputGain
      },
      onApply
    }),
    [audioBuffer, activeRegion, cutRegion, applyProcessedAudio, audioContext, echoDelay, echoFeedback, echoInputGain, echoOutputGain, onApply]
  );
  
  
  return (
    <Container fluid className="p-2">
      {/* Echo Header with Help */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="text-white mb-0">Echo Effect</h5>
            <OverlayTrigger
              placement="left"
              delay={{ show: 250, hide: 100 }}
              overlay={
                <Tooltip>
                  Click for detailed explanation of echo effects
                </Tooltip>
              }
            >
              <Button
                size="sm"
                variant="link"
                className="p-0 text-info"
                onClick={() => setShowHelpModal(true)}
              >
                <FaQuestionCircle size={20} />
              </Button>
            </OverlayTrigger>
          </div>
        </Col>
      </Row>

      {/* Echo Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{EchoTooltips.delayTime}</Tooltip>}
          >
            <div>
              <Knob
                value={echoDelay}
                onChange={setEchoDelay}
                min={0.1}
                max={2000}
                step={1}
                label="Delay Time"
                displayValue={`${echoDelay.toFixed(0)}ms`}
                size={50}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{EchoTooltips.feedback}</Tooltip>}
          >
            <div>
              <Knob
                value={echoFeedback}
                onChange={setEchoFeedback}
                min={0}
                max={0.8}
                step={0.01}
                label="Feedback"
                displayValue={`${Math.round(echoFeedback * 100)}%`}
                size={50}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{EchoTooltips.inputGain}</Tooltip>}
          >
            <div>
              <Knob
                value={echoInputGain}
                onChange={setEchoInputGain}
                min={0}
                max={1.5}
                step={0.01}
                label="Input Gain"
                displayValue={`${echoInputGain.toFixed(2)}x`}
                size={50}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{EchoTooltips.outputGain}</Tooltip>}
          >
            <div>
              <Knob
                value={echoOutputGain}
                onChange={setEchoOutputGain}
                min={0}
                max={1.5}
                step={0.01}
                label="Output Gain"
                displayValue={`${echoOutputGain.toFixed(2)}x`}
                size={50}
                color="#ffa500"
              />
            </div>
          </OverlayTrigger>
        </Col>
      </Row>

      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyEcho}
          >
            Apply Echo to Region
          </Button>
        </Col>
      </Row>

      {/* Help Modal */}
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>Understanding Echo Effects</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
          <h5 className="text-info mb-3">What is Echo?</h5>
          <p>
            Echo is a time-based effect that creates delayed repetitions of your original sound.
            Unlike reverb which simulates room reflections, echo creates distinct, audible repetitions
            that can be rhythmic or atmospheric.
          </p>

          <h5 className="text-info mt-4 mb-3">Echo vs Delay vs Reverb</h5>
          <ul>
            <li><strong>Echo:</strong> Discrete, audible repetitions (think: shouting in a canyon)</li>
            <li><strong>Delay:</strong> Technical term for the same effect, often with more control</li>
            <li><strong>Reverb:</strong> Dense, overlapping reflections that blend together (think: singing in a cathedral)</li>
          </ul>

          <h5 className="text-info mt-4 mb-3">Key Parameters</h5>
          <ul>
            <li><strong>Delay Time:</strong> The gap between echoes
              <ul>
                <li>50-200ms: Slapback echo (rockabilly, vocals)</li>
                <li>300-600ms: Rhythmic echoes</li>
                <li>600ms+: Ambient, spacey effects</li>
              </ul>
            </li>
            <li><strong>Feedback:</strong> How many times the echo repeats
              <ul>
                <li>0-30%: Single or few repeats</li>
                <li>30-60%: Multiple repeats that fade</li>
                <li>60-90%: Many repeats, use carefully</li>
                <li>90%+: Can create infinite loops!</li>
              </ul>
            </li>
          </ul>

          <h5 className="text-info mt-4 mb-3">Creative Uses</h5>
          <ul>
            <li><strong>Slapback:</strong> Short delay (100-150ms) with low feedback for vintage vocals</li>
            <li><strong>Rhythmic:</strong> Sync to tempo for musical repeats</li>
            <li><strong>Dub:</strong> High feedback with filtering for reggae/dub effects</li>
            <li><strong>Ping-Pong:</strong> Alternating left-right for wide stereo movement</li>
            <li><strong>Tape Echo:</strong> Add modulation for vintage analog character</li>
          </ul>

          <div className="alert alert-info mt-4">
            <strong>💡 Safety First:</strong> This echo effect has built-in safety features to protect your
            hearing and speakers. Feedback is limited to 80% maximum and gain controls are capped at 1.5x.
            Start with lower values and increase gradually for best results.
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
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