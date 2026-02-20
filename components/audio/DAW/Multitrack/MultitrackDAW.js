'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
  Button,
  ButtonGroup,
} from 'react-bootstrap';
import {
  FaPlus,
  FaPlay,
  FaPause,
  FaStop,
  FaRedo,
  FaUndo,
} from 'react-icons/fa';
import { GrHelpBook } from 'react-icons/gr';
import { MdLayers, MdLayersClear } from 'react-icons/md';
import {
  useAudio,
  useEffects,
  useFFmpeg,
  useUI,
  useMultitrack,
} from '../../../../contexts/DAWProvider';
import TrackHeader from './TrackHeader';
import AddTrackButton from './AddTrackButton';
import MultitrackWaveform from './MultitrackWaveform';
import MultitrackTransport from './MultitrackTransport';
import EffectsRack from '../Effects/EffectsRack';
import HelpModal from '../../daw-old/dawHelp';
import AddTrackModal from './AddTrackModal';
import styles from './MultitrackDAW.module.css';

/**
 * Main Multitrack DAW component
 */
export default function MultitrackDAW({
  onSubmit,
  showSubmitButton = false,
  onModeSwitch,
}) {
  const { tracks, addTrack, isPlaying, play, pause, stop, reorderTracks } =
    useMultitrack();

  const { loadFFmpeg, loaded: ffmpegLoaded } = useFFmpeg();
  const { showHelp, setShowHelp, useEffectsRack } = useUI();

  // Track drag and drop
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Add track modal (for importing takes)
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);

  // Initialize FFmpeg
  useEffect(() => {
    if (!ffmpegLoaded) {
      loadFFmpeg();
    }
  }, [ffmpegLoaded, loadFFmpeg]);

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (
      draggedIndex !== null &&
      dragOverIndex !== null &&
      draggedIndex !== dragOverIndex
    ) {
      reorderTracks(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <>
      <HelpModal setFn={setShowHelp} shown={showHelp} />
      <AddTrackModal
        show={showAddTrackModal}
        onHide={() => setShowAddTrackModal(false)}
      />

      <Card className="mt-2 mb-2 h-100" id="multitrack-daw">
        <CardHeader className="dawHeaderFooter">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <CardTitle className="mb-0">Multitrack Editor</CardTitle>

              {/* Mode switcher */}
              {onModeSwitch && (
                <ButtonGroup size="sm">
                  <Button
                    variant="secondary"
                    onClick={() => onModeSwitch('single')}
                    title="Single track mode"
                  >
                    <MdLayersClear fontSize="1rem" />
                  </Button>
                  <Button variant="primary" title="Multitrack mode" disabled>
                    <MdLayers fontSize="1rem" />
                  </Button>
                </ButtonGroup>
              )}
            </div>

            <div className="d-flex gap-2">
              {/* Import takes button */}
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => setShowAddTrackModal(true)}
                title="Import recorded takes"
              >
                <FaPlus /> Import Takes
              </Button>

              {/* Help button */}
              <Button
                className="help-button"
                variant="none"
                size="sm"
                onClick={() => setShowHelp(true)}
              >
                <GrHelpBook />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody
          className="p-0 d-flex flex-column"
          style={{ height: 'calc(100% - 120px)' }}
        >
          <div className={styles.mainContainer}>
            {/* Track headers panel */}
            <div className={styles.trackHeadersPanel}>
              {/* Master controls header */}
              <div className={styles.masterHeader}>
                <span>Tracks</span>
              </div>

              {/* Track headers */}
              <div className={styles.trackHeaders}>
                {tracks.map((track, index) => (
                  <div
                    key={track.id}
                    onDragOver={(e) => handleDragOver(e, index)}
                    className={dragOverIndex === index ? styles.dragOver : ''}
                  >
                    <TrackHeader
                      track={track}
                      index={index}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))}

                {/* Add track button - always visible at the bottom */}
                <AddTrackButton />
              </div>
            </div>

            {/* Waveform area */}
            <div className={styles.waveformArea}>
              <MultitrackWaveform />
            </div>
          </div>

          {/* Transport controls */}
          <MultitrackTransport />

          {/* Effects rack (if enabled) */}
          {useEffectsRack && tracks.length > 0 && (
            <div className={styles.effectsRack}>
              <EffectsRack width={100} />
            </div>
          )}
        </CardBody>

        {showSubmitButton && tracks.length > 0 && (
          <CardFooter className={styles.dawFooter}>
            <Button
              style={{ float: 'right' }}
              onClick={() => onSubmit && onSubmit()}
            >
              Submit Mix
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  );
}
