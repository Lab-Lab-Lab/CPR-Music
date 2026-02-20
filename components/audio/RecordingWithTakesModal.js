'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  Button,
  Alert,
  Table,
  Form,
  ButtonGroup,
  Container,
  Row,
  Col
} from 'react-bootstrap';
import {
  FaMicrophone,
  FaStop,
  FaPlay,
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimes
} from 'react-icons/fa';
import { useRecording, useAudio } from '../../contexts/DAWProvider';

const RecordingWithTakesModal = ({ show, onHide, mode = 'full' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingTake, setEditingTake] = useState(null);
  const [editingName, setEditingName] = useState('');

  const { setAudioURL, addToEditHistory } = useAudio();
  const {
    mediaRecorder,
    setMediaRecorder,
    addTake,
    blobInfo,
    activeTakeNo,
    setActiveTakeNo,
    deleteTake,
    renameTake
  } = useRecording();

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

        // Add the new take with consistent formatting
        const newTake = {
          data: blob,
          url: audioURL,
          mimeType: 'audio/webm',
          take: Date.now(),
          takeName: `Take ${blobInfo.length + 1}`,
          timeStr: new Date().toLocaleTimeString(),
          duration: duration
        };

        if (addTake) {
          addTake(newTake);
        }

        // Automatically load the new take
        setAudioURL(audioURL);
        addToEditHistory(audioURL);
        if (setActiveTakeNo) {
          setActiveTakeNo(newTake.take);
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
  }, [setAudioURL, addToEditHistory, addTake, setMediaRecorder, blobInfo, setActiveTakeNo]);

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

  const loadTake = useCallback((take) => {
    setAudioURL(take.url);
    addToEditHistory(take.url);
    if (setActiveTakeNo) {
      setActiveTakeNo(take.take);
    }
  }, [setAudioURL, addToEditHistory, setActiveTakeNo]);

  const handleDeleteTake = useCallback((index) => {
    if (confirm('Are you sure you want to delete this take?')) {
      deleteTake(index);
    }
  }, [deleteTake]);

  const startEditingName = useCallback((take, index) => {
    setEditingTake(index);
    setEditingName(take.takeName || `Take ${index + 1}`);
  }, []);

  const saveEditingName = useCallback((index) => {
    if (renameTake) {
      renameTake(index, editingName);
    }
    setEditingTake(null);
    setEditingName('');
  }, [renameTake, editingName]);

  const cancelEditingName = useCallback(() => {
    setEditingTake(null);
    setEditingName('');
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (take) => {
    if (take.duration && isFinite(take.duration) && take.duration > 0) {
      const mins = Math.floor(take.duration / 60);
      const secs = Math.floor(take.duration % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return '--:--';
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recording & Takes Management</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Takes Table Section */}
        {blobInfo && blobInfo.length > 0 && (
          <div className="mb-4">
            <h5 className="mb-3">Existing Takes</h5>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <Table striped hover size="sm">
                <thead>
                  <tr>
                    <th width="30">#</th>
                    <th>Name</th>
                    <th width="80">Duration</th>
                    <th width="100">Recorded</th>
                    <th width="120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blobInfo.map((take, index) => (
                    <tr
                      key={take.take}
                      className={activeTakeNo === take.take ? 'table-primary' : ''}
                    >
                      <td>{index + 1}</td>
                      <td>
                        {editingTake === index ? (
                          <div className="d-flex gap-1">
                            <Form.Control
                              size="sm"
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditingName(index);
                                if (e.key === 'Escape') cancelEditingName();
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => saveEditingName(index)}
                            >
                              <FaCheck />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={cancelEditingName}
                            >
                              <FaTimes />
                            </Button>
                          </div>
                        ) : (
                          <span onClick={() => startEditingName(take, index)} style={{ cursor: 'pointer' }}>
                            {take.takeName || `Take ${index + 1}`}
                          </span>
                        )}
                      </td>
                      <td>{formatDuration(take)}</td>
                      <td>{take.timeStr || new Date(take.take).toLocaleTimeString()}</td>
                      <td>
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-primary"
                            onClick={() => loadTake(take)}
                            disabled={activeTakeNo === take.take}
                            title="Load this take"
                          >
                            <FaPlay />
                          </Button>
                          <Button
                            variant="outline-secondary"
                            onClick={() => startEditingName(take, index)}
                            title="Rename this take"
                          >
                            <FaEdit />
                          </Button>
                          <Button
                            variant="outline-danger"
                            onClick={() => handleDeleteTake(index)}
                            title="Delete this take"
                          >
                            <FaTrash />
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}

        {/* Recording Section */}
        <div className="text-center py-3">
          <h5 className="mb-3">Record New Take</h5>

          {isBlocked && (
            <Alert variant="warning" className="mb-3">
              <strong>Microphone Access Denied</strong>
              <br />
              Please allow microphone access in your browser settings to record audio.
            </Alert>
          )}

          {isRecording && (
            <div className="mb-3">
              <h4 className="text-danger">Recording: {formatTime(recordingTime)}</h4>
              <div className="recording-indicator d-inline-block">
                <span className="recording-dot"></span>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-center gap-3">
            {!isRecording ? (
              <Button
                variant="danger"
                size="lg"
                onClick={startRecording}
                disabled={isBlocked}
              >
                <FaMicrophone className="me-2" />
                Record New Take
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
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>

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

export default RecordingWithTakesModal;