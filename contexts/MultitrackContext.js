// contexts/MultitrackContext.js
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import audioContextManager from '../components/audio/DAW/Multitrack/AudioContextManager';
import { createTransport } from '../components/audio/DAW/Multitrack/AudioEngine';
import RecordingManager from '../components/audio/DAW/Multitrack/recording/RecordingManager';
import { getDAWActivityLogger } from '../lib/activity/DAWActivityLogger';

const MultitrackContext = createContext();

export const useMultitrack = () => {
  const context = useContext(MultitrackContext);
  if (!context) {
    throw new Error('useMultitrack must be used within MultitrackProvider');
  }
  return context;
};

export const MultitrackProvider = ({ children, initialTracks = [] }) => {
  // Get activity logger instance
  const activityLogger = getDAWActivityLogger();

  // Track state - Initialize with provided tracks or empty array
  const [tracks, setTracks] = useState(initialTracks);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [soloTrackId, setSoloTrackId] = useState(null);

  // Multitrack playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Editor state
  const [activeRegion, setActiveRegion] = useState(null);
  const [editorTool, setEditorTool] = useState('select'); // 'select' | 'clip' | 'cut'
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedClipIds, setSelectedClipIds] = useState([]); // For multi-selection
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSizeSec, setGridSizeSec] = useState(0.1);

  // Effects modal state
  const [showEffectSelectionModal, setShowEffectSelectionModal] = useState(false);
  const [showEffectParametersModal, setShowEffectParametersModal] = useState(false);
  const [selectedEffectType, setSelectedEffectType] = useState(null);
  const [effectTargetTrackId, setEffectTargetTrackId] = useState(null);

  // Playback timer
  const playbackTimerRef = useRef(null);
  
  // Recording timer for MIDI recording
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const recordingInitialTimeRef = useRef(0);
  const currentTimeRef = useRef(currentTime);

  // MIDI-specific refs
  const trackInstrumentsRef = useRef({}); // Store instrument references for each track
  const midiSchedulerRef = useRef(null); // For future MIDI scheduling

  // Unified transport (single timebase for audio + MIDI)
  const transportRef = useRef(null);

  const trackPlayersRef = useRef({}); // trackId -> ClipPlayer instance

  useEffect(() => {
    // create a fresh transport when duration changes (so it clamps correctly)
    transportRef.current = createTransport({
      onTick: (t) => setCurrentTime(t),
      getProjectDurationSec: () => duration || 0,
    });
    return () => {
      try {
        transportRef.current?.stop?.();
      } catch {}
    };
  }, [duration]);

  // Get live transport time directly from AudioContext
  // This ensures components can sync with the exact same timing
  const getTransportTime = useCallback(() => {
    if (!transportRef.current) return 0;
    // Access the transport's currentTime getter directly
    return transportRef.current.currentTime || 0;
  }, []);

  // Check if any track is recording (using RecordingManager)
  const isAnyTrackRecording = useCallback(() => {
    return RecordingManager.hasActiveRecordings();
  }, []);

  // Check if specific track is recording
  const isTrackRecording = useCallback((trackId) => {
    return RecordingManager.isTrackRecording(trackId);
  }, []);

  // (removed tick and useEffect for old transport)

  // Clear any stuck mixdown state on component mount and initialize RecordingManager
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__MIXDOWN_ACTIVE__) {
      window.__MIXDOWN_ACTIVE__ = false;
      console.log('🔧 Startup: Cleared stuck mixdown state from previous session');
    }

    // Initialize RecordingManager with audio context
    const audioContext = audioContextManager.getContext();
    RecordingManager.initialize(audioContext);
    console.log('🎙️ MultitrackContext: RecordingManager initialized');

    // Subscribe to recording events to update track state
    const handleRecordingComplete = (data) => {
      console.log('🎙️ MultitrackContext: Recording complete', data);
      // This will be handled by the individual track components
    };

    RecordingManager.on('audio-recording-complete', handleRecordingComplete);
    RecordingManager.on('midi-recording-complete', handleRecordingComplete);

    return () => {
      RecordingManager.off('audio-recording-complete', handleRecordingComplete);
      RecordingManager.off('midi-recording-complete', handleRecordingComplete);
      RecordingManager.destroy();
    };
  }, []); // Run once on mount

  // Debug: Log when instruments change (only in development and when non-empty)
  useEffect(() => {
    const instrumentIds = Object.keys(trackInstrumentsRef.current);
    if (process.env.NODE_ENV === 'development' && instrumentIds.length > 0) {
      console.log(
        '🎻 Registered instruments:',
        instrumentIds,
        trackInstrumentsRef.current
      );
    }
  }, [tracks]); // Re-log when tracks change

  // (removed interval-based timer effect for updating current time)

  // Update duration when tracks change (clip-aware)
  useEffect(() => {
    let maxDuration = 0;

    // Seed per-track clip initializations when needed
    const initClipsById = new Map();

    // Pass 1: audio tracks — prefer clips to compute end; otherwise fallback to WS duration
    tracks.forEach((track) => {
      // If clips exist, compute end from clips
      if (Array.isArray(track.clips) && track.clips.length > 0) {
        const end = track.clips.reduce(
          (m, c) => Math.max(m, (c.start || 0) + (c.duration || 0)),
          0,
        );
        maxDuration = Math.max(maxDuration, end);
        return;
      }
      // No clips yet: fallback to the raw audio duration from wavesurfer
      if (track.wavesurferInstance) {
        try {
          const d = track.wavesurferInstance.getDuration() || 0;
          maxDuration = Math.max(maxDuration, d);
          if (d > 0 && track.type !== 'midi' && track.audioURL) {
            // Schedule an initial single clip so we can render/manipulate non-destructively later
            initClipsById.set(track.id, [
              {
                id: `clip-${track.id}`,
                start: 0,
                duration: d,
                color: track.color || '#7bafd4',
                src: track.audioURL,
                offset: 0,
              },
            ]);
          }
        } catch (e) {
          // ignore
        }
      }
    });

    // Pass 2: MIDI tracks — notes are in seconds
    tracks.forEach((track) => {
      if (track.type === 'midi' && track.midiData?.notes?.length > 0) {
        const lastSecond = track.midiData.notes.reduce((latest, note) => {
          const noteEnd = note.startTime + note.duration; // seconds
          return noteEnd > latest ? noteEnd : latest;
        }, 0);
        maxDuration = Math.max(maxDuration, lastSecond);
      }
    });

    // Apply any clip initializations in one state update
    if (initClipsById.size > 0) {
      setTracks((prev) =>
        prev.map((t) =>
          initClipsById.has(t.id) &&
          (!Array.isArray(t.clips) || t.clips.length === 0)
            ? { ...t, clips: initClipsById.get(t.id) }
            : t,
        ),
      );
    }

    console.log(`📐 MultitrackContext: Updating duration`, {
      maxDuration,
      trackCount: tracks.length,
      clipsPerTrack: tracks.map(t => ({
        id: t.id,
        type: t.type,
        clipCount: t.clips?.length || 0,
        clipEnds: t.clips?.map(c => (c.start || 0) + (c.duration || 0)) || []
      }))
    });

    setDuration(maxDuration);
  }, [tracks]);

  const registerTrackPlayer = useCallback((trackId, player) => {
    trackPlayersRef.current[trackId] = player;
  }, []);

  const unregisterTrackPlayer = useCallback((trackId) => {
    delete trackPlayersRef.current[trackId];
  }, []);

  // Track management
  const addTrack = useCallback(
    (trackData = {}) => {
      const newTrack = {
        id: Date.now(),
        name: trackData.name || `Track ${tracks.length + 1}`,
        type: trackData.type || 'audio', // 'audio' or 'midi'
        audioURL: trackData.audioURL || null,
        volume: trackData.volume || 1,
        pan: trackData.pan || 0,
        muted: trackData.muted || false,
        solo: trackData.solo || false,
        color: trackData.color || '#7bafd4',
        wavesurferInstance: null, // Will be set by Track component
        clips: trackData.clips || [], // Always initialize clips array
        isRecording: false, // Explicitly ensure recording is false
        armed: false, // Explicitly ensure not armed
        // Preserve any additional properties passed in (except isRecording/armed)
        ...trackData,
        isRecording: false, // Override any passed isRecording
        armed: false, // Override any passed armed
      };

      console.log('MultitrackContext: Adding track:', newTrack);

      setTracks((prev) => [...prev, newTrack]);

      // Log track addition
      try {
        if (activityLogger?.isActive) {
          activityLogger.logTrackAdded(newTrack.id, newTrack.type, newTrack.name);
        }
      } catch (error) {
        console.error('📊 Error logging track addition:', error);
      }

      return newTrack;
    },
    [tracks.length],
  );

  const removeTrack = useCallback(
    (trackId) => {
      // Clean up instrument reference if it's a MIDI track
      if (trackInstrumentsRef.current[trackId]) {
        console.log('🗑️ Removing instrument for track:', trackId);
        const instrument = trackInstrumentsRef.current[trackId];
        instrument.stopAllNotes?.();
        instrument.dispose?.();
        delete trackInstrumentsRef.current[trackId];
      }

      // Get track type before deletion for logging
      const trackToDelete = tracks.find(t => t.id === trackId);

      setTracks((prev) => prev.filter((track) => track.id !== trackId));
      if (selectedTrackId === trackId) {
        setSelectedTrackId(null);
      }
      if (soloTrackId === trackId) {
        setSoloTrackId(null);
      }

      // Log track deletion
      try {
        if (activityLogger?.isActive && trackToDelete) {
          activityLogger.logTrackDeleted(trackId, trackToDelete.type);
        }
      } catch (error) {
        console.error('📊 Error logging track deletion:', error);
      }
    },
    [selectedTrackId, soloTrackId, tracks],
  );

  /**
   * Update a single track by id.
   *
   * Usage:
   *   updateTrack(id, { muted: true });
   *   updateTrack(id, (t) => ({ muted: !t.muted }));
   *   updateTrack(id, { midiData: { tempo: 140 } }); // merges tempo without clobbering notes
   *   updateTrack(id, { midiData: newMidi }, { mergeMidiData: false }); // replace midiData wholesale
   *
   * - Accepts either a plain updates object or a function (track) => updates.
   * - By default, performs a shallow merge AND a safe nested merge for `midiData`
   *   so you don't accidentally clobber notes/tempo when touching only one field.
   * - Pass { mergeMidiData: false } to replace midiData wholesale.
   */
  const updateTrack = useCallback((trackId, updatesOrFn, options = {}) => {
    const { mergeMidiData = true } = options;
    let wavesurferChanged = false;

    console.log('🔄 updateTrack called:', {
      trackId,
      updates: typeof updatesOrFn === 'function' ? 'function' : updatesOrFn,
      options
    });

    setTracks((prev) => {
      const beforeTrack = prev.find(t => t.id === trackId);
      console.log('🔄 Track before update:', {
        id: beforeTrack?.id,
        name: beforeTrack?.name,
        clipCount: beforeTrack?.clips?.length,
        clipIds: beforeTrack?.clips?.map(c => c.id)
      });

      const updated = prev.map((track) => {
        if (track.id !== trackId) return track;

        const updates =
          typeof updatesOrFn === 'function'
            ? updatesOrFn(track)
            : updatesOrFn || {};

        console.log('🔄 Applying updates to track:', {
          trackId: track.id,
          updates,
          oldClipCount: track.clips?.length,
          newClipCount: updates.clips?.length
        });

        // Start with a shallow merge
        let next = { ...track, ...updates };

        // Optionally deep-merge midiData to avoid clobbering nested fields
        if (
          mergeMidiData &&
          (updates?.midiData !== undefined || track.midiData !== undefined)
        ) {
          next.midiData = {
            ...(track.midiData || {}),
            ...(updates?.midiData || {}),
          };
        }

        if (
          updates &&
          Object.prototype.hasOwnProperty.call(updates, 'wavesurferInstance')
        ) {
          wavesurferChanged = true;
        }

        console.log('🔄 Track after update:', {
          id: next.id,
          name: next.name,
          clipCount: next.clips?.length,
          clipIds: next.clips?.map(c => c.id)
        });

        return next;
      });

      return updated;
    });

    if (wavesurferChanged) {
      // Force a re-render to update duration after wavesurfer instance changes
      setTimeout(() => {
        setTracks((prev) => [...prev]);
      }, 100);
    }
  }, []);

  const clearAllTracks = useCallback(() => {
    // Stop any playing tracks first
    tracks.forEach((track) => {
      if (track.wavesurferInstance) {
        try {
          track.wavesurferInstance.pause();
          track.wavesurferInstance.destroy();
        } catch (e) {
          console.warn('Error cleaning up track:', e);
        }
      }
    });

    // Clean up instruments properly
    Object.values(trackInstrumentsRef.current).forEach((instrument) => {
      if (instrument) {
        instrument.stopAllNotes?.();
        instrument.dispose?.();
      }
    });
    // Clear instrument references
    trackInstrumentsRef.current = {};

    setTracks([]);
    setSelectedTrackId(null);
    setSoloTrackId(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setActiveRegion(null);
  }, [tracks]);

  // Playback control
  const seek = useCallback(
    (progress) => {
      // Clamp progress
      const p = Math.max(
        0,
        Math.min(1, typeof progress === 'number' ? progress : 0),
      );

      const projectDuration = duration || 0;
      const targetSec = projectDuration > 0 ? p * projectDuration : 0;

      // Seek all track players
      Object.values(trackPlayersRef.current).forEach((player) => {
        if (player) {
          player.seek(targetSec);
        }
      });

      // Update transport
      try {
        transportRef.current?.seek?.(targetSec);
      } catch {}

      // Update current time
      setCurrentTime(targetSec);
    },
    [duration],
  );

  // --- Local pure helpers for clip editing (non-destructive) ---
  function splitClipLocal(clip, at) {
    const end = (clip.start || 0) + (clip.duration || 0);
    if (at <= (clip.start || 0) || at >= end) return [clip, null];
    const left = { ...clip, duration: at - (clip.start || 0) };
    const right = {
      ...clip,
      id: `${clip.id}-r-${Math.random().toString(36).slice(2, 7)}`,
      start: at,
      duration: end - at,
      offset: (clip.offset || 0) + (at - (clip.start || 0)),
    };
    return [left, right];
  }

  function trimClipLocal(clip, newStart, newEnd) {
    const s = Math.max(clip.start || 0, newStart);
    const e = Math.min((clip.start || 0) + (clip.duration || 0), newEnd);
    if (e <= s) return null;
    const delta = s - (clip.start || 0);
    return {
      ...clip,
      start: s,
      duration: e - s,
      offset: (clip.offset || 0) + delta,
    };
  }

  function rippleClipsLocal(clips, start, end) {
    const cut = Math.max(0, end - start);
    if (cut === 0) return clips.slice();
    const out = [];
    for (const c of clips) {
      const cEnd = (c.start || 0) + (c.duration || 0);
      if (cEnd <= start) {
        out.push({ ...c });
        continue;
      }
      if ((c.start || 0) >= end) {
        out.push({ ...c, start: (c.start || 0) - cut });
        continue;
      }
      const [left, right] = splitClipLocal(c, start);
      if (left && left !== c) out.push(left);
      else if ((c.start || 0) < start) {
        const trimmed = trimClipLocal(c, c.start || 0, start);
        if (trimmed) out.push(trimmed);
      }
      if (right) out.push({ ...right, start });
      else if (cEnd > end) {
        const trimmedRight = trimClipLocal(c, end, cEnd);
        if (trimmedRight) out.push({ ...trimmedRight, start });
      }
    }
    return out.sort((a, b) => (a.start || 0) - (b.start || 0));
  }

  // --- Playback control methods (play, pause, stop) ---
  const play = useCallback(() => {
    // Start transport from current time
    try {
      transportRef.current?.play?.(currentTime || 0);
    } catch {}

    // Start all track players
    Object.entries(trackPlayersRef.current).forEach(([trackId, player]) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;

      // Handle solo/mute logic
      const shouldPlay = soloTrackId ? track.id === soloTrackId : !track.muted;

      if (shouldPlay && player) {
        player.play(currentTime || 0);
      }
    });

    setIsPlaying(true);

    // Log play action for multitrack
    try {
      if (activityLogger?.isActive) {
        activityLogger.logEvent('multitrack_play', {
          trackCount: tracks.length,
          currentTime
        });
      }
    } catch (error) {
      console.error('📊 Error logging multitrack play:', error);
    }
  }, [currentTime, tracks, soloTrackId]);

  const pause = useCallback(() => {
    // Pause transport
    try {
      transportRef.current?.pause?.();
    } catch {}

    // Pause all track players and get current position
    let maxPosition = 0;
    Object.values(trackPlayersRef.current).forEach((player) => {
      if (player) {
        const position = player.pause();
        maxPosition = Math.max(maxPosition, position);
      }
    });

    setIsPlaying(false);
    setCurrentTime(maxPosition);

    // Log pause action for multitrack
    try {
      if (activityLogger?.isActive) {
        activityLogger.logEvent('multitrack_pause', {
          trackCount: tracks.length,
          currentTime: maxPosition
        });
      }
    } catch (error) {
      console.error('📊 Error logging multitrack pause:', error);
    }
  }, [tracks]);

  // Ref for scroll reset callback (set by MultitrackEditor)
  const scrollResetCallbackRef = useRef(null);

  const stop = useCallback(() => {
    // Stop transport
    try {
      transportRef.current?.stop?.();
    } catch {}

    // Stop all track players
    Object.values(trackPlayersRef.current).forEach((player) => {
      if (player) {
        player.stop();
      }
    });

    setIsPlaying(false);
    setCurrentTime(0);

    // Reset scroll position to beginning
    if (scrollResetCallbackRef.current) {
      scrollResetCallbackRef.current();
    }

    // Log stop action for multitrack
    try {
      if (activityLogger?.isActive) {
        activityLogger.logEvent('multitrack_stop', {
          trackCount: tracks.length
        });
      }
    } catch (error) {
      console.error('📊 Error logging multitrack stop:', error);
    }
  }, [tracks]);

  // --- Non-destructive CLIP actions (audio + MIDI) ---
  const splitAtPlayhead = useCallback(
    (scope = 'selected') => {
      const tSec = currentTime || 0;
      setTracks((prev) =>
        prev.map((track) => {
          const inScope = scope === 'all' ? true : track.id === selectedTrackId;
          if (
            !inScope ||
            !Array.isArray(track.clips) ||
            track.clips.length === 0
          )
            return track;
          let changed = false;
          const out = [];
          for (const c of track.clips) {
            const cEnd = (c.start || 0) + (c.duration || 0);
            if (tSec > (c.start || 0) && tSec < cEnd) {
              const [left, right] = splitClipLocal(c, tSec);
              if (left) out.push(left);
              if (right) out.push(right);
              changed = true;
            } else {
              out.push(c);
            }
          }
          return changed ? { ...track, clips: out } : track;
        }),
      );
    },
    [currentTime, selectedTrackId],
  );

  const rippleDeleteSelection = useCallback(() => {
    const region = activeRegion;
    if (!region) return;
    const rStart = Math.max(
      0,
      Math.min(
        region.start ?? region.startTime ?? 0,
        region.end ?? region.endTime ?? 0,
      ),
    );
    const rEnd = Math.max(
      rStart,
      region.end ?? region.endTime ?? region.start ?? region.startTime ?? 0,
    );
    const cut = Math.max(0, rEnd - rStart);
    if (cut === 0) return;

    try {
      pause();
    } catch {}

    setTracks((prev) =>
      prev.map((track) => {
        if (track.type !== 'midi' && Array.isArray(track.clips)) {
          const nextClips = rippleClipsLocal(track.clips, rStart, rEnd);
          return { ...track, clips: nextClips };
        }
        if (track.type === 'midi' && track.midiData) {
          const tempo = track.midiData.tempo || 120;
          const spb = 60 / tempo;
          const rs = rStart / spb;
          const re = rEnd / spb;
          const delta = re - rs;
          const src = Array.isArray(track.midiData.notes)
            ? track.midiData.notes
            : [];
          const out = [];
          for (const n of src) {
            const s = n.startTime;
            const e = n.startTime + n.duration;
            if (e <= rs) {
              out.push(n);
            } else if (s >= re) {
              out.push({ ...n, startTime: s - delta });
            } else if (s < rs && e > re) {
              const leftDur = Math.max(0, rs - s);
              const rightDur = Math.max(0, e - re);
              if (leftDur > 1e-6) out.push({ ...n, duration: leftDur });
              if (rightDur > 1e-6)
                out.push({ ...n, startTime: re - delta, duration: rightDur });
            } else if (s < rs && e > rs && e <= re) {
              const leftDur = Math.max(0, rs - s);
              if (leftDur > 1e-6) out.push({ ...n, duration: leftDur });
            } else if (s >= rs && s < re && e > re) {
              const rightDur = Math.max(0, e - re);
              if (rightDur > 1e-6)
                out.push({ ...n, startTime: re - delta, duration: rightDur });
            }
            // fully inside region → dropped
          }
          return { ...track, midiData: { ...track.midiData, notes: out } };
        }
        return track;
      }),
    );

    setActiveRegion(null);
    setCurrentTime(rStart);
  }, [activeRegion, pause, setTracks, setActiveRegion, setCurrentTime]);

  // MIDI-specific methods
  const registerTrackInstrument = useCallback((trackId, instrument) => {
    console.log('📝 Context: registerTrackInstrument called', {
      trackId,
      hasInstrument: !!instrument,
    });

    if (instrument) {
      trackInstrumentsRef.current[trackId] = instrument;
      console.log('✅ Instrument registered for track:', trackId);
      console.log(
        '📊 Total registered instruments:',
        Object.keys(trackInstrumentsRef.current).length,
      );
    } else {
      delete trackInstrumentsRef.current[trackId];
      console.log('❌ Instrument unregistered for track:', trackId);
    }
  }, []);

  const playNoteOnSelectedTrack = useCallback(
    (note, velocity = 0.8) => {
      console.log('🎵 Context: playNoteOnSelectedTrack called', {
        note,
        velocity,
        selectedTrackId,
        availableInstruments: Object.keys(trackInstrumentsRef.current),
        hasInstrumentForTrack: !!trackInstrumentsRef.current[selectedTrackId],
      });

      const selectedTrack = tracks.find(
        (t) => t.id === selectedTrackId && t.type === 'midi',
      );
      console.log('🎵 Context: Selected track:', selectedTrack);

      if (selectedTrack && trackInstrumentsRef.current[selectedTrackId]) {
        console.log('🎵 Context: Found instrument, checking mute/solo state');

        // Check if track is muted or if we're in solo mode
        if (selectedTrack.muted) {
          console.log('❌ Track is muted');
          return null;
        }
        if (soloTrackId && selectedTrack.id !== soloTrackId) {
          console.log('❌ Track is not soloed');
          return null;
        }

        try {
          console.log('🎵 Context: Calling instrument.playNote()');
          const audioContext = audioContextManager.getContext();
          const handle = trackInstrumentsRef.current[selectedTrackId].playNote(
            note,
            velocity,
            audioContext.currentTime,
          );
          console.log('✅ Note played successfully', { handle });
          return handle ?? null;
        } catch (error) {
          console.error('❌ Error playing note:', error);
          return null;
        }
      } else {
        console.log('❌ No instrument found for track', {
          hasTrack: !!selectedTrack,
          hasInstrument: !!trackInstrumentsRef.current[selectedTrackId],
          trackType: selectedTrack?.type,
        });
        return null;
      }
    },
    [selectedTrackId, tracks, soloTrackId],
  );

  // Get real-time current time for precise note placement
  // Keep currentTime ref updated
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const getPreciseCurrentTime = useCallback(() => {
    if (recordingTimerRef.current && recordingStartTimeRef.current) {
      // If recording timer is active, use the same calculation as the recording timer
      const now = performance.now() / 1000;
      const elapsed = now - recordingStartTimeRef.current;
      // Use the stored initial time from when recording started + precise elapsed time
      return recordingInitialTimeRef.current + elapsed;
    }
    return currentTimeRef.current; // Use ref to avoid callback recreation
  }, []); // No dependencies = stable callback

  // Recording timer functions for MIDI recording
  const startRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) return; // Already running
    
    recordingStartTimeRef.current = performance.now() / 1000;
    const initialTime = currentTime;
    recordingInitialTimeRef.current = initialTime; // Store for precise timing
    
    const startTime = recordingStartTimeRef.current;
    recordingTimerRef.current = requestAnimationFrame(function updateRecordingTime() {
      // Check if timer was cancelled during frame
      if (!recordingTimerRef.current || recordingStartTimeRef.current !== startTime) {
        return; // Timer was cancelled, don't continue
      }
      
      try {
        const now = performance.now() / 1000;
        const elapsed = now - recordingStartTimeRef.current;
        const newTime = initialTime + elapsed;
        
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`⏱️ RECORDING TIMER:`, {
            elapsed: elapsed.toFixed(3),
            initialTime: initialTime.toFixed(3),
            newTime: newTime.toFixed(3),
            performanceNow: now.toFixed(3),
          });
        }
        
        setCurrentTime(newTime);
        
        // Schedule next frame if still active
        if (recordingTimerRef.current) {
          recordingTimerRef.current = requestAnimationFrame(updateRecordingTime);
        }
      } catch (error) {
        console.error('Recording timer error:', error);
        // Clean up on error
        if (recordingTimerRef.current) {
          cancelAnimationFrame(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      }
    });
  }, [currentTime]);
  
  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      cancelAnimationFrame(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  // Emergency reset function to clear stuck mixdown state
  const resetMixdownState = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.__MIXDOWN_ACTIVE__ = false;
      console.log('🔧 Emergency: Cleared stuck mixdown state');
    }
  }, []);

  // Note batching for smoother recording performance
  const noteBufferRef = useRef([]);
  const noteBufferTimerRef = useRef(null);

  const addNoteToSelectedTrack = useCallback(
    (note, velocity01, startBeat, durationBeats) => {
      if (!selectedTrackId) return;

      const newNote = {
        note,
        velocity: Math.max(
          1,
          Math.min(127, Math.round((velocity01 ?? 0.8) * 127)),
        ),
        startTime: startBeat,
        duration: durationBeats,
      };

      // Add to buffer instead of immediate state update
      noteBufferRef.current.push(newNote);

      // Debounce: flush buffer after 150ms of inactivity
      if (noteBufferTimerRef.current) {
        clearTimeout(noteBufferTimerRef.current);
      }

      noteBufferTimerRef.current = setTimeout(() => {
        const notesToAdd = [...noteBufferRef.current];
        noteBufferRef.current = [];

        if (notesToAdd.length > 0) {
          setTracks((prev) =>
            prev.map((t) => {
              if (t.id !== selectedTrackId || t.type !== 'midi') return t;
              const notes = Array.isArray(t.midiData?.notes)
                ? t.midiData.notes
                : [];
              return {
                ...t,
                midiData: {
                  ...(t.midiData || {}),
                  notes: [...notes, ...notesToAdd] // Batch add all buffered notes
                },
              };
            }),
          );
        }
      }, 150);
    },
    [selectedTrackId, setTracks],
  );

  // Flush buffer immediately when stopping recording
  const flushNoteBuffer = useCallback(() => {
    if (noteBufferTimerRef.current) {
      clearTimeout(noteBufferTimerRef.current);
    }

    const notesToAdd = [...noteBufferRef.current];
    noteBufferRef.current = [];

    if (notesToAdd.length > 0 && selectedTrackId) {
      setTracks((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTrackId || t.type !== 'midi') return t;
          const notes = Array.isArray(t.midiData?.notes)
            ? t.midiData.notes
            : [];
          return {
            ...t,
            midiData: {
              ...(t.midiData || {}),
              notes: [...notes, ...notesToAdd]
            },
          };
        }),
      );
    }
  }, [selectedTrackId, setTracks]);

  const stopNoteOnSelectedTrack = useCallback(
    (note, token = null) => {
      console.log('🎵 Context: stopNoteOnSelectedTrack called', {
        note,
        token,
        selectedTrackId,
      });

      const selectedTrack = tracks.find(
        (t) => t.id === selectedTrackId && t.type === 'midi',
      );
      if (selectedTrack && trackInstrumentsRef.current[selectedTrackId]) {
        try {
          const instrument = trackInstrumentsRef.current[selectedTrackId];
          if (!instrument || typeof instrument.stopNote !== 'function') return;
          const audioContext = audioContextManager.getContext();
          // Always provide a second arg: token if available, otherwise current time.
          // Extra args are safe in JS; this guarantees preview handles are used when supported.
          const secondArg = token ?? audioContext.currentTime;
          instrument.stopNote(note, secondArg);
          console.log('✅ Note stopped successfully', { token });
        } catch (error) {
          console.error('❌ Error stopping note:', error);
        }
      }
    },
    [selectedTrackId, tracks],
  );

  // --- Region editing helpers (audio + MIDI) ---
  function audioBufferToWav(buffer) {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    let pos = 0;
    const setUint16 = (d) => {
      view.setUint16(pos, d, true);
      pos += 2;
    };
    const setUint32 = (d) => {
      view.setUint32(pos, d, true);
      pos += 4;
    };

    // RIFF/WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    // fmt chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(buffer.numberOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
    setUint16(buffer.numberOfChannels * 2);
    setUint16(16);
    // data chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // Interleave & write samples
    let offset = pos;
    const channels = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      channels[ch] = buffer.getChannelData(ch);
    }
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const s = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  async function deleteAudioSegment(buffer, startSec, endSec) {
    const sr = buffer.sampleRate;
    const startS = Math.max(
      0,
      Math.min(buffer.length, Math.round(startSec * sr)),
    );
    const endS = Math.max(
      startS,
      Math.min(buffer.length, Math.round(endSec * sr)),
    );
    const cutLen = endS - startS;
    if (cutLen <= 0) return buffer;

    const newLen = buffer.length - cutLen;
    const out = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: newLen,
      sampleRate: sr,
    });

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      // Pre-cut
      dst.set(src.subarray(0, startS), 0);
      // Post-cut, moved left
      dst.set(src.subarray(endS), startS);

      // 5ms crossfade at the join to avoid clicks
      const cross = Math.min(Math.floor(sr * 0.005), startS, newLen - startS);
      for (let i = 0; i < cross; i++) {
        const t = i / cross;
        const a = dst[startS - cross + i];
        const b = dst[startS + i];
        dst[startS - cross + i] = a * (1 - t) + b * t;
      }
    }
    return out;
  }

  function exciseAudioSegment(buffer, startSec, endSec) {
    const sr = buffer.sampleRate;
    const startS = Math.max(
      0,
      Math.min(buffer.length, Math.round(startSec * sr)),
    );
    const endS = Math.max(
      startS,
      Math.min(buffer.length, Math.round(endSec * sr)),
    );
    const newLen = Math.max(0, endS - startS);
    const out = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: newLen,
      sampleRate: sr,
    });

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      dst.set(src.subarray(startS, endS), 0);

      // 5ms fade in/out so trims are click‑free
      const fade = Math.min(Math.floor(sr * 0.005), newLen);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        dst[i] *= t; // fade-in
        dst[newLen - 1 - i] *= t; // fade-out
      }
    }
    return out;
  }

  const deleteRegion = useCallback(
    async (region) => {
      if (!region) return;
      const rStart = Math.max(
        0,
        Math.min(
          region.start ?? region.startTime ?? 0,
          region.end ?? region.endTime ?? 0,
        ),
      );
      const rEnd = Math.max(
        rStart,
        region.end ?? region.endTime ?? region.start ?? region.startTime ?? 0,
      );

      try {
        pause();
      } catch {}

      const updatedTracks = await Promise.all(
        tracks.map(async (track) => {
          // AUDIO: ripple delete (remove time & close gap)
          if (track.wavesurferInstance && track.audioURL) {
            try {
              const buffer = await track.wavesurferInstance.getDecodedData();
              if (!buffer) return track;
              const edited = await deleteAudioSegment(buffer, rStart, rEnd);
              if (edited.length === buffer.length) return track; // nothing changed
              const blob = audioBufferToWav(edited);
              const newURL = URL.createObjectURL(blob);
              const oldURL = track.audioURL;
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(oldURL);
                } catch {}
              }, 1000);
              return { ...track, audioURL: newURL, wavesurferInstance: null };
            } catch (e) {
              console.warn(
                'Delete region (audio) failed for track',
                track.id,
                e,
              );
              return track;
            }
          }

          // MIDI: trim/split notes and shift later notes left
          if (track.type === 'midi' && track.midiData) {
            const tempo = track.midiData.tempo || 120;
            const spb = 60 / tempo;
            const rs = rStart / spb;
            const re = rEnd / spb;
            const delta = re - rs;

            const src = Array.isArray(track.midiData.notes)
              ? track.midiData.notes
              : [];
            const out = [];
            for (const n of src) {
              const s = n.startTime;
              const e = n.startTime + n.duration;

              if (e <= rs) {
                out.push(n); // before region
              } else if (s >= re) {
                out.push({ ...n, startTime: s - delta }); // after region → shift left
              } else if (s < rs && e > re) {
                // spans the region → split into two notes
                const leftDur = Math.max(0, rs - s);
                const rightDur = Math.max(0, e - re);
                if (leftDur > 1e-6) out.push({ ...n, duration: leftDur });
                if (rightDur > 1e-6)
                  out.push({ ...n, startTime: re - delta, duration: rightDur });
              } else if (s < rs && e > rs && e <= re) {
                const leftDur = Math.max(0, rs - s); // overlap left edge → keep left part
                if (leftDur > 1e-6) out.push({ ...n, duration: leftDur });
              } else if (s >= rs && s < re && e > re) {
                const rightDur = Math.max(0, e - re); // overlap right edge → keep right part
                if (rightDur > 1e-6)
                  out.push({ ...n, startTime: re - delta, duration: rightDur });
              }
              // fully inside region → dropped
            }

            return { ...track, midiData: { ...track.midiData, notes: out } };
          }

          return track;
        }),
      );

      setTracks(updatedTracks);
      setActiveRegion(null);
      setCurrentTime(rStart);
    },
    [tracks, pause, setTracks, setActiveRegion, setCurrentTime],
  );

  const exciseRegion = useCallback(
    async (region) => {
      if (!region) return;
      const rStart = Math.max(
        0,
        Math.min(
          region.start ?? region.startTime ?? 0,
          region.end ?? region.endTime ?? 0,
        ),
      );
      const rEnd = Math.max(
        rStart,
        region.end ?? region.endTime ?? region.start ?? region.startTime ?? 0,
      );

      try {
        pause();
      } catch {}

      const updatedTracks = await Promise.all(
        tracks.map(async (track) => {
          // AUDIO: keep only selection (rebased to 0s)
          if (track.wavesurferInstance && track.audioURL) {
            try {
              const buffer = await track.wavesurferInstance.getDecodedData();
              if (!buffer) return track;
              const clipped = exciseAudioSegment(buffer, rStart, rEnd);
              const blob = audioBufferToWav(clipped);
              const newURL = URL.createObjectURL(blob);
              const oldURL = track.audioURL;
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(oldURL);
                } catch {}
              }, 1000);
              return { ...track, audioURL: newURL, wavesurferInstance: null };
            } catch (e) {
              console.warn(
                'Excise region (audio) failed for track',
                track.id,
                e,
              );
              return track;
            }
          }

          // MIDI: keep only overlapping notes, trim to edges, rebase start to 0
          if (track.type === 'midi' && track.midiData) {
            const tempo = track.midiData.tempo || 120;
            const spb = 60 / tempo;
            const rs = rStart / spb;
            const re = rEnd / spb;
            const src = Array.isArray(track.midiData.notes)
              ? track.midiData.notes
              : [];
            const out = [];
            for (const n of src) {
              const s = n.startTime;
              const e = n.startTime + n.duration;
              const clipStart = Math.max(s, rs);
              const clipEnd = Math.min(e, re);
              const dur = Math.max(0, clipEnd - clipStart);
              if (dur > 1e-6)
                out.push({ ...n, startTime: clipStart - rs, duration: dur });
            }
            return { ...track, midiData: { ...track.midiData, notes: out } };
          }

          return track;
        }),
      );

      setTracks(updatedTracks);
      setActiveRegion(null);
      setCurrentTime(0);
    },
    [tracks, pause, setTracks, setActiveRegion, setCurrentTime],
  );

  const value = {
    // Track state
    tracks,
    setTracks,
    selectedTrackId,
    setSelectedTrackId,
    soloTrackId,
    setSoloTrackId,

    // Playback state
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,

    // Track management
    addTrack,
    removeTrack,
    updateTrack,
    clearAllTracks,
    registerTrackPlayer,
    unregisterTrackPlayer,

    // Playback control
    play,
    pause,
    stop,
    seek,
    getTransportTime,
    scrollResetCallbackRef, // For scroll position reset on stop
    // Recording management (using RecordingManager)
    isAnyTrackRecording,
    isTrackRecording,
    RecordingManager,

    // regions and effects
    activeRegion,
    setActiveRegion,
    deleteRegion,
    exciseRegion,
    // editor tool & clip selection
    editorTool,
    setEditorTool,
    selectedClipId,
    setSelectedClipId,
    selectedClipIds,
    setSelectedClipIds,
    snapEnabled,
    setSnapEnabled,
    gridSizeSec,
    setGridSizeSec,
    splitAtPlayhead,
    rippleDeleteSelection,

    // MIDI methods
    registerTrackInstrument,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
    addNoteToSelectedTrack,
    flushNoteBuffer,

    // Recording timer for MIDI
    startRecordingTimer,
    stopRecordingTimer,
    getPreciseCurrentTime,
    resetMixdownState,

    // Effects modal system
    showEffectSelectionModal,
    setShowEffectSelectionModal,
    showEffectParametersModal,
    setShowEffectParametersModal,
    selectedEffectType,
    setSelectedEffectType,
    effectTargetTrackId,
    setEffectTargetTrackId,
  };

  return (
    <MultitrackContext.Provider value={value}>
      {children}
    </MultitrackContext.Provider>
  );
};
