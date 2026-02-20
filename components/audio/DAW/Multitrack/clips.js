// components/audio/DAW/Multitrack/clips.js
'use client';

// clip shape: { id, start, duration, color?, src?, offset? }

/** Split a clip at absolute project time `at` (sec). */
export function splitClip(clip, at) {
  const end = clip.start + clip.duration;
  if (at <= clip.start || at >= end) return [clip, null];

  const left = { ...clip, duration: at - clip.start };
  const right = {
    ...clip,
    id: `${clip.id}-r-${Math.random().toString(36).slice(2, 7)}`,
    start: at,
    duration: end - at,
    offset: (clip.offset || 0) + (at - clip.start),
  };
  return [left, right];
}

/** Trim a clip to [newStart, newEnd] window (absolute project seconds). */
export function trimClip(clip, newStart, newEnd) {
  const s = Math.max(clip.start, newStart);
  const e = Math.min(clip.start + clip.duration, newEnd);
  if (e <= s) return null;
  const delta = s - clip.start;
  return {
    ...clip,
    start: s,
    duration: e - s,
    offset: (clip.offset || 0) + delta,
  };
}

/** Move a clip by delta seconds (clamped to >= 0). */
export function moveClip(clip, delta) {
  return { ...clip, start: Math.max(0, clip.start + delta) };
}

/**
 * Ripple delete a time window [start, end] across the timeline.
 * - Removes that time from the project, shifting everything after left by (end-start).
 * - Overlapping clips are split; right parts slide left to `start`.
 */
export function rippleDelete(clips, start, end) {
  const cut = Math.max(0, end - start);
  if (cut === 0) return clips.slice();

  const out = [];
  for (const c of clips) {
    const cEnd = c.start + c.duration;

    // completely before -> unchanged
    if (cEnd <= start) {
      out.push({ ...c });
      continue;
    }

    // completely after -> shift left
    if (c.start >= end) {
      out.push({ ...c, start: c.start - cut });
      continue;
    }

    // overlapping
    const [left, right] = splitClip(c, start);
    if (left && left !== c) {
      out.push(left); // keep left portion
    } else if (c.start < start) {
      // left-only trim
      const trimmed = trimClip(c, c.start, start);
      if (trimmed) out.push(trimmed);
    }

    // keep right piece but slide to 'start'
    if (right) {
      out.push({ ...right, start }); // preserve offset inside source
    } else if (cEnd > end) {
      const trimmedRight = trimClip(c, end, cEnd);
      if (trimmedRight) out.push({ ...trimmedRight, start }); // slide
    }
  }
  // normalize sort by start
  return out.sort((a, b) => a.start - b.start);
}

/** Snap a second value to a grid (sec). */
export function quantizeSeconds(sec, gridSec) {
  if (!gridSec || gridSec <= 0) return sec;
  return Math.round(sec / gridSec) * gridSec;
}
