// components/audio/DAW/Multitrack/ClipClipboard.js
'use client';

/**
 * ClipClipboard - Manages clip copy/paste operations
 * Stores clip data with source references for efficient copying
 */
class ClipClipboard {
  constructor() {
    this.clipboard = null; // { clips: Array, trackId: string }
  }

  /**
   * Copy clips to clipboard
   * @param {Array} clips - Array of clip objects to copy
   * @param {string} trackId - Source track ID
   */
  copy(clips, trackId) {
    if (!clips || clips.length === 0) return false;

    // Store clips with their relative positions
    const minStart = Math.min(...clips.map((c) => c.start || 0));

    this.clipboard = {
      clips: clips.map((clip) => ({
        ...clip,
        // Store relative position for pasting
        relativeStart: (clip.start || 0) - minStart,
        // Generate new ID for pasted clips
        sourceId: clip.id,
      })),
      trackId,
      timestamp: Date.now(),
    };

    return true;
  }

  /**
   * Cut clips (copy and mark for deletion)
   * @param {Array} clips - Array of clip objects to cut
   * @param {string} trackId - Source track ID
   * @returns {Array} IDs of clips to delete
   */
  cut(clips, trackId) {
    if (!this.copy(clips, trackId)) return [];

    // Mark as cut operation
    this.clipboard.isCut = true;

    // Return clip IDs to delete
    return clips.map((c) => c.id);
  }

  /**
   * Paste clips at a specific position
   * @param {number} position - Timeline position to paste at (seconds)
   * @param {string} targetTrackId - Target track ID
   * @returns {Array} New clip objects to add
   */
  paste(position, targetTrackId) {
    if (!this.clipboard || !this.clipboard.clips) return [];

    const newClips = this.clipboard.clips.map((clipData) => {
      const newId = `clip-${targetTrackId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      return {
        ...clipData,
        id: newId,
        start: position + clipData.relativeStart,
        // Remove helper properties
        relativeStart: undefined,
        sourceId: undefined,
      };
    });

    // Clear clipboard if it was a cut operation
    if (this.clipboard.isCut) {
      this.clear();
    }

    return newClips;
  }

  /**
   * Check if clipboard has content
   * @returns {boolean}
   */
  hasContent() {
    return this.clipboard !== null && this.clipboard.clips.length > 0;
  }

  /**
   * Get clipboard info
   * @returns {Object|null}
   */
  getInfo() {
    if (!this.clipboard) return null;

    return {
      clipCount: this.clipboard.clips.length,
      sourceTrackId: this.clipboard.trackId,
      isCut: this.clipboard.isCut || false,
      timestamp: this.clipboard.timestamp,
    };
  }

  /**
   * Clear clipboard
   */
  clear() {
    this.clipboard = null;
  }

  /**
   * Calculate paste preview bounds
   * @param {number} position - Timeline position to paste at
   * @returns {Object} { start, end, clips: Array }
   */
  getPastePreview(position) {
    if (!this.clipboard || !this.clipboard.clips) return null;

    const clips = this.clipboard.clips.map((clipData) => ({
      start: position + clipData.relativeStart,
      duration: clipData.duration,
    }));

    const start = Math.min(...clips.map((c) => c.start));
    const end = Math.max(...clips.map((c) => c.start + c.duration));

    return { start, end, clips };
  }
}

// Create singleton instance
const clipClipboard = new ClipClipboard();

export default clipClipboard;
