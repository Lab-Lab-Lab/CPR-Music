// components/audio/DAW/Multitrack/EffectsPanel.js
'use client';

import { useState } from 'react';
import { Button, Form, Card, Alert, ProgressBar } from 'react-bootstrap';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import TrackEffectsProcessor from './TrackEffectsProcessor';

const AVAILABLE_EFFECTS = [
  { id: 'reverb', name: 'Reverb', category: 'Space' },
  { id: 'echo', name: 'Echo', category: 'Space' },
  { id: 'delay', name: 'Delay', category: 'Time' },
  { id: 'chorus', name: 'Chorus', category: 'Modulation' },
  { id: 'flanger', name: 'Flanger', category: 'Modulation' },
  { id: 'phaser', name: 'Phaser', category: 'Modulation' },
  { id: 'distortion', name: 'Distortion', category: 'Dynamics' },
  { id: 'compressor', name: 'Compressor', category: 'Dynamics' },
  { id: 'gate', name: 'Gate', category: 'Dynamics' },
  { id: 'eq', name: 'EQ', category: 'Frequency' },
  { id: 'pitch', name: 'Pitch Shift', category: 'Pitch' },
  { id: 'tremolo', name: 'Tremolo', category: 'Modulation' },
  { id: 'autopan', name: 'Auto Pan', category: 'Space' },
];

// Default parameters for each effect
const DEFAULT_PARAMETERS = {
  reverb: { mix: 0.3, preset: 'mediumHall' },
  echo: { time: 250, feedback: 0.5, mix: 0.5 },
  delay: { time: 500, feedback: 0.5, mix: 0.5 },
  chorus: { rate: 1, depth: 0.5, mix: 0.5 },
  flanger: { rate: 0.5, depth: 0.002, feedback: 0.5, delay: 0.005, mix: 0.5 },
  phaser: { rate: 0.5, depth: 1000, mix: 0.5 },
  distortion: { amount: 50, outputGain: 0.7 },
  compressor: {
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.1,
    knee: 30,
    makeup: 0,
  },
  gate: { threshold: -40 },
  eq: {
    bands: [
      { frequency: 100, gain: 0 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: 0 },
    ],
  },
  pitch: { shift: 0 },
  tremolo: { rate: 5, depth: 0.5 },
  autopan: { rate: 1, depth: 0.8 },
};

export default function EffectsPanel() {
  const { tracks, updateTrack, selectedTrackId } = useMultitrack();
  const [selectedEffect, setSelectedEffect] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Group effects by category
  const effectsByCategory = AVAILABLE_EFFECTS.reduce((acc, effect) => {
    if (!acc[effect.category]) {
      acc[effect.category] = [];
    }
    acc[effect.category].push(effect);
    return acc;
  }, {});

  const handleApplyEffect = async () => {
    if (!selectedEffect || !selectedTrackId) {
      return;
    }

    // Find the selected track
    const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
    if (!selectedTrack || !selectedTrack.wavesurferInstance) {
      setError('Please select a track with audio');
      return;
    }

    // Get regions from the selected track
    const regionsPlugin = selectedTrack.regionsPlugin;

    if (!regionsPlugin) {
      setError('No regions available on selected track');
      return;
    }

    const regions = regionsPlugin.getRegions();
    if (regions.length === 0) {
      setError('Please create at least one region on the selected track');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      setProgress(10);

      // Get the audio buffer from wavesurfer
      const wavesurfer = selectedTrack.wavesurferInstance;
      const audioBuffer = await wavesurfer.getDecodedData();

      if (!audioBuffer) {
        throw new Error('No audio loaded in track');
      }

      setProgress(20);

      // Create audio context
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Get default parameters for the effect
      const parameters = DEFAULT_PARAMETERS[selectedEffect] || {};

      // Sort regions by start time (process from end to beginning)
      const sortedRegions = [...regions].sort((a, b) => b.start - a.start);

      // Process each region
      let processedBuffer = audioBuffer;
      const totalRegions = sortedRegions.length;

      for (let i = 0; i < sortedRegions.length; i++) {
        const region = sortedRegions[i];
        const progressPercent = 20 + (60 * (i + 1)) / totalRegions;
        setProgress(progressPercent);

        processedBuffer = await TrackEffectsProcessor.processRegion(
          processedBuffer,
          region.start,
          region.end,
          selectedEffect,
          parameters,
          audioContext,
        );
      }

      setProgress(85);

      // Convert processed buffer to blob
      const wav = await TrackEffectsProcessor.audioBufferToWav(processedBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      setProgress(90);

      // Clear all regions
      regions.forEach((region) => {
        try {
          region.remove();
        } catch (e) {
          console.warn('Error removing region:', e);
        }
      });

      // Update the track with the new audio
      updateTrack(selectedTrack.id, { audioURL: url });

      // Re-enable region creation after a short delay
      setTimeout(() => {
        if (regionsPlugin && regionsPlugin.enableDragSelection) {
          regionsPlugin.enableDragSelection({
            color: 'rgba(155, 115, 215, 0.4)',
          });
        }
      }, 100);

      setProgress(100);
      setSuccess(
        `${selectedEffect} effect applied to ${totalRegions} region${totalRegions > 1 ? 's' : ''}!`,
      );

      // Reset after a delay
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setSuccess(null);
      }, 2000);
    } catch (err) {
      console.error('Error applying effect:', err);
      setError(err.message);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const hasSelectedTrack = selectedTrack && selectedTrack.wavesurferInstance;
  const canApplyEffect = hasSelectedTrack && selectedEffect && !isProcessing;

  return (
    <Card className="effects-panel h-100">
      <Card.Header>
        <Card.Title>Effects</Card.Title>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && <Alert variant="success">{success}</Alert>}

        {!hasSelectedTrack && (
          <Alert variant="info">Select a track to apply effects</Alert>
        )}

        {hasSelectedTrack && (
          <>
            <Alert variant="info" className="small">
              <strong>Active Track:</strong> {selectedTrack.name}
              <br />
              <small>
                Click and drag to create regions. Double-click to delete them.
              </small>
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Select Effect</Form.Label>
              <Form.Select
                value={selectedEffect}
                onChange={(e) => setSelectedEffect(e.target.value)}
                disabled={!hasSelectedTrack || isProcessing}
              >
                <option value="">Choose an effect...</option>
                {Object.entries(effectsByCategory).map(
                  ([category, effects]) => (
                    <optgroup key={category} label={category}>
                      {effects.map((effect) => (
                        <option key={effect.id} value={effect.id}>
                          {effect.name}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </Form.Select>
            </Form.Group>

            {isProcessing && (
              <ProgressBar
                now={progress}
                label={`${progress}%`}
                animated
                striped
                className="mb-3"
              />
            )}

            <Button
              variant="primary"
              onClick={handleApplyEffect}
              disabled={!canApplyEffect}
              className="w-100"
            >
              {isProcessing ? 'Processing...' : 'Apply Effect'}
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
