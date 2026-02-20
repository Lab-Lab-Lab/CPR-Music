'use client';

import { useCallback } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Button, Table } from 'react-bootstrap';
import { formatTimeMilli } from '../../lib/dawUtils';
import { PiWarningOctagonFill } from 'react-icons/pi';

const WarningIcon = <PiWarningOctagonFill fontSize="2.2rem" />;

const silenceDataTable = (silenceData) => {
  const rows = [];
  const regions = silenceData.silences;

  const row = (key, start, end, duration) => (
    <tr>
      <td>{key}</td>
      <td>{formatTimeMilli(start)}</td>
      <td>{formatTimeMilli(end)}</td>
      <td>{formatTimeMilli(duration)}</td>
    </tr>
  );

  regions.forEach((region, i) => {
    rows.push(row(i + 1, region.startTime, region.endTime, region.duration));
  });

  return (
    <Table striped bordered hover variant="dark">
      <thead>
        <tr>
          <th>#</th>
          <th className="text-center">Silence Start</th>
          <th className="text-center">Silence End</th>
          <th className="text-center">Silence duration</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </Table>
  );
};

const AudioDropModal = ({ show, silenceData, onIgnore, onUploadNew }) => {
  const closeModal = useCallback(() => {
    if (onUploadNew) onUploadNew();
  }, [onUploadNew]);

  const closeAndSubmit = useCallback(() => {
    if (onIgnore) onIgnore();
  }, [onIgnore]);

  return (
    <>
      <Modal show={show} onHide={closeModal} size="xl">
        <Modal.Header
          closeButton
          style={{ backgroundColor: 'thistle', color: 'maroon' }}
        >
          <Modal.Title
            className="d-flex align-items-center gap-2"
            style={{ fontSize: '1.5rem' }}
          >
            {WarningIcon}
            Warning!
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: 'linen' }}>
          {/* TODO @mfwolffe - p tag below.. what link? */}
          <p>
            Dropped audio regions have been detected in your submission! Please
            ask your teacher, or see this link about resolving computer audio
            problems.
          </p>
          <p>
            The following{' '}
            <span style={{ color: 'maroon', fontWeight: 'bold' }}>
              {silenceData?.numSilences}
            </span>{' '}
            region
            {silenceData?.numSilences > 1 ? 's' : ''} have dropped audio:
          </p>
          {silenceData ? silenceDataTable(silenceData) : ''}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: 'thistle' }}>
          <Button variant="secondary" onClick={closeModal}>
            Close
          </Button>
          <Button variant="primary" onClick={closeAndSubmit}>
            Submit Anyway
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export { AudioDropModal }
