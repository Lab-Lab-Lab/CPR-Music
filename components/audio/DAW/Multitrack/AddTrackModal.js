'use client';

import { useState } from 'react';
import { Modal, Button, ListGroup, Badge } from 'react-bootstrap';
import { FaMicrophone, FaFileAudio, FaMusic } from 'react-icons/fa';
import { useRecording } from '../../../../contexts/DAWProvider';
import { useMultitrack } from '../../../../contexts/DAWProvider';
import { formatTime } from '../../../../lib/dawUtils';

/**
 * Modal for importing existing takes as tracks
 */
export default function AddTrackModal({ show, onHide }) {
  const { blobInfo } = useRecording();
  const { tracks, addTrack, setTrackAudio, updateTrack } = useMultitrack();
  const [selectedTake, setSelectedTake] = useState(null);

  // Import a take as a track
  const handleImportTake = async (take) => {
    const trackName = take.takeName || `Take ${take.take}`;
    const newTrack = addTrack(trackName);

    // Add track returns the new track, so we can use it directly
    if (take.url) {
      setTimeout(async () => {
        await setTrackAudio(newTrack.id, take.url);
      }, 100);
    }

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Import Take</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {blobInfo.length === 0 ? (
          <div className="text-center py-5">
            <FaMicrophone size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No recorded takes available</h5>
            <p className="text-muted">
              Record some audio takes first, then you can import them as tracks
              here.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <h6>Select a take to import as a new track:</h6>
            </div>
            <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {blobInfo.map((take, index) => (
                <ListGroup.Item
                  key={take.url}
                  action
                  active={selectedTake === index}
                  onClick={() => setSelectedTake(index)}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <FaMusic className="me-2" />
                    <span className="fw-bold">
                      {take.takeName || `Take ${take.take}`}
                    </span>
                    <small className="text-muted ms-2">{take.timeStr}</small>
                  </div>
                  <Badge bg="secondary">{take.mimeType}</Badge>
                </ListGroup.Item>
              ))}
            </ListGroup>

            <div className="mt-3 d-flex justify-content-end">
              <Button
                variant="primary"
                onClick={() =>
                  selectedTake !== null &&
                  handleImportTake(blobInfo[selectedTake])
                }
                disabled={selectedTake === null}
              >
                Import Selected Take
              </Button>
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
