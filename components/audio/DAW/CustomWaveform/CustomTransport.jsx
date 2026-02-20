'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Button, ButtonGroup, Dropdown, Form } from 'react-bootstrap';
import {
  FaRegCirclePlay,
  FaRegCirclePause,
  FaArrowRotateLeft,
  FaArrowRotateRight
} from 'react-icons/fa6';
import {
  BsSkipBackwardCircle,
  BsSpeedometer2,
  BsZoomIn,
  BsZoomOut
} from 'react-icons/bs';
import { TbZoomReset } from 'react-icons/tb';
import { useWaveform } from '../../../../contexts/WaveformContext';
import { useAudio } from '../../../../contexts/AudioContext';

export default function CustomTransport() {
  const {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    zoomLevel,
    play,
    pause,
    stop,
    seek,
    setPlaybackSpeed,
    zoomIn,
    zoomOut,
    resetZoom
  } = useWaveform();

  // Undo/redo now handled in CustomTimeline

  const icoSize = "1.25rem"; // Match original icon size

  // Format time display
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, []);

  // Skip backward/forward (10 seconds like original)
  const skipBackward = useCallback(() => {
    seek(Math.max(0, currentTime - 10));
  }, [currentTime, seek]);

  const skipForward = useCallback(() => {
    seek(Math.min(duration, currentTime + 10));
  }, [currentTime, duration, seek]);

  // Stop and seek to zero
  const stopAndSeekZero = useCallback(() => {
    stop();
    seek(0);
  }, [stop, seek]);

  // Playback speed options
  const speedOptions = [
    { value: 0.25, label: '0.25x' },
    { value: 0.5, label: '0.5x' },
    { value: 0.75, label: '0.75x' },
    { value: 1, label: '1x' },
    { value: 1.25, label: '1.25x' },
    { value: 1.5, label: '1.5x' },
    { value: 2, label: '2x' }
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't handle if focused on input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            skipBackward();
          } else {
            seek(Math.max(0, currentTime - 1));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            skipForward();
          } else {
            seek(Math.min(duration, currentTime + 1));
          }
          break;
        case 'Home':
          e.preventDefault();
          seek(0);
          break;
        case 'End':
          e.preventDefault();
          seek(duration);
          break;
        // Undo/redo handled by CustomTimeline
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, currentTime, duration, play, pause, seek, skipBackward, skipForward]);

  return (
    <div className="d-flex w-100 ml-auto mr-auto prog-bar align-items-center flex-between flex gap-0375">
      {/* Playback controls */}
      <div className="d-flex gap-05 align-items-center">
        <Button onClick={skipBackward} className="prog-button pl-2" title="Skip 10s backward">
          <FaArrowRotateLeft fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={stopAndSeekZero} title="Stop">
          <BsSkipBackwardCircle fontSize={icoSize} />
        </Button>
        <Button
          className="prog-button"
          onClick={isPlaying ? pause : play}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <FaRegCirclePause fontSize={icoSize} /> : <FaRegCirclePlay fontSize={icoSize} />}
        </Button>
        <Button onClick={skipForward} className="prog-button pr-2" title="Skip 10s forward">
          <FaArrowRotateRight fontSize={icoSize} />
        </Button>

      </div>

      {/* Center controls - time display only */}
      <div className="d-flex align-items-center">
        <div className="ml-2 mr-2">{formatTime(currentTime)}</div>
      </div>

      {/* Right side controls - playback speed and zoom */}
      <div className="d-flex align-items-center gap-05">
        {/* Playback speed dropdown - moved here */}
        <Dropdown align="end" className="drop">
          <Dropdown.Toggle className="prog-button speed-drop-toggle" bsPrefix="wavesurfer">
            <BsSpeedometer2 fontSize={icoSize} className="speed-gague" />
          </Dropdown.Toggle>
          <Dropdown.Menu className="prog-drop">
            <Dropdown.Item onClick={() => setPlaybackSpeed(0.25)}>
              <span className={playbackRate === 0.25 ? 'speed-select' : ''}>0.25x</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(0.5)}>
              <span className={playbackRate === 0.5 ? 'speed-select' : ''}>0.5x</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(0.75)}>
              <span className={playbackRate === 0.75 ? 'speed-select' : ''}>0.75x</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(1)}>
              <span className={playbackRate === 1 ? 'speed-select' : ''}>1x</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(1.5)}>
              <span className={playbackRate === 1.5 ? 'speed-select' : ''}>1.5x</span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(2)}>
              <span className={playbackRate === 2 ? 'speed-select' : ''}>2x</span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        {/* Divider between speed and zoom */}
        <div className="vr" style={{ height: '20px', margin: '0 4px' }} />

        {/* Zoom controls */}
        <Button
          onClick={zoomOut}
          className="prog-button"
          title="Zoom Out"
        >
          <BsZoomOut fontSize={icoSize} />
        </Button>
        <Button
          onClick={resetZoom}
          className="prog-button"
          title="Reset Zoom (Fit to View)"
        >
          <TbZoomReset fontSize={icoSize} />
        </Button>
        <Button
          onClick={zoomIn}
          className="prog-button"
          title="Zoom In"
        >
          <BsZoomIn fontSize={icoSize} />
        </Button>
      </div>
    </div>
  );
}