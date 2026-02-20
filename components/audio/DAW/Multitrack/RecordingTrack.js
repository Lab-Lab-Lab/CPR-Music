// components/audio/DAW/Multitrack/RecordingTrack.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Form, ButtonGroup, ProgressBar } from 'react-bootstrap';
import {
  FaCircle,
  FaStop,
  FaVolumeUp,
  FaFileImport,
  FaTrash,
} from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import WalkingWaveform from './WalkingWaveform';
import TrackClipCanvas from '../../../../contexts/TrackClipCanvas';
import ClipPlayer from './ClipPlayer';
import audioContextManager from './AudioContextManager';
import { decodeAudioFromURL } from './AudioEngine';
import waveformCache from './WaveformCache';
import { getAudioProcessor } from './AudioProcessor';

export default function RecordingTrack({ track, index, zoomLevel = 100 }) {
  const {
    updateTrack,
    removeTrack,
    setSelectedTrackId,
    selectedTrackId,
    soloTrackId,
    setSoloTrackId,
    currentTime,
    duration,
    isPlaying,
    play,
    stop,
    startRecordingTimer,
    stopRecordingTimer,
  } = useMultitrack();

  const [mediaStream, setMediaStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);
  const [controlTab, setControlTab] = useState('vol'); // 'vol' | 'pan'
  const [recordedBlob, setRecordedBlob] = useState(null);

  // Advanced import state from Track.js
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingState, setLoadingState] = useState('idle'); // 'idle', 'reading', 'decoding', 'generating-waveform', 'complete', 'error'
  const [processingMethod, setProcessingMethod] = useState('unknown'); // 'worker', 'main-thread', 'unknown'
  const [isDragOver, setIsDragOver] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const clipPlayerRef = useRef(null);

  // Initialize media stream
  useEffect(() => {
    const initMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setMediaStream(stream);
        console.log('RecordingTrack: Media stream initialized');
      } catch (error) {
        console.error('RecordingTrack: Error accessing microphone:', error);
      }
    };

    initMediaStream();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Only run once on mount

  // Initialize clip player for playback when not recording
  useEffect(() => {
    const initPlayer = async () => {
      try {
        const audioContext = audioContextManager.getContext();
        clipPlayerRef.current = new ClipPlayer(audioContext);
      } catch (error) {
        console.error('RecordingTrack: Error initializing clip player:', error);
      }
    };

    initPlayer();

    return () => {
      if (clipPlayerRef.current) {
        clipPlayerRef.current.dispose();
      }
    };
  }, []);

  // Update clips/params on player
  useEffect(() => {
    if (!clipPlayerRef.current || !track.clips) return;
    (async () => {
      try {
        await clipPlayerRef.current.updateClips(
          track.clips,
          track.muted ? 0 : track.volume || 1,
          track.pan || 0,
        );
        if (isPlaying && clipPlayerRef.current) {
          clipPlayerRef.current.play(currentTime);
        }
      } catch (error) {
        console.error(
          `RecordingTrack: Error updating clips for ${track.id}:`,
          error,
        );
      }
    })();
  }, [track.clips, track.volume, track.pan, track.muted]);

  // Handle global play/stop
  useEffect(() => {
    if (!clipPlayerRef.current) return;
    const shouldPlay = soloTrackId ? track.id === soloTrackId : !track.muted;
    if (isPlaying && shouldPlay && !isRecording) {
      const ctx = audioContextManager.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => clipPlayerRef.current.play(currentTime));
      } else {
        clipPlayerRef.current.play(currentTime);
      }
    } else {
      clipPlayerRef.current.stop();
    }
  }, [isPlaying, currentTime, track.id, track.muted, soloTrackId, isRecording]);

  // Seek when paused
  useEffect(() => {
    if (!clipPlayerRef.current || isPlaying || isRecording) return;
    clipPlayerRef.current.seek(currentTime);
  }, [currentTime, isPlaying, isRecording]);

  // Debug: Monitor isRecording state changes
  useEffect(() => {
    console.log('RecordingTrack: isRecording changed to:', isRecording);
  }, [isRecording]);

  // No need to calculate pixelsPerSecond here - let WalkingWaveform handle it
  // to ensure consistency with TrackClipCanvas

  const handleRecord = () => {
    console.log('RecordingTrack: handleRecord called', { isRecording, isCountingIn });

    if (isRecording || isCountingIn) {
      // Stop recording or cancel countdown
      if (isRecording) {
        stopRecording();
      }
      setIsCountingIn(false);
      setCountInBeat(0);
    } else {
      // Start countdown
      console.log('RecordingTrack: Starting countdown...');
      setIsCountingIn(true);
      setCountInBeat(3);

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setCountInBeat((prev) => {
          console.log('RecordingTrack: Countdown beat:', prev);
          if (prev <= 1) {
            // Start recording
            console.log('RecordingTrack: Countdown finished, starting recording...');
            clearInterval(countdownInterval);
            setIsCountingIn(false);
            setCountInBeat(0);
            startRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const startRecording = () => {
    console.log('RecordingTrack: startRecording called', {
      hasMediaStream: !!mediaStream,
      isAlreadyRecording: isRecording,
      canRecord: !isRecording && mediaStream,
      currentTime,
    });

    if (isRecording || !mediaStream) {
      console.error('RecordingTrack: Cannot start recording', {
        isRecording,
        hasMediaStream: !!mediaStream,
      });
      return;
    }

    chunksRef.current = [];

    // Capture current playhead position when recording starts
    const recordingStartPosition = currentTime;

    // Determine MIME type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    console.log('RecordingTrack: Using MIME type:', mimeType);
    console.log(
      'RecordingTrack: Recording will start at position:',
      recordingStartPosition,
    );

    // Create MediaRecorder
    const recorder = new MediaRecorder(mediaStream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);

      console.log('Recording stopped, blob created:', blob);

      // Get audio duration using Web Audio API
      let audioDuration = 0;
      try {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioDuration = audioBuffer.duration;
        console.log('Audio duration:', audioDuration);
      } catch (error) {
        console.error('Error getting audio duration:', error);
        audioDuration = 10; // fallback duration
      }

      // Create a clip at the position where recording started
      const newClip = {
        id: `clip-${track.id}-${Date.now()}`,
        start: recordingStartPosition, // Use the stored start position
        duration: audioDuration,
        src: url,
        offset: 0,
        color: track.color || '#ff6b6b',
        name: `Recording ${new Date().toLocaleTimeString()}`,
      };

      // Update the track with the recorded audio AND the clip
      updateTrack(track.id, {
        audioURL: url,
        isRecording: false,
        isEmpty: false,
        clips: [...(track.clips || []), newClip],
        // Keep type as 'recording' to avoid component swap
        recordingStartPosition: undefined,
      });

      setRecordedBlob(blob);
      setIsRecording(false);

      // Important: Update duration in multitrack context if needed
      if (
        audioDuration > 0 &&
        recordingStartPosition + audioDuration > duration
      ) {
        // This will trigger duration update in MultitrackContext
        setTimeout(() => {
          updateTrack(track.id, {
            duration: recordingStartPosition + audioDuration,
          });
        }, 100);
      }
    };

    // Start recording
    recorder.start(10); // Collect data every 10ms
    setIsRecording(true);
    console.log('RecordingTrack: Recording started, setIsRecording(true) called');

    // Start the recording timer to advance playhead during recording
    startRecordingTimer();

    // Update track to show recording state AND store start position
    updateTrack(track.id, {
      isRecording: true,
      recordingStartPosition: recordingStartPosition,
    });
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
    
    // Stop the recording timer
    stopRecordingTimer();
    
    setIsRecording(false);
  };

  // Handlers to mirror Audio Track controls
  const handleRemove = () => {
    if (window.confirm('Remove this track?')) {
      removeTrack(track.id);
    }
  };

  // Progress update helper for advanced import
  const updateLoadingProgress = (state, progress) => {
    setLoadingState(state);
    setLoadingProgress(progress);
    console.log(`🔄 Loading ${state}: ${Math.round(progress)}%`);
  };

  // Advanced file import from Track.js - Hybrid Worker/Fallback approach
  const processAudioFile = async (file) => {
    if (!file || !file.type.startsWith('audio/')) return;

    setIsLoading(true);
    setProcessingMethod('unknown');
    updateLoadingProgress('reading', 0);
    
    let clipId = null;
    const audioProcessor = getAudioProcessor();

    try {
      const url = URL.createObjectURL(file);
      updateLoadingProgress('reading', 10);

      // Phase 1: Create immediate placeholder clip
      clipId = `clip-${track.id}-${Date.now()}`;
      const placeholderClip = {
        id: clipId,
        start: 0,
        duration: 0, // Will update when processed
        color: track.color || '#7bafd4',
        src: url,
        offset: 0,
        name: file.name.replace(/\.[^/.]+$/, ''),
        isLoading: true,
        loadingState: 'reading'
      };

      // Immediately add track with placeholder - UI stays responsive!
      updateTrack(track.id, {
        audioURL: url,
        clips: [...(track.clips || []), placeholderClip]
      });

      // Phase 2: Process with hybrid approach (Worker or Main Thread)
      const result = await audioProcessor.processAudioFile(
        url,
        clipId,
        (stage, progress) => {
          updateLoadingProgress(stage, progress);
          
          // Update clip loading state in real-time
          updateTrack(track.id, (prevTrack) => ({
            ...prevTrack,
            clips: prevTrack.clips.map(clip =>
              clip.id === clipId
                ? { ...clip, loadingState: stage }
                : clip
            )
          }));
        }
      );

      // Set processing method indicator
      setProcessingMethod(result.method);
      console.log(`🔧 Audio processed using: ${result.method}`);

      // Phase 3: Update clip with final data
      const finalClip = {
        ...placeholderClip,
        duration: result.duration,
        isLoading: false,
        loadingState: 'complete',
        processingMethod: result.method
      };

      updateTrack(track.id, (prevTrack) => ({
        ...prevTrack,
        clips: prevTrack.clips.map(clip =>
          clip.id === clipId ? finalClip : clip
        )
      }));

      updateLoadingProgress('complete', 100);

      // Phase 4: Cache peaks if not already cached by worker
      if (result.peaks) {
        // Store peaks in cache for immediate use
        console.log(`✅ Peaks ready (${result.peaks.length} samples)`);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      console.error('Error importing file:', err);
      updateLoadingProgress('error', 100);
      
      // Update clip to show error state
      if (clipId) {
        updateTrack(track.id, (prevTrack) => ({
          ...prevTrack,
          clips: prevTrack.clips.map(clip => 
            clip.id === clipId 
              ? { ...clip, isLoading: false, loadingState: 'error', hasError: true }
              : clip
          )
        }));
      }
    } finally {
      // Keep loading indicators for a moment to show completion
      setTimeout(() => {
        setIsLoading(false);
        setLoadingProgress(0);
        setLoadingState('idle');
        setProcessingMethod('unknown');
      }, 1500);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    await processAudioFile(file);
  };

  // Drag and drop handlers from Track.js
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/')) {
        await processAudioFile(file);
      }
    }
  };

  const isSelected = selectedTrackId === track.id;
  const isSolo = soloTrackId === track.id;

  // Otherwise, render the recording interface
  return (
    <div className="track-container" style={{ display: 'flex' }}>
      {/* Sidebar spacer - matches timeline sidebar */}
      <div
        className="track-sidebar"
        style={{
          width: '80px',
          backgroundColor: '#1e1e1e',
          borderRight: '1px solid #3a3a3a',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Track number with recording indicator */}
        <span
          style={{
            color: isRecording ? '#ff6b6b' : '#666',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isRecording && <FaCircle size={8} />}
          {index + 1}
        </span>
      </div>

      {/* Main track div */}
      <div
        className={`track recording-track ${isSelected ? 'track-selected' : ''}`}
        onClick={() => setSelectedTrackId(track.id)}
        style={{ display: 'flex', flex: 1 }}
      >
        {/* Track Controls - fixed width matching timeline */}
        <div
          className="track-controls"
          style={{
            width: '200px',
            flexShrink: 0,
            backgroundColor: '#232323',
            borderRight: '1px solid #444',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div className="track-header">
            <Form.Control
              type="text"
              value={track.name}
              onChange={(e) => updateTrack(track.id, { name: e.target.value })}
              className="track-name-input"
              onClick={(e) => e.stopPropagation()}
              style={{ marginBottom: '8px' }}
            />
          </div>

          {/* Vol/Pan toggle - align with Track.js */}
          <ButtonGroup
            size="sm"
            className="control-tabs"
            style={{ marginBottom: 4 }}
          >
            <Button
              variant={controlTab === 'vol' ? 'secondary' : 'outline-secondary'}
              onClick={(e) => {
                e.stopPropagation();
                setControlTab('vol');
              }}
            >
              Vol
            </Button>
            <Button
              variant={controlTab === 'pan' ? 'secondary' : 'outline-secondary'}
              onClick={(e) => {
                e.stopPropagation();
                setControlTab('pan');
              }}
            >
              Pan
            </Button>
          </ButtonGroup>

          {controlTab === 'vol' ? (
            <div
              className="track-control-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <FaVolumeUp size={12} className="control-icon" />
              <input
                type="range"
                className="track-volume-slider"
                min="0"
                max="1"
                step="0.01"
                value={track.volume || 1}
                onChange={(e) =>
                  updateTrack(track.id, {
                    volume: parseFloat(e.target.value),
                  })
                }
                disabled={track.muted}
                style={{ flex: 1 }}
              />
              <span
                className="control-value"
                style={{ fontSize: '11px', width: 30 }}
              >
                {Math.round((track.volume || 1) * 100)}
              </span>
            </div>
          ) : (
            <div
              className="track-control-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <MdPanTool size={12} className="control-icon" />
              <input
                type="range"
                className="track-pan-slider"
                min="-1"
                max="1"
                step="0.01"
                value={track.pan || 0}
                onChange={(e) =>
                  updateTrack(track.id, { pan: parseFloat(e.target.value) })
                }
                disabled={track.muted}
                style={{ flex: 1 }}
              />
              <span
                className="control-value"
                style={{ fontSize: '11px', width: 30 }}
              >
                {track.pan > 0
                  ? `R${Math.round((track.pan || 0) * 100)}`
                  : track.pan < 0
                    ? `L${Math.round(Math.abs((track.pan || 0) * 100))}`
                    : 'C'}
              </span>
            </div>
          )}

          {/* Three-button row: Solo / Mute / Record */}
          <div className="track-button-row" style={{ display: 'flex', gap: 4 }}>
            <Button
              variant={isSolo ? 'warning' : 'outline-secondary'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSoloTrackId(isSolo ? null : track.id);
              }}
              title="Solo"
              style={{ flex: 1 }}
            >
              S
            </Button>
            <Button
              variant={track.muted ? 'danger' : 'outline-secondary'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                updateTrack(track.id, { muted: !track.muted });
              }}
              title={track.muted ? 'Unmute' : 'Mute'}
              style={{ flex: 1 }}
            >
              M
            </Button>
            {!isRecording ? (
              <Button
                size="sm"
                variant={isCountingIn ? 'danger' : 'outline-danger'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecord();
                }}
                title={isCountingIn ? 'Cancel Countdown' : 'Record'}
                style={{ flex: 1 }}
              >
                {isCountingIn ? countInBeat : <FaCircle />}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="warning"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecord();
                }}
                title="Stop"
                style={{ flex: 1 }}
              >
                <FaStop />
              </Button>
            )}
          </div>

          {/* Import and Delete Row - side by side */}
          <div className="track-button-row" style={{ display: 'flex', gap: 4 }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Import Audio"
              style={{ flex: 1 }}
              disabled={isRecording}
            >
              <FaFileImport />
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              title="Delete Track"
              style={{ flex: 1 }}
            >
              <FaTrash />
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />
        </div>

        {/* Track Waveform - takes remaining space */}
        <div
          className="track-waveform"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            backgroundColor: isDragOver ? '#3a3a3a' : '#2a2a2a',
            position: 'relative',
            overflow: 'hidden',
            border: isDragOver ? '2px dashed #7bafd4' : 'none',
            transition: 'background-color 0.2s, border 0.2s',
          }}
        >
          {isRecording ? (
            <>
              {console.log('RecordingTrack: Rendering WalkingWaveform', {
                mediaStream: !!mediaStream,
                isRecording,
                startPosition: track.recordingStartPosition || 0,
                zoomLevel,
                duration,
              })}
              <WalkingWaveform
                mediaStream={mediaStream}
                isRecording={isRecording}
                trackId={track.id}
                height={160}
                color="#ff6b6b"
                startPosition={track.recordingStartPosition || 0}
                zoomLevel={zoomLevel}
                duration={duration}
              />
            </>
          ) : isLoading ? (
            <div
              className="waveform-loading"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                padding: '20px',
                gap: '10px',
              }}
            >
              {/* Loading state indicator */}
              <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                {loadingState === 'reading' && '📖 Reading file...'}
                {loadingState === 'decoding' && '🔧 Decoding audio...'}
                {loadingState === 'generating-peaks' && '🌊 Generating peaks...'}
                {loadingState === 'complete' && '✅ Complete!'}
                {loadingState === 'error' && '❌ Error occurred'}
                {loadingState === 'idle' && 'Processing...'}
              </div>
              
              {/* Processing method indicator */}
              {processingMethod !== 'unknown' && (
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
                  {processingMethod === 'worker' && '🚀 Web Worker (non-blocking)'}
                  {processingMethod === 'main-thread' && '🔄 Main Thread (progressive)'}
                </div>
              )}
              
              {/* Progress bar */}
              <ProgressBar 
                now={loadingProgress} 
                style={{ width: '200px', height: '8px' }}
                variant={loadingState === 'error' ? 'danger' : 
                        loadingState === 'complete' ? 'success' : 'primary'}
                striped={loadingState !== 'complete' && loadingState !== 'error'}
                animated={loadingState !== 'complete' && loadingState !== 'error'}
              />
              
              {/* Percentage */}
              <small style={{ color: '#888', fontSize: '12px' }}>
                {Math.round(loadingProgress)}%
              </small>
            </div>
          ) : track.clips && track.clips.length > 0 ? (
            <TrackClipCanvas
              track={track}
              clips={track.clips}
              zoomLevel={zoomLevel}
              height={200}
            />
          ) : (
                <div
                  className="empty-waveform-state"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: isDragOver ? '#7bafd4' : '#666',
                    transition: 'color 0.2s',
                  }}
                >
                  <FaFileImport size={24} />
                  <div>
                    {isDragOver 
                      ? 'Drop audio file here' 
                      : mediaStream
                        ? 'Record or import audio'
                        : 'Initializing microphone...'}
                  </div>
                </div>
              )}
        </div>
      </div>
    </div>
  );
}
