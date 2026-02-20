// components/audio/DAW/Multitrack/MultitrackEditor.js
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  Container,
  Row,
  Col,
  ButtonGroup,
  ToggleButton,
} from 'react-bootstrap';
import {
  FaPlus,
  FaCut,
  FaCopy,
  FaPaste,
  FaUndo,
  FaRedo,
  FaTrash,
  FaFileImport,
  FaDatabase,
  FaMicrophone,
  FaMusic,
  FaKeyboard,
  FaMousePointer,
  FaHandPaper,
  FaMagnet,
} from 'react-icons/fa';
import { RiScissors2Fill } from 'react-icons/ri';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { Dropdown } from 'react-bootstrap';
import { getDAWActivityLogger } from '../../../../lib/activity/DAWActivityLogger';
import AudioTrack from './AudioTrack';
import MIDITrack from './MIDITrack';
import MultitrackTransport from './MultitrackTransport';
import ClipEffectsRack from './ClipEffectsRack';
import MultitrackTimeline from './MultitrackTimeline';
import TakesImportModal from './TakesImportModal';
import MultitrackMixdown from './MultitrackMixdown';
import MIDIInputManager from './MIDIInputManager';
import MIDIDeviceSelector from './MIDIDeviceSelector';
import PianoKeyboard from './PianoKeyboard';
import clipClipboard from './ClipClipboard';
import SelectionOverlay from './SelectionOverlay';
import {
  splitClipsAtTime,
  rippleDelete,
  findClipsInRange,
  duplicateClips,
  quantizeClips,
} from './clipOperations';

// Create singleton MIDI manager
const midiInputManager = new MIDIInputManager();
if (typeof window !== 'undefined') window.__midiInputManager = midiInputManager;

export default function MultitrackEditor({ availableTakes: propTakes = [], logOperation = null }) {
  const tracksScrollRef = useRef(null);
  const tracksInnerRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const isSyncingScrollRef = useRef(false);

  const {
    tracks = [],
    addTrack,
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    selectedClipId,
    setSelectedClipId,
    selectedClipIds,
    setSelectedClipIds,
    currentTime,
    duration,
    isPlaying,
    soloTrackId,
    setSoloTrackId,
    // tool & snap controls
    editorTool,
    setEditorTool,
    snapEnabled,
    setSnapEnabled,
    gridSizeSec,
    setGridSizeSec,
    // removed old track-based effects modal state
    isAnyTrackRecording,
    scrollResetCallbackRef,
  } = useMultitrack();

  const [showClipEffectsModal, setShowClipEffectsModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showTakesModal, setShowTakesModal] = useState(false);
  // Use propTakes directly instead of state since it's managed by RecordingContext
  const availableTakes = propTakes;
  
  console.log('🎛️ MultitrackEditor: Available takes for modal:', availableTakes);
  const [midiInputActive, setMidiInputActive] = useState(false);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState(null);
  const [showPiano, setShowPiano] = useState(false);
  const [activeNotes, setActiveNotes] = useState([]);
  const pianoNoteHandlerRef = useRef(null);

  // Track undo/redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Debug: Log when tracks change
  useEffect(() => {
    console.log('📊 Tracks state changed:', {
      trackCount: tracks.length,
      tracks: tracks.map(t => ({
        id: t.id,
        name: t.name,
        clipCount: t.clips?.length || 0,
        clipIds: (t.clips || []).map(c => c.id)
      }))
    });
  }, [tracks]);

  // Use ref to ensure we always have the latest selectedClipIds value
  const selectedClipIdsRef = useRef(selectedClipIds);
  useEffect(() => {
    selectedClipIdsRef.current = selectedClipIds;
  }, [selectedClipIds]);

  // Get selected track and clips
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  // Support both single selection (selectedClipId) and multi-selection (selectedClipIds)
  const selectedClips = (() => {
    // Use ref value to ensure we get the latest selectedClipIds
    const currentSelectedClipIds = selectedClipIdsRef.current;

    // If we have multiple selections, use those
    if (currentSelectedClipIds && currentSelectedClipIds.length > 0) {
      // Get all clips from all tracks that match selectedClipIds
      const allSelectedClips = [];
      tracks.forEach(track => {
        if (track.clips) {
          const trackClips = track.clips.filter(clip =>
            currentSelectedClipIds.includes(clip.id)
          );
          allSelectedClips.push(...trackClips);
        }
      });
      return allSelectedClips;
    }
    // Fall back to single selection
    else if (selectedClipId && selectedTrack?.clips) {
      return selectedTrack.clips.filter((c) => c.id === selectedClipId);
    }
    return [];
  })();

  // Handle copy - supports batch copying of multiple selected clips
  const handleCopy = useCallback(() => {
    if (selectedClips.length === 0) return;

    // Note: clipClipboard.copy expects trackId for context, but with multi-selection
    // clips might be from different tracks. Pass first track's ID or null
    const firstTrackId = selectedTrack?.id ||
      (selectedClips.length > 0 && tracks.find(t =>
        t.clips?.some(c => c.id === selectedClips[0].id))?.id);

    clipClipboard.copy(selectedClips, firstTrackId);
    console.log('Copied', selectedClips.length, 'clips');

    // Log copy operation
    try {
      const activityLogger = getDAWActivityLogger();
      if (activityLogger?.isActive) {
        if (selectedClips.length > 1) {
          activityLogger.logBatchOperation('copy', selectedClips.length);
        } else {
          activityLogger.logClipOperation('copy', {
            clipId: selectedClips[0]?.id
          });
        }
      }

      // Log for study protocol (Activity 3)
      if (logOperation) {
        logOperation('clip_copy', { clipCount: selectedClips.length });
      }
    } catch (error) {
      console.error('📊 Error logging copy operation:', error);
    }
  }, [selectedTrack, selectedClips, tracks, logOperation]);

  // Handle cut - supports batch cutting of multiple selected clips
  const handleCut = useCallback(() => {
    if (selectedClips.length === 0) return;

    // Note: clipClipboard.cut expects trackId for context, but with multi-selection
    // clips might be from different tracks. Pass first track's ID or null
    const firstTrackId = selectedTrack?.id ||
      (selectedClips.length > 0 && tracks.find(t =>
        t.clips?.some(c => c.id === selectedClips[0].id))?.id);

    const clipIds = clipClipboard.cut(selectedClips, firstTrackId);
    const clipCount = selectedClips.length;

    // Use ref value to ensure we get the latest selectedClipIds
    const currentSelectedClipIds = selectedClipIdsRef.current;

    // For multi-selection across tracks, update all affected tracks
    if (currentSelectedClipIds && currentSelectedClipIds.length > 0) {
      // Group clips by track for efficient updates
      const clipsByTrack = {};
      tracks.forEach(track => {
        if (track.clips) {
          const clipsToRemove = track.clips.filter(clip =>
            clipIds.includes(clip.id)
          );
          if (clipsToRemove.length > 0) {
            clipsByTrack[track.id] = clipsToRemove.map(c => c.id);
          }
        }
      });

      // Update each affected track
      Object.entries(clipsByTrack).forEach(([trackId, clipIdsToRemove]) => {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          updateTrack(trackId, {
            clips: track.clips.filter(c => !clipIdsToRemove.includes(c.id))
          });
        }
      });

      // Clear multi-selection
      setSelectedClipIds([]);
    }
    // Single track cut (backward compatibility)
    else if (selectedTrack) {
      updateTrack(selectedTrack.id, {
        clips: selectedTrack.clips.filter((c) => !clipIds.includes(c.id)),
      });
    }

    setSelectedClipId(null);
    console.log('Cut', selectedClips.length, 'clips');

    // Log cut operation
    try {
      const activityLogger = getDAWActivityLogger();
      if (activityLogger?.isActive) {
        if (clipCount > 1) {
          activityLogger.logBatchOperation('cut', clipCount);
        } else {
          activityLogger.logClipOperation('cut', {
            clipId: clipIds[0]
          });
        }
      }
    } catch (error) {
      console.error('📊 Error logging cut operation:', error);
    }
  }, [selectedTrack, selectedClips, tracks, updateTrack, setSelectedClipId, setSelectedClipIds]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (!selectedTrack || !clipClipboard.hasContent()) return;

    // Paste at current playhead position
    const pastePosition = currentTime;
    const newClips = clipClipboard.paste(pastePosition, selectedTrack.id);

    if (newClips.length > 0) {
      updateTrack(selectedTrack.id, {
        clips: [...(selectedTrack.clips || []), ...newClips],
      });

      // Select first pasted clip
      setSelectedClipId(newClips[0].id);
      console.log('Pasted', newClips.length, 'clips at', pastePosition);

      // Log paste operation
      try {
        const activityLogger = getDAWActivityLogger();
        if (activityLogger?.isActive) {
          activityLogger.logClipOperation('paste', {
            clipCount: newClips.length,
            pastePosition,
            targetTrackId: selectedTrack.id
          });
        }

        // Log for study protocol (Activity 3)
        if (logOperation) {
          logOperation('clip_paste', { clipCount: newClips.length, pastePosition });
        }
      } catch (error) {
        console.error('📊 Error logging paste operation:', error);
      }
    }
  }, [selectedTrack, currentTime, updateTrack, setSelectedClipId, logOperation]);

  // Handle delete - supports batch deletion of multiple selected clips
  const handleDelete = useCallback(() => {
    // Use ref value to ensure we get the latest selectedClipIds
    const currentSelectedClipIds = selectedClipIdsRef.current;

    // Check if we have any selection at all
    const hasMultiSelection = currentSelectedClipIds && currentSelectedClipIds.length > 0;
    const hasSingleSelection = selectedClipId && selectedTrack;

    console.log('🗑️ Delete handler called:', {
      selectedClipIds: currentSelectedClipIds,
      selectedClipIdsLength: currentSelectedClipIds?.length,
      selectedClipId,
      hasMultiSelection,
      hasSingleSelection,
      selectedTrack: selectedTrack?.id
    });

    if (!hasMultiSelection && !hasSingleSelection) {
      console.log('🗑️ No selection to delete, returning');
      return;
    }

    const clipCount = hasMultiSelection ? currentSelectedClipIds.length : 1;

    // For multi-selection, delete clips from all tracks
    if (hasMultiSelection) {
      console.log(`🗑️ Deleting ${currentSelectedClipIds.length} clips:`, currentSelectedClipIds);

      // Instead of using tracks from closure, use updateTrack with function form
      // to access current track state
      tracks.forEach(track => {
        // Use function form of updateTrack to get current track state
        updateTrack(track.id, (currentTrack) => {
          if (!currentTrack.clips || currentTrack.clips.length === 0) {
            return {}; // No changes needed
          }

          const clipsToDelete = currentTrack.clips.filter(clip =>
            currentSelectedClipIds.includes(clip.id)
          );

          if (clipsToDelete.length > 0) {
            const remainingClips = currentTrack.clips.filter(c =>
              !currentSelectedClipIds.includes(c.id)
            );
            console.log(`🗑️ Track ${track.id}: Removing ${clipsToDelete.length} clips, ${remainingClips.length} remaining`);
            return { clips: remainingClips };
          }

          return {}; // No changes needed for this track
        });
      });

      console.log('🗑️ Clearing selections');
      // Clear selections
      setSelectedClipIds([]);
      setSelectedClipId(null);
    }
    // For single selection (backward compatibility)
    else if (hasSingleSelection) {
      console.log(`Deleting single clip: ${selectedClipId}`);

      updateTrack(selectedTrack.id, (currentTrack) => {
        if (!currentTrack.clips) return {};
        return {
          clips: currentTrack.clips.filter((c) => c.id !== selectedClipId)
        };
      });

      setSelectedClipId(null);
    }

    // Log deletion
    try {
      const activityLogger = getDAWActivityLogger();
      if (activityLogger?.isActive) {
        if (clipCount > 1) {
          activityLogger.logBatchOperation('delete', clipCount);
        } else {
          activityLogger.logClipOperation('delete', {
            clipId: selectedClipId || currentSelectedClipIds[0]
          });
        }
      }
    } catch (error) {
      console.error('📊 Error logging delete operation:', error);
    }
  }, [selectedTrack, selectedClipId, tracks, updateTrack, setSelectedClipId, setSelectedClipIds]);

  // Handle split at playhead
  const handleSplitAtPlayhead = useCallback(() => {
    let clipsAffected = 0;

    tracks.forEach((track) => {
      if (!track.clips || track.clips.length === 0) return;

      const newClips = splitClipsAtTime(track.clips, currentTime);
      if (newClips.length > track.clips.length) {
        clipsAffected += newClips.length - track.clips.length;
        updateTrack(track.id, { clips: newClips });
      }
    });

    // Log split operation if clips were affected
    if (clipsAffected > 0) {
      try {
        const activityLogger = getDAWActivityLogger();
        if (activityLogger?.isActive) {
          activityLogger.logClipOperation('split', {
            splitTime: currentTime,
            clipsAffected,
            scope: 'all'
          });
        }
      } catch (error) {
        console.error('📊 Error logging split operation:', error);
      }
    }
  }, [tracks, currentTime, updateTrack]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    if (!selectedTrack || selectedClips.length === 0) return;

    // Find the end of selected clips
    const maxEnd = Math.max(
      ...selectedClips.map((c) => (c.start || 0) + (c.duration || 0)),
    );
    const minStart = Math.min(...selectedClips.map((c) => c.start || 0));
    const offset = maxEnd - minStart;

    const duplicated = duplicateClips(selectedClips, offset);

    updateTrack(selectedTrack.id, {
      clips: [...selectedTrack.clips, ...duplicated],
    });

    // Select first duplicated clip
    if (duplicated.length > 0) {
      setSelectedClipId(duplicated[0].id);
    }

    // Log duplicate operation
    try {
      const activityLogger = getDAWActivityLogger();
      if (activityLogger?.isActive) {
        activityLogger.logClipOperation('duplicate', {
          clipCount: duplicated.length,
          offset
        });
      }
    } catch (error) {
      console.error('📊 Error logging duplicate operation:', error);
    }
  }, [selectedTrack, selectedClips, updateTrack, setSelectedClipId]);

  // Handle quantize
  const handleQuantize = useCallback(() => {
    if (!selectedTrack || !snapEnabled) return;

    const quantized = quantizeClips(
      selectedClipId
        ? selectedTrack.clips.filter((c) => c.id === selectedClipId)
        : selectedTrack.clips,
      gridSizeSec,
    );

    updateTrack(selectedTrack.id, { clips: quantized });
  }, [selectedTrack, selectedClipId, snapEnabled, gridSizeSec, updateTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      console.log('🎹 MultitrackEditor keydown:', {
        key: e.key,
        code: e.code,
        target: e.target.tagName,
        selectedClipIds: selectedClipIdsRef.current,
        selectedClipId,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey
      });

      // Tool shortcuts with logging
      if (e.key === '1') {
        setEditorTool('select');
        try {
          const activityLogger = getDAWActivityLogger();
          if (activityLogger?.isActive) {
            activityLogger.logToolUsed('select');
          }
        } catch (error) {
          console.error('📊 Error logging tool change:', error);
        }
      }
      if (e.key === '2') {
        setEditorTool('clip');
        try {
          const activityLogger = getDAWActivityLogger();
          if (activityLogger?.isActive) {
            activityLogger.logToolUsed('clip');
          }
        } catch (error) {
          console.error('📊 Error logging tool change:', error);
        }
      }
      if (e.key === '3') {
        setEditorTool('cut');
        try {
          const activityLogger = getDAWActivityLogger();
          if (activityLogger?.isActive) {
            activityLogger.logToolUsed('cut');
          }
        } catch (error) {
          console.error('📊 Error logging tool change:', error);
        }
      }

      // Edit shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        e.preventDefault();
        handleCut();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        console.log('🎹 Delete/Backspace pressed, calling handleDelete');
        e.preventDefault();
        e.stopPropagation(); // Prevent other handlers from interfering
        handleDelete();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplitAtPlayhead();
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleQuantize();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleDuplicate,
    handleSplitAtPlayhead,
    handleQuantize,
    setEditorTool,
    setSelectedClipIds,
    selectedClipId, // Keep this for single selection
  ]);

  // MIDI setup
  useEffect(() => {
    midiInputManager.addListener('editor', (noteData) => {
      if (midiInputActive && selectedTrackId) {
        const track = tracks.find((t) => t.id === selectedTrackId);
        if (track && track.type === 'midi' && track.isRecording) {
          console.log('MIDI Editor received note:', noteData);
        }
      }
    });

    return () => {
      midiInputManager.removeListener('editor');
    };
  }, [midiInputActive, selectedTrackId, tracks]);

  const handleAddAudioTrack = () => {
    addTrack({ type: 'audio' });

    // Log for study protocol (Activity 3)
    if (logOperation) {
      logOperation('track_added', { trackType: 'audio' });
    }
  };

  const handleAddMIDITrack = () => {
    addTrack({
      type: 'midi',
      midiData: { notes: [], tempo: 120 },
      clips: [], // Initialize empty clips array for MIDI tracks
    });

    // Log for study protocol (Activity 3)
    if (logOperation) {
      logOperation('track_added', { trackType: 'midi' });
    }
  };


  const handleImportTake = (take) => {
    addTrack({
      type: 'audio',
      name: take.name,
      audioURL: take.audioURL,
      clips: [
        {
          id: `clip-${Date.now()}`,
          start: 0,
          duration: take.duration || 0,
          src: take.audioURL,
          offset: 0,
          color: '#7bafd4',
        },
      ],
    });

    // Log for study protocol (Activity 3)
    if (logOperation) {
      logOperation('takes_imported', { takeName: take.name });
    }
  };

  const canPaste = clipClipboard.hasContent();
  const hasSelection = (selectedClipId !== null) || (selectedClipIdsRef.current && selectedClipIdsRef.current.length > 0);

  // Update playhead positions for both timeline and tracks
  useEffect(() => {
    // Remove any old playhead elements that might be lingering
    const oldPlayhead = document.getElementById('multitrack-playhead');
    if (oldPlayhead) {
      oldPlayhead.remove();
    }

    const updatePlayheads = () => {
      const timelinePlayhead = document.getElementById(
        'multitrack-timeline-playhead',
      );
      const tracksPlayhead = document.getElementById(
        'multitrack-tracks-playhead',
      );

      // Allow playhead updates during recording or playback even when project duration is 0
      // Check both RecordingManager AND track.isRecording for compatibility with both systems
      const hasActiveRecording = (isAnyTrackRecording && isAnyTrackRecording()) || tracks.some(t => t.isRecording);
      if ((!duration || duration === 0) && !hasActiveRecording && !isPlaying) return;

      // Derive content width from the shared inner container so 1s = 1s across UI
      const inner = document.getElementById('multitrack-tracks-inner');
      // All tracks now use 230px controls for consistency
      const controlsWidth = 230;
      const gutterWidth = 80 + controlsWidth; // sidebar + track controls

      // Calculate FIXED pixels per second based on zoom level only
      // At 100% zoom, we want 100 pixels per second
      // This ensures consistent timing regardless of project duration
      const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
      const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * (zoomLevel / 100);

      // Playhead position is simply currentTime * pixelsPerSecond (no scaling needed)
      const x = currentTime * pixelsPerSecond;

      if (timelinePlayhead) {
        timelinePlayhead.style.left = `${x}px`;
      }
      if (tracksPlayhead) {
        tracksPlayhead.style.left = `${x}px`;
      }

      // Auto-scroll to keep playhead visible during playback/recording
      if ((isPlaying || hasActiveRecording) && tracksScrollRef.current) {
        const scrollContainer = tracksScrollRef.current;
        const scrollLeft = scrollContainer.scrollLeft;
        const containerWidth = scrollContainer.clientWidth;

        // Target: keep playhead at 75% of visible area (matching MIDI track behavior)
        const targetPlayheadPosition = containerWidth * 0.75;
        const playheadPositionInViewport = x - scrollLeft;

        // If playhead is going off screen (past 85%) or too far left (before 65%), scroll to keep it at 75%
        if (playheadPositionInViewport > containerWidth * 0.85 || playheadPositionInViewport < containerWidth * 0.65) {
          const newScrollLeft = Math.max(0, x - targetPlayheadPosition);
          scrollContainer.scrollLeft = newScrollLeft;

          // Sync timeline scroll
          if (timelineScrollRef.current) {
            timelineScrollRef.current.scrollLeft = newScrollLeft;
          }
        }
      }
    };

    updatePlayheads();

    // Update on animation frame if playing OR if any track is recording
    let animationId;
    const hasActiveRecording = isAnyTrackRecording && isAnyTrackRecording();
    if (isPlaying || hasActiveRecording) {
      const animate = () => {
        updatePlayheads();
        animationId = requestAnimationFrame(animate);
      };
      animate();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [duration, zoomLevel, isPlaying, tracks, currentTime]); // Include tracks to detect recording state changes and currentTime for playhead updates

  // Register scroll reset callback with context
  useEffect(() => {
    if (scrollResetCallbackRef) {
      scrollResetCallbackRef.current = () => {
        // Reset scroll position to beginning
        if (tracksScrollRef.current) {
          tracksScrollRef.current.scrollLeft = 0;
        }
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollLeft = 0;
        }
      };
    }

    return () => {
      if (scrollResetCallbackRef) {
        scrollResetCallbackRef.current = null;
      }
    };
  }, [scrollResetCallbackRef]);

  return (
    <Container fluid className={`multitrack-editor multitrack-editor-container p-3 ${showPiano ? 'piano-visible' : ''}`}>
      <Row className="mb-3 main-controls-row">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex gap-2 align-items-center controls-left">
              {/* Tool Selection */}
              <ButtonGroup size="sm">
                <ToggleButton
                  id="tool-select"
                  type="radio"
                  variant="outline-secondary"
                  name="tool"
                  value="select"
                  checked={editorTool === 'select'}
                  onChange={(e) => {
                    setEditorTool(e.currentTarget.value);
                    try {
                      const activityLogger = getDAWActivityLogger();
                      if (activityLogger?.isActive) {
                        activityLogger.logToolUsed('select');
                      }
                    } catch (error) {
                      console.error('📊 Error logging tool change:', error);
                    }
                  }}
                  title="Selection Tool (1)"
                >
                  <FaMousePointer />
                </ToggleButton>
                <ToggleButton
                  id="tool-clip"
                  type="radio"
                  variant="outline-secondary"
                  name="tool"
                  value="clip"
                  checked={editorTool === 'clip'}
                  onChange={(e) => {
                    setEditorTool(e.currentTarget.value);
                    try {
                      const activityLogger = getDAWActivityLogger();
                      if (activityLogger?.isActive) {
                        activityLogger.logToolUsed('clip');
                      }
                    } catch (error) {
                      console.error('📊 Error logging tool change:', error);
                    }
                  }}
                  title="Clip Tool (2)"
                >
                  <FaHandPaper />
                </ToggleButton>
                <ToggleButton
                  id="tool-cut"
                  type="radio"
                  variant="outline-secondary"
                  name="tool"
                  value="cut"
                  checked={editorTool === 'cut'}
                  onChange={(e) => {
                    setEditorTool(e.currentTarget.value);
                    try {
                      const activityLogger = getDAWActivityLogger();
                      if (activityLogger?.isActive) {
                        activityLogger.logToolUsed('cut');
                      }
                    } catch (error) {
                      console.error('📊 Error logging tool change:', error);
                    }
                  }}
                  title="Cut Tool (3)"
                >
                  <RiScissors2Fill />
                </ToggleButton>
              </ButtonGroup>

              {/* Clip Operations */}
              <div className="vr" />
              <ButtonGroup size="sm">
                <Button
                  variant="outline-secondary"
                  onClick={handleCut}
                  disabled={!hasSelection}
                  title="Cut (Cmd/Ctrl+X)"
                >
                  <FaCut />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleCopy}
                  disabled={!hasSelection}
                  title="Copy (Cmd/Ctrl+C)"
                >
                  <FaCopy />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handlePaste}
                  disabled={!canPaste}
                  title="Paste (Cmd/Ctrl+V)"
                >
                  <FaPaste />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleDelete}
                  disabled={!hasSelection}
                  title="Delete"
                >
                  <FaTrash />
                </Button>
              </ButtonGroup>

              {/* Snap controls */}
              <div className="vr" />
              <Button
                variant={snapEnabled ? 'secondary' : 'outline-secondary'}
                size="sm"
                onClick={() => setSnapEnabled(!snapEnabled)}
                title="Toggle Snap to Grid"
              >
                <FaMagnet />
              </Button>
              <select
                className="form-select form-select-sm"
                style={{ width: '100px' }}
                value={gridSizeSec}
                onChange={(e) => setGridSizeSec(parseFloat(e.target.value))}
                disabled={!snapEnabled}
              >
                <option value="0.01">1/100</option>
                <option value="0.0625">1/16</option>
                <option value="0.125">1/8</option>
                <option value="0.25">1/4</option>
                <option value="0.5">1/2</option>
                <option value="1">1 bar</option>
              </select>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleQuantize}
                disabled={!snapEnabled || !selectedTrack}
                title="Quantize (Q)"
              >
                Q
              </Button>
            </div>

            <div className="d-flex gap-2 controls-right">
              <Dropdown drop="down" align="end">
                <Dropdown.Toggle variant="primary" size="sm">
                  <FaPlus /> Add Track
                </Dropdown.Toggle>
                <Dropdown.Menu renderOnMount={true} popperConfig={{
                  strategy: 'fixed',
                  modifiers: [
                    {
                      name: 'offset',
                      options: {
                        offset: [0, 4],
                      },
                    },
                  ],
                }}>
                  <Dropdown.Item onClick={handleAddAudioTrack}>
                    <FaMicrophone /> Audio Track
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleAddMIDITrack}>
                    <FaKeyboard /> MIDI Track
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => setShowTakesModal(true)}>
                    <FaDatabase /> Import from Takes
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedClipId) {
                    setShowClipEffectsModal(true);

                    // Log for study protocol (Activity 3)
                    if (logOperation) {
                      logOperation('effects_rack_toggled', { clipId: selectedClipId });
                    }
                  } else {
                    alert('Please select a clip first to add effects.');
                  }
                }}
                disabled={!selectedClipId}
                title={selectedClipId ? "Add effects to selected clip" : "Select a clip first"}
              >
                Effects
              </Button>

              <MultitrackMixdown tracks={tracks} logOperation={logOperation} />
            </div>
          </div>
        </Col>
      </Row>

      {/* Transport Controls - MOVED TO TOP */}
      <Row className="mb-2">
        <Col>
          <MultitrackTransport 
            showPiano={showPiano}
            setShowPiano={setShowPiano}
            onPianoNoteHandler={(handler) => { pianoNoteHandlerRef.current = handler; }}
            onActiveNotesChange={setActiveNotes}
          />
        </Col>
      </Row>

      {/* Timeline */}
      <Row className="mb-2">
        <Col>
          <MultitrackTimeline
            zoomLevel={zoomLevel}
            scrollRef={timelineScrollRef}
            timelineExtent={(() => {
              // Calculate timeline extent (same logic as tracks container width)
              const hasRecording = isAnyTrackRecording && isAnyTrackRecording();
              const baseDuration = duration || 30;
              const maxClipEnd = tracks.reduce((max, track) => {
                if (!track.clips) return max;
                const trackEnd = track.clips.reduce((tMax, clip) => {
                  return Math.max(tMax, (clip.start || 0) + (clip.duration || 0));
                }, 0);
                return Math.max(max, trackEnd);
              }, 0);
              const WORKSPACE_BUFFER = 30; // Same buffer as tracks
              const maxDuration = 180; // Cap at 3 minutes
              const unboundedDuration = hasRecording
                ? Math.max(baseDuration, maxClipEnd + WORKSPACE_BUFFER, currentTime + 20)
                : Math.max(baseDuration, maxClipEnd + WORKSPACE_BUFFER);
              const effectiveDuration = Math.min(unboundedDuration, maxDuration);

              console.log(`📏 Timeline Extent Calculation:`, {
                duration,
                baseDuration,
                maxClipEnd,
                unboundedDuration,
                effectiveDuration,
                hasRecording,
                currentTime
              });

              return effectiveDuration;
            })()}
            onScroll={(e) => {
              if (!tracksScrollRef.current) return;
              if (isSyncingScrollRef.current) return;
              isSyncingScrollRef.current = true;
              try {
                tracksScrollRef.current.scrollLeft = e.target.scrollLeft;
              } finally {
                // Allow the reciprocal handler to run without ping-pong loops
                setTimeout(() => {
                  isSyncingScrollRef.current = false;
                }, 0);
              }
            }}
          />
        </Col>
      </Row>

      {/* Tracks */}
      <Row style={{ flex: 1, minHeight: 0, maxHeight: 'calc(100vh - 180px)' }}>
        <Col style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
          <div
            ref={tracksScrollRef}
            onScroll={(e) => {
              if (!timelineScrollRef.current) return;
              if (isSyncingScrollRef.current) return;
              isSyncingScrollRef.current = true;
              try {
                timelineScrollRef.current.scrollLeft = e.target.scrollLeft;
              } finally {
                setTimeout(() => {
                  isSyncingScrollRef.current = false;
                }, 0);
              }
            }}
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              position: 'relative',
              height: '100%',
            }}
            className={`tracks-container ${showPiano ? 'piano-visible' : ''}`}
          >
            <div
              id="multitrack-tracks-inner"
              ref={tracksInnerRef}
              style={(() => {
                // Compute dynamic width and grid size during recording
                const hasRecording = isAnyTrackRecording && isAnyTrackRecording();

                // Use FIXED pixels per second based on zoom level only
                const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
                const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * (zoomLevel / 100);

                // Calculate maxClipEnd to ensure canvas includes all clips
                const maxClipEnd = tracks.reduce((max, track) => {
                  if (!track.clips) return max;
                  const trackEnd = track.clips.reduce((tMax, clip) => {
                    return Math.max(tMax, (clip.start || 0) + (clip.duration || 0));
                  }, 0);
                  return Math.max(max, trackEnd);
                }, 0);

                // Calculate effective duration for the container
                const WORKSPACE_BUFFER = 30; // 30 seconds of extra workspace
                const maxDuration = 180; // Cap at 3 minutes total to prevent canvas overflow
                const baseDuration = duration || 30;
                const unboundedDuration = hasRecording
                  ? Math.max(baseDuration, maxClipEnd + WORKSPACE_BUFFER, currentTime + 20)
                  : Math.max(baseDuration, maxClipEnd + WORKSPACE_BUFFER);
                const effectiveDuration = Math.min(unboundedDuration, maxDuration);

                // Width = controls + (pixels per second * duration)
                const expandedWidth = 230 + (pixelsPerSecond * effectiveDuration);

                console.log(`📐 Tracks Container Width:`, {
                  duration,
                  baseDuration,
                  maxClipEnd,
                  pixelsPerSecond,
                  effectiveDuration,
                  expandedWidth,
                  zoomLevel
                });

                return {
                  position: 'relative',
                  minHeight: '600px',
                  width: `${expandedWidth}px`,
                  // Grid background removed - CSS backgrounds shift during width changes
                  // causing visual jarring during recording
                };
              })()}
            >
              {tracks.map((track, index) => {
                if (track.type === 'midi') {
                  return (
                    <MIDITrack
                      key={track.id}
                      track={track}
                      index={index}
                      zoomLevel={zoomLevel}
                    />
                  );
                } else {
                  // Use enhanced AudioTrack component for both 'audio' and 'recording' types
                  // This provides backward compatibility while consolidating functionality
                  return (
                    <AudioTrack
                      key={track.id}
                      track={track}
                      index={index}
                      zoomLevel={zoomLevel}
                      logOperation={logOperation}
                    />
                  );
                }
              })}

              {/* Global playhead that spans all tracks */}
              {tracks.length > 0 && (
                <div
                  id="multitrack-tracks-playhead"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '2px',
                    height: `${tracks.reduce((totalHeight, track) => {
                      // Calculate height based on track type
                      // Both audio and MIDI tracks are 200px tall for consistency
                      return totalHeight + 200;
                    }, 0)}px`,
                    backgroundColor: '#ff3030',
                    boxShadow: '0 0 3px rgba(255, 48, 48, 0.8)',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    marginLeft: '310px', // 80px sidebar + 230px controls
                  }}
                />
              )}

              {/* Selection Overlay for cross-track selection */}
              <SelectionOverlay containerRef={tracksInnerRef} zoomLevel={zoomLevel} />
            </div>
          </div>
        </Col>
      </Row>

      {/* Zoom Control */}
      <Row className="mt-2">
        <Col>
          <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
            <label className="mb-0" style={{ fontSize: '0.8rem' }}>Zoom:</label>
            <input
              type="range"
              min="10"
              max="500"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseInt(e.target.value))}
              style={{ width: '150px', height: '6px' }}
            />
            <span style={{ fontSize: '0.8rem', minWidth: '45px' }}>{zoomLevel}%</span>

            {/* Zoom presets */}
            <ButtonGroup size="sm" className="ms-2">
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(50)}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                50%
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(100)}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                100%
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(200)}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                200%
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(400)}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                400%
              </Button>
            </ButtonGroup>
          </div>
        </Col>
      </Row>

      {/* MIDI Device Selector */}
      {tracks.some((t) => t.type === 'midi') && (
        <MIDIDeviceSelector
          midiInputManager={midiInputManager}
          selectedDevice={selectedMidiDevice}
          onDeviceSelect={setSelectedMidiDevice}
          isActive={midiInputActive}
          onToggleActive={setMidiInputActive}
        />
      )}

      {/* Modals */}
      <TakesImportModal
        show={showTakesModal}
        onHide={() => setShowTakesModal(false)}
        takes={availableTakes}
        onImport={handleImportTake}
      />

      {/* Clip Effects Modal */}
      <ClipEffectsRack
        show={showClipEffectsModal}
        onHide={() => setShowClipEffectsModal(false)}
        selectedClipId={selectedClipId}
        logOperation={logOperation}
      />

      {/* Piano Section - Bottom of Editor */}
      {showPiano && (
        <Row className="mt-3">
          <Col>
            <div className="piano-keyboard-section">
              <div className="piano-keyboard-wrapper">
                <div className="piano-keyboard-info">
                  <small>
                    Playing on: <strong>{tracks.find(t => t.id === selectedTrackId && t.type === 'midi')?.name || 'No MIDI Track Selected'}</strong>
                  </small>
                  <small>
                    Click keys to play • Use Z/X/C… and Q/W/E… on your keyboard
                  </small>
                </div>
                <PianoKeyboard
                  startNote={36} // C2
                  endNote={84} // C6
                  activeNotes={activeNotes}
                  width={800}
                  height={120}
                  onNoteClick={(note, type) => {
                    if (pianoNoteHandlerRef.current) {
                      pianoNoteHandlerRef.current(note, type);
                    }
                  }}
                  captureComputerKeyboard={true}
                />
              </div>
            </div>
          </Col>
        </Row>
      )}

    </Container>
  );
}
