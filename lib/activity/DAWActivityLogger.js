/**
 * DAWActivityLogger - Comprehensive logging for DAW user activity
 *
 * This logger tracks all user interactions in both single-track and multi-track modes,
 * generating detailed analytics for pedagogical insights.
 */

class DAWActivityLogger {
  constructor() {
    // Core session data
    this.sessionId = this.generateSessionId();
    this.startTime = new Date().toISOString();
    this.endTime = null;

    // Event storage
    this.events = [];

    // Current state
    this.currentMode = null; // 'single', 'multi', or null
    this.isActive = false;

    // Performance tracking
    this.modeTimers = {
      single: { startTime: null, totalTime: 0, sessionCount: 0 },
      multi: { startTime: null, totalTime: 0, sessionCount: 0 }
    };

    // Summary caches (updated incrementally)
    this.summaryCache = {
      single: this.createEmptySingleSummary(),
      multi: this.createEmptyMultiSummary(),
      session: this.createEmptySessionSummary()
    };

    // Metadata
    this.metadata = {
      assignmentId: null,
      userId: null,
      courseId: null,
      browser: this.detectBrowser(),
      platform: this.detectPlatform(),
      submittedAt: null
    };

    console.log('📊 DAWActivityLogger initialized:', this.sessionId);
  }

  // ========== Core Methods ==========

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Start logging session
   */
  startSession(metadata = {}) {
    this.isActive = true;
    this.metadata = { ...this.metadata, ...metadata };

    this.logEvent('session_start', {
      metadata: this.metadata
    });

    console.log('📊 Logging session started');
  }

  /**
   * End logging session
   */
  endSession() {
    // Stop any active mode timer
    if (this.currentMode) {
      this.stopModeTimer(this.currentMode);
    }

    this.endTime = new Date().toISOString();
    this.isActive = false;

    this.logEvent('session_end', {
      totalDuration: this.calculateTotalDuration()
    });

    console.log('📊 Logging session ended');
  }

  /**
   * Log an event
   * @param {string} eventType - Type of event
   * @param {object} data - Event data
   * @param {string} mode - Override current mode if needed
   */
  logEvent(eventType, data = {}, mode = null) {
    if (!this.isActive && eventType !== 'session_start') {
      console.warn('📊 Logger not active, event not logged:', eventType);
      return;
    }

    const event = {
      timestamp: new Date().toISOString(),
      mode: mode || this.currentMode,
      eventType,
      data
    };

    this.events.push(event);

    // Update summaries incrementally
    this.updateSummaryForEvent(event);

    // Debug logging (can be disabled in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Event logged:', eventType, data);
    }
  }

  // ========== Mode Management ==========

  /**
   * Switch editor mode
   */
  switchMode(newMode) {
    const oldMode = this.currentMode;

    // Stop timer for old mode
    if (oldMode) {
      this.stopModeTimer(oldMode);
    }

    // Log mode switch event
    this.logEvent('mode_switch', {
      from: oldMode,
      to: newMode
    }, null); // null mode for switch events

    // Update current mode
    this.currentMode = newMode;

    // Start timer for new mode
    if (newMode) {
      this.startModeTimer(newMode);
    }

    console.log(`📊 Mode switched: ${oldMode || 'none'} → ${newMode}`);
  }

  /**
   * Start timing for a mode
   */
  startModeTimer(mode) {
    if (this.modeTimers[mode]) {
      this.modeTimers[mode].startTime = Date.now();
      this.modeTimers[mode].sessionCount++;
    }
  }

  /**
   * Stop timing for a mode
   */
  stopModeTimer(mode) {
    if (this.modeTimers[mode] && this.modeTimers[mode].startTime) {
      const duration = Date.now() - this.modeTimers[mode].startTime;
      this.modeTimers[mode].totalTime += duration;
      this.modeTimers[mode].startTime = null;
    }
  }

  // ========== Single Track Logging Methods ==========

  logEffectApplied(effectType, parameters = {}) {
    this.logEvent('effect_applied', {
      effectType,
      parameters
    });
  }

  logPlaybackAction(action) {
    this.logEvent('playback_action', {
      action // 'play', 'pause', 'stop', 'seek'
    });
  }

  logRegionCreated(startTime, endTime) {
    this.logEvent('region_created', {
      startTime,
      endTime,
      duration: endTime - startTime
    });
  }

  logUndo() {
    this.logEvent('undo_action', {});
    // Increment handled by updateSummaryForEvent
  }

  logRedo() {
    this.logEvent('redo_action', {});
    // Increment handled by updateSummaryForEvent
  }

  logZoomOperation(zoomLevel, direction) {
    this.logEvent('zoom_operation', {
      zoomLevel,
      direction // 'in', 'out', 'reset'
    });
  }

  // ========== Multi Track Logging Methods ==========

  logTrackAdded(trackId, trackType, trackName) {
    this.logEvent('track_added', {
      trackId,
      trackType, // 'audio' or 'midi'
      trackName
    });
  }

  logTrackDeleted(trackId, trackType) {
    this.logEvent('track_deleted', {
      trackId,
      trackType
    });
  }

  logClipOperation(operation, data) {
    this.logEvent(`clip_${operation}`, {
      ...data
      // operation: 'split', 'trim', 'duplicate', 'delete', 'move', etc.
    });
  }

  logRecordingStarted(trackId) {
    this.logEvent('recording_started', {
      trackId,
      timestamp: Date.now()
    });
  }

  logRecordingCompleted(trackId, duration, kept = true) {
    this.logEvent('recording_completed', {
      trackId,
      duration,
      kept // whether the take was kept or discarded
    });
  }

  logMidiInput(source, noteCount, duration) {
    this.logEvent('midi_input', {
      source, // 'virtual_piano' or 'external_device'
      noteCount,
      duration
    });
  }

  logMixingOperation(operation, trackId, value) {
    this.logEvent(`mixing_${operation}`, {
      trackId,
      value,
      // operation: 'volume', 'pan', 'mute', 'solo'
    });
  }

  logToolUsed(toolName) {
    this.logEvent('tool_used', {
      toolName // 'select', 'clip', 'cut', etc.
    });
  }

  logBatchOperation(operation, clipCount) {
    this.logEvent('batch_operation', {
      operation, // 'delete', 'copy', 'cut'
      clipCount
    });
  }

  // ========== Summary Generation ==========

  createEmptySingleSummary() {
    return {
      totalTimeInMode: 0,
      sessionCount: 0,
      effectsApplied: {},
      takeCount: 0,
      undoCount: 0,
      redoCount: 0,
      playbackCount: 0,
      regionsCreated: 0,
      destructiveEdits: 0
    };
  }

  createEmptyMultiSummary() {
    return {
      totalTimeInMode: 0,
      sessionCount: 0,
      finalTrackCount: 0,
      maxTrackCount: 0,
      tracksByType: { audio: 0, midi: 0 },
      tracksAdded: 0,
      tracksDeleted: 0,
      totalClips: 0,
      clipsDeleted: 0,
      clipOperations: {
        split: 0,
        trim: 0,
        duplicate: 0,
        batchDelete: 0
      },
      recordingStats: {
        totalTakes: 0,
        recordingsKept: 0,
        averageTakeLength: 0,
        tracksRecordedTo: new Set()
      },
      midiStats: {
        virtualPianoUsed: false,
        virtualPianoSessionDuration: 0,
        externalMidiUsed: false,
        totalNotesRecorded: 0
      },
      mixingStats: {
        volumeAdjustments: 0,
        panAdjustments: 0,
        muteToggleCount: 0,
        soloToggleCount: 0,
        trackEffectsApplied: []
      },
      navigationStats: {
        playCount: 0,
        stopCount: 0,
        zoomOperations: 0,
        gridSizeChanges: 0,
        snapToggleCount: 0
      },
      toolUsage: {
        select: 0,
        clip: 0,
        cut: 0
      }
    };
  }

  createEmptySessionSummary() {
    return {
      modesUsed: [],
      modePreference: null,
      totalEditorInteractions: 0,
      workflowPattern: null,
      effectExperimentation: {
        effectsTriedThenUndone: 0,
        effectsAppliedMultipleTimes: {}
      },
      submissionReady: false,
      preSubmissionReviewCount: 0
    };
  }

  /**
   * Update summary cache based on event
   */
  updateSummaryForEvent(event) {
    // Count total interactions
    this.summaryCache.session.totalEditorInteractions++;

    // Track modes used
    if (event.mode && !this.summaryCache.session.modesUsed.includes(event.mode)) {
      this.summaryCache.session.modesUsed.push(event.mode);
    }

    // Update summaries based on event type and mode
    if (event.mode === 'single') {
      // Single track events
      switch (event.eventType) {
        case 'effect_applied':
          const effectType = event.data.effectType;
          if (!this.summaryCache.single.effectsApplied[effectType]) {
            this.summaryCache.single.effectsApplied[effectType] = 0;
          }
          this.summaryCache.single.effectsApplied[effectType]++;
          break;
        case 'playback_action':
          if (event.data.action === 'play') {
            this.summaryCache.single.playbackCount++;
          }
          break;
        case 'region_created':
          this.summaryCache.single.regionsCreated++;
          break;
        case 'undo_action':
          this.summaryCache.single.undoCount++;
          break;
        case 'redo_action':
          this.summaryCache.single.redoCount++;
          break;
      }
    } else if (event.mode === 'multi') {
      // Multi track events
      switch (event.eventType) {
        case 'track_added':
          this.summaryCache.multi.tracksAdded++;
          this.summaryCache.multi.tracksByType[event.data.trackType]++;
          this.summaryCache.multi.maxTrackCount = Math.max(
            this.summaryCache.multi.maxTrackCount,
            this.summaryCache.multi.tracksAdded - this.summaryCache.multi.tracksDeleted
          );
          break;
        case 'track_deleted':
          this.summaryCache.multi.tracksDeleted++;
          break;
        case 'clip_split':
          this.summaryCache.multi.clipOperations.split++;
          break;
        case 'clip_trim':
          this.summaryCache.multi.clipOperations.trim++;
          break;
        case 'clip_duplicate':
          this.summaryCache.multi.clipOperations.duplicate++;
          break;
        case 'clip_delete':
        case 'clip_cut':
          this.summaryCache.multi.clipsDeleted++;
          break;
        case 'clip_copy':
        case 'clip_paste':
          this.summaryCache.multi.totalClips++;
          break;
        case 'batch_operation':
          if (event.data.operation === 'delete') {
            this.summaryCache.multi.clipOperations.batchDelete++;
            this.summaryCache.multi.clipsDeleted += event.data.clipCount;
          }
          break;
        case 'recording_started':
          this.summaryCache.multi.recordingStats.totalTakes++;
          if (event.data.trackId) {
            this.summaryCache.multi.recordingStats.tracksRecordedTo.add(event.data.trackId);
          }
          break;
        case 'recording_completed':
          if (event.data.kept) {
            this.summaryCache.multi.recordingStats.recordingsKept++;
          }
          if (event.data.duration) {
            // Update average take length
            const stats = this.summaryCache.multi.recordingStats;
            const currentAvg = stats.averageTakeLength;
            const totalTakes = stats.recordingsKept;
            stats.averageTakeLength = (currentAvg * (totalTakes - 1) + event.data.duration) / totalTakes;
          }
          break;
        case 'mixing_volume':
          this.summaryCache.multi.mixingStats.volumeAdjustments++;
          break;
        case 'mixing_pan':
          this.summaryCache.multi.mixingStats.panAdjustments++;
          break;
        case 'mixing_mute':
          this.summaryCache.multi.mixingStats.muteToggleCount++;
          break;
        case 'mixing_solo':
          this.summaryCache.multi.mixingStats.soloToggleCount++;
          break;
        case 'tool_used':
          const toolName = event.data.toolName;
          if (this.summaryCache.multi.toolUsage[toolName] !== undefined) {
            this.summaryCache.multi.toolUsage[toolName]++;
          }
          break;
        case 'multitrack_play':
          this.summaryCache.multi.navigationStats.playCount++;
          break;
        case 'multitrack_stop':
          this.summaryCache.multi.navigationStats.stopCount++;
          break;
      }
    }
  }

  /**
   * Calculate total session duration
   */
  calculateTotalDuration() {
    if (!this.startTime) return 0;
    const end = this.endTime || new Date().toISOString();
    return Math.floor((new Date(end) - new Date(this.startTime)) / 1000); // seconds
  }

  /**
   * Generate complete summary
   */
  generateSummary() {
    // Update mode timers if still active
    if (this.currentMode) {
      this.stopModeTimer(this.currentMode);
      this.startModeTimer(this.currentMode); // Restart for continued logging
    }

    // Update time totals
    this.summaryCache.single.totalTimeInMode = Math.floor(this.modeTimers.single.totalTime / 1000);
    this.summaryCache.multi.totalTimeInMode = Math.floor(this.modeTimers.multi.totalTime / 1000);
    this.summaryCache.single.sessionCount = this.modeTimers.single.sessionCount;
    this.summaryCache.multi.sessionCount = this.modeTimers.multi.sessionCount;

    // Determine mode preference
    if (this.summaryCache.single.totalTimeInMode > this.summaryCache.multi.totalTimeInMode) {
      this.summaryCache.session.modePreference = 'single';
    } else if (this.summaryCache.multi.totalTimeInMode > 0) {
      this.summaryCache.session.modePreference = 'multi';
    }

    // Determine workflow pattern
    if (this.events.length > 0) {
      const firstMode = this.events.find(e => e.mode)?.mode;
      if (firstMode === 'single' && this.summaryCache.session.modesUsed.includes('multi')) {
        this.summaryCache.session.workflowPattern = 'single_first';
      } else if (firstMode === 'multi' && this.summaryCache.session.modesUsed.includes('single')) {
        this.summaryCache.session.workflowPattern = 'multi_first';
      } else if (this.summaryCache.session.modesUsed.length > 1) {
        this.summaryCache.session.workflowPattern = 'mixed';
      }
    }

    // Convert Set to Array for serialization
    const multiSummary = { ...this.summaryCache.multi };
    if (multiSummary.recordingStats && multiSummary.recordingStats.tracksRecordedTo instanceof Set) {
      multiSummary.recordingStats.tracksRecordedTo = Array.from(multiSummary.recordingStats.tracksRecordedTo);
    }
    multiSummary.finalTrackCount = this.summaryCache.multi.tracksAdded - this.summaryCache.multi.tracksDeleted;

    return {
      singleTrackSummary: this.summaryCache.single,
      multitrackSummary: multiSummary,
      sessionSummary: this.summaryCache.session
    };
  }

  // ========== Export Methods ==========

  /**
   * Export complete log as JSON
   */
  toJSON() {
    const summary = this.generateSummary();

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: this.endTime || new Date().toISOString(),
      totalDuration: this.calculateTotalDuration(),
      events: this.events,
      ...summary,
      metadata: {
        ...this.metadata,
        submittedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Export as compressed string for submission
   */
  toCompressedString() {
    try {
      return JSON.stringify(this.toJSON());
    } catch (error) {
      console.error('📊 Error serializing activity log:', error);
      return null;
    }
  }

  // ========== Utility Methods ==========

  detectBrowser() {
    if (typeof window === 'undefined') return 'unknown';

    const ua = window.navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }

  detectPlatform() {
    if (typeof window === 'undefined') return 'unknown';

    const platform = window.navigator.platform;
    if (platform.includes('Mac')) return 'MacOS';
    if (platform.includes('Win')) return 'Windows';
    if (platform.includes('Linux')) return 'Linux';
    if (/Android|iPhone|iPad|iPod/.test(window.navigator.userAgent)) return 'Mobile';
    return 'Other';
  }

  /**
   * Get current statistics (for debugging/display)
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      isActive: this.isActive,
      currentMode: this.currentMode,
      eventCount: this.events.length,
      duration: this.calculateTotalDuration(),
      modesUsed: this.summaryCache.session.modesUsed
    };
  }

  /**
   * Reset logger to fresh state for new session
   * This should be called after submission to prevent data contamination
   */
  reset() {
    console.log('📊 Resetting activity logger');

    // Generate new session ID
    this.sessionId = this.generateSessionId();
    this.startTime = new Date().toISOString();
    this.endTime = null;

    // Clear event storage
    this.events = [];

    // Reset state
    this.currentMode = null;
    this.isActive = false;

    // Reset timers
    this.modeTimers = {
      single: { startTime: null, totalTime: 0, sessionCount: 0 },
      multi: { startTime: null, totalTime: 0, sessionCount: 0 }
    };

    // Reset summary caches
    this.summaryCache = {
      single: this.createEmptySingleSummary(),
      multi: this.createEmptyMultiSummary(),
      session: this.createEmptySessionSummary()
    };

    // Reset metadata (preserve browser/platform detection)
    const browser = this.metadata.browser;
    const platform = this.metadata.platform;
    this.metadata = {
      assignmentId: null,
      userId: null,
      courseId: null,
      browser,
      platform,
      submittedAt: null
    };

    console.log('📊 Logger reset complete, new session:', this.sessionId);
  }
}

// Export as singleton to ensure single instance across app
let loggerInstance = null;

export const getDAWActivityLogger = () => {
  if (!loggerInstance) {
    loggerInstance = new DAWActivityLogger();
  }
  return loggerInstance;
};

export const resetDAWActivityLogger = () => {
  if (loggerInstance) {
    loggerInstance.reset();
  }
};

export default DAWActivityLogger;