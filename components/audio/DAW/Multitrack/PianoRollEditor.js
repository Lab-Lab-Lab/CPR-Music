// components/audio/DAW/Multitrack/PianoRollEditor.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, ButtonGroup, Dropdown } from 'react-bootstrap';
import {
  FaTimes,
  FaPencilAlt,
  FaMousePointer,
  FaEraser,
  FaMagnet,
  FaUndo,
  FaRedo,
  FaPlay,
  FaPause,
  FaSave,
  FaTrash,
} from 'react-icons/fa';
import PianoRollCanvas from './PianoRollCanvas';
import PianoRollKeyboard from './PianoRollKeyboard';

export default function PianoRollEditor({
  show,
  onHide,
  notes: initialNotes = [],
  onSave,
  instrument,
  trackName = 'MIDI Track',
  isPlaying = false,
  currentTime = 0,
  tempo = 120,
}) {
  // Editor state
  const [notes, setNotes] = useState(initialNotes);
  const [currentTool, setCurrentTool] = useState('pencil'); // pencil, select, eraser, velocity
  const [snapValue, setSnapValue] = useState(1 / 8); // Grid snap value in beats
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [zoom, setZoom] = useState({ x: 150, y: 1 });
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  const [activeNote, setActiveNote] = useState(null); // For preview
  const [hasChanges, setHasChanges] = useState(false);

  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const canvasContainerRef = useRef(null);
  const keyboardRef = useRef(null);

  // Track if this is initial mount/show to prevent reset loops
  const initialShowRef = useRef(false);

  // Initialize notes ONLY when modal first opens, not on note updates
  useEffect(() => {
    if (show && !initialShowRef.current) {
      // First time opening modal
      initialShowRef.current = true;
      console.log(`🎹 PianoRollEditor: Opening with ${initialNotes.length} notes`, initialNotes.slice(0, 3));
      setNotes(initialNotes);
      setHistory([initialNotes]);
      setHistoryIndex(0);
      setHasChanges(false);
      setSelectedNotes(new Set());
      setScrollOffset({ x: 0, y: 0 }); // Reset scroll position
    } else if (!show) {
      // Reset flag when modal closes
      initialShowRef.current = false;
    }
  }, [show]); // REMOVED initialNotes dependency to prevent reset on updates

  // Separately handle external note updates during recording (without resetting state)
  const prevNotesRef = useRef(initialNotes);
  useEffect(() => {
    if (show && initialShowRef.current && initialNotes !== prevNotesRef.current) {
      // Modal is open and notes changed externally (e.g., during recording)
      // Update notes WITHOUT resetting history or other state
      setNotes(initialNotes);
      // Don't mark as changes since these are external updates
    }
    prevNotesRef.current = initialNotes;
  }, [initialNotes, show]);

  // Handle tool selection
  const handleToolChange = (tool) => {
    setCurrentTool(tool);
    if (tool !== 'select') {
      setSelectedNotes(new Set());
    }
  };

  // Handle snap value change
  const getSnapLabel = (value) => {
    if (value === 0) return 'Off';
    const denominator = Math.round(1 / value);
    return `1/${denominator}`;
  };

  // Handle notes update with history
  const handleNotesUpdate = (newNotes) => {
    setNotes(newNotes);
    setHasChanges(true);

    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newNotes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo/Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setNotes(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setNotes(history[historyIndex + 1]);
    }
  };

  // Clear all notes
  const handleClear = () => {
    if (window.confirm('Clear all notes?')) {
      handleNotesUpdate([]);
    }
  };

  // Save and close
  const handleSave = () => {
    onSave(notes);
    setHasChanges(false);
    onHide();
  };

  // Close without saving
  const handleClose = () => {
    if (hasChanges && !window.confirm('Discard changes?')) {
      return;
    }
    onHide();
  };

  // Handle scroll safely
  const handleScroll = useCallback((e) => {
    if (!e.target) return;

    const newScrollOffset = {
      x: Math.max(0, e.target.scrollLeft || 0),
      y: Math.max(0, e.target.scrollTop || 0),
    };

    setScrollOffset(newScrollOffset);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!show) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'a':
            e.preventDefault();
            // Select all
            setSelectedNotes(new Set(notes.map((n) => n.id)));
            break;
        }
      }

      // Tool shortcuts
      switch (e.key) {
        case 'p':
          setCurrentTool('pencil');
          break;
        case 'v':
          setCurrentTool('select');
          break;
        case 'e':
          setCurrentTool('eraser');
          break;
        case 'Delete':
          if (selectedNotes.size > 0) {
            handleNotesUpdate(notes.filter((n) => !selectedNotes.has(n.id)));
            setSelectedNotes(new Set());
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [show, notes, selectedNotes, historyIndex, history]);

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      fullscreen="lg-down"
      className="piano-roll-modal"
    >
      <Modal.Header className="piano-roll-header">
        <Modal.Title>{trackName} - Piano Roll</Modal.Title>
        <div className="d-flex align-items-center gap-3 ms-auto me-3">
          {/* Tool buttons */}
          <ButtonGroup size="sm">
            <Button
              variant={currentTool === 'select' ? 'primary' : 'secondary'}
              onClick={() => handleToolChange('select')}
              title="Select (V)"
            >
              <FaMousePointer />
            </Button>
            <Button
              variant={currentTool === 'pencil' ? 'primary' : 'secondary'}
              onClick={() => handleToolChange('pencil')}
              title="Pencil (P)"
            >
              <FaPencilAlt />
            </Button>
            <Button
              variant={currentTool === 'eraser' ? 'primary' : 'secondary'}
              onClick={() => handleToolChange('eraser')}
              title="Eraser (E)"
            >
              <FaEraser />
            </Button>
          </ButtonGroup>

          {/* Snap dropdown */}
          <Dropdown>
            <Dropdown.Toggle size="sm" variant="secondary">
              <FaMagnet className="me-1" />
              {getSnapLabel(snapValue)}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setSnapValue(0)}>Off</Dropdown.Item>
              <Dropdown.Item onClick={() => setSnapValue(1)}>1/1</Dropdown.Item>
              <Dropdown.Item onClick={() => setSnapValue(1 / 2)}>
                1/2
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setSnapValue(1 / 4)}>
                1/4
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setSnapValue(1 / 8)}>
                1/8
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setSnapValue(1 / 16)}>
                1/16
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setSnapValue(1 / 32)}>
                1/32
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Undo/Redo */}
          <ButtonGroup size="sm">
            <Button
              variant="secondary"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <FaUndo />
            </Button>
            <Button
              variant="secondary"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Shift+Z)"
            >
              <FaRedo />
            </Button>
          </ButtonGroup>

          {/* Clear button */}
          <Button
            size="sm"
            variant="danger"
            onClick={handleClear}
            disabled={notes.length === 0}
            title="Clear all notes"
          >
            <FaTrash />
          </Button>

          {/* Zoom controls */}
          <div className="ms-auto d-flex align-items-center gap-2">
            <label className="d-flex align-items-center gap-2">
              <span>Zoom:</span>
              <input
                type="range"
                min="50"
                max="300"
                value={zoom.x}
                onChange={(e) =>
                  setZoom({ ...zoom, x: parseInt(e.target.value) })
                }
                className="form-range"
                style={{ width: '100px' }}
              />
            </label>
          </div>

          {/* Playback indicator */}
          {isPlaying && (
            <div className="d-flex align-items-center gap-2 text-success">
              <FaPlay />
              <span>{currentTime.toFixed(2)}s</span>
            </div>
          )}

          {/* Save indicator */}
          {hasChanges && <span className="text-warning">• Unsaved</span>}
        </div>
      </Modal.Header>

      <Modal.Body className="piano-roll-body p-0">
        <div className="piano-roll-content">
          {/* Piano keyboard */}
          <div
            className="piano-roll-keyboard-container"
            style={{
              overflow: 'hidden',
              position: 'relative',
              width: '100px', // Fixed width
              minWidth: '100px',
              height: '100%', // Full height
            }}
          >
            <PianoRollKeyboard
              ref={keyboardRef}
              scrollOffset={scrollOffset}
              zoom={zoom}
              activeNote={activeNote}
              onNoteClick={(note) => {
                console.log('Preview note:', note);
              }}
            />
          </div>

          {/* Piano roll canvas */}
          <div
            ref={canvasContainerRef}
            className="piano-roll-canvas-container"
            onScroll={handleScroll}
            style={{
              overflow: 'auto',
              position: 'relative',
              minHeight: '600px',
            }}
          >
            <PianoRollCanvas
              notes={notes}
              onNotesUpdate={handleNotesUpdate}
              currentTool={currentTool}
              snapValue={snapValue}
              selectedNotes={selectedNotes}
              onSelectedNotesChange={setSelectedNotes}
              zoom={zoom}
              scrollOffset={scrollOffset}
              onScrollOffsetChange={setScrollOffset}
              isPlaying={isPlaying}
              currentTime={currentTime}
              tempo={tempo}
              instrument={instrument}
              canvasSize={{ width: 2000, height: 88 * 20 }}
            />
          </div>
        </div>

        {/* Velocity lane */}
        <div className="velocity-lane">
          <canvas
            width={2000}
            height={60}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </Modal.Body>

      <Modal.Footer className="piano-roll-header">
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-white-50">
            <small>
              {notes.length} notes •
              {selectedNotes.size > 0 && ` ${selectedNotes.size} selected`}
            </small>
          </div>
          <div>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              className="ms-2"
              disabled={!hasChanges}
            >
              <FaSave className="me-1" />
              Save Changes
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
