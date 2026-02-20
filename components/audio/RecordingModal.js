'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import { useRecording, useAudio } from '../../contexts/DAWProvider';

const RecordingModal = ({ show, onHide, onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);

  const { setAudioURL, addToEditHistory } = useAudio();
  const { mediaRecorder, setMediaRecorder, addTake } = useRecording();

  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartTime = useRef(null);
  const recordingDuration = useRef(0);


  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      setIsBlocked(false);
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(blob);

        // Use the duration we tracked during recording
        const duration = recordingDuration.current || 0;

        // Set the audio URL for the DAW
        setAudioURL(audioURL);
        addToEditHistory(audioURL);

        // Add to recording context with consistent format
        if (addTake) {
          addTake({
            data: blob,
            url: audioURL,
            mimeType: 'audio/webm',
            take: Date.now(),
            takeName: `Take 1`,
            timeStr: new Date().toLocaleTimeString(),
            duration: duration
          });
        }

        setHasRecording(true);

        // Call the completion callback
        if (onRecordingComplete) {
          onRecordingComplete(audioURL);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      recordingStartTime.current = Date.now();

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setIsBlocked(true);
    }
  }, [setAudioURL, addToEditHistory, addTake, setMediaRecorder, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Calculate duration before stopping
      if (recordingStartTime.current) {
        recordingDuration.current = (Date.now() - recordingStartTime.current) / 1000;
      }
      mediaRecorder.stop();
      setIsRecording(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [mediaRecorder]);

  const handleClose = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    onHide();
  }, [isRecording, stopRecording, onHide]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>Record Audio</Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-center py-4">
        {!hasRecording ? (
          <>
            <p className="mb-4">
              To use the single track editor, please record some audio first.
              Click the stop button when you're done recording.
            </p>

            {isBlocked && (
              <Alert variant="warning" className="mb-3">
                <strong>Microphone Access Denied</strong>
                <br />
                Please allow microphone access in your browser settings to record audio.
              </Alert>
            )}

            <div className="mb-3">
              {isRecording && (
                <div className="mb-3">
                  <h4 className="text-danger">Recording: {formatTime(recordingTime)}</h4>
                  <div className="recording-indicator d-inline-block">
                    <span className="recording-dot"></span>
                  </div>
                </div>
              )}
            </div>

            <div className="d-flex justify-content-center gap-3">
              {!isRecording ? (
                <Button
                  variant="danger"
                  size="lg"
                  onClick={startRecording}
                  disabled={isBlocked}
                >
                  <FaMicrophone className="me-2" />
                  Start Recording
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={stopRecording}
                >
                  <FaStop className="me-2" />
                  Stop Recording
                </Button>
              )}
            </div>
          </>
        ) : (
          <div>
            <Alert variant="success">
              <strong>Recording Complete!</strong>
              <br />
              Your audio has been loaded into the single track editor.
            </Alert>
            <Button variant="primary" onClick={handleClose}>
              Continue to Editor
            </Button>
          </div>
        )}
      </Modal.Body>

      {!hasRecording && (
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </Modal.Footer>
      )}

      <style jsx>{`
        .recording-dot {
          display: inline-block;
          width: 12px;
          height: 12px;
          background-color: #dc3545;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
          }
        }
      `}</style>
    </Modal>
  );
};

export default RecordingModal;