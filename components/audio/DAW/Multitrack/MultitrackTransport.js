'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
// Sentinel used when instruments don't return a preview handle
const NO_TOKEN = Symbol('no_token');
import { Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaStepBackward,
  FaStepForward,
  FaVolumeUp,
  FaVolumeMute,
  FaKeyboard,
  FaCircle,
} from 'react-icons/fa';
import { MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import Metronome from './Metronome';
import PianoKeyboard from './PianoKeyboard';
import MIDIInputManager from './MIDIInputManager';
import MIDIDeviceSelector from './MIDIDeviceSelector';

export default function MultitrackTransport({
  showPiano: showPianoProp,
  setShowPiano: setShowPianoProp,
  onPianoNoteHandler,
  onActiveNotesChange,
}) {
  const {
    play,
    pause,
    stop,
    seek,
    isPlaying,
    currentTime,
    duration,
    tracks,
    selectedTrackId,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
    addNoteToSelectedTrack,
  } = useMultitrack();

  const [masterVolume, setMasterVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showPianoState, setShowPianoState] = useState(false);
  const showPiano = showPianoProp ?? showPianoState;
  const setShowPiano = setShowPianoProp ?? setShowPianoState;
  const [activeNotes, setActiveNotes] = useState([]);
  const previewTokensRef = useRef(new Map()); // note -> token

  // MIDI device management state
  const [showMidiDeviceSelector, setShowMidiDeviceSelector] = useState(false);
  const [connectedMidiDevices, setConnectedMidiDevices] = useState([]);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState(null);
  const [midiActivity, setMidiActivity] = useState(false);

  // Ref to track previous isPlaying state for edge-triggered cleanup
  const prevIsPlayingRef = useRef(isPlaying);

  const activeNotesRef = useRef(new Set());
  useEffect(() => {
    activeNotesRef.current = new Set(activeNotes);
  }, [activeNotes]);

  // Live capture (seconds → beats) while armed & playing
  const liveNotesRef = useRef(new Map()); // note -> { startSec, velocity }
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Refs for latest state in async callbacks
  const selectedTrackIdRef = useRef(selectedTrackId);
  useEffect(() => {
    selectedTrackIdRef.current = selectedTrackId;
  }, [selectedTrackId]);
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  const showPianoRef = useRef(showPiano);
  useEffect(() => {
    showPianoRef.current = showPiano;
  }, [showPiano]);

  // Virtual capture clock (used when transport isn't running)
  const captureBaseSecRef = useRef(0);
  const captureBaseWallRef = useRef(0);
  const getCaptureSec = useCallback(() => {
    if (isPlayingRef.current) return currentTimeRef.current;
    // If not playing, start/continue a virtual clock from current timeline pos
    if (!captureBaseWallRef.current) {
      captureBaseSecRef.current = currentTimeRef.current;
      captureBaseWallRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    const nowWall =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    return (
      captureBaseSecRef.current + (nowWall - captureBaseWallRef.current) / 1000
    );
  }, []);

  // Reset virtual clock when transport starts or piano closes
  useEffect(() => {
    if (isPlaying) {
      captureBaseWallRef.current = 0;
    }
  }, [isPlaying]);
  useEffect(() => {
    if (!showPiano) {
      captureBaseWallRef.current = 0;
    }
  }, [showPiano]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = x / width;
    seek(progress);
  };

  // Handle piano key presses: preview always; record when armed & playing (uses robust capture clock)
  const handlePianoNote = (note, action) => {
    const selectedMidiTrack = tracks.find(
      (t) => t.id === selectedTrackId && t.type === 'midi',
    );

    if (!selectedMidiTrack) {
      console.warn('⚠️ No MIDI track selected!');
      return;
    }

    const tempo = selectedMidiTrack.midiData?.tempo || 120;
    const secPerBeat = 60 / tempo;
    const velocity = 0.85; // 0..1 for context

    const shouldCapture = isPlayingRef.current || showPiano;

    if (action === 'down') {
      setActiveNotes((prev) => (prev.includes(note) ? prev : [...prev, note]));

      if (!previewTokensRef.current.has(note)) {
        try {
          const token = playNoteOnSelectedTrack(note, velocity);
          previewTokensRef.current.set(note, token ?? NO_TOKEN);
        } catch {}
      }

      if (shouldCapture) {
        const startSec = getCaptureSec();
        liveNotesRef.current.set(note, {
          startSec,
          velocity,
        });
      }
    } else if (action === 'up') {
      const stored = previewTokensRef.current.get(note);
      try {
        if (stored && stored !== NO_TOKEN) {
          stopNoteOnSelectedTrack(note, stored);
        } else {
          stopNoteOnSelectedTrack(note);
        }
      } catch {}
      previewTokensRef.current.delete(note);
      setActiveNotes((prev) => prev.filter((n) => n !== note));

      const live = liveNotesRef.current.get(note);
      if (
        shouldCapture &&
        live &&
        typeof addNoteToSelectedTrack === 'function'
      ) {
        const endSec = getCaptureSec();
        const durationSec = Math.max(0, endSec - live.startSec);
        if (durationSec > 0.04) {
          const startBeat = live.startSec / secPerBeat;
          const durationBeats = durationSec / secPerBeat;
          addNoteToSelectedTrack(note, live.velocity, startBeat, durationBeats);
        }
        liveNotesRef.current.delete(note);
      }
    }
  };

  // External MIDI device capture: preview/record just like the piano
  const handleExternalMIDIMessage = useCallback(
    (message) => {
      // Flash MIDI activity indicator
      setMidiActivity(true);
      setTimeout(() => setMidiActivity(false), 100);

      const id = selectedTrackIdRef.current;
      const tr = tracksRef.current.find(
        (t) => t.id === id && t.type === 'midi',
      );
      if (!tr) return;

      const tempo = tr.midiData?.tempo || 120;
      const secPerBeat = 60 / tempo;
      // External MIDI records when: transport playing OR track is armed (independent of piano visibility)
      const shouldCapture = isPlayingRef.current || tr.armed;

      if (message.type === 'noteon' && (message.velocity ?? 0) > 0) {
        const velocity01 = Math.max(
          0,
          Math.min(1, (message.velocity || 0) / 127),
        );
        if (!previewTokensRef.current.has(message.note)) {
          try {
            const token = playNoteOnSelectedTrack(message.note, velocity01);
            previewTokensRef.current.set(message.note, token ?? NO_TOKEN);
          } catch {}
        }
        if (shouldCapture) {
          const startSec = getCaptureSec();
          liveNotesRef.current.set(message.note, {
            startSec,
            velocity: velocity01,
          });
        }
      } else if (
        message.type === 'noteoff' ||
        (message.type === 'noteon' && (message.velocity ?? 0) === 0)
      ) {
        const stored = previewTokensRef.current.get(message.note);
        try {
          if (stored && stored !== NO_TOKEN) {
            stopNoteOnSelectedTrack(message.note, stored);
          } else {
            stopNoteOnSelectedTrack(message.note);
          }
        } catch {}
        previewTokensRef.current.delete(message.note);

        const live = liveNotesRef.current.get(message.note);
        if (
          shouldCapture &&
          live &&
          typeof addNoteToSelectedTrack === 'function'
        ) {
          const endSec = getCaptureSec();
          const durationSec = Math.max(0, endSec - live.startSec);
          if (durationSec > 0.02) {
            const startBeat = live.startSec / secPerBeat;
            const durationBeats = durationSec / secPerBeat;
            addNoteToSelectedTrack(
              message.note,
              live.velocity,
              startBeat,
              durationBeats,
            );
          }
          liveNotesRef.current.delete(message.note);
        }
      }
    },
    [
      addNoteToSelectedTrack,
      playNoteOnSelectedTrack,
      stopNoteOnSelectedTrack,
      getCaptureSec,
    ],
  );

  // External MIDI setup – initialize and connect to all inputs
  useEffect(() => {
    const mm =
      typeof window !== 'undefined' && window.__midiInputManager
        ? window.__midiInputManager
        : new MIDIInputManager();
    if (typeof window !== 'undefined' && !window.__midiInputManager) {
      window.__midiInputManager = mm;
    }

    let mounted = true;
    let onDeviceChange;

    (async () => {
      const ok = await mm.initialize();
      if (!ok || !mounted) return;

      const connectAll = () => {
        try {
          const inputs = mm.getInputDevices();
          // Update connected devices state
          if (mounted) {
            setConnectedMidiDevices(inputs);
          }
          inputs.forEach((d) => {
            try {
              mm.connectInput(d.id, handleExternalMIDIMessage);
            } catch {}
          });
        } catch {}
      };

      connectAll();
      onDeviceChange = () => connectAll();
      mm.addListener('devicechange', onDeviceChange);
    })();

    return () => {
      mounted = false;
      try {
        const mm2 = window.__midiInputManager || mm;
        const inputs = mm2.getInputDevices?.() || [];
        inputs.forEach((d) => {
          try {
            mm2.disconnectInput(d.id);
          } catch {}
        });
        if (onDeviceChange) mm2.removeListener('devicechange', onDeviceChange);
      } catch {}
    };
  }, [handleExternalMIDIMessage]);
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;

    // Only clear when we actually transition from playing to stopped
    if (wasPlaying && !isPlaying) {
      const snapshot = Array.from(activeNotesRef.current);
      snapshot.forEach((n) => {
        const t = previewTokensRef.current.get(n);
        try {
          if (t && t !== NO_TOKEN) {
            stopNoteOnSelectedTrack(n, t);
          } else {
            stopNoteOnSelectedTrack(n);
          }
        } catch {}
      });
      previewTokensRef.current.clear();
      setActiveNotes([]);
      liveNotesRef.current.clear();
    }
  }, [isPlaying, stopNoteOnSelectedTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only handle if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;
        case 'Enter':
          e.preventDefault();
          stop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, play, pause, stop]);

  // Update volume on all tracks when master volume changes
  useEffect(() => {
    // This would typically be handled by a master gain node
    // For now, we'll just log the change
    console.log('Master volume:', masterVolume);
  }, [masterVolume]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const selectedMidiTrack = tracks.find(
    (t) => t.id === selectedTrackId && t.type === 'midi',
  );

  // Check if we're currently capturing MIDI (either playing or track is armed)
  const isMidiCapturing = isPlaying || (selectedMidiTrack?.armed);

  // Debug: Log when selected track changes
  useEffect(() => {
    console.log('🎯 Selected track changed:', {
      selectedTrackId,
      selectedMidiTrack: selectedMidiTrack
        ? {
            id: selectedMidiTrack.id,
            name: selectedMidiTrack.name,
            type: selectedMidiTrack.type,
          }
        : null,
    });
  }, [selectedTrackId, selectedMidiTrack]);

  // Expose piano note handler to parent
  useEffect(() => {
    if (onPianoNoteHandler) {
      onPianoNoteHandler(handlePianoNote);
    }
  }, [onPianoNoteHandler, handlePianoNote]);

  // Expose active notes to parent
  useEffect(() => {
    if (onActiveNotesChange) {
      onActiveNotesChange(activeNotes);
    }
  }, [onActiveNotesChange, activeNotes]);

  return (
    <div className="multitrack-transport-container">
      {/* Transport Controls Only - Piano moved to bottom of editor */}
      <div className="multitrack-transport d-flex align-items-center gap-3">
        {/* Transport Controls */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => {
              try {
                if (isPlaying) {
                  pause && pause();
                } else {
                  play && play();
                }
              } catch (e) {
                console.error('Transport error:', e);
              }
            }}
            disabled={tracks.length === 0}
            style={{
              backgroundColor: isPlaying ? '#d4910b' : '#4a7c9e',
              border: '1px solid #5a8cae',
              color: '#fff',
              minWidth: '60px',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: tracks.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {isPlaying ? <FaPause /> : <FaPlay />}
          </button>
          <button
            onClick={() => {
              try {
                stop && stop();
              } catch (e) {
                console.error('Stop error:', e);
              }
            }}
            disabled={tracks.length === 0}
            style={{
              backgroundColor: '#5a5a5a',
              border: '1px solid #6a6a6a',
              color: '#fff',
              minWidth: '60px',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: tracks.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <FaStop />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-grow-1 d-flex align-items-center gap-2">
          <span className="time-display">{formatTime(currentTime)}</span>
          <div
            className="progress flex-grow-1"
            style={{ height: '6px', cursor: 'pointer' }}
            onClick={handleSeek}
          >
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="time-display">{formatTime(duration)}</span>
        </div>

        {/* Metronome */}
        <Metronome tempo={120} />

        {/* MIDI Device Button */}
        <Button
          size="sm"
          variant={midiActivity ? 'warning' : connectedMidiDevices.length > 0 ? 'success' : 'outline-secondary'}
          onClick={() => setShowMidiDeviceSelector(true)}
          title={connectedMidiDevices.length > 0
            ? `${connectedMidiDevices.length} MIDI device(s) connected`
            : 'No MIDI devices connected'
          }
          style={{
            transition: 'all 0.1s ease',
            boxShadow: midiActivity ? '0 0 10px rgba(255, 193, 7, 0.5)' : 'none'
          }}
        >
          <FaKeyboard />
          {connectedMidiDevices.length > 0 && (
            <span className="ms-1">({connectedMidiDevices.length})</span>
          )}
          {midiActivity && <span className="ms-1">●</span>}
        </Button>

        {/* Piano Toggle */}
        <Button
          size="sm"
          variant={showPiano ? 'primary' : 'outline-secondary'}
          onClick={() => {
            console.log('🎹 Piano toggle clicked');
            setShowPiano(!showPiano);
          }}
          title={
            selectedMidiTrack
              ? `Virtual piano for ${selectedMidiTrack.name}`
              : 'Select a MIDI track first'
          }
          disabled={!selectedMidiTrack}
        >
          <MdPiano /> Piano
        </Button>

        {/* Master Volume */}
        <div className="d-flex align-items-center gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </Button>
          <input
            type="range"
            className="form-range"
            style={{ width: '100px' }}
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          />
        </div>

        {/* Track Info */}
        <div className="track-info">
          <small className="text-muted">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </small>
          {isMidiCapturing && selectedMidiTrack && (
            <small className="text-danger ms-2">
              <FaCircle size={8} className="me-1" />
              MIDI REC
            </small>
          )}
        </div>
      </div>

      {/* MIDI Device Selector Modal */}
      <MIDIDeviceSelector
        show={showMidiDeviceSelector}
        onHide={() => setShowMidiDeviceSelector(false)}
        onDeviceSelect={(deviceId) => {
          setSelectedMidiDevice(deviceId);
          console.log('Selected MIDI device:', deviceId);
        }}
        midiInputManager={window.__midiInputManager || new MIDIInputManager()}
        currentDevice={selectedMidiDevice}
      />
    </div>
  );
}
