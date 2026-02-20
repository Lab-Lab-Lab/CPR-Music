// components/audio/DAW/Multitrack/clipOperations.js
'use client';

/**
 * Enhanced clip operations for DAW functionality
 */

/**
 * Split a clip at a specific time
 * @param {Object} clip - Clip to split
 * @param {number} splitTime - Time to split at (seconds)
 * @returns {Array} [leftClip, rightClip] - null if split point is outside clip
 */
export function splitClip(clip, splitTime) {
  const clipStart = clip.start || 0;
  const clipEnd = clipStart + (clip.duration || 0);

  // Can't split outside clip bounds
  if (splitTime <= clipStart || splitTime >= clipEnd) {
    return [clip, null];
  }

  const leftDuration = splitTime - clipStart;
  const rightDuration = clipEnd - splitTime;

  const leftClip = {
    ...clip,
    duration: leftDuration,
  };

  const rightClip = {
    ...clip,
    id: `${clip.id}-split-${Date.now()}`,
    start: splitTime,
    duration: rightDuration,
    offset: (clip.offset || 0) + leftDuration,
  };

  return [leftClip, rightClip];
}

/**
 * Split multiple clips at a specific time
 * @param {Array} clips - Array of clips
 * @param {number} splitTime - Time to split at
 * @returns {Array} New array of clips with splits applied
 */
export function splitClipsAtTime(clips, splitTime) {
  const result = [];

  for (const clip of clips) {
    const [left, right] = splitClip(clip, splitTime);
    result.push(left);
    if (right) result.push(right);
  }

  return result;
}

/**
 * Delete a time range from clips (ripple delete)
 * @param {Array} clips - Array of clips
 * @param {number} startTime - Start of deletion range
 * @param {number} endTime - End of deletion range
 * @returns {Array} New array of clips with range deleted and subsequent clips moved
 */
export function rippleDelete(clips, startTime, endTime) {
  const deleteDuration = endTime - startTime;
  if (deleteDuration <= 0) return [...clips];

  const result = [];

  for (const clip of clips) {
    const clipStart = clip.start || 0;
    const clipEnd = clipStart + (clip.duration || 0);

    // Clip is entirely before deletion range - keep as is
    if (clipEnd <= startTime) {
      result.push({ ...clip });
      continue;
    }

    // Clip is entirely after deletion range - shift left
    if (clipStart >= endTime) {
      result.push({
        ...clip,
        start: clipStart - deleteDuration,
      });
      continue;
    }

    // Clip overlaps deletion range
    // Split at start and end of deletion range
    const [beforeSplit, afterStartSplit] = splitClip(clip, startTime);

    if (beforeSplit && beforeSplit !== clip) {
      result.push(beforeSplit);
    }

    if (afterStartSplit) {
      const [, afterEndSplit] = splitClip(afterStartSplit, endTime);
      if (afterEndSplit) {
        result.push({
          ...afterEndSplit,
          start: startTime, // Move to deletion start point
        });
      }
    }
  }

  return result;
}

/**
 * Find clips in a time range
 * @param {Array} clips - Array of clips
 * @param {number} startTime - Start of range
 * @param {number} endTime - End of range
 * @returns {Array} Clips that overlap the range
 */
export function findClipsInRange(clips, startTime, endTime) {
  return clips.filter((clip) => {
    const clipStart = clip.start || 0;
    const clipEnd = clipStart + (clip.duration || 0);
    return clipEnd > startTime && clipStart < endTime;
  });
}

/**
 * Find clip at a specific time
 * @param {Array} clips - Array of clips
 * @param {number} time - Time to check
 * @returns {Object|null} Clip at time, or null
 */
export function findClipAtTime(clips, time) {
  return clips.find((clip) => {
    const clipStart = clip.start || 0;
    const clipEnd = clipStart + (clip.duration || 0);
    return time >= clipStart && time < clipEnd;
  });
}

/**
 * Trim clip to a specific range
 * @param {Object} clip - Clip to trim
 * @param {number} trimStart - New start time (absolute)
 * @param {number} trimEnd - New end time (absolute)
 * @returns {Object|null} Trimmed clip or null if invalid
 */
export function trimClip(clip, trimStart, trimEnd) {
  const clipStart = clip.start || 0;
  const clipEnd = clipStart + (clip.duration || 0);

  // Calculate intersection
  const newStart = Math.max(clipStart, trimStart);
  const newEnd = Math.min(clipEnd, trimEnd);

  // No intersection
  if (newStart >= newEnd) return null;

  const startDelta = newStart - clipStart;
  const newDuration = newEnd - newStart;

  return {
    ...clip,
    start: newStart,
    duration: newDuration,
    offset: (clip.offset || 0) + startDelta,
  };
}

/**
 * Merge overlapping clips (for same source)
 * @param {Array} clips - Array of clips
 * @returns {Array} Merged clips
 */
export function mergeOverlappingClips(clips) {
  if (clips.length <= 1) return [...clips];

  // Sort by start time
  const sorted = [...clips].sort((a, b) => (a.start || 0) - (b.start || 0));
  const result = [];

  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEnd = (current.start || 0) + (current.duration || 0);
    const nextStart = next.start || 0;

    // Check if clips can be merged (same source and continuous)
    if (
      current.src === next.src &&
      currentEnd >= nextStart &&
      (current.offset || 0) + (current.duration || 0) === (next.offset || 0)
    ) {
      // Extend current clip
      current.duration = Math.max(
        current.duration || 0,
        nextStart - (current.start || 0) + (next.duration || 0),
      );
    } else {
      // Can't merge, save current and start new
      result.push(current);
      current = { ...next };
    }
  }

  result.push(current);
  return result;
}

/**
 * Duplicate clips with offset
 * @param {Array} clips - Clips to duplicate
 * @param {number} offsetTime - Time offset for duplicates
 * @returns {Array} Array of duplicated clips
 */
export function duplicateClips(clips, offsetTime = 0) {
  return clips.map((clip) => ({
    ...clip,
    id: `${clip.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start: (clip.start || 0) + offsetTime,
  }));
}

/**
 * Quantize clip positions to grid
 * @param {Array} clips - Clips to quantize
 * @param {number} gridSize - Grid size in seconds
 * @returns {Array} Quantized clips
 */
export function quantizeClips(clips, gridSize) {
  // Safety check for undefined clips
  if (!clips || !Array.isArray(clips)) return [];

  if (!gridSize || gridSize <= 0) return [...clips];

  return clips.map((clip) => ({
    ...clip,
    start: Math.round((clip.start || 0) / gridSize) * gridSize,
  }));
}

/**
 * Create crossfade between two clips
 * @param {Object} clipA - First clip
 * @param {Object} clipB - Second clip
 * @param {number} fadeTime - Crossfade duration in seconds
 * @returns {Object} Crossfade metadata
 */
export function createCrossfade(clipA, clipB, fadeTime) {
  const aEnd = (clipA.start || 0) + (clipA.duration || 0);
  const bStart = clipB.start || 0;

  // Clips must be close enough for crossfade
  if (Math.abs(aEnd - bStart) > fadeTime) {
    return null;
  }

  // Adjust clips to create overlap
  const fadeStart = aEnd - fadeTime / 2;
  const fadeEnd = bStart + fadeTime / 2;

  return {
    id: `fade-${clipA.id}-${clipB.id}`,
    type: 'crossfade',
    clipAId: clipA.id,
    clipBId: clipB.id,
    start: fadeStart,
    duration: fadeTime,
    fadeIn: {
      start: 0,
      end: 1,
    },
    fadeOut: {
      start: 1,
      end: 0,
    },
  };
}
