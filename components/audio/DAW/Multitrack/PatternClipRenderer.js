// components/audio/DAW/Multitrack/PatternClipRenderer.js
'use client';

export function drawPatternClips(ctx, track, width, height, pixelsPerBeat, scrollOffset) {
  const { patterns = [], arrangement = [] } = track.midiData || {};
  
  if (arrangement.length === 0) return;
  
  // Create pattern map for quick lookup
  const patternMap = {};
  patterns.forEach(p => patternMap[p.id] = p);
  
  // Draw each clip in the arrangement
  arrangement.forEach((clip, clipIndex) => {
    const pattern = patternMap[clip.patternId];
    if (!pattern) return;
    
    const patternLengthInBeats = pattern.length * 4; // Assuming 4/4
    const totalBeats = patternLengthInBeats * clip.repeatCount;
    
    const x = (clip.startTime * pixelsPerBeat) - scrollOffset;
    const clipWidth = totalBeats * pixelsPerBeat;
    
    // Skip if outside visible area
    if (x + clipWidth < 0 || x > width) return;
    
    // Draw pattern background
    ctx.fillStyle = pattern.color + '40'; // 25% opacity
    ctx.fillRect(x, 0, clipWidth, height);
    
    // Draw pattern sections
    for (let i = 0; i < clip.repeatCount; i++) {
      const sectionX = x + (i * patternLengthInBeats * pixelsPerBeat);
      
      // Pattern border
      ctx.strokeStyle = pattern.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(sectionX, 0, patternLengthInBeats * pixelsPerBeat, height);
      
      // Draw resize handles
      if (i === 0) {
        // Left handle
        ctx.fillStyle = pattern.color + '80';
        ctx.fillRect(sectionX, 0, 4, height);
      }
      if (i === clip.repeatCount - 1) {
        // Right handle
        ctx.fillStyle = pattern.color + '80';
        ctx.fillRect(sectionX + patternLengthInBeats * pixelsPerBeat - 4, 0, 4, height);
      }
      
      // Pattern name (only on first repeat)
      if (i === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(pattern.name, sectionX + 5, 15);
      }
      
      // Repeat indicator
      if (clip.repeatCount > 1) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${i + 1}/${clip.repeatCount}`, sectionX + 5, height - 5);
      }
      
      // Mini note preview
      drawMiniNotes(ctx, pattern, sectionX, 0, patternLengthInBeats * pixelsPerBeat, height);
    }
    
    // Selection indicator (if selected)
    if (clip.selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x - 1, -1, clipWidth + 2, height + 2);
      ctx.setLineDash([]);
    }
  });
}

function drawMiniNotes(ctx, pattern, x, y, width, height) {
  const notes = pattern.notes || [];
  if (notes.length === 0) return;
  
  const patternBeats = pattern.length * 4;
  const noteHeight = 2;
  const margin = 20; // Leave space for pattern name
  
  notes.forEach(note => {
    const noteX = x + (note.startTime / patternBeats) * width;
    const noteWidth = Math.max(1, (note.duration / patternBeats) * width);
    const noteY = y + margin + ((127 - note.note) / 127) * (height - margin - 5);
    
    ctx.fillStyle = pattern.color + 'CC'; // 80% opacity
    ctx.fillRect(noteX, noteY, noteWidth, noteHeight);
  });
}

// Handle pattern clip interactions
export function handlePatternClick(x, y, track, pixelsPerBeat, scrollOffset) {
  const { patterns = [], arrangement = [] } = track.midiData || {};
  const clickTime = (x + scrollOffset) / pixelsPerBeat;
  
  // Find which clip was clicked
  const patternMap = {};
  patterns.forEach(p => patternMap[p.id] = p);
  
  for (let i = 0; i < arrangement.length; i++) {
    const clip = arrangement[i];
    const pattern = patternMap[clip.patternId];
    if (!pattern) continue;
    
    const patternLengthInBeats = pattern.length * 4;
    const clipEnd = clip.startTime + (patternLengthInBeats * clip.repeatCount);
    
    if (clickTime >= clip.startTime && clickTime < clipEnd) {
      // Check if clicking on resize handle
      const clipX = (clip.startTime * pixelsPerBeat) - scrollOffset;
      const clipWidth = patternLengthInBeats * clip.repeatCount * pixelsPerBeat;
      
      if (x >= clipX && x <= clipX + 4) {
        return { clip, pattern, action: 'resize-left', clipIndex: i };
      } else if (x >= clipX + clipWidth - 4 && x <= clipX + clipWidth) {
        return { clip, pattern, action: 'resize-right', clipIndex: i };
      } else {
        return { clip, pattern, action: 'select', clipIndex: i };
      }
    }
  }
  
  return null;
}

// Add pattern to arrangement at specific time
export function addPatternToArrangement(track, patternId, startTime, updateTrack) {
  const arrangement = track.midiData?.arrangement || [];
  const patterns = track.midiData?.patterns || [];
  
  // Find pattern
  const pattern = patterns.find(p => p.id === patternId);
  if (!pattern) return;
  
  // Snap to grid (quarter notes)
  const snappedTime = Math.round(startTime * 4) / 4;
  
  // Check for overlaps and find insertion point
  const patternLength = pattern.length * 4;
  let canInsert = true;
  
  for (const clip of arrangement) {
    const clipPattern = patterns.find(p => p.id === clip.patternId);
    if (!clipPattern) continue;
    
    const clipStart = clip.startTime;
    const clipEnd = clipStart + (clipPattern.length * 4 * clip.repeatCount);
    
    // Check if new pattern would overlap
    if (snappedTime < clipEnd && snappedTime + patternLength > clipStart) {
      canInsert = false;
      break;
    }
  }
  
  if (!canInsert) {
    console.warn('Cannot insert pattern - would overlap existing clip');
    return;
  }
  
  // Add new clip
  const newClip = {
    patternId,
    startTime: snappedTime,
    repeatCount: 1
  };
  
  // Add to arrangement and sort
  const newArrangement = [...arrangement, newClip].sort((a, b) => a.startTime - b.startTime);
  
  updateTrack(track.id, {
    midiData: {
      ...track.midiData,
      arrangement: newArrangement
    }
  });
}

// Remove pattern clip from arrangement
export function removePatternClip(track, clipIndex, updateTrack) {
  const arrangement = track.midiData?.arrangement || [];
  const newArrangement = arrangement.filter((_, index) => index !== clipIndex);
  
  updateTrack(track.id, {
    midiData: {
      ...track.midiData,
      arrangement: newArrangement
    }
  });
}

// Update pattern clip (move, resize, etc.)
export function updatePatternClip(track, clipIndex, updates, updateTrack) {
  const arrangement = track.midiData?.arrangement || [];
  const newArrangement = [...arrangement];
  
  if (clipIndex >= 0 && clipIndex < newArrangement.length) {
    newArrangement[clipIndex] = {
      ...newArrangement[clipIndex],
      ...updates
    };
    
    // Re-sort if position changed
    if (updates.startTime !== undefined) {
      newArrangement.sort((a, b) => a.startTime - b.startTime);
    }
    
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        arrangement: newArrangement
      }
    });
  }
}

// Convert arrangement to flat note list for playback
export function resolvePatternArrangement(track) {
  const { patterns = [], arrangement = [] } = track.midiData || {};
  const resolvedNotes = [];
  
  // Create pattern map
  const patternMap = {};
  patterns.forEach(p => patternMap[p.id] = p);
  
  // Resolve each clip
  arrangement.forEach(clip => {
    const pattern = patternMap[clip.patternId];
    if (!pattern || !pattern.notes) return;
    
    const patternLengthInBeats = pattern.length * 4;
    
    // Repeat pattern according to repeatCount
    for (let repeat = 0; repeat < clip.repeatCount; repeat++) {
      const timeOffset = clip.startTime + (repeat * patternLengthInBeats);
      
      // Copy notes with time offset
      pattern.notes.forEach(note => {
        resolvedNotes.push({
          ...note,
          id: `${note.id}-${clip.startTime}-${repeat}`,
          startTime: note.startTime + timeOffset
        });
      });
    }
  });
  
  return resolvedNotes;
}

// Duplicate pattern clip
export function duplicatePatternClip(track, clipIndex, updateTrack) {
  const arrangement = track.midiData?.arrangement || [];
  const patterns = track.midiData?.patterns || [];
  
  if (clipIndex < 0 || clipIndex >= arrangement.length) return;
  
  const clipToDuplicate = arrangement[clipIndex];
  const pattern = patterns.find(p => p.id === clipToDuplicate.patternId);
  if (!pattern) return;
  
  // Find next available position
  const patternLength = pattern.length * 4 * clipToDuplicate.repeatCount;
  const newStartTime = clipToDuplicate.startTime + patternLength;
  
  // Check if position is available
  let canPlace = true;
  for (const clip of arrangement) {
    const clipPattern = patterns.find(p => p.id === clip.patternId);
    if (!clipPattern) continue;
    
    const clipStart = clip.startTime;
    const clipEnd = clipStart + (clipPattern.length * 4 * clip.repeatCount);
    
    if (newStartTime < clipEnd && newStartTime + patternLength > clipStart) {
      canPlace = false;
      break;
    }
  }
  
  if (!canPlace) {
    console.warn('Cannot duplicate pattern - no space available');
    return;
  }
  
  // Create duplicate clip
  const newClip = {
    ...clipToDuplicate,
    startTime: newStartTime
  };
  
  const newArrangement = [...arrangement, newClip].sort((a, b) => a.startTime - b.startTime);
  
  updateTrack(track.id, {
    midiData: {
      ...track.midiData,
      arrangement: newArrangement
    }
  });
}