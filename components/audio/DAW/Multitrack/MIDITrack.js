// components/audio/DAW/Multitrack/MIDITrack_NEW.js
'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { Button, Form, Dropdown } from 'react-bootstrap';
import {
  FaKeyboard,
  FaTrash,
  FaVolumeUp,
  FaDownload,
  FaPiano,
  FaEdit,
  FaCircle,
  FaStop
} from 'react-icons/fa';
import { MdPanTool, MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import MIDIRecordingTrack from './recording/MIDIRecordingTrack';
import LiveMIDIVisualizer from './recording/LiveMIDIVisualizer';
import RecordingManager from './recording/RecordingManager';
import MIDIInputManager from './MIDIInputManager';
import PianoRollEditor from './PianoRollEditor';
import InstrumentSelector from './InstrumentSelector';
import { exportToMIDIFile } from '../../../../lib/midiFileExport';
import { useMIDITrackAudio } from './hooks/useMidiTrackAudio';

// Get singleton MIDI manager
const midiInputManager = typeof window !== 'undefined' && window.__midiInputManager
  ? window.__midiInputManager
  : new MIDIInputManager();

function MIDITrack({ track, index, zoomLevel = 100 }) {
  const {
    updateTrack,
    removeTrack,
    setSelectedTrackId,
    selectedTrackId,
    soloTrackId,
    setSoloTrackId,
    getTransportTime,
    isPlaying,
    currentTime,
    registerTrackInstrument,
    duration,
  } = useMultitrack();

  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countdownValue, setCountdownValue] = useState(0);
  const [showInstrumentSelector, setShowInstrumentSelector] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);
  const [controlTab, setControlTab] = useState('vol');
  const [selectedMidiDevice, setSelectedMidiDevice] = useState(null);

  // Use MIDI audio hook for playback
  const {
    instrumentRef,
    playNote,
    stopNote,
  } = useMIDITrackAudio(track, isPlaying, currentTime, registerTrackInstrument, soloTrackId);

  const instrument = instrumentRef?.current;
  const instrumentLoading = !instrument;

  // Register instrument with context
  useEffect(() => {
    if (instrument && registerTrackInstrument) {
      registerTrackInstrument(track.id, instrument);
    }
  }, [instrument, track.id, registerTrackInstrument]);

  // Subscribe to recording events
  useEffect(() => {
    const handleCountdownStart = ({ trackId, countdown }) => {
      if (trackId === track.id) {
        setIsCountingIn(true);
        setCountdownValue(countdown);
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
      }
    };

    const handleRecordingStart = ({ trackId, type }) => {
      if (trackId === track.id && type === 'midi') {
        setIsRecording(true);
        setIsCountingIn(false);
      }
    };

    const handleRecordingStop = ({ trackId, type }) => {
      if (trackId === track.id && type === 'midi') {
        setIsRecording(false);
        setIsCountingIn(false);
      }
    };

    const handleRecordingComplete = (data) => {
      if (data.trackId === track.id) {
        console.log(`🎹 MIDITrack: Recording complete, adding notes`);

        // Add recorded notes to track
        const existingNotes = track.midiData?.notes || [];
        const newNotes = data.notes || [];

        updateTrack(track.id, {
          midiData: {
            ...track.midiData,
            notes: [...existingNotes, ...newNotes]
          }
        });
      }
    };

    RecordingManager.on('countdown-start', handleCountdownStart);
    RecordingManager.on('countdown-update', handleCountdownUpdate);
    RecordingManager.on('countdown-complete', handleCountdownComplete);
    RecordingManager.on('recording-start', handleRecordingStart);
    RecordingManager.on('recording-stop', handleRecordingStop);
    RecordingManager.on('midi-recording-complete', handleRecordingComplete);

    return () => {
      RecordingManager.off('countdown-start', handleCountdownStart);
      RecordingManager.off('countdown-update', handleCountdownUpdate);
      RecordingManager.off('countdown-complete', handleCountdownComplete);
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      RecordingManager.off('midi-recording-complete', handleRecordingComplete);
    };
  }, [track.id, track.midiData, updateTrack]);

  // Simple MIDI visualization on canvas
  useEffect(() => {
    console.log(`🎹 MIDITrack visualization effect triggered`, {
      hasCanvas: !!canvasRef.current,
      isRecording,
      trackId: track.id
    });

    if (!canvasRef.current || isRecording) {
      console.log(`🎹 MIDITrack visualization skipped - no canvas or recording`);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Calculate proper canvas width based on duration and zoom
    const pixelsPerSecond = 100 * (zoomLevel / 100);
    const canvasWidth = Math.max(800, pixelsPerSecond * (duration || 30));

    canvas.width = canvasWidth;
    canvas.style.width = canvasWidth + 'px';

    console.log(`🎹 MIDITrack visualization render:`, {
      hasNotes: !!track.midiData?.notes?.length,
      noteCount: track.midiData?.notes?.length || 0,
      firstNoteRaw: track.midiData?.notes?.[0],
      allNotes: track.midiData?.notes,
      zoomLevel,
      tempo: track.midiData?.tempo || 120,
      canvasWidth,
      pixelsPerSecond,
      duration
    });

    // Clear canvas with dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw MIDI notes if any
    if (track.midiData?.notes?.length > 0) {
      const pixelsPerSecond = 100 * (zoomLevel / 100);

      // Log first note to debug
      if (track.midiData.notes[0]) {
        console.log(`🎹 MIDITrack drawing notes:`, {
          firstNote: {
            startTime: track.midiData.notes[0].startTime,
            duration: track.midiData.notes[0].duration,
            note: track.midiData.notes[0].note
          },
          pixelsPerSecond,
          x: track.midiData.notes[0].startTime * pixelsPerSecond,
          width: track.midiData.notes[0].duration * pixelsPerSecond
        });
      }

      ctx.fillStyle = '#4CAF50';
      ctx.globalAlpha = 0.8;

      track.midiData.notes.forEach(note => {
        // Notes are stored in seconds, so just multiply by pixelsPerSecond
        const x = note.startTime * pixelsPerSecond;
        const width = note.duration * pixelsPerSecond;
        const noteHeight = canvas.height / 128;
        const y = canvas.height - ((note.note / 128) * canvas.height);

        ctx.fillRect(x, y - noteHeight/2, Math.max(width, 2), noteHeight);
      });

      ctx.globalAlpha = 1.0;
    }
  }, [track.midiData, zoomLevel, isRecording, duration]);

  const handleInstrumentChange = (instrumentName) => {
    console.log(`🎹 MIDITrack: Changing instrument to ${instrumentName}`);
    updateTrack(track.id, {
      midiData: { ...track.midiData, instrument: instrumentName }
    });
    setShowInstrumentSelector(false);
  };

  const handleRecord = async () => {
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
        midiInput: selectedMidiDevice,
        startPosition,
        tempo
      });
    }
  };

  const handleExportMIDI = () => {
    if (!track.midiData?.notes?.length) {
      console.warn('No MIDI data to export');
      return;
    }

    const midiData = {
      notes: track.midiData.notes,
      tempo: track.midiData.tempo || 120,
      name: track.name
    };

    exportToMIDIFile(midiData, `${track.name}.mid`);
  };

  const handleRemove = () => {
    if (window.confirm('Remove this MIDI track?')) {
      if (instrument?.stopAllNotes) {
        instrument.stopAllNotes();
      }
      removeTrack(track.id);
    }
  };

  const isSelected = selectedTrackId === track.id;
  const isSolo = soloTrackId === track.id;
  const isMutedBySolo = soloTrackId && !isSolo; // Track is muted because another track is soloed

  // Add style reset to override external CSS
  const styleReset = `
    .track-container.midi-track-override,
    .track-container.midi-track-override .track.midi-track {
      height: 200px !important;
      max-height: 200px !important;
      min-height: 200px !important;
      background-color: transparent !important;
    }
    .track-container.midi-track-override .track-waveform,
    .track-container.midi-track-override .track-content,
    .track-container.midi-track-override .midi-track-display {
      height: 200px !important;
      max-height: 200px !important;
      min-height: 200px !important;
      background-color: #1a1a1a !important;
      background-image: none !important;
    }
    .track-container.midi-track-override .track-controls {
      padding-top: 6px !important;
      margin-top: 0 !important;
    }
    .track-container.midi-track-override .track-controls > *:first-child {
      margin-top: 0 !important;
    }
    .track-container.midi-track-override .track-controls input[type="text"],
    .track-container.midi-track-override .track-controls .track-name-input {
      margin: 0 !important;
      padding: 2px 6px !important;
      height: 24px !important;
      font-size: 0.75rem !important;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleReset }} />
      <div className="track-container midi-track-override" style={{
        display: 'flex',
        height: '200px !important',
        maxHeight: '200px !important',
        overflowY: 'clip', // Clip vertical overflow while allowing sticky to work
        overflowX: 'visible', // Allow horizontal sticky positioning
        position: 'relative' // Establish positioning context
      }}>
        {/* Sidebar spacer - matches timeline sidebar */}
      <div
        className="track-sidebar"
        style={{
          width: '80px',
          height: '200px !important',
          backgroundColor: '#1e1e1e !important',
          borderRight: '1px solid #3a3a3a',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'sticky',
          left: 0,
          zIndex: 10,
        }}
      >
        {/* Track number with recording indicator */}
        <span
          style={{
            color: isRecording ? '#4CAF50' : '#666',
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
        className={`track midi-track ${isSelected ? 'track-selected' : ''}`}
        onClick={() => setSelectedTrackId(track.id)}
        style={{
          display: 'flex',
          flex: 1,
          height: '200px !important',
          maxHeight: '200px !important',
          backgroundColor: isSelected ? '#2a2a2a !important' : '#1a1a1a !important'
        }}
      >
        {/* Track Controls */}
        <div
          className="track-controls"
          style={{
            width: '230px',
            height: '200px !important',
            maxHeight: '200px !important',
            flexShrink: 0,
            padding: '6px 8px 8px 8px',
            borderRight: '1px solid #444',
            backgroundColor: '#232323 !important',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            position: 'sticky',
            left: '80px',
            zIndex: 9,
            boxSizing: 'border-box',
          }}
        >
        {/* Track Name */}
        <input
          type="text"
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: '0.75rem',
            padding: '2px 6px !important',
            height: '24px !important',
            width: '100%',
            backgroundColor: '#2a2a2a !important',
            border: '1px solid #444 !important',
            color: '#fff !important',
            borderRadius: '3px',
            margin: '0 !important',
            boxSizing: 'border-box'
          }}
        />

        {/* Instrument Selector */}
        <Button
          size="sm"
          variant="outline-success"
          onClick={(e) => {
            e.stopPropagation();
            setShowInstrumentSelector(!showInstrumentSelector);
          }}
          style={{ width: '100%', fontSize: '0.75rem' }}
          disabled={instrumentLoading}
        >
          <MdPiano /> {track.midiData?.instrument?.name || 'Select Instrument'}
        </Button>

        {/* Editor Buttons */}
        <Button
          size="sm"
          variant={showPianoRoll ? 'success' : 'outline-success'}
          onClick={(e) => {
            e.stopPropagation();
            setShowPianoRoll(!showPianoRoll);
          }}
          style={{ width: '100%', fontSize: '0.75rem' }}
        >
          <FaEdit /> Piano Roll
        </Button>

        {/* Volume/Pan Controls */}
        <div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            <Button
              size="sm"
              variant={controlTab === 'vol' ? 'primary' : 'outline-secondary'}
              onClick={() => setControlTab('vol')}
              style={{ flex: 1, fontSize: '0.75rem' }}
            >
              <FaVolumeUp />
            </Button>
            <Button
              size="sm"
              variant={controlTab === 'pan' ? 'primary' : 'outline-secondary'}
              onClick={() => setControlTab('pan')}
              style={{ flex: 1, fontSize: '0.75rem' }}
            >
              <MdPanTool />
            </Button>
          </div>

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
                onClick={(e) => e.stopPropagation()}
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
                onClick={(e) => e.stopPropagation()}
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
        </div>

        {/* Record / Solo / Mute / Export / Delete */}
        <div style={{ display: 'flex', gap: 4 }}>
          {!isRecording ? (
            <Button
              size="sm"
              variant={isCountingIn ? 'danger' : 'outline-danger'}
              onClick={(e) => {
                e.stopPropagation();
                handleRecord();
              }}
              title={isCountingIn ? `Countdown: ${countdownValue}` : 'Start MIDI Recording'}
              style={{ flex: 1, fontSize: '0.75rem' }}
            >
              {isCountingIn ? countdownValue : <FaCircle />}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="warning"
              onClick={(e) => {
                e.stopPropagation();
                handleRecord();
              }}
              title="Stop MIDI Recording"
              style={{ flex: 1, fontSize: '0.75rem' }}
            >
              <FaStop />
            </Button>
          )}
          <Button
            variant={isSolo ? 'warning' : 'outline-secondary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSoloTrackId(isSolo ? null : track.id);
            }}
            title="Solo"
            style={{ flex: 1, fontSize: '0.75rem' }}
          >
            S
          </Button>
          <Button
            variant={track.muted || isMutedBySolo ? 'danger' : 'outline-secondary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              updateTrack(track.id, { muted: !track.muted });
            }}
            title={
              isMutedBySolo
                ? 'Muted by solo (another track is soloed)'
                : track.muted
                  ? 'Unmute'
                  : 'Mute'
            }
            style={{
              flex: 1,
              fontSize: '0.75rem',
              opacity: isMutedBySolo ? 0.6 : 1 // Dimmed if muted by solo
            }}
          >
            M
          </Button>
          <Button
            variant="outline-info"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleExportMIDI();
            }}
            title="Export MIDI"
            style={{ flex: 1, fontSize: '0.75rem' }}
          >
            <FaDownload />
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            title="Delete Track"
            style={{ flex: 1, fontSize: '0.75rem' }}
          >
            <FaTrash />
          </Button>
        </div>
      </div>

        {/* Track Content Area */}
        <div
          className="track-content"
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden', // Clip canvas overflow but don't affect sticky controls
            height: '200px !important',
            maxHeight: '200px !important',
            backgroundColor: '#1a1a1a !important',
          }}
        >
        {isRecording ? (
          <LiveMIDIVisualizer
            trackId={track.id}
            height={200}
            color="#4CAF50"
            zoomLevel={zoomLevel}
            getTransportTime={getTransportTime}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '200px',
            }}
          />
        )}
        </div>
      </div>

      {/* Piano Roll Editor Modal */}
      {showPianoRoll && (
        <PianoRollEditor
          show={showPianoRoll}
          onHide={() => setShowPianoRoll(false)}
          track={track}
          updateTrack={updateTrack}
        />
      )}

      {/* Instrument Selector Modal */}
      <InstrumentSelector
        show={showInstrumentSelector}
        onHide={() => setShowInstrumentSelector(false)}
        onSelect={handleInstrumentChange}
        currentInstrument={track.midiData?.instrument}
      />
    </div>
    </>
  );
}

export default memo(MIDITrack);
