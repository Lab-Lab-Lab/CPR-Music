// components/audio/DAW/Multitrack/recording/MIDIRecordingTrack.js
'use client';

import { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { FaCircle, FaStop } from 'react-icons/fa';
import RecordingManager from './RecordingManager';

export default function MIDIRecordingTrack({
  track,
  midiInputId = null,
  onRecordingComplete,
  getTransportTime
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countdownValue, setCountdownValue] = useState(0);

  // Subscribe to RecordingManager events
  useEffect(() => {
    const handleCountdownStart = ({ trackId, countdown }) => {
      if (trackId === track.id) {
        setIsCountingIn(true);
        setCountdownValue(countdown);
        console.log(`🎹 MIDIRecordingTrack: Countdown started for track ${track.id}`);
      }
    };

    const handleCountdownUpdate = ({ trackId, value }) => {
      if (trackId === track.id) {
        setCountdownValue(value);
      }
    };

    const handleCountdownComplete = ({ trackId }) => {
      if (trackId === track.id) {
        setIsCountingIn(false);
        setCountdownValue(0);
        console.log(`🎹 MIDIRecordingTrack: Countdown complete for track ${track.id}`);
      }
    };

    const handleRecordingStart = ({ trackId, type }) => {
      if (trackId === track.id && type === 'midi') {
        setIsRecording(true);
        setIsCountingIn(false);
        console.log(`🎹 MIDIRecordingTrack: Recording started for track ${track.id}`);
      }
    };

    const handleRecordingStop = ({ trackId, type }) => {
      if (trackId === track.id && type === 'midi') {
        setIsRecording(false);
        setIsCountingIn(false);
        console.log(`🎹 MIDIRecordingTrack: Recording stopped for track ${track.id}`);
      }
    };

    const handleRecordingComplete = (data) => {
      if (data.trackId === track.id) {
        console.log(`🎹 MIDIRecordingTrack: Recording complete for track ${track.id}`, {
          notes: data.notes?.length || 0,
          duration: data.duration,
          startPosition: data.startPosition
        });

        // Notify parent component
        if (onRecordingComplete) {
          onRecordingComplete({
            ...data,
            trackId: track.id
          });
        }
      }
    };

    // Subscribe to events
    RecordingManager.on('countdown-start', handleCountdownStart);
    RecordingManager.on('countdown-update', handleCountdownUpdate);
    RecordingManager.on('countdown-complete', handleCountdownComplete);
    RecordingManager.on('recording-start', handleRecordingStart);
    RecordingManager.on('recording-stop', handleRecordingStop);
    RecordingManager.on('midi-recording-complete', handleRecordingComplete);

    // Cleanup
    return () => {
      RecordingManager.off('countdown-start', handleCountdownStart);
      RecordingManager.off('countdown-update', handleCountdownUpdate);
      RecordingManager.off('countdown-complete', handleCountdownComplete);
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      RecordingManager.off('midi-recording-complete', handleRecordingComplete);
    };
  }, [track.id, onRecordingComplete]);

  // Handle record button click
  const handleRecord = async () => {
    console.log(`🎹 MIDIRecordingTrack: Record button clicked for track ${track.id}`, {
      isRecording,
      isCountingIn,
      midiInputId
    });

    if (isRecording || isCountingIn) {
      // Stop recording or cancel countdown
      RecordingManager.stopRecording(track.id);
    } else {
      // Get current position from transport
      const startPosition = getTransportTime ? getTransportTime() : 0;

      // Get tempo from track
      const tempo = track.midiData?.tempo || 120;

      // Start recording
      await RecordingManager.startRecording(track.id, 'midi', {
        midiInput: midiInputId,
        startPosition,
        tempo
      });
    }
  };

  return (
    <div className="midi-recording-controls">
      {!isRecording ? (
        <Button
          size="sm"
          variant={isCountingIn ? 'danger' : 'outline-danger'}
          onClick={handleRecord}
          title={isCountingIn ? `Countdown: ${countdownValue}` : 'Start MIDI Recording'}
        >
          {isCountingIn ? countdownValue : <FaCircle />}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="warning"
          onClick={handleRecord}
          title="Stop MIDI Recording"
        >
          <FaStop />
        </Button>
      )}
    </div>
  );
}