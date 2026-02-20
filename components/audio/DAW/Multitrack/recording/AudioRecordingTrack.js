// components/audio/DAW/Multitrack/recording/AudioRecordingTrack.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from 'react-bootstrap';
import { FaCircle, FaStop } from 'react-icons/fa';
import RecordingManager from './RecordingManager';

export default function AudioRecordingTrack({
  track,
  mediaStream = null,
  zoomLevel = 100,
  onRecordingComplete,
  getTransportTime
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countdownValue, setCountdownValue] = useState(0);
  const [localMediaStream, setLocalMediaStream] = useState(mediaStream);
  const isMountedRef = useRef(true);

  // Use provided mediaStream or initialize our own
  useEffect(() => {
    if (mediaStream) {
      // Use the provided media stream
      setLocalMediaStream(mediaStream);
      return;
    }

    // Otherwise, initialize our own media stream
    let stream = null;

    const initMediaStream = async () => {
      try {
        console.log(`🎤 AudioRecordingTrack: Initializing media stream for track ${track.id}`);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0
          }
        });

        if (isMountedRef.current) {
          setLocalMediaStream(stream);
          console.log(`🎤 AudioRecordingTrack: Media stream ready for track ${track.id}`);
        }
      } catch (error) {
        console.error(`🎤 AudioRecordingTrack: Error accessing microphone:`, error);
      }
    };

    if (!mediaStream) {
      initMediaStream();
    }

    // Cleanup only if we created our own stream
    return () => {
      isMountedRef.current = false;
      if (!mediaStream && stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log(`🎤 AudioRecordingTrack: Media stream stopped for track ${track.id}`);
      }
    };
  }, [track.id, mediaStream]);

  // Subscribe to RecordingManager events
  useEffect(() => {
    const handleCountdownStart = ({ trackId, countdown }) => {
      if (trackId === track.id) {
        setIsCountingIn(true);
        setCountdownValue(countdown);
        console.log(`🎤 AudioRecordingTrack: Countdown started for track ${track.id}`);
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
        console.log(`🎤 AudioRecordingTrack: Countdown complete for track ${track.id}`);
      }
    };

    const handleRecordingStart = ({ trackId, type }) => {
      if (trackId === track.id && type === 'audio') {
        setIsRecording(true);
        setIsCountingIn(false);
        console.log(`🎤 AudioRecordingTrack: Recording started for track ${track.id}`);
      }
    };

    const handleRecordingStop = ({ trackId, type }) => {
      if (trackId === track.id && type === 'audio') {
        setIsRecording(false);
        setIsCountingIn(false);
        console.log(`🎤 AudioRecordingTrack: Recording stopped for track ${track.id}`);
      }
    };

    const handleRecordingComplete = (data) => {
      if (data.trackId === track.id) {
        console.log(`🎤 AudioRecordingTrack: Recording complete for track ${track.id}`, {
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
    RecordingManager.on('audio-recording-complete', handleRecordingComplete);

    // Cleanup
    return () => {
      RecordingManager.off('countdown-start', handleCountdownStart);
      RecordingManager.off('countdown-update', handleCountdownUpdate);
      RecordingManager.off('countdown-complete', handleCountdownComplete);
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      RecordingManager.off('audio-recording-complete', handleRecordingComplete);
    };
  }, [track.id, onRecordingComplete]);

  // Handle record button click
  const handleRecord = async () => {
    console.log(`🎤 AudioRecordingTrack: Record button clicked for track ${track.id}`, {
      isRecording,
      isCountingIn,
      hasMediaStream: !!mediaStream
    });

    if (isRecording || isCountingIn) {
      // Stop recording or cancel countdown
      RecordingManager.stopRecording(track.id);
    } else if (localMediaStream) {
      // Get current position from transport
      const startPosition = getTransportTime ? getTransportTime() : 0;

      // Start recording
      await RecordingManager.startRecording(track.id, 'audio', {
        mediaStream: localMediaStream,
        startPosition
      });
    } else {
      console.error(`🎤 AudioRecordingTrack: Cannot start recording - no media stream`);
    }
  };

  return (
    <div className="audio-recording-controls">
      {!isRecording ? (
        <Button
          size="sm"
          variant={isCountingIn ? 'danger' : 'outline-danger'}
          onClick={handleRecord}
          disabled={!localMediaStream}
          title={isCountingIn ? `Countdown: ${countdownValue}` : 'Start Recording'}
        >
          {isCountingIn ? countdownValue : <FaCircle />}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="warning"
          onClick={handleRecord}
          title="Stop Recording"
        >
          <FaStop />
        </Button>
      )}
    </div>
  );
}