'use client';

import { decodeAudioFromURL } from './AudioEngine';
import { debugLog, debugWarn, debugError } from '../../../../lib/debug';
import { getAudioResourceManager, revokeAudioBlob } from '../../../../lib/audioUtils';

// Module-level log helpers to avoid creating new functions on each call
const log = (msg, data) => debugLog('ClipPlayer', msg, data);
const warn = (msg, data) => debugWarn('ClipPlayer', msg, data);
const error = (msg, data) => debugError('ClipPlayer', msg, data);

/**
 * ClipPlayer - Handles playback of audio clips using Web Audio API
 * Supports offset, duration, volume, pan, and synchronized playback
 *
 * Memory Management:
 * - Tracks blob URLs for cleanup
 * - Provides dispose() method for full cleanup
 * - Automatically disconnects audio nodes when clips are removed
 *
 * Timing Sync:
 * - Version tracking ensures timing updates propagate to playing sources
 * - Automatic reschedule when clip timing changes during playback
 */
export default class ClipPlayer {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.clips = new Map(); // clipId -> { buffer, source, gainNode, panNode, startTime, offset, duration, blobUrl, version }
    this.isPlaying = false;
    this.playbackStartTime = 0; // When playback started (context time)
    this.playbackStartOffset = 0; // Where in the timeline we started (seconds)
    this.trackedBlobUrls = new Set(); // Track blob URLs for cleanup
    this.instanceId = `ClipPlayer_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    this.disposed = false; // Prevent operations after dispose

    // Register with resource manager for coordinated cleanup
    const manager = getAudioResourceManager();
    this.unregisterCleanup = manager.registerCleanupCallback(() => this.dispose());
  }

  /**
   * Load and prepare a clip for playback
   * @param {Object} clip - Clip object with id, src, offset, duration
   * @param {number} volume - Track volume (0-1)
   * @param {number} pan - Track pan (-1 to 1)
   */
  async prepareClip(clip, volume = 1, pan = 0) {
    if (this.disposed) {
      warn(`ClipPlayer disposed, ignoring prepareClip for ${clip.id}`);
      return null;
    }

    if (!clip.src) {
      warn(`Clip ${clip.id} has no source URL`);
      return;
    }

    log(`🔊 ClipPlayer: prepareClip called`, {
      clipId: clip.id,
      clipStart: clip.start,
      clipOffset: clip.offset,
      clipDuration: clip.duration,
      src: clip.src?.substring(0, 50) + '...'
    });

    // Check if already loaded
    const existing = this.clips.get(clip.id);
    if (existing && existing.src === clip.src) {
      // Track if timing changed for potential reschedule
      const oldStartTime = existing.startTime;
      const oldOffset = existing.offset;
      const oldDuration = existing.duration;

      log(`🔊 ClipPlayer: Updating existing clip`, {
        clipId: clip.id,
        bufferDuration: existing.buffer?.duration,
        oldClipDuration: existing.duration,
        newClipDuration: clip.duration
      });

      // Update volume and pan
      // Catch blocks intentionally empty: AudioNode may be in invalid state during
      // disposal or context state changes - safe to ignore as clip will be recreated
      try {
        existing.gainNode.gain.value = volume;
      } catch { /* AudioNode may be disconnected or context closed */ }
      try {
        existing.panNode.pan.value = pan;
      } catch { /* AudioNode may be disconnected or context closed */ }
      // IMPORTANT: also update timing so canvas edits take effect
      existing.startTime = Math.max(0, Number(clip.start) || 0);
      existing.offset = Math.max(0, Number(clip.offset) || 0);

      const nextDur =
        clip.duration != null ? Number(clip.duration) : existing.duration;
      if (existing.buffer) {
        const maxDur = Math.max(0, existing.buffer.duration - existing.offset);
        existing.duration = Math.max(0, Math.min(Number(nextDur) || 0, maxDur));
      } else {
        existing.duration = Math.max(0, Number(nextDur) || 0);
      }

      // Check if timing actually changed
      const timingChanged =
        oldStartTime !== existing.startTime ||
        oldOffset !== existing.offset ||
        oldDuration !== existing.duration;

      // If playing and timing changed, reschedule this clip
      if (timingChanged && this.isPlaying && existing.source) {
        existing.version = (existing.version || 0) + 1;
        log(`🔊 ClipPlayer: Timing changed during playback, rescheduling`, {
          clipId: clip.id,
          version: existing.version,
          oldTiming: { startTime: oldStartTime, offset: oldOffset, duration: oldDuration },
          newTiming: { startTime: existing.startTime, offset: existing.offset, duration: existing.duration }
        });

        // Stop old source and reschedule
        try {
          existing.source.stop();
          existing.source.disconnect();
        } catch {
          // Intentionally ignored: source may already be stopped or disconnected
          // This is expected when rapidly updating clip timing or during cleanup
        }
        existing.source = null;

        // Reschedule with current timeline position
        const currentPosition = this.getCurrentTime();
        this.scheduleClip(existing, currentPosition);
      }

      return existing;
    }

    try {
      // Decode audio
      const audioBuffer = await decodeAudioFromURL(clip.src);
      if (!audioBuffer) {
        throw new Error('Failed to decode audio');
      }

      // Create nodes
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;

      const panNode = this.audioContext.createStereoPanner();
      panNode.pan.value = pan;

      // Connect nodes: source -> gain -> pan -> destination
      gainNode.connect(panNode);
      panNode.connect(this.audioContext.destination);

      const clipData = {
        id: clip.id,
        src: clip.src,
        buffer: audioBuffer,
        source: null,
        gainNode,
        panNode,
        startTime: clip.start || 0,
        offset: clip.offset || 0,
        duration: clip.duration || audioBuffer.duration,
        version: 1, // Track clip version for timing sync
      };

      log(`🔊 ClipPlayer: Clip prepared successfully`, {
        clipId: clip.id,
        bufferDuration: audioBuffer.duration,
        clipDuration: clipData.duration,
        startTime: clipData.startTime,
        offset: clipData.offset,
        effectivePlayDuration: Math.min(clipData.duration, audioBuffer.duration - clipData.offset)
      });

      this.clips.set(clip.id, clipData);
      return clipData;
    } catch (error) {
      error(`Failed to prepare clip ${clip.id}:`, error);
      return null;
    }
  }

  /**
   * Update clips for a track
   * @param {Array} clips - Array of clip objects
   * @param {number} volume - Track volume
   * @param {number} pan - Track pan
   */
  async updateClips(clips, volume = 1, pan = 0) {
    clips = Array.isArray(clips)
      ? clips.map((c) => ({
          id: c.id,
          src: c.src,
          start: Math.max(0, Number(c.start) || 0),
          offset: Math.max(0, Number(c.offset) || 0),
          duration: Math.max(0, Number(c.duration) || 0),
        }))
      : [];

    // Remove clips that no longer exist
    const clipIds = new Set(clips.map((c) => c.id));
    for (const [id, clipData] of this.clips.entries()) {
      if (!clipIds.has(id)) {
        this.removeClip(id);
      }
    }

    // Prepare all clips
    const promises = clips.map((clip) => this.prepareClip(clip, volume, pan));
    await Promise.all(promises);
  }

  /**
   * Start playback from a specific position
   * @param {number} startTime - Start position in seconds
   */
  play(startTime = 0) {
    if (this.disposed) {
      warn('ClipPlayer disposed, ignoring play()');
      return;
    }

    this.stop(); // Stop any existing playback

    this.isPlaying = true;
    this.playbackStartTime = this.audioContext.currentTime;
    this.playbackStartOffset = startTime;

    // Schedule all clips
    for (const [clipId, clipData] of this.clips.entries()) {
      this.scheduleClip(clipData, startTime);
    }
  }

  /**
   * Schedule a single clip for playback
   * @param {Object} clipData - Clip data from the clips map
   * @param {number} timelinePosition - Current position in the timeline
   */
  scheduleClip(clipData, timelinePosition) {
    const { buffer, gainNode, startTime, offset, duration } = clipData;

    // Calculate when this clip should start playing
    const clipEndTime = startTime + duration;

    log(`🔊 ClipPlayer: Scheduling clip`, {
      clipId: clipData.id,
      startTime: startTime.toFixed(3),
      offset: offset.toFixed(3),
      duration: duration.toFixed(3),
      bufferDuration: buffer.duration.toFixed(3),
      clipEndTime: clipEndTime.toFixed(3),
      timelinePosition: timelinePosition.toFixed(3)
    });

    // Skip if we're already past this clip
    if (timelinePosition >= clipEndTime) {
      log(`🔊 ClipPlayer: Skipping clip (past end)`);
      return;
    }

    // Create a new buffer source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);

    // Calculate timing
    const now = this.audioContext.currentTime;
    let when = this.playbackStartTime;
    let sourceOffset = Math.max(0, Number(offset) || 0);
    let sourceDuration = Math.max(0, Number(duration) || 0);

    if (timelinePosition < startTime) {
      // Clip hasn't started yet, schedule it for the future
      when = this.playbackStartTime + (startTime - timelinePosition);
    } else {
      // We're in the middle of this clip
      when = this.playbackStartTime;
      const clipProgress = timelinePosition - startTime;
      sourceOffset = offset + clipProgress;
      sourceDuration = duration - clipProgress;
    }

    // Ensure we don't exceed buffer duration
    const maxDuration = Math.max(0, buffer.duration - sourceOffset);
    sourceDuration = Math.max(0, Math.min(sourceDuration, maxDuration));

    // Prevent scheduling in the past (causes immediate start with glitches)
    if (when < now) {
      warn('ClipPlayer: Scheduling in past, adjusting', {
        when: when.toFixed(3),
        now: now.toFixed(3),
        diff: (now - when).toFixed(3),
      });
      // Adjust offset to account for time already passed
      const timePassed = now - when;
      sourceOffset += timePassed;
      sourceDuration -= timePassed;
      when = now;
    }

    if (sourceDuration > 1e-4) {
      try {
        source.start(when, sourceOffset, sourceDuration);
        clipData.source = source;

        log('🔊 ClipPlayer: Started source', {
          clipId: clipData.id,
          when: when.toFixed(3),
          sourceOffset: sourceOffset.toFixed(3),
          sourceDuration: sourceDuration.toFixed(3),
          scheduleAhead: (when - now).toFixed(3),
          bufferDuration: buffer.duration.toFixed(3),
          clipStartTime: startTime.toFixed(3),
          clipOffset: offset.toFixed(3),
          clipDuration: duration.toFixed(3)
        });
      } catch (error) {
        error('🔊 ClipPlayer: Error starting source:', error, {
          clipId: clipData.id,
          when,
          sourceOffset,
          sourceDuration,
          bufferDuration: buffer.duration,
        });
        return;
      }

      // Clean up when finished
      source.onended = () => {
        log('🔊 ClipPlayer: Source ended', {
          clipId: clipData.id,
          endTime: this.audioContext.currentTime.toFixed(3)
        });
        if (clipData.source === source) {
          clipData.source = null;
        }
      };
    }
  }

  /**
   * Stop all playback
   */
  stop() {
    this.isPlaying = false;

    for (const [clipId, clipData] of this.clips.entries()) {
      if (clipData.source) {
        try {
          clipData.source.stop();
          clipData.source.disconnect();
        } catch {
          // Intentionally ignored: BufferSourceNode may already be stopped
          // (single-use nodes cannot be stopped twice per Web Audio spec)
        }
        clipData.source = null;
      }
    }
  }

  /**
   * Pause playback (stop and remember position)
   * @returns {number} Current playback position
   */
  pause() {
    if (!this.isPlaying) {
      return this.playbackStartOffset;
    }

    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    const currentPosition = this.playbackStartOffset + elapsed;

    this.stop();

    return currentPosition;
  }

  /**
   * Seek to a specific position
   * @param {number} position - Position in seconds
   */
  seek(position) {
    const wasPlaying = this.isPlaying;
    this.stop();

    if (wasPlaying) {
      this.play(position);
    } else {
      this.playbackStartOffset = position;
    }
  }

  /**
   * Update volume for all clips
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    for (const [clipId, clipData] of this.clips.entries()) {
      clipData.gainNode.gain.value = volume;
    }
  }

  /**
   * Update pan for all clips
   * @param {number} pan - Pan (-1 to 1)
   */
  setPan(pan) {
    for (const [clipId, clipData] of this.clips.entries()) {
      clipData.panNode.pan.value = pan;
    }
  }

  /**
   * Remove a specific clip and clean up its resources
   * @param {string} clipId - Clip ID to remove
   */
  removeClip(clipId) {
    const clipData = this.clips.get(clipId);
    if (!clipData) return;

    log(`Removing clip ${clipId}`);

    // Stop and disconnect source if playing
    if (clipData.source) {
      try {
        clipData.source.stop();
        clipData.source.disconnect();
      } catch {
        // Intentionally ignored: source may already be stopped or in ended state
      }
    }

    // Disconnect audio nodes - errors ignored as nodes may already be disconnected
    // during rapid clip removal or context closure
    try {
      clipData.gainNode.disconnect();
    } catch { /* Node may already be disconnected */ }
    try {
      clipData.panNode.disconnect();
    } catch { /* Node may already be disconnected */ }

    // Revoke blob URL if this clip was using one
    if (clipData.src && clipData.src.startsWith('blob:')) {
      revokeAudioBlob(clipData.src);
      this.trackedBlobUrls.delete(clipData.src);
    }

    // Clear buffer reference to help garbage collection
    clipData.buffer = null;

    this.clips.delete(clipId);
  }

  /**
   * Clean up all resources - call this when the ClipPlayer is no longer needed
   * This prevents memory leaks from audio buffers and blob URLs
   *
   * Cleanup order:
   * 1. Mark as disposed to prevent new operations
   * 2. Stop all audio sources and wait for them to settle
   * 3. Disconnect audio nodes
   * 4. Revoke blob URLs (after audio is stopped)
   * 5. Clear data structures
   */
  dispose() {
    if (this.disposed) {
      log(`ClipPlayer ${this.instanceId} already disposed`);
      return;
    }

    log(`Disposing ClipPlayer ${this.instanceId}`);
    this.disposed = true;

    // Step 1: Stop all playback first
    this.stop();

    // Step 2: Collect blob URLs before clearing clips
    // This ensures we don't lose track of URLs that need cleanup
    const blobUrlsToRevoke = new Set(this.trackedBlobUrls);

    // Step 3: Clean up each clip
    for (const [clipId, clipData] of this.clips.entries()) {
      // Ensure source is stopped (double-check after stop())
      if (clipData.source) {
        try {
          clipData.source.stop();
          clipData.source.disconnect();
        } catch { /* Source may already be stopped - safe to ignore during dispose */ }
        clipData.source = null;
      }

      // Disconnect audio nodes - safe to ignore errors during dispose as
      // the entire audio graph is being torn down
      try {
        clipData.gainNode.disconnect();
      } catch { /* Node cleanup during dispose */ }
      try {
        clipData.panNode.disconnect();
      } catch { /* Node cleanup during dispose */ }

      // Track blob URL for later cleanup
      if (clipData.src && clipData.src.startsWith('blob:')) {
        blobUrlsToRevoke.add(clipData.src);
      }

      // Clear buffer reference
      clipData.buffer = null;
    }

    // Step 4: Clear all clips
    this.clips.clear();

    // Step 5: Revoke blob URLs after all audio operations are done
    // Use setTimeout to ensure audio nodes have fully released
    setTimeout(() => {
      for (const url of blobUrlsToRevoke) {
        revokeAudioBlob(url);
      }
    }, 50);

    this.trackedBlobUrls.clear();

    // Step 6: Unregister from resource manager
    if (this.unregisterCleanup) {
      this.unregisterCleanup();
      this.unregisterCleanup = null;
    }

    log(`ClipPlayer ${this.instanceId} disposed`);
  }

  /**
   * Track a blob URL for cleanup when this ClipPlayer is disposed
   * @param {string} url - Blob URL to track
   */
  trackBlobUrl(url) {
    if (url && url.startsWith('blob:')) {
      this.trackedBlobUrls.add(url);
    }
  }

  /**
   * Get memory usage statistics for this ClipPlayer
   * @returns {Object} Stats about clips and buffers
   */
  getMemoryStats() {
    let totalBufferSize = 0;
    let clipCount = 0;

    for (const [clipId, clipData] of this.clips.entries()) {
      clipCount++;
      if (clipData.buffer) {
        // Estimate buffer size: numberOfChannels * length * 4 bytes per float32
        totalBufferSize += clipData.buffer.numberOfChannels * clipData.buffer.length * 4;
      }
    }

    return {
      clipCount,
      totalBufferSize,
      totalBufferSizeMB: (totalBufferSize / (1024 * 1024)).toFixed(2),
      trackedBlobUrls: this.trackedBlobUrls.size
    };
  }

  /**
   * Get current playback position
   * @returns {number} Current position in seconds
   */
  getCurrentTime() {
    if (!this.isPlaying) {
      return this.playbackStartOffset;
    }

    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    return this.playbackStartOffset + elapsed;
  }

  /**
   * Check if a specific clip is currently playing
   * @param {string} clipId - Clip ID
   * @returns {boolean}
   */
  isClipPlaying(clipId) {
    const clipData = this.clips.get(clipId);
    return clipData && clipData.source !== null;
  }
}
