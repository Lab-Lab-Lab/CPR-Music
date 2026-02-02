// lib/midiFileExport.js
/**
 * MIDI File Export Utility
 * Converts MIDI note data to standard MIDI file format
 */

import { DEFAULT_PPQ, DEFAULT_TEMPO } from './midiTimeUtils';

/**
 * Convert notes to MIDI file and trigger download
 * @param {Array} notes - Array of note objects with {note, velocity, startTime, duration}
 *                        Note: startTime and duration should be in BEATS
 * @param {number} tempo - Tempo in BPM
 * @param {string} filename - Desired filename
 */
export function exportToMIDIFile(notes, tempo = DEFAULT_TEMPO, filename = 'midi-export.mid') {
  // Create MIDI file data
  const midiData = createMIDIFile(notes, tempo);

  // Create blob and download
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Create a standard MIDI file from notes
 * Format: MIDI File Format 0 (single track)
 */
function createMIDIFile(notes, tempo) {
  // Use centralized PPQ constant for consistency
  const ppq = DEFAULT_PPQ;

  // MIDI Header Chunk
  const header = createMIDIHeader(ppq);

  // MIDI Track Chunk
  const track = createMIDITrack(notes, tempo, ppq);

  // Combine header and track
  const midiFile = new Uint8Array(header.length + track.length);
  midiFile.set(header, 0);
  midiFile.set(track, header.length);

  return midiFile;
}

/**
 * Create MIDI header chunk
 */
function createMIDIHeader(ppq) {
  const header = new Uint8Array(14);

  // "MThd" chunk identifier
  header[0] = 0x4D; // M
  header[1] = 0x54; // T
  header[2] = 0x68; // h
  header[3] = 0x64; // d

  // Chunk size (always 6 for header)
  header[4] = 0x00;
  header[5] = 0x00;
  header[6] = 0x00;
  header[7] = 0x06;

  // Format type (0 = single track)
  header[8] = 0x00;
  header[9] = 0x00;

  // Number of tracks (1)
  header[10] = 0x00;
  header[11] = 0x01;

  // Ticks per quarter note
  header[12] = (ppq >> 8) & 0xFF;
  header[13] = ppq & 0xFF;

  return header;
}

/**
 * Create MIDI track chunk with tempo and note events
 */
function createMIDITrack(notes, tempo, ppq) {
  const events = [];

  // Add tempo event at start
  const tempoEvent = createTempoEvent(tempo);
  events.push({ time: 0, data: tempoEvent });

  // Convert notes to MIDI events
  notes.forEach(note => {
    const noteOn = createNoteOnEvent(note.note, note.velocity || 100);
    const noteOff = createNoteOffEvent(note.note);

    // Convert beat times to ticks
    const onTick = Math.round(note.startTime * ppq);
    const offTick = Math.round((note.startTime + note.duration) * ppq);

    events.push({ time: onTick, data: noteOn });
    events.push({ time: offTick, data: noteOff });
  });

  // Sort events by time
  events.sort((a, b) => a.time - b.time);

  // Add end of track marker
  const lastEventTime = events.length > 0 ? events[events.length - 1].time : 0;
  events.push({ time: lastEventTime + 1, data: new Uint8Array([0xFF, 0x2F, 0x00]) });

  // Convert to delta times and create track data
  const trackData = [];
  let previousTime = 0;

  events.forEach(event => {
    const deltaTime = event.time - previousTime;
    const deltaBytes = encodeVariableLength(deltaTime);
    trackData.push(...deltaBytes, ...event.data);
    previousTime = event.time;
  });

  // Create track chunk
  const trackArray = new Uint8Array(trackData);
  const track = new Uint8Array(8 + trackArray.length);

  // "MTrk" chunk identifier
  track[0] = 0x4D; // M
  track[1] = 0x54; // T
  track[2] = 0x72; // r
  track[3] = 0x6B; // k

  // Chunk size
  const size = trackArray.length;
  track[4] = (size >> 24) & 0xFF;
  track[5] = (size >> 16) & 0xFF;
  track[6] = (size >> 8) & 0xFF;
  track[7] = size & 0xFF;

  // Track data
  track.set(trackArray, 8);

  return track;
}

/**
 * Create tempo meta event
 */
function createTempoEvent(bpm) {
  const microsecondsPerQuarter = Math.round(60000000 / bpm);

  return new Uint8Array([
    0xFF, 0x51, 0x03, // Tempo meta event
    (microsecondsPerQuarter >> 16) & 0xFF,
    (microsecondsPerQuarter >> 8) & 0xFF,
    microsecondsPerQuarter & 0xFF
  ]);
}

/**
 * Create note on event
 */
function createNoteOnEvent(note, velocity) {
  return new Uint8Array([
    0x90, // Note on, channel 0
    note & 0x7F,
    velocity & 0x7F
  ]);
}

/**
 * Create note off event
 */
function createNoteOffEvent(note) {
  return new Uint8Array([
    0x80, // Note off, channel 0
    note & 0x7F,
    0x40 // Release velocity
  ]);
}

/**
 * Encode number as variable-length quantity (MIDI format)
 */
function encodeVariableLength(value) {
  const bytes = [];

  bytes.unshift(value & 0x7F);
  value >>= 7;

  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }

  return bytes;
}
