// components/audio/DAW/Multitrack/TakesImportModal.js
'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, ListGroup, Form, Badge } from 'react-bootstrap';
import { FaFileAudio, FaClock, FaMusic } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { getAudioProcessor } from './AudioProcessor';

export default function TakesImportModal({ show, onHide, takes = [] }) {
  const { addTrack, updateTrack } = useMultitrack();
  const [selectedTake, setSelectedTake] = useState(null);
  const [trackName, setTrackName] = useState('');

  // Update track name when take is selected
  useEffect(() => {
    if (selectedTake) {
      // Generate default name from take info
      const takeName =
        selectedTake.name ||
        `${selectedTake.partType} - Take ${selectedTake.takeNumber}`;
      setTrackName(takeName);
    }
  }, [selectedTake]);

  const handleImport = async () => {
    if (!selectedTake || !selectedTake.audioURL) return;

    console.log('📥 TakesImportModal: Importing take:', selectedTake);

    try {
      let finalURL = selectedTake.audioURL;

      // For blob URLs, we might need to ensure they're still valid
      if (selectedTake.audioURL.startsWith('blob:')) {
        console.log('🔄 TakesImportModal: Refreshing blob URL for take');
        const response = await fetch(selectedTake.audioURL);
        if (response.ok) {
          const blob = await response.blob();
          finalURL = URL.createObjectURL(blob);
          console.log('✅ TakesImportModal: Blob URL refreshed');
        } else {
          throw new Error('Blob URL expired');
        }
      }

      // Create immediate placeholder clip
      const clipId = `clip-take-${selectedTake.id}-${Date.now()}`;
      const placeholderClip = {
        id: clipId,
        start: 0,
        duration: 0, // Will update when processed
        color: '#7bafd4',
        src: finalURL,
        offset: 0,
        name: trackName || 'Imported Take',
        isLoading: true,
        loadingState: 'reading'
      };

      // Add track immediately with placeholder - UI stays responsive!
      // Creates an Audio track (with recording + import capabilities)
      const newTrack = addTrack({
        type: 'audio', // Explicitly create Audio track (enhanced with recording capabilities)
        name: trackName || 'Imported Take',
        audioURL: finalURL,
        takeId: selectedTake.id,
        clips: [placeholderClip],
      });

      console.log('🎵 TakesImportModal: Track created immediately with ID:', newTrack.id);

      // Close modal immediately - track is already visible
      setSelectedTake(null);
      setTrackName('');
      onHide();

      // Process in background - Try AudioProcessor first, fallback to old method
      console.log('🔄 TakesImportModal: Starting background processing for take');
      
      try {
        const audioProcessor = getAudioProcessor();
        
        // Check if AudioProcessor is available and working
        if (audioProcessor && typeof audioProcessor.processAudioFile === 'function') {
          console.log('🚀 TakesImportModal: Using AudioProcessor for take processing');
          
          const result = await audioProcessor.processAudioFile(
            finalURL,
            clipId,
            (stage, progress) => {
              console.log(`📊 TakesImportModal: Background processing ${stage}: ${progress}%`);
              
              // Update clip loading state in real-time
              updateTrack(newTrack.id, (prevTrack) => ({
                ...prevTrack,
                clips: prevTrack.clips.map(clip =>
                  clip.id === clipId
                    ? { ...clip, loadingState: stage }
                    : clip
                )
              }));
            }
          );

          console.log(`✅ TakesImportModal: Background processing complete using ${result.method}`);

          // Update clip with final data
          const finalClip = {
            ...placeholderClip,
            duration: result.duration,
            isLoading: false,
            loadingState: 'complete',
            processingMethod: result.method
          };

          updateTrack(newTrack.id, {
            clips: [finalClip]
          });

          console.log(`📊 TakesImportModal: Take import fully complete - duration: ${result.duration?.toFixed(2)}s`);

        } else {
          throw new Error('AudioProcessor not available, falling back to legacy method');
        }

      } catch (bgErr) {
        console.warn('🔄 TakesImportModal: AudioProcessor failed, trying fallback method:', bgErr.message);
        
        // Fallback to original decodeAudioFromURL approach
        try {
          console.log('🔄 TakesImportModal: Using fallback audio processing');
          
          // Import fallback function
          const { decodeAudioFromURL } = await import('./AudioEngine');
          
          const audioBuffer = await decodeAudioFromURL(finalURL);
          const duration = audioBuffer ? audioBuffer.duration : 0;

          // Update clip with final data (fallback version)
          const finalClip = {
            ...placeholderClip,
            duration: duration,
            isLoading: false,
            loadingState: 'complete',
            processingMethod: 'fallback'
          };

          updateTrack(newTrack.id, {
            clips: [finalClip]
          });

          console.log(`✅ TakesImportModal: Fallback processing complete - duration: ${duration?.toFixed(2)}s`);

        } catch (fallbackErr) {
          console.error('❌ TakesImportModal: Both AudioProcessor and fallback failed:', fallbackErr);
          
          // Update clip to show error state
          updateTrack(newTrack.id, (prevTrack) => ({
            ...prevTrack,
            clips: prevTrack.clips.map(clip =>
              clip.id === clipId
                ? { ...clip, isLoading: false, loadingState: 'error', hasError: true }
                : clip
            )
          }));
        }
      }

    } catch (err) {
      console.error('❌ TakesImportModal: Take import failed:', err);
      alert('Failed to import take: ' + err.message);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Mock data for testing if no takes provided
  const displayTakes = takes.length > 0 ? takes : [];

  console.log('🎹 TakesImportModal: Received takes:', takes);
  console.log('🎹 TakesImportModal: Display takes:', displayTakes);

  // Show helpful message if no takes
  if (displayTakes.length === 0 && takes.length === 0) {
    console.log('No takes available in TakesImportModal');
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" className="takes-import-modal">
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaFileAudio className="me-2" />
          Import Take to Multitrack
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark">
        {displayTakes.length === 0 ? (
          <div className="text-center text-muted py-5">
            <p>No takes available. Record some takes first!</p>
          </div>
        ) : (
          <>
            <h6 className="text-white mb-3">Select a take to import:</h6>
            <ListGroup className="mb-3">
              {displayTakes.map((take) => (
                <ListGroup.Item
                  key={take.id}
                  action
                  active={selectedTake?.id === take.id}
                  onClick={() => setSelectedTake(take)}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div className="fw-bold">
                      <FaMusic className="me-2" />
                      {take.name ||
                        `${take.partType} - Take ${take.takeNumber}`}
                    </div>
                    <small className="text-muted">
                      <FaClock className="me-1" />
                      {formatDuration(take.duration)} •{' '}
                      {formatDate(take.createdAt)}
                    </small>
                  </div>
                  <div>
                    <Badge
                      bg={take.partType === 'melody' ? 'primary' : 'secondary'}
                    >
                      {take.partType}
                    </Badge>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {selectedTake && (
              <Form.Group className="mb-3">
                <Form.Label className="text-white">Track Name:</Form.Label>
                <Form.Control
                  type="text"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  placeholder="Enter track name"
                  className="bg-dark text-white"
                />
              </Form.Group>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!selectedTake}
        >
          Import Take
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
