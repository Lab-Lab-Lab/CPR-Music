// components/audio/DAW/Multitrack/AudioEngine.js
'use client';

let _ctx = null;
function getAudioContext() {
  if (_ctx && _ctx.state !== 'closed') return _ctx;
  _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

// Export for use by transport
export { getAudioContext };

const _decodeCache = new Map();

/**
 * Decode an audio URL (data:, blob:, http(s):).
 * Returns an AudioBuffer (cached).
 */
export async function decodeAudioFromURL(url) {
  if (!url) return null;
  if (_decodeCache.has(url)) return _decodeCache.get(url);

  const res = await fetch(url);
  const ab = await res.arrayBuffer();
  const buffer = await getAudioContext().decodeAudioData(ab);
  _decodeCache.set(url, buffer);
  return buffer;
}

/**
 * Downsample peaks for simple block-wave rendering (min/max pairs).
 */
export function getPeaks(audioBuffer, samplesPerPixel = 256) {
  const ch = 0; // use first channel for peaks
  const data = audioBuffer.getChannelData(ch);
  const total = data.length;
  const step = Math.max(
    1,
    Math.floor(total / Math.max(1, Math.floor(total / samplesPerPixel))),
  );
  const peaks = [];

  for (let i = 0; i < total; i += step) {
    let min = 1.0;
    let max = -1.0;
    for (let j = 0; j < step && i + j < total; j++) {
      const v = data[i + j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks.push([min, max]);
  }
  return peaks;
}

/**
 * A tiny transport with a single timebase using AudioContext for timing.
 * - onTick(currentTimeSec) is called ~60fps when playing.
 * - Uses AudioContext.currentTime for sample-accurate synchronization with audio
 */
export function createTransport({ onTick, getProjectDurationSec }) {
  const audioContext = getAudioContext();

  const state = {
    isPlaying: false,
    startAtSec: 0, // where playback started (project seconds)
    contextStartTime: 0, // AudioContext time when we started
    rafId: null,
  };

  const tick = () => {
    if (!state.isPlaying) return;
    const dur = getProjectDurationSec?.() ?? 0;
    const elapsed = audioContext.currentTime - state.contextStartTime;
    const t = state.startAtSec + elapsed;
    const clamped = dur > 0 ? Math.min(t, dur) : t;
    onTick?.(clamped);

    if (dur > 0 && clamped >= dur) {
      api.pause();
      onTick?.(dur);
      return;
    }
    state.rafId = requestAnimationFrame(tick);
  };

  const api = {
    get currentTime() {
      if (!state.isPlaying) return state.startAtSec;
      const elapsed = audioContext.currentTime - state.contextStartTime;
      return state.startAtSec + elapsed;
    },
    play(fromSec = null) {
      if (fromSec != null) state.startAtSec = Math.max(0, fromSec);
      state.contextStartTime = audioContext.currentTime;
      state.isPlaying = true;
      cancelAnimationFrame(state.rafId);
      state.rafId = requestAnimationFrame(tick);
    },
    pause() {
      if (!state.isPlaying) return;
      state.startAtSec = api.currentTime;
      state.isPlaying = false;
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    },
    stop() {
      state.isPlaying = false;
      state.startAtSec = 0;
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
      onTick?.(0);
    },
    seek(toSec) {
      state.startAtSec = Math.max(0, toSec || 0);
      state.contextStartTime = audioContext.currentTime;
      onTick?.(state.startAtSec);
    },
  };

  return api;
}

export default {
  getAudioContext,
  decodeAudioFromURL,
  getPeaks,
  createTransport,
};
