'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FaVolumeUp,
  FaVolumeMute,
  FaHeadphones,
  FaMicrophone,
  FaTrash,
  FaGripVertical,
} from 'react-icons/fa';
import { Button, Form } from 'react-bootstrap';
import { useMultitrack } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';
import styles from './TrackHeader.module.css';

/**
 * Track header component with controls for each track
 */
export default function TrackHeader({ track, index, onDragStart, onDragEnd }) {
  const {
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    soloedTracks,
  } = useMultitrack();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(track.name);
  const nameInputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = () => {
    updateTrack(track.id, { name: tempName });
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(track.name);
      setIsEditingName(false);
    }
  };

  const isSelected = selectedTrackId === track.id;
  const isSoloed = soloedTracks.has(track.id);
  const isOtherSoloed = soloedTracks.size > 0 && !isSoloed;

  return (
    <div
      className={`${styles.trackHeader} ${isSelected ? styles.selected : ''}`}
      onClick={() => setSelectedTrackId(track.id)}
      style={{
        height: track.minimized ? '40px' : `${track.height}px`,
        borderLeft: `4px solid ${track.color}`,
      }}
    >
      {/* Drag handle */}
      <div
        className={styles.dragHandle}
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragEnd={onDragEnd}
      >
        <FaGripVertical />
      </div>

      {/* Track info section */}
      <div className={styles.trackInfo}>
        {/* Track number and name */}
        <div className={styles.trackName}>
          <span className={styles.trackNumber}>{index + 1}</span>
          {isEditingName ? (
            <Form.Control
              ref={nameInputRef}
              type="text"
              size="sm"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              className={styles.nameInput}
            />
          ) : (
            <span
              className={styles.name}
              onDoubleClick={() => setIsEditingName(true)}
            >
              {track.name}
            </span>
          )}
        </div>

        {/* Track controls */}
        <div className={styles.trackControls}>
          {/* Mute button */}
          <Button
            size="sm"
            variant={track.mute ? 'danger' : 'secondary'}
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              updateTrack(track.id, { mute: !track.mute });
            }}
            title={track.mute ? 'Unmute' : 'Mute'}
          >
            {track.mute ? <FaVolumeMute /> : <FaVolumeUp />}
          </Button>

          {/* Solo button */}
          <Button
            size="sm"
            variant={isSoloed ? 'warning' : 'secondary'}
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              updateTrack(track.id, { solo: !track.solo });
            }}
            title={isSoloed ? 'Unsolo' : 'Solo'}
          >
            <FaHeadphones />
          </Button>

          {/* Record arm button */}
          <Button
            size="sm"
            variant={track.armed ? 'danger' : 'secondary'}
            className={`${styles.controlButton} ${track.armed ? styles.armed : ''}`}
            onClick={(e) => {
              e.stopPropagation();

              // If disarming a track that's currently recording, warn the user
              if (track.armed && track.isRecording) {
                if (
                  !confirm(
                    'Recording is in progress. Stop recording first before disarming the track.',
                  )
                ) {
                  return;
                }
              }

              // If the track has a recording position but no audio yet, it might be processing
              if (
                track.armed &&
                track.recordingStartTime !== null &&
                !track.audioURL
              ) {
                console.warn(
                  'Track appears to be processing a recording, keeping armed state',
                );
                return;
              }

              updateTrack(track.id, { armed: !track.armed });
            }}
            title={track.armed ? 'Disarm track' : 'Arm track for recording'}
            disabled={track.isRecording} // Disable during active recording
          >
            <FaMicrophone />
          </Button>

          {/* Delete button */}
          <Button
            size="sm"
            variant="outline-danger"
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete track "${track.name}"?`)) {
                removeTrack(track.id);
              }
            }}
            title="Delete track"
          >
            <FaTrash />
          </Button>
        </div>
      </div>

      {/* Faders section (only show if not minimized) */}
      {!track.minimized && (
        <div className={styles.faders}>
          {/* Volume knob */}
          <div className={styles.knobContainer}>
            <Knob
              value={track.volume}
              onChange={(value) => updateTrack(track.id, { volume: value })}
              min={0}
              max={1}
              label="Vol"
              displayValue={`${Math.round(track.volume * 100)}%`}
              size={40}
              color={track.color}
            />
          </div>

          {/* Pan knob */}
          <div className={styles.knobContainer}>
            <Knob
              value={track.pan}
              onChange={(value) => updateTrack(track.id, { pan: value })}
              min={-1}
              max={1}
              label="Pan"
              displayValue={
                track.pan === 0
                  ? 'C'
                  : track.pan < 0
                    ? `${Math.round(Math.abs(track.pan) * 100)}L`
                    : `${Math.round(track.pan * 100)}R`
              }
              size={40}
              color="#92ceaa"
            />
          </div>
        </div>
      )}

      {/* Visual mute/solo indicator */}
      {(track.mute || isOtherSoloed) && <div className={styles.muteOverlay} />}
    </div>
  );
}
