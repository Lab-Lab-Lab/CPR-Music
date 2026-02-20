// lib/MIDIRenderCache.js
'use client';

/**
 * MIDI Render Cache for automatic mixdown preprocessing
 * Caches rendered MIDI tracks to avoid re-synthesis during mixdown
 */
class MIDIRenderCache {
  constructor() {
    this.cache = new Map(); // trackId -> { hash, audioBuffer, timestamp }
    this.maxCacheSize = 10; // Limit memory usage
    this.maxAge = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate a hash for track MIDI data to detect changes
   */
  generateHash(track) {
    const data = {
      notes: track.midiData?.notes || [],
      instrument: track.midiData?.instrument || {},
      tempo: track.midiData?.tempo || 120,
      volume: track.volume || 1,
      pan: track.pan || 0,
    };
    
    // Simple hash - in production you'd use a proper hash function
    return JSON.stringify(data);
  }

  /**
   * Check if we have a valid cached render for this track
   */
  hasValidCache(track) {
    const cached = this.cache.get(track.id);
    if (!cached) return false;

    // Check if data changed
    const currentHash = this.generateHash(track);
    if (cached.hash !== currentHash) return false;

    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age > this.maxAge) return false;

    return true;
  }

  /**
   * Get cached audio buffer for a track
   */
  getCached(track) {
    if (!this.hasValidCache(track)) return null;
    
    const cached = this.cache.get(track.id);
    // Update timestamp to keep it fresh
    cached.timestamp = Date.now();
    return cached.audioBuffer;
  }

  /**
   * Store rendered audio buffer in cache
   */
  setCached(track, audioBuffer) {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestEntry = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0];
      
      if (oldestEntry) {
        console.log(`MIDIRenderCache: Evicting old entry for track ${oldestEntry[0]}`);
        this.cache.delete(oldestEntry[0]);
      }
    }

    const hash = this.generateHash(track);
    this.cache.set(track.id, {
      hash,
      audioBuffer,
      timestamp: Date.now(),
    });

    console.log(`MIDIRenderCache: Cached render for track ${track.id}`);
  }

  /**
   * Clear cache for specific track (called when track is deleted/changed significantly)
   */
  clearTrack(trackId) {
    this.cache.delete(trackId);
  }

  /**
   * Clear entire cache
   */
  clearAll() {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [trackId, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.maxAge) {
        this.cache.delete(trackId);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      entries: Array.from(this.cache.keys()),
      oldestAge: this.cache.size > 0 
        ? Math.min(...Array.from(this.cache.values()).map(c => Date.now() - c.timestamp))
        : 0,
    };
  }
}

// Singleton instance
const midiRenderCache = new MIDIRenderCache();

// Cleanup timer
if (typeof window !== 'undefined') {
  setInterval(() => midiRenderCache.cleanup(), 60000); // Clean every minute
}

export default midiRenderCache;