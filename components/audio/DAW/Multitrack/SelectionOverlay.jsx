'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

/**
 * SelectionOverlay - Handles cross-track selection box
 * Renders over all tracks to allow selecting clips across multiple tracks
 */
export default function SelectionOverlay({ containerRef, zoomLevel }) {
  const {
    tracks,
    selectedClipIds,
    setSelectedClipIds,
    setSelectedClipId,
    editorTool,
    selectedTrackId,
    setSelectedTrackId,
  } = useMultitrack();

  const [selectionBox, setSelectionBox] = useState(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!containerRef?.current || editorTool !== 'select') return;

    const container = containerRef.current;

    function onPointerDown(e) {
      // Only handle if we're in select mode
      if (editorTool !== 'select') {
        console.log('🔷 SelectionOverlay: Not in select mode, editorTool =', editorTool);
        return;
      }

      // Check if clicking on track canvas area (not controls)
      const target = e.target;
      const isCanvas = target.tagName === 'CANVAS' || target.closest('.track-clips-area');
      console.log('🔷 SelectionOverlay: pointerDown', {
        targetTag: target.tagName,
        isCanvas,
        hasTrackClipsArea: !!target.closest('.track-clips-area')
      });
      if (!isCanvas) return;

      // Don't start selection box if clicking directly on a clip
      // Let the individual TrackClipCanvas handle that
      // We only start selection box for dragging across empty space or multiple tracks
      // A small delay will help distinguish between clip clicks and drag starts
      const rect = container.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      console.log('🔷 SelectionOverlay: Starting pending drag', { startX, startY });
      // Store the start position but don't activate selection box yet
      isDraggingRef.current = { pending: true, startX, startY, hasMovedEnough: false };
    }

    function onPointerMove(e) {
      if (!isDraggingRef.current) return;

      const rect = container.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;

      // If we have a pending drag, check if we've moved enough to activate selection box
      if (isDraggingRef.current.pending) {
        const dx = endX - isDraggingRef.current.startX;
        const dy = endY - isDraggingRef.current.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Require at least 5 pixels of movement to activate selection box
        if (distance > 5) {
          console.log('🔷 SelectionOverlay: Activating selection box', { distance, startX: isDraggingRef.current.startX, startY: isDraggingRef.current.startY, endX, endY });
          // Keep the start coordinates when activating
          const { startX: savedStartX, startY: savedStartY } = isDraggingRef.current;
          isDraggingRef.current = { active: true, startX: savedStartX, startY: savedStartY };
          setSelectionBox({
            startX: savedStartX,
            startY: savedStartY,
            endX,
            endY,
          });

          // Clear selection unless shift/ctrl is held
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedClipId(null);
            setSelectedClipIds([]);
          }
        }
        return;
      }

      // Update active selection box
      if (selectionBox) {
        setSelectionBox(prev => ({
          ...prev,
          endX,
          endY,
        }));
      }
    }

    function onPointerUp(e) {
      // If we didn't activate a selection box, just reset
      if (!isDraggingRef.current || (!isDraggingRef.current.active && !selectionBox)) {
        isDraggingRef.current = false;
        setSelectionBox(null);
        return;
      }

      // If selection box wasn't activated (small movement or click), just reset
      if (!selectionBox) {
        isDraggingRef.current = false;
        return;
      }

      // Calculate which clips are in the selection box
      const rect = container.getBoundingClientRect();
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const selectedIds = [];
      const pixelsPerSecond = zoomLevel;

      // Account for track controls offset (80px sidebar + 230px controls)
      const CONTROLS_OFFSET = 310;

      console.log('🔷 SelectionOverlay: Calculating selection', {
        minX, maxX, minY, maxY,
        pixelsPerSecond,
        controlsOffset: CONTROLS_OFFSET,
        trackCount: tracks.length
      });

      // Iterate through all audio tracks
      tracks.forEach((track, trackIndex) => {
        // Skip MIDI tracks
        if (track.type === 'midi') return;

        // Calculate track's Y position (approximate)
        // Each track is roughly 200px tall + some margin
        const trackHeight = 200; // Should match your track height
        const trackY = trackIndex * (trackHeight + 10); // 10px margin between tracks
        const trackEndY = trackY + trackHeight;

        console.log('🔷 SelectionOverlay: Checking track', {
          trackId: track.id,
          trackIndex,
          trackY,
          trackEndY,
          intersectsY: maxY >= trackY && minY <= trackEndY,
          clipCount: (track.clips || []).length
        });

        // Check if selection box intersects this track's Y range
        if (maxY >= trackY && minY <= trackEndY) {
          // Check each clip in this track
          (track.clips || []).forEach(clip => {
            // Clip X positions need to account for the controls offset
            const clipStartX = CONTROLS_OFFSET + (clip.start || 0) * pixelsPerSecond;
            const clipEndX = clipStartX + (clip.duration || 0) * pixelsPerSecond;

            console.log('🔷 SelectionOverlay: Checking clip', {
              clipId: clip.id,
              clipStart: clip.start,
              clipDuration: clip.duration,
              clipStartX,
              clipEndX,
              intersects: clipEndX >= minX && clipStartX <= maxX
            });

            // Check if clip intersects with selection box
            if (clipEndX >= minX && clipStartX <= maxX) {
              selectedIds.push(clip.id);
            }
          });
        }
      });

      // Update selection
      const isShift = e.shiftKey;
      const isCtrl = e.ctrlKey || e.metaKey;

      console.log('🔷 SelectionOverlay: Selection complete', {
        selectedIds,
        selectedIdsCount: selectedIds.length,
        isShift,
        isCtrl,
        existingSelection: selectedClipIds
      });

      if (isShift || isCtrl) {
        // Add to existing selection
        const combinedIds = [...new Set([...selectedClipIds, ...selectedIds])];
        setSelectedClipIds(combinedIds);
        if (combinedIds.length > 0) {
          setSelectedClipId(combinedIds[0]);
        }
      } else {
        // Replace selection
        setSelectedClipIds(selectedIds);
        if (selectedIds.length > 0) {
          setSelectedClipId(selectedIds[0]);
        }
      }

      isDraggingRef.current = false;
      setSelectionBox(null);
    }

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [containerRef, editorTool, selectionBox, selectedClipIds, setSelectedClipIds,
      setSelectedClipId, tracks, zoomLevel]);

  if (!selectionBox || editorTool !== 'select') {
    console.log('🔷 SelectionOverlay: Not rendering', { hasSelectionBox: !!selectionBox, editorTool });
    return null;
  }

  const { startX, startY, endX, endY } = selectionBox;
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  console.log('🔷 SelectionOverlay: Rendering box', { left, top, width, height });

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: 'rgba(100, 150, 255, 0.15)',
        border: '2px solid rgba(100, 150, 255, 0.8)',
        pointerEvents: 'none',
        zIndex: 1000,
        boxSizing: 'border-box',
      }}
    />
  );
}
