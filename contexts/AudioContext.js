// contexts/AudioContext.js
'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getCommandManager, createAudioCommand } from '../lib/AudioCommandManager';
import { getDAWActivityLogger } from '../lib/activity/DAWActivityLogger';

const AudioContext = createContext();

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children, persistenceConfig = { enabled: false } }) => {
  // Core audio state
  const [audioURL, setAudioURL] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // DAW mode state
  const [dawMode, setDawModeState] = useState('single'); // 'single' or 'multi'

  // Undo/redo state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // References
  const audioRef = useRef(null);
  const wavesurferRef = useRef(null);
  const commandManagerRef = useRef(null);
  const hasInitialAudioRef = useRef(false); // Track if initial audio has been set
  const activityLoggerRef = useRef(null);
  const audioStateRestoredRef = useRef(false); // Track if we've loaded saved state

  // Initialize command manager and activity logger
  useEffect(() => {
    const manager = getCommandManager();
    commandManagerRef.current = manager;

    // Initialize activity logger (but don't start it yet)
    const logger = getDAWActivityLogger();
    activityLoggerRef.current = logger;
    console.log('📊 DAW Activity Logger initialized (not active yet)');

    // Listen for state changes
    const handleStateChange = (state) => {
      setCanUndo(state.canUndo);
      setCanRedo(state.canRedo);
    };

    manager.addListener(handleStateChange);

    return () => {
      manager.removeListener(handleStateChange);
    };
  }, []);

  // Set hasInitialAudioRef when audioURL is first set
  useEffect(() => {
    if (audioURL && !hasInitialAudioRef.current) {
      hasInitialAudioRef.current = true;
    }
  }, [audioURL]);
  
  // Load audio and handle updates
  const loadAudio = useCallback(async (url, skipHistory = false) => {
    if (!url) return;

    try {
      setAudioURL(url);

      // Add to history unless explicitly skipped (like during undo/redo)
      if (!skipHistory && commandManagerRef.current) {
        const command = createAudioCommand('Load Audio', url, {
          source: 'user_action'
        });
        commandManagerRef.current.execute(command);
      }

      // The WaveformContext will handle the actual audio loading
      // when it detects the audioURL change
    } catch (error) {
      console.error('Error in loadAudio:', error);
    }
  }, []);
  
  // Add new audio state to history
  const addToEditHistory = useCallback((url, name = 'Edit', metadata = {}) => {
    if (!commandManagerRef.current) return;

    const command = createAudioCommand(name, url, metadata);
    commandManagerRef.current.execute(command);

    // Update current audio URL
    setAudioURL(url);
  }, []);
  
  // Undo operation
  const undo = useCallback(async () => {
    if (!commandManagerRef.current) return;

    const command = commandManagerRef.current.undo();
    if (command) {
      // Simply update the audioURL
      // This will trigger the WaveformContext to reload the audio
      setAudioURL(command.audioData);

      // If there's still a legacy audio element, update it
      if (audioRef.current) {
        audioRef.current.src = command.audioData;
        audioRef.current.load();
      }

      // Log undo action
      try {
        if (activityLoggerRef.current?.isActive) {
          activityLoggerRef.current.logUndo();
        }
      } catch (error) {
        console.error('📊 Error logging undo:', error);
      }
    }
  }, []);

  // Redo operation
  const redo = useCallback(async () => {
    if (!commandManagerRef.current) return;

    const command = commandManagerRef.current.redo();
    if (command) {
      // Simply update the audioURL
      // This will trigger the WaveformContext to reload the audio
      setAudioURL(command.audioData);

      // If there's still a legacy audio element, update it
      if (audioRef.current) {
        audioRef.current.src = command.audioData;
        audioRef.current.load();
      }

      // Log redo action
      try {
        if (activityLoggerRef.current?.isActive) {
          activityLoggerRef.current.logRedo();
        }
      } catch (error) {
        console.error('📊 Error logging redo:', error);
      }
    }
  }, []);
  
  // Get current command for debugging
  const getCurrentCommand = useCallback(() => {
    if (!commandManagerRef.current) return null;
    return commandManagerRef.current.getCurrentCommand();
  }, []);

  // Check if audio has been restored to original state (index 0 in history)
  const isRestoredToOriginal = useCallback(() => {
    if (!commandManagerRef.current) return false;
    return commandManagerRef.current.currentIndex === 0;
  }, []);

  // Clear history (useful when switching between parts)
  const clearHistory = useCallback(() => {
    if (!commandManagerRef.current) return;
    commandManagerRef.current.clear();

    // Set hasInitialAudioRef to true so that subsequent edits will be tracked
    // When switching takes, we clear the history but want new edits to be added
    hasInitialAudioRef.current = true;
  }, []);

  // Wrapped setDawMode with logging
  const setDawMode = useCallback((newMode) => {
    try {
      // Start logging session if not already started
      if (activityLoggerRef.current && !activityLoggerRef.current.isActive) {
        activityLoggerRef.current.startSession({
          // These will be populated properly in production
          assignmentId: 'unknown',
          userId: 'unknown',
          courseId: 'unknown'
        });
        console.log('📊 Activity logging started automatically');
      }

      // Log the mode switch
      if (activityLoggerRef.current && activityLoggerRef.current.isActive) {
        activityLoggerRef.current.switchMode(newMode);
      }
    } catch (error) {
      // Don't let logging errors break the app
      console.error('📊 Error logging mode switch:', error);
    }

    // Always update the actual mode
    setDawModeState(newMode);
  }, []);

  // ========== Audio State Persistence (Activity Study Only) ==========

  // Load initial audio state from persistence if available
  useEffect(() => {
    if (!persistenceConfig.enabled || audioStateRestoredRef.current) return;
    if (!persistenceConfig.initialAudioState) return;

    const { current_audio_url, audio_edit_history, audio_metadata } = persistenceConfig.initialAudioState;

    // Restore audio URL and edit history if they exist
    if (current_audio_url && audio_edit_history && audio_edit_history.length > 0) {
      console.log('🔄 Restoring saved audio state:', {
        url: current_audio_url.substring(0, 50) + '...',
        historyLength: audio_edit_history.length
      });

      // Restore edit history to command manager
      if (commandManagerRef.current) {
        // Clear existing history first
        commandManagerRef.current.clear();

        // Restore each command from history
        audio_edit_history.forEach((historyItem) => {
          const command = createAudioCommand(
            historyItem.effectName || 'Restored Edit',
            historyItem.url,
            historyItem.metadata || {}
          );
          commandManagerRef.current.addCommand(command);
        });

        console.log(`✅ Restored ${audio_edit_history.length} items to edit history`);
      }

      // Set the current audio URL
      setAudioURL(current_audio_url);
      hasInitialAudioRef.current = true;
      audioStateRestoredRef.current = true;
    }
  }, [persistenceConfig]);

  // Auto-save audio state when it changes (with debouncing)
  useEffect(() => {
    if (!persistenceConfig.enabled) return;
    if (!audioURL || !hasInitialAudioRef.current) return;

    const { slug, assignmentId } = persistenceConfig;
    if (!slug || !assignmentId) {
      console.warn('⚠️ Persistence enabled but missing slug or assignmentId');
      return;
    }

    // Debounce saves to avoid excessive API calls
    const debounceTimer = setTimeout(async () => {
      try {
        // Get current edit history from command manager
        const editHistory = [];
        if (commandManagerRef.current) {
          const commands = commandManagerRef.current.getAllCommands();
          commands.forEach(cmd => {
            editHistory.push({
              url: cmd.audioData,
              effectName: cmd.name,
              metadata: cmd.metadata || {}
            });
          });
        }

        // Dynamic import to avoid circular dependency
        const { mutateSaveAudioState } = await import('../api');
        const saveAudioStateFn = mutateSaveAudioState({ slug, assignmentId });

        await saveAudioStateFn({
          audioUrl: audioURL,
          editHistory,
          metadata: {
            duration,
            // Add more metadata as needed
          }
        });

        console.log('💾 Auto-saved audio state');
      } catch (error) {
        console.error('❌ Failed to auto-save audio state:', error);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(debounceTimer);
  }, [audioURL, duration, persistenceConfig]);

  const value = {
    // State
    audioURL,
    setAudioURL,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playbackSpeed,
    setPlaybackSpeed,

    // DAW mode
    dawMode,
    setDawMode,

    // Refs
    audioRef,
    wavesurferRef,

    // Command history
    canUndo,
    canRedo,
    addToEditHistory,
    undo,
    redo,
    getCurrentCommand,
    isRestoredToOriginal,
    clearHistory,

    // Methods
    loadAudio,

    // Activity Logger (Phase 1 - not active yet)
    activityLogger: activityLoggerRef.current,
  };
  
  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};