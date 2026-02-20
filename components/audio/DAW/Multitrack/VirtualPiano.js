// components/audio/DAW/Multitrack/VirtualPiano.js
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Modal, Button, ButtonGroup, Badge } from 'react-bootstrap';
import { FaCircle, FaStop, FaClock } from 'react-icons/fa';
import { MdPiano } from 'react-icons/md';
import PianoKeyboard from './PianoKeyboard';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function VirtualPiano({ show, onHide }) {
  const {
    tracks,
    selectedTrackId,
    isPlaying,
    currentTime,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
    updateTrack,
    getPreciseCurrentTime,
  } = useMultitrack();

  // State
  const [activeNotes, setActiveNotes] = useState([]);
  const [quantizeValue, setQuantizeValue] = useState(0); // 0 = off, 0.25 = 1/16, 0.5 = 1/8, 1 = 1/4
  const [noteCount, setNoteCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Refs for tracking notes in progress
  const notesInProgressRef = useRef(new Map()); // note -> noteData
  const recordingStartTimeRef = useRef(null);
  const lastNoteIdRef = useRef(0);

  // Get selected MIDI track
  const selectedTrack = tracks.find(
    (t) => t.id === selectedTrackId && t.type === 'midi',
  );
  const tempo = selectedTrack?.midiData?.tempo || 120;

  // Update recording state based on track's recording state
  useEffect(() => {
    // Only record if the selected track is actually in recording mode
    const trackIsRecording = selectedTrack?.isRecording || false;
    setIsRecording(trackIsRecording);

    if (trackIsRecording && !recordingStartTimeRef.current) {
      recordingStartTimeRef.current = currentTime;
    } else if (!trackIsRecording) {
      // Clean up any notes that were held when recording stopped
      handlePlaybackStopped();
      recordingStartTimeRef.current = null;
    }
  }, [selectedTrack?.isRecording, currentTime]);

  // Convert current time to beat position (MUST match MIDITrack playhead calculation)
  const convertTimeToBeat = useCallback(
    (timeInSeconds) => {
      const secPerBeat = 60 / tempo;  // Match MIDITrack variable name
      return timeInSeconds / secPerBeat;
    },
    [tempo],
  );

  // Quantize a beat position if quantization is enabled
  const quantizeBeat = useCallback(
    (beat) => {
      if (quantizeValue === 0) return beat;
      return Math.round(beat / quantizeValue) * quantizeValue;
    },
    [quantizeValue],
  );

  // Generate unique note ID
  const generateNoteId = useCallback(() => {
    lastNoteIdRef.current += 1;
    return `vp-note-${Date.now()}-${lastNoteIdRef.current}`;
  }, []);

  // Add a completed note to the track
  const addNoteToTrack = useCallback(
    (noteData) => {
      if (!selectedTrack) return;

      // Validate and sanitize note data
      const sanitizedNote = {
        id: noteData.id || generateNoteId(),
        note: Math.max(0, Math.min(127, Math.round(Number(noteData.note) || 60))), // Clamp to MIDI range
        velocity: Math.max(1, Math.min(127, Math.round(Number(noteData.velocity) || 100))), // Clamp velocity
        startTime: Math.max(0, Number(noteData.startTime) || 0), // Ensure positive
        duration: Math.max(0.125, Number(noteData.duration) || 0.125), // Minimum 1/32 note
      };

      // Validate required fields
      if (!sanitizedNote.id || isNaN(sanitizedNote.note) || isNaN(sanitizedNote.startTime)) {
        console.warn('Invalid note data, skipping:', noteData);
        return;
      }

      // Debug logging (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('🎹 VirtualPiano: Adding note to track', {
          trackId: selectedTrack.id,
          trackName: selectedTrack.name,
          noteData: sanitizedNote,
          existingNotes: selectedTrack.midiData?.notes?.length || 0,
        });
      }

      // Create the updated notes array with memory limit
      const existingNotes = selectedTrack.midiData?.notes || [];
      
      // Prevent memory issues by limiting total notes (configurable)
      const MAX_NOTES_PER_TRACK = 10000; // ~10k notes should be plenty for most use cases
      if (existingNotes.length >= MAX_NOTES_PER_TRACK) {
        console.warn(`Track ${selectedTrack.id} has reached maximum note limit (${MAX_NOTES_PER_TRACK}), ignoring new note`);
        return;
      }
      
      const updatedNotes = [...existingNotes, sanitizedNote];

      // Update the track
      updateTrack(selectedTrack.id, {
        midiData: {
          ...selectedTrack.midiData,
          notes: updatedNotes,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('🎹 VirtualPiano: After update call', {
          updatedNotesLength: updatedNotes.length,
        });
      }

      setNoteCount((prev) => prev + 1);
    },
    [selectedTrack, updateTrack],
  );

  // Handle when playback is stopped with notes still held
  const handlePlaybackStopped = useCallback(() => {
    notesInProgressRef.current.forEach((noteData, note) => {
      // Finalize any held notes using precise timing
      const preciseEndTime = getPreciseCurrentTime();
      const endBeat = convertTimeToBeat(preciseEndTime);
      noteData.duration = Math.max(0.125, endBeat - noteData.startTime);
      addNoteToTrack(noteData);

      // Make sure to stop the sound
      stopNoteOnSelectedTrack(note);
    });

    notesInProgressRef.current.clear();
    setActiveNotes([]);
  }, [getPreciseCurrentTime, convertTimeToBeat, addNoteToTrack, stopNoteOnSelectedTrack]);

  // Main note event handler
  const handleNoteClick = useCallback(
    (note, type) => {
      if (!selectedTrack) {
        console.warn('No MIDI track selected');
        return;
      }

      if (type === 'down') {
        // Always play the note sound
        playNoteOnSelectedTrack(note, 100);
        setActiveNotes((prev) => [...prev, note]);

        // If recording, start tracking this note
        if (isRecording) {
          // Use precise timing that matches the recording timer
          const preciseTime = getPreciseCurrentTime();
          const beatPosition = convertTimeToBeat(preciseTime);
          const quantizedBeat = quantizeBeat(beatPosition);

          if (process.env.NODE_ENV === 'development') {
            console.log(`🎹 UNIFIED COORDINATE DEBUG - Note Start:`, {
              currentTime: currentTime.toFixed(3),
              preciseTime: preciseTime.toFixed(3),
              tempo: tempo,
              beatPosition: beatPosition.toFixed(3),
              quantizedBeat: quantizedBeat.toFixed(3),
              coordinateSystem: 'BEATS_TO_SECONDS_IN_MIDITRACK',
              expectedSecondsInMIDITrack: (quantizedBeat * (60 / tempo)).toFixed(3),
              secondsPerBeat: (60 / tempo).toFixed(3),
              timeDifference: (preciseTime - currentTime).toFixed(3),
              note: note,
            });
          }

          const noteData = {
            id: generateNoteId(),
            note: note,
            velocity: 100,
            startTime: quantizedBeat, // Store in beats - will be converted to seconds in MIDITrack rendering
            startTimeSeconds: quantizedBeat * (60 / tempo), // Store seconds for debugging
            duration: 0, // Will be set on note up in beats - will be converted to seconds in MIDITrack rendering
          };

          notesInProgressRef.current.set(note, noteData);
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `🎵 Recording note ${note} at beat ${quantizedBeat.toFixed(3)} (time: ${currentTime.toFixed(3)}s)`,
            );
          }
        }
      } else if (type === 'up') {
        // Always stop the note sound
        stopNoteOnSelectedTrack(note);
        setActiveNotes((prev) => prev.filter((n) => n !== note));

        // If we were recording this note, finalize it
        if (isRecording && notesInProgressRef.current.has(note)) {
          const noteData = notesInProgressRef.current.get(note);
          const preciseEndTime = getPreciseCurrentTime();
          const endBeat = convertTimeToBeat(preciseEndTime);
          const quantizedEndBeat =
            quantizeValue > 0 ? quantizeBeat(endBeat) : endBeat;

          // Calculate duration
          noteData.duration = Math.max(
            0.125,
            quantizedEndBeat - noteData.startTime,
          );

          if (process.env.NODE_ENV === 'development') {
            console.log(`🎹 UNIFIED COORDINATE DEBUG - Note End:`, {
              note: note,
              preciseEndTime: preciseEndTime.toFixed(3),
              endBeat: endBeat.toFixed(3),
              quantizedEndBeat: quantizedEndBeat.toFixed(3),
              startBeat: noteData.startTime.toFixed(3),
              duration: noteData.duration.toFixed(3),
              coordinateSystem: 'BEATS_TO_SECONDS_IN_MIDITRACK',
              expectedDurationInSeconds: (noteData.duration * (60 / tempo)).toFixed(3),
              currentTime: currentTime.toFixed(3),
            });
          }

          // Add to track
          addNoteToTrack(noteData);
          notesInProgressRef.current.delete(note);
        }
      }
    },
    [
      selectedTrack,
      playNoteOnSelectedTrack,
      stopNoteOnSelectedTrack,
      isRecording,
      isPlaying,
      currentTime,
      convertTimeToBeat,
      quantizeBeat,
      generateNoteId,
      addNoteToTrack,
    ],
  );

  // Handle modal close
  const handleClose = useCallback(() => {
    // Stop all active notes
    activeNotes.forEach((note) => {
      stopNoteOnSelectedTrack(note);
    });
    setActiveNotes([]);

    // Clear any notes in progress
    notesInProgressRef.current.clear();

    onHide();
  }, [activeNotes, stopNoteOnSelectedTrack, onHide]);

  // Reset note count when track changes
  useEffect(() => {
    setNoteCount(0);
  }, [selectedTrackId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      // Number keys 1-5 for quantization
      if (e.key >= '1' && e.key <= '5') {
        const quantizeMap = {
          1: 0, // Off
          2: 1, // 1/4
          3: 0.5, // 1/8
          4: 0.25, // 1/16
          5: 0.125, // 1/32
        };
        setQuantizeValue(quantizeMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show]);

  // Calculate current measure and beat
  const getCurrentPosition = () => {
    const beat = convertTimeToBeat(currentTime);
    const measure = Math.floor(beat / 4) + 1;
    const beatInMeasure = (beat % 4) + 1;
    return `${measure}:${beatInMeasure.toFixed(1)}`;
  };

  // Debug: Log selected track details
  useEffect(() => {
    if (selectedTrack) {
      console.log('🔍 VirtualPiano: Selected track details', {
        id: selectedTrack.id,
        name: selectedTrack.name,
        type: selectedTrack.type,
        hasMidiData: !!selectedTrack.midiData,
        notesArray: selectedTrack.midiData?.notes,
        notesLength: selectedTrack.midiData?.notes?.length || 0,
        fullTrack: selectedTrack,
      });
    }
  }, [selectedTrack]);

  useEffect(() => {
    const midiTrack = tracks.find(
      (t) => t.id === selectedTrackId && t.type === 'midi',
    );
    if (midiTrack) {
      console.log('🔄 VirtualPiano: Track updated', {
        trackId: midiTrack.id,
        notesLength: midiTrack.midiData?.notes?.length || 0,
        notes: midiTrack.midiData?.notes,
      });
    }
  }, [tracks, selectedTrackId]);

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
      backdrop="static"
      keyboard={true}
      className="virtual-piano-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <MdPiano size={24} />
          Virtual Piano - {selectedTrack?.name || 'No MIDI Track Selected'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Status Bar */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-3">
            {/* Recording Status */}
            <div className="d-flex align-items-center gap-2">
              {isRecording ? (
                <>
                  <FaCircle className="text-danger blink" size={12} />
                  <span className="text-danger fw-bold">RECORDING</span>
                </>
              ) : isPlaying ? (
                <>
                  <FaCircle className="text-success" size={12} />
                  <span className="text-success">Playing (not recording)</span>
                </>
              ) : (
                <>
                  <FaStop className="text-secondary" size={12} />
                  <span className="text-secondary">Ready</span>
                </>
              )}
            </div>

            {/* Position Display */}
            {isPlaying && (
              <Badge bg="dark" className="d-flex align-items-center gap-1">
                <FaClock size={10} />
                {getCurrentPosition()}
              </Badge>
            )}

            {/* Note Counter */}
            {isRecording && noteCount > 0 && (
              <Badge bg="info">
                {noteCount} note{noteCount !== 1 ? 's' : ''} recorded
              </Badge>
            )}
          </div>

          {/* Quantization Controls */}
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Quantize:</span>
            <ButtonGroup size="sm">
              <Button
                variant={quantizeValue === 0 ? 'primary' : 'outline-secondary'}
                onClick={() => setQuantizeValue(0)}
                title="No quantization (1)"
              >
                Off
              </Button>
              <Button
                variant={quantizeValue === 1 ? 'primary' : 'outline-secondary'}
                onClick={() => setQuantizeValue(1)}
                title="1/4 note (2)"
              >
                1/4
              </Button>
              <Button
                variant={
                  quantizeValue === 0.5 ? 'primary' : 'outline-secondary'
                }
                onClick={() => setQuantizeValue(0.5)}
                title="1/8 note (3)"
              >
                1/8
              </Button>
              <Button
                variant={
                  quantizeValue === 0.25 ? 'primary' : 'outline-secondary'
                }
                onClick={() => setQuantizeValue(0.25)}
                title="1/16 note (4)"
              >
                1/16
              </Button>
              <Button
                variant={
                  quantizeValue === 0.125 ? 'primary' : 'outline-secondary'
                }
                onClick={() => setQuantizeValue(0.125)}
                title="1/32 note (5)"
              >
                1/32
              </Button>
            </ButtonGroup>
          </div>
        </div>

        {/* Piano Keyboard */}
        <div className="piano-container">
          {selectedTrack ? (
            <PianoKeyboard
              startNote={36} // C2
              endNote={84} // C6
              activeNotes={activeNotes}
              onNoteClick={handleNoteClick}
              width={740}
              height={140}
              showNoteNames={true}
            />
          ) : (
            <div className="text-center py-5 text-muted">
              <MdPiano size={48} className="mb-3" />
              <p>Please select a MIDI track to use the virtual piano</p>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-3 text-muted small">
          <p className="mb-1">
            <strong>Tips:</strong> Click and drag across keys to play
            glissandos. Press number keys 1-5 to change quantization.
          </p>
          {!isRecording && selectedTrack && (
            <p className="mb-0 text-warning">
              ⚠️ Not recording - notes will play but won't be saved to the track.
              Click the record button on the track to start recording with countdown.
            </p>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-muted small">
            {selectedTrack && `${tempo} BPM`}
          </div>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
