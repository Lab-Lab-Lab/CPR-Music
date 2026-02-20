'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaEdit, FaStop, FaMicrophone, FaRegTrashAlt } from 'react-icons/fa';
import { BiRename } from 'react-icons/bi';
import {
  Card,
  Form,
  Button,
  ListGroup,
  ListGroupItem,
  Row,
  Col,
} from 'react-bootstrap';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import {
  useAudio,
  useRecording,
  useFFmpeg,
  useUI,
  useEffects,
  useMultitrack,
} from '../contexts/DAWProvider';
import DAW from './audio/DAW';
import { AudioDropModal } from './audio/silenceDetect';
import { catchSilence, setupAudioContext } from '../lib/dawUtils';
import StatusIndicator from './statusIndicator';

// Create a silent audio buffer as scratch audio to initialize wavesurfer
const createSilentAudio = () => {
  if (typeof window === 'undefined') return '';

  try {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 0.1,
      audioContext.sampleRate,
    );
    const arrayBuffer = new ArrayBuffer(44 + buffer.length * 2);
    const view = new DataView(arrayBuffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, audioContext.sampleRate, true);
    view.setUint32(28, audioContext.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, buffer.length * 2, true);

    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }

    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Error creating silent audio:', e);
    return '';
  }
};

const scratchURL = createSilentAudio();

