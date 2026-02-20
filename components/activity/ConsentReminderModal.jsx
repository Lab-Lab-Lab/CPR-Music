/**
 * ConsentReminderModal
 *
 * Shows consent form reminder on first activity load
 */

import { Modal, Button, Alert } from 'react-bootstrap';
import { FaInfoCircle } from 'react-icons/fa';

export default function ConsentReminderModal({ show, onAccept }) {
  return (
    <Modal
      show={show}
      onHide={onAccept}
      centered
      size="lg"
      backdrop="static"
    >
      <Modal.Header>
        <Modal.Title>
          <FaInfoCircle className="text-info me-2" />
          Study Participation Reminder
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          <Alert.Heading>Research Study Activities</Alert.Heading>
          <p>
            You are about to complete a series of guided activities using the DAW
            (Digital Audio Workstation) as part of a research study. These activities
            will help you learn basic audio editing and music production skills.
          </p>
        </Alert>

        <h5>What to expect:</h5>
        <ul>
          <li>
            <strong>4 Activities:</strong> You'll complete Activities focusing on
            audio selection, editing, multitrack mixing, and effects.
          </li>
          <li>
            <strong>Embedded Questions:</strong> You'll answer short questions about
            your experience as you complete each activity.
          </li>
          <li>
            <strong>Progress Tracking:</strong> Your progress is automatically saved,
            so you can leave and return at any time.
          </li>
          <li>
            <strong>Data Collection:</strong> Your interactions and responses will be
            recorded for research purposes as outlined in the consent form you completed.
          </li>
        </ul>

        <Alert variant="warning" className="mt-3">
          <strong>Reminder:</strong> By proceeding, you confirm that you have completed
          the consent process through the Qualtrics survey and agree to participate in
          this study.
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onAccept} size="lg">
          I Understand - Begin Activities
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
