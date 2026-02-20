// components/audio/DAW/Multitrack/PianoRoll/utils/noteHelpers.js

// MIDI note number to note name conversion
export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// Get note name from MIDI number
export const getNoteNameFromNumber = (noteNumber) => {
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
};

// Get MIDI number from note name
export const getNoteNumberFromName = (noteName) => {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;

  const [, note, octave] = match;
  const noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex === -1) return null;

  return (parseInt(octave) + 1) * 12 + noteIndex;
};

// Frequency to MIDI note number
export const frequencyToNoteNumber = (frequency) => {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
};

// MIDI note number to frequency
export const noteNumberToFrequency = (noteNumber) => {
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
};

// Check if note is black key
export const isBlackKey = (noteNumber) => {
  const noteIndex = noteNumber % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex);
};

// Quantize time to grid
export const quantizeTime = (time, gridSize) => {
  if (gridSize === 0) return time;
  return Math.round(time / gridSize) * gridSize;
};

// Get grid size in beats from string (e.g., "1/16" -> 0.0625)
export const parseGridSize = (gridString) => {
  if (gridString === '0' || gridString === 'Off') return 0;
  if (gridString.includes('/')) {
    const [num, den] = gridString.split('/').map(Number);
    return num / den;
  }
  return parseFloat(gridString);
};

// Snap notes to scale
export const snapToScale = (noteNumber, scale = 'major', root = 0) => {
  const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  const scaleNotes = scales[scale] || scales.major;
  const octave = Math.floor(noteNumber / 12);
  const noteInOctave = noteNumber % 12;
  const rootAdjusted = (noteInOctave - root + 12) % 12;

  // Find closest note in scale
  let closestNote = scaleNotes[0];
  let minDistance = Math.abs(rootAdjusted - closestNote);

  for (const scaleNote of scaleNotes) {
    const distance = Math.abs(rootAdjusted - scaleNote);
    if (distance < minDistance) {
      minDistance = distance;
      closestNote = scaleNote;
    }
  }

  return octave * 12 + ((closestNote + root) % 12);
};

// Transpose notes
export const transposeNotes = (notes, semitones) => {
  return notes.map((note) => ({
    ...note,
    note: Math.max(0, Math.min(127, note.note + semitones)),
  }));
};

// Velocity curve functions
export const applyVelocityCurve = (velocity, curve = 'linear') => {
  const normalized = velocity / 127;
  let adjusted;

  switch (curve) {
    case 'soft':
      adjusted = Math.pow(normalized, 2);
      break;
    case 'hard':
      adjusted = Math.sqrt(normalized);
      break;
    case 'exponential':
      adjusted = Math.pow(normalized, 3);
      break;
    case 'logarithmic':
      adjusted = Math.log(normalized + 1) / Math.log(2);
      break;
    default:
      adjusted = normalized;
  }

  return Math.round(adjusted * 127);
};

// Note length humanization
export const humanizeNotes = (notes, options = {}) => {
  const {
    timingVariation = 0.01, // In beats
    velocityVariation = 10,
    lengthVariation = 0.05,
  } = options;

  return notes.map((note) => ({
    ...note,
    startTime: note.startTime + (Math.random() - 0.5) * timingVariation * 2,
    velocity: Math.max(
      1,
      Math.min(
        127,
        note.velocity +
          Math.round((Math.random() - 0.5) * velocityVariation * 2),
      ),
    ),
    duration: Math.max(
      0.01,
      note.duration + (Math.random() - 0.5) * lengthVariation * 2,
    ),
  }));
};

// Chord detection
export const detectChord = (notes) => {
  if (notes.length < 2) return null;

  // Get unique pitches
  const pitches = [...new Set(notes.map((n) => n.note % 12))].sort(
    (a, b) => a - b,
  );

  // Common chord patterns
  const chordPatterns = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
  };

  // Try to match chord pattern
  for (const [chordName, pattern] of Object.entries(chordPatterns)) {
    if (pitches.length === pattern.length) {
      const root = pitches[0];
      const normalized = pitches.map((p) => (p - root + 12) % 12);

      if (pattern.every((note, i) => normalized[i] === note)) {
        return {
          type: chordName,
          root: NOTE_NAMES[root],
          notes: pitches.map((p) => NOTE_NAMES[p]),
        };
      }
    }
  }

  return null;
};

// Split notes at time
export const splitNotesAtTime = (notes, splitTime) => {
  return notes.flatMap((note) => {
    const noteEnd = note.startTime + note.duration;

    if (note.startTime < splitTime && noteEnd > splitTime) {
      // Note crosses split point - split it
      return [
        {
          ...note,
          duration: splitTime - note.startTime,
        },
        {
          ...note,
          id: `${note.id}-split`,
          startTime: splitTime,
          duration: noteEnd - splitTime,
        },
      ];
    }

    return note;
  });
};

// Merge overlapping notes
export const mergeOverlappingNotes = (notes) => {
  const sorted = [...notes].sort((a, b) => {
    if (a.note !== b.note) return a.note - b.note;
    return a.startTime - b.startTime;
  });

  const merged = [];

  for (const note of sorted) {
    const lastNote = merged[merged.length - 1];

    if (
      lastNote &&
      lastNote.note === note.note &&
      lastNote.startTime + lastNote.duration >= note.startTime
    ) {
      // Extend the last note
      lastNote.duration = Math.max(
        lastNote.duration,
        note.startTime + note.duration - lastNote.startTime,
      );
      // Use average velocity
      lastNote.velocity = Math.round((lastNote.velocity + note.velocity) / 2);
    } else {
      merged.push({ ...note });
    }
  }

  return merged;
};