export default function RecorderRefactored({ submit, accompaniment, logOperation = null }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { slug, piece, actCategory, partType } = router.query;

  // Context hooks
  const { audioURL, setAudioURL, audioRef, addToEditHistory, clearHistory } = useAudio();

  const {
    isRecording,
    setIsRecording,
    isBlocked,
    setIsBlocked,
    mediaRecorder,
    setMediaRecorder,
    mimeType,
    setMimeType,
    recordingTime,
    setRecordingTime,
    takeNo,
    setTakeNo,
    activeTakeNo,
    setActiveTakeNo,
    blobInfo,
    setBlobInfo,
    blobURL,
    setBlobURL,
    blobData,
    setBlobData,
    chunksRef,
    accompanimentRef,
    silenceData,
    setSilenceData,
    ignoreSilence,
    setIgnoreSilence,
    showAudioDrop,
    setShowAudioDrop,
    getSupportedMimeType,
    addTake,
    deleteTake,
    clearRecordingData,
    isRecordingToTrack,
    setupTrackRecording,
    clearTrackRecording,
  } = useRecording();

  const { ffmpegRef, loaded: ffmpegLoaded } = useFFmpeg();
  const { showDAW, setShowDAW } = useUI();
  const { setFilters } = useEffects();
  const { tracks, setTrackAudio, updateTrack } = useMultitrack();

  // Track blob changes for multitrack recording
  const prevBlobURLRef = useRef(null);
  const prevIsRecordingRef = useRef(false);

  // Keep track of processed takes to avoid duplicates
  const processedTakesRef = useRef(new Set());

  // Fixed recording completion effect - apply recording to armed track
  useEffect(() => {
    // Detect when we've just stopped recording (transition from recording to not recording)
    const justStoppedRecording = prevIsRecordingRef.current && !isRecording;

    // Detect when we have a new blob URL
    const hasNewBlob = blobURL && blobURL !== prevBlobURLRef.current;

    console.log('Recording state check:', {
      justStoppedRecording,
      hasNewBlob,
      blobURL,
      prevBlobURL: prevBlobURLRef.current,
      isRecording,
      prevIsRecording: prevIsRecordingRef.current,
    });

    // If we just stopped recording AND have a new blob, apply to armed track
    if (justStoppedRecording && hasNewBlob) {
      const armedTrack = tracks.find((t) => t.armed);

      if (armedTrack) {
        console.log(
          'Recording complete, applying to armed track:',
          armedTrack.name,
          blobURL,
        );

        // Apply the recording to the armed track
        setTrackAudio(armedTrack.id, blobURL)
          .then(() => {
            console.log('Audio saved to track:', armedTrack.name);

            // Important: Update the track with the new audio URL and disarm it
            // This ensures the waveform component detects the change
            updateTrack(armedTrack.id, {
              armed: false,
              audioURL: blobURL,
              isRecording: false,
              // Force a re-render by updating a timestamp
              lastRecordingTime: Date.now(),
            });
          })
          .catch((error) => {
            console.error('Error setting track audio:', error);
          });
      }
    }

    // Update refs for next render
    prevBlobURLRef.current = blobURL;
    prevIsRecordingRef.current = isRecording;
  }, [blobURL, isRecording, tracks, setTrackAudio, updateTrack]);

  // Watch for new takes and apply to armed tracks in multitrack mode
  useEffect(() => {
    // Skip if no takes or if currently recording
    if (blobInfo.length === 0 || isRecording) return;

    // Get unprocessed takes
    const unprocessedTakes = blobInfo.filter(
      (take) => !processedTakesRef.current.has(take.url),
    );

    // Process each new take
    unprocessedTakes.forEach((take) => {
      console.log('📦 Processing new take:', take.take);

      // Mark as processed immediately to prevent reprocessing
      processedTakesRef.current.add(take.url);

      // Only apply to armed tracks if we're in DAW mode and not recording
      const armedTrack = tracks.find((t) => t.armed && !t.isRecording);

      if (armedTrack && showDAW && !isRecording) {
        console.log('🎯 Applying take to armed track:', armedTrack.name);

        // Apply the take
        setTrackAudio(armedTrack.id, take.url)
          .then(() => {
            console.log('✅ Take applied successfully');

            // Disarm the track and update its state
            updateTrack(armedTrack.id, {
              armed: false,
              isRecording: false,
              audioURL: take.url,
              lastRecordingTime: Date.now(),
            });
          })
          .catch((error) => {
            console.error('❌ Error applying take:', error);
            // Remove from processed if it failed
            processedTakesRef.current.delete(take.url);
          });
      }
    });
  }, [blobInfo, tracks, setTrackAudio, updateTrack, showDAW, isRecording]);

  // Create a ref to track current take number
  const takeNoRef = useRef(0);
  useEffect(() => {
    takeNoRef.current = takeNo;
  }, [takeNo]);

  // Add global error handler for AbortErrors
  useEffect(() => {
    const handleError = (event) => {
      if (event.error && event.error.name === 'AbortError') {
        event.preventDefault();
        console.log('Suppressed expected AbortError during audio operations');
        return false;
      }
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.name === 'AbortError') {
        event.preventDefault();
        console.log('Suppressed expected AbortError promise rejection');
      }
    });
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);
  
  // Initialize audio URL with scratch audio
  useEffect(() => {
    if (!audioURL) {
      setAudioURL(scratchURL);
    }
  }, [audioURL, setAudioURL]);

  // Initialize audio context and filters - only once
  useEffect(() => {
    if (typeof window !== 'undefined' && (audioURL || scratchURL)) {
      let initialized = false;

      const initAudioContext = () => {
        if (initialized) return;
        initialized = true;

        const result = setupAudioContext(audioURL || scratchURL);
        setFilters(result.filters);
        audioRef.current = result.audio;
      };

      const handleUserGesture = () => {
        initAudioContext();
        document.removeEventListener('click', handleUserGesture);
        document.removeEventListener('touchstart', handleUserGesture);
      };

      document.addEventListener('click', handleUserGesture);
      document.addEventListener('touchstart', handleUserGesture);

      return () => {
        document.removeEventListener('click', handleUserGesture);
        document.removeEventListener('touchstart', handleUserGesture);
      };
    }
  }, []); // Empty array - only run once on mount

  // Clear recording data when switching parts
  useEffect(() => {
    clearRecordingData();
  }, [partType]); // Only clear when partType changes

  // Clear processed takes when entering/leaving DAW mode
  useEffect(() => {
    if (showDAW) {
      // Clear processed takes when entering DAW mode to start fresh
      processedTakesRef.current.clear();
    }
  }, [showDAW]);

  // Initialize MediaRecorder
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      navigator?.mediaDevices?.getUserMedia
    ) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0,
          },
        })
        .then((stream) => {
          const supportedType = getSupportedMimeType();
          if (!supportedType) {
            console.error('No supported audio MIME type found');
            setIsBlocked(true);
            return;
          }
          setMimeType(supportedType);

          const recorder = new MediaRecorder(stream, {
            mimeType: supportedType,
          });

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          recorder.onerror = (event) => {
            console.log('MediaRecorder error suppressed:', event.error?.name || 'unknown');
          };
          
          recorder.onstop = () => {
            console.log('MediaRecorder.onstop called');
            const blob = new Blob(chunksRef.current, { type: supportedType });
            const url = URL.createObjectURL(blob);

            console.log('Created blob URL:', url, 'size:', blob.size);

            setBlobData(blob);
            setBlobURL(url);

            // Always add to takes list - keep it simple
            const currentTakeNo = takeNoRef.current + 1;
            addTake({
              url,
              data: blob,
              take: currentTakeNo,
              timeStr: new Date().toLocaleString(),
              mimeType: supportedType,
              takeName: null,
            });
            setTakeNo(currentTakeNo);

            chunksRef.current = [];
          };

          setMediaRecorder(recorder);
          setIsBlocked(false);
        })
        .catch((err) => {
          console.log('Permission Denied', err);
          setIsBlocked(true);
        });
    }
    // Re-initialize when tracks change or DAW visibility changes
  }, []); // Empty dependency array - only run once

  // Store per-take history and current URL
  const takeHistoryRef = useRef({}); // { takeNo: { currentURL, history } }
  const previousTakeNoRef = useRef(-1);

  // Update audio URL when active take changes
  useEffect(() => {
    if (activeTakeNo === -1) return;

    // Only run when activeTakeNo actually changes, not when blobInfo updates
    if (previousTakeNoRef.current === activeTakeNo) {
      return;
    }

    const take = blobInfo.find((o) => o.take === activeTakeNo);
    if (!take) return;

    previousTakeNoRef.current = activeTakeNo;

    // Get or initialize this take's state
    if (!takeHistoryRef.current[activeTakeNo]) {
      // First time loading this take - initialize with original recording
      takeHistoryRef.current[activeTakeNo] = {
        currentURL: take.url,
        originalURL: take.url
      };
    }

    // Always clear history when switching takes
    // Each take has independent undo/redo history
    clearHistory();

    // Load the take's current state (either original or last edited)
    const takeState = takeHistoryRef.current[activeTakeNo];
    addToEditHistory(takeState.currentURL, 'Load Take', { isTakeLoad: true });
  }, [activeTakeNo, blobInfo, addToEditHistory, clearHistory, setAudioURL]);

  // Track current URL changes to store per-take state
  useEffect(() => {
    if (activeTakeNo !== -1 && audioURL && takeHistoryRef.current[activeTakeNo]) {
      takeHistoryRef.current[activeTakeNo].currentURL = audioURL;
    }
  }, [audioURL, activeTakeNo]);

  // Recording timer
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => ({
          min: prev.sec === 59 ? prev.min + 1 : prev.min,
          sec: prev.sec === 59 ? 0 : prev.sec + 1,
        }));
      }, 1000);
    } else {
      setRecordingTime({ min: 0, sec: 0 });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, setRecordingTime]);

  const startRecording = useCallback(() => {
    if (isBlocked || !mediaRecorder) {
      console.error(
        'Cannot record, microphone permissions are blocked or recorder not ready',
      );
      return;
    }

    if (accompanimentRef.current) {
      accompanimentRef.current.play();
    }

    chunksRef.current = [];
    mediaRecorder.start(10);
    setIsRecording(true);
  }, [isBlocked, mediaRecorder, accompanimentRef, chunksRef, setIsRecording]);
  
  const stopRecording = useCallback(async () => {
    try {
      if (accompanimentRef.current) {
        accompanimentRef.current.pause();
        
        // Use a safer approach to reset audio
        try {
          if (accompanimentRef.current.readyState >= 1) {
            accompanimentRef.current.currentTime = 0;
          }
        } catch (timeError) {
          // Ignore timing errors during abort
          console.log('Ignored audio timing error during stop:', timeError.name);
        }
      }

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        // Set the active take to the one we just recorded
        setTimeout(() => {
          setActiveTakeNo(takeNoRef.current + 1);
        }, 100);
      }
      setIsRecording(false);
    } catch (error) {
      console.log('Suppressed error in stopRecording:', error.name);
      setIsRecording(false); // Ensure we still update state
    }
  }, [mediaRecorder, accompanimentRef, setIsRecording, setActiveTakeNo]);

  const handleDeleteTake = useCallback(
    (index) => {
      const takeToDelete = blobInfo[index];
      if (takeToDelete && takeToDelete.take === activeTakeNo) {
        setShowDAW(false);
      }
      deleteTake(index);
    },
    [blobInfo, activeTakeNo, setShowDAW, deleteTake],
  );

  const handleRename = useCallback((takeNumber) => {
    const nameInput = document.getElementById(`name-take-${takeNumber}`);
    const placeholder = document.getElementById(`plc-txt-${takeNumber}`);

    if (nameInput && placeholder) {
      if (nameInput.style.display === 'none') {
        nameInput.style.display = 'block';
        placeholder.style.display = 'none';
        nameInput.focus();
      } else {
        nameInput.style.display = 'none';
        placeholder.style.display = 'block';
      }
    }
  }, []);

  const submitEditedRecording = useCallback(
    async (url, activityLogData = null) => {
      if (!url || url === scratchURL) {
        alert('Please record audio before submitting');
        return;
      }

      try {
        if (!ignoreSilence && ffmpegLoaded) {
          const silenceResult = await catchSilence(
            ffmpegRef,
            url,
            '-30dB',  // Use proper dB format for cutoff threshold
            10,       // Duration in seconds to detect silence
            null,
          );
          setSilenceData(silenceResult);

          if (silenceResult?.silenceFlag) {
            setShowAudioDrop(true);
            return;
          }
        }

        const response = await fetch(url);
        // The blob from response.blob() should preserve the original MIME type
        const blob = await response.blob();
        console.log('📊 Submitting audio blob:', {
          size: blob.size,
          type: blob.type || 'unknown',
          url: url.substring(0, 50) + '...'
        });

        if (submit) {
          // IMPORTANT: Never modify the blob directly as it will corrupt it
          // Keep the blob pristine for submission

          if (activityLogData) {
            console.log('📊 Activity log data available, will be submitted separately');
            console.log('📊 Activity log size:', activityLogData.length, 'characters');

            // Store activity log in window for the submission handler to access
            // This is a temporary solution until the backend is updated to handle it properly
            if (typeof window !== 'undefined') {
              window.__PENDING_ACTIVITY_LOG__ = activityLogData;
              window.__PENDING_ACTIVITY_LOG_TIMESTAMP__ = new Date().toISOString();
            }
          }

          // Always submit the pristine blob - DO NOT MODIFY IT
          submit(blob);

          // Clear the pending activity log after a delay
          if (activityLogData && typeof window !== 'undefined') {
            setTimeout(() => {
              window.__PENDING_ACTIVITY_LOG__ = null;
              window.__PENDING_ACTIVITY_LOG_TIMESTAMP__ = null;
            }, 5000);
          }
        }
      } catch (error) {
        console.error('Error submitting recording:', error);
        alert('Error submitting recording. Please try again.');
      }
    },
    [
      ignoreSilence,
      ffmpegLoaded,
      ffmpegRef,
      setSilenceData,
      setShowAudioDrop,
      submit,
    ],
  );

  return (
    <>
      <Row>
        <Col>
          {isRecording ? (
            <Button onClick={stopRecording} className="mb-2 mt-2">
              <FaStop /> {String(recordingTime.min).padStart(2, '0')}:
              {String(recordingTime.sec).padStart(2, '0')}
            </Button>
          ) : (
            <Button onClick={startRecording} className="mb-2 mt-2">
              <FaMicrophone />
            </Button>
          )}
        </Col>
      </Row>

      <Row>
        <Col>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio 
            ref={accompanimentRef} 
            className='mb-2'
            onError={(e) => {
              console.log('Audio element error suppressed:', e.error?.name || 'unknown');
              e.preventDefault();
            }}
            onAbort={(e) => {
              console.log('Audio abort event suppressed');
              e.preventDefault();
            }}
          >
            <source src={accompaniment} type="audio/mpeg" />
          </audio>

          {blobInfo.length === 0 ? (
            <span className="mt-2">
              No takes yet. Click the microphone icon to record.
            </span>
          ) : (
            <ListGroup as="ol" numbered className="mt-2">
              <h3>Your Takes ({blobInfo.length})</h3>
              {blobInfo.map((take, i) => (
                <ListGroupItem
                  key={take.url}
                  as="li"
                  className="d-flex justify-content-between"
                  style={{ fontSize: '1rem', alignItems: 'center' }}
                >
                  <Form.Control
                    type="text"
                    placeholder={`Take ${take.take} -- ${take.timeStr}`}
                    id={`plc-txt-${take.take}`}
                    style={{ display: 'block' }}
                    value={
                      take.takeName || `Take ${take.take} -- ${take.timeStr}`
                    }
                    readOnly
                  />
                  <Form.Control
                    type="text"
                    placeholder={`Name your take`}
                    id={`name-take-${take.take}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const newBlobInfo = blobInfo.map((item, idx) => {
                        if (idx === i) {
                          return { ...item, takeName: e.target.value };
                        }
                        return item;
                      });
                      setBlobInfo(newBlobInfo);
                    }}
                  />
                  <div className="d-flex align-items-center gap-1">
                    <BiRename onClick={() => handleRename(take.take)} />
                    <Button
                      size="sm"
                      variant="success"
                      style={{ fontSize: '0.6rem' }}
                      onClick={() => {
                        setActiveTakeNo(take.take);
                        setShowDAW(true);
                      }}
                    >
                      <FaEdit /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      style={{ fontSize: '0.6rem' }}
                      onClick={() => handleDeleteTake(i)}
                    >
                      <FaRegTrashAlt /> Delete
                    </Button>
                  </div>
                </ListGroupItem>
              ))}
            </ListGroup>
          )}
          {showDAW && audioURL && audioURL !== scratchURL && (
            <DAW
              onSubmit={submitEditedRecording}
              showSubmitButton={true}
              logOperation={logOperation}
            />
          )}
          {showDAW && (!audioURL || audioURL === scratchURL) && (
            <div className="text-center py-3">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading audio...</span>
              </div>
              <p className="mt-2">Loading take...</p>
            </div>
          )}
          <StatusIndicator
            slug={slug}
            piece={piece}
            partType={partType}
            actCategory={actCategory}
          />
        </Col>
      </Row>
      <AudioDropModal
        show={showAudioDrop}
        silenceData={silenceData}
        onIgnore={() => {
          setIgnoreSilence(true);
          setShowAudioDrop(false);
          // Pass null for activity log when retrying after silence warning
          submitEditedRecording(audioURL, null);
        }}
        onUploadNew={() => setShowAudioDrop(false)}
      />
    </>
  );
}
