// components/audio/DAW/Multitrack/PatternLibrary.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { Modal, Button, ListGroup, Form, Badge, ButtonGroup } from 'react-bootstrap';
import { 
  FaPlus, FaTrash, FaEdit, FaCopy, FaPlay, FaGripVertical,
  FaThLarge, FaMusic, FaDrum, FaPalette, FaPaste
} from 'react-icons/fa';

// Predefined pattern colors
const PATTERN_COLORS = [
  '#4a7c9e', '#9e4a7c', '#7c9e4a', '#9e7c4a',
  '#4a9e7c', '#7c4a9e', '#ce6a6a', '#6ace6a'
];

export default function PatternLibrary({
  show,
  onHide,
  patterns = [],
  onCreatePattern,
  onUpdatePattern,
  onDeletePattern,
  onSelectPattern,
  onDragStart,
  enableDrag = false,
  currentPatternId
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [selectedLength, setSelectedLength] = useState(4);
  const [copiedPattern, setCopiedPattern] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragGhostRef = useRef(null);

  // Create new pattern
  const handleCreatePattern = () => {
    const newPattern = {
      id: `pattern-${Date.now()}`,
      name: `Pattern ${patterns.length + 1}`,
      length: selectedLength,
      notes: [],
      color: PATTERN_COLORS[patterns.length % PATTERN_COLORS.length]
    };
    onCreatePattern(newPattern);
  };

  // Start editing pattern name
  const handleStartEdit = (pattern) => {
    setEditingId(pattern.id);
    setEditingName(pattern.name);
  };

  // Save pattern name
  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onUpdatePattern(editingId, { name: editingName.trim() });
    }
    setEditingId(null);
    setEditingName('');
  };

  // Duplicate pattern
  const handleDuplicate = (pattern) => {
    const newPattern = {
      ...pattern,
      id: `pattern-${Date.now()}`,
      name: `${pattern.name} (Copy)`,
      notes: [...pattern.notes]
    };
    onCreatePattern(newPattern);
  };

  // Copy pattern to clipboard
  const handleCopy = (pattern) => {
    setCopiedPattern(pattern);
  };

  // Paste pattern
  const handlePaste = () => {
    if (copiedPattern) {
      handleDuplicate(copiedPattern);
    }
  };

  // Get pattern duration in beats
  const getPatternBeats = (pattern) => {
    return pattern.length * 4; // Assuming 4/4 time
  };

  // Count notes in pattern
  const getNoteCount = (pattern) => {
    return pattern.notes?.length || 0;
  };

  // Handle drag start
  const handlePatternDragStart = (e, pattern) => {
    if (enableDrag && onDragStart) {
      onDragStart(e, pattern);
      
      // Create custom drag ghost
      const ghost = e.currentTarget.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = '-1000px';
      ghost.style.opacity = '0.8';
      ghost.style.pointerEvents = 'none';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      
      // Clean up ghost after drag
      setTimeout(() => {
        document.body.removeChild(ghost);
      }, 0);
    }
  };

  // Mouse move handler for drag preview
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragGhost && dragGhostRef.current) {
        dragGhostRef.current.style.left = `${e.clientX + 10}px`;
        dragGhostRef.current.style.top = `${e.clientY + 10}px`;
      }
    };

    if (dragGhost) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [dragGhost]);

  return (
    <Modal 
      show={show} 
      onHide={onHide}
      size="lg"
      className="pattern-library-modal"
    >
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaThLarge className="me-2" />
          Pattern Library
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark">
        {/* Create New Pattern */}
        <div className="mb-4 p-3 bg-secondary rounded">
          <h6 className="text-white mb-3">Create New Pattern</h6>
          <div className="d-flex gap-2 align-items-center">
            <Form.Label className="text-white mb-0">Length:</Form.Label>
            <ButtonGroup size="sm">
              {[1, 2, 4, 8].map(bars => (
                <Button
                  key={bars}
                  variant={selectedLength === bars ? 'primary' : 'outline-secondary'}
                  onClick={() => setSelectedLength(bars)}
                >
                  {bars} {bars === 1 ? 'bar' : 'bars'}
                </Button>
              ))}
            </ButtonGroup>
            <Button 
              variant="success" 
              size="sm"
              onClick={handleCreatePattern}
              className="ms-auto"
            >
              <FaPlus className="me-1" /> Create
            </Button>
          </div>
        </div>

        {/* Clipboard actions */}
        {copiedPattern && (
          <div className="mb-3 p-2 bg-secondary bg-opacity-50 rounded d-flex align-items-center">
            <small className="text-white-50">
              Copied: {copiedPattern.name}
            </small>
            <Button
              size="sm"
              variant="outline-light"
              onClick={handlePaste}
              className="ms-auto"
            >
              <FaPaste className="me-1" /> Paste
            </Button>
          </div>
        )}

        {/* Pattern List */}
        <div className="pattern-list">
          <h6 className="text-white mb-3">
            Patterns ({patterns.length})
            {enableDrag && (
              <small className="text-white-50 ms-2">
                (Drag to timeline)
              </small>
            )}
          </h6>
          
          {patterns.length === 0 ? (
            <p className="text-white-50 text-center py-4">
              No patterns yet. Create your first pattern!
            </p>
          ) : (
            <ListGroup>
              {patterns.map((pattern) => (
                <ListGroup.Item
                  key={pattern.id}
                  className={`bg-dark text-white border-secondary ${
                    currentPatternId === pattern.id ? 'active' : ''
                  }`}
                  draggable={enableDrag}
                  onDragStart={(e) => handlePatternDragStart(e, pattern)}
                  style={{ cursor: enableDrag ? 'grab' : 'pointer' }}
                  onClick={() => onSelectPattern && onSelectPattern(pattern)}
                >
                  <div className="d-flex align-items-center">
                    {/* Drag handle */}
                    {enableDrag && (
                      <FaGripVertical 
                        className="text-secondary me-2" 
                        style={{ cursor: 'grab' }}
                      />
                    )}
                    
                    {/* Pattern color */}
                    <div 
                      className="pattern-color-indicator me-2"
                      style={{ backgroundColor: pattern.color }}
                    />
                    
                    {/* Pattern name */}
                    {editingId === pattern.id ? (
                      <Form.Control
                        type="text"
                        size="sm"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                        className="me-2"
                        style={{ maxWidth: '200px' }}
                      />
                    ) : (
                      <div className="flex-grow-1">
                        <strong>{pattern.name}</strong>
                        <div className="small text-white-50">
                          {pattern.length} {pattern.length === 1 ? 'bar' : 'bars'} • 
                          {getNoteCount(pattern)} notes
                        </div>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <ButtonGroup size="sm">
                      <Button
                        variant="outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPattern && onSelectPattern(pattern);
                        }}
                        title="Select pattern"
                      >
                        <FaPlay size={12} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(pattern);
                        }}
                        title="Rename"
                      >
                        <FaEdit size={12} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(pattern);
                        }}
                        title="Copy"
                      >
                        <FaCopy size={12} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(pattern);
                        }}
                        title="Duplicate"
                      >
                        <FaPlus size={12} />
                      </Button>
                      <Button
                        variant="outline-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePattern(pattern.id);
                        }}
                        title="Delete"
                      >
                        <FaTrash size={12} />
                      </Button>
                    </ButtonGroup>
                  </div>
                  
                  {/* Mini pattern preview */}
                  <div 
                    className="pattern-preview mt-2"
                    style={{ 
                      height: '30px',
                      position: 'relative',
                      backgroundColor: '#1a1a1a'
                    }}
                  >
                    {pattern.notes && pattern.notes.map((note, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${(note.startTime / getPatternBeats(pattern)) * 100}%`,
                          width: `${(note.duration / getPatternBeats(pattern)) * 100}%`,
                          top: `${(1 - (note.note - 36) / 48) * 100}%`,
                          height: '2px',
                          backgroundColor: pattern.color,
                          opacity: 0.8
                        }}
                      />
                    ))}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>
        
        {/* Tips */}
        <div className="mt-4 p-3 bg-secondary bg-opacity-25 rounded">
          <h6 className="text-white-50 mb-2">Tips</h6>
          <ul className="mb-0 small text-white-50">
            <li>Double-click a pattern on the timeline to edit it</li>
            <li>Drag patterns from here to your track timeline</li>
            <li>Use copy/paste to quickly create variations</li>
            <li>Patterns can be reused multiple times</li>
            <li>Each pattern can have its own length and color</li>
          </ul>
        </div>
      </Modal.Body>
      
      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>

      {/* Drag ghost (if needed) */}
      {dragGhost && (
        <div
          ref={dragGhostRef}
          className="pattern-drag-ghost"
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.8,
            border: `2px solid ${dragGhost.color}`,
            borderRadius: '4px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            fontSize: '12px'
          }}
        >
          {dragGhost.name}
        </div>
      )}
    </Modal>
  );
}