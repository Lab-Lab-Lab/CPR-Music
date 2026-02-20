/**
 * ActivitySubmitModal
 *
 * Modal shown after successful step submission with options to continue editing or proceed
 */

import { Modal, Button } from 'react-bootstrap';
import { FaCheckCircle } from 'react-icons/fa';

export default function ActivitySubmitModal({
  show,
  onKeepEditing,
  onContinue,
  currentStep,
  isLastStep = false
}) {
  return (
    <Modal
      show={show}
      onHide={onKeepEditing}
      centered
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <FaCheckCircle className="text-success me-2" />
          Activity {currentStep} Complete!
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">
          {isLastStep
            ? "Congratulations! You've completed all activities. You can continue editing or proceed to the final submission."
            : "Great work! You've completed this activity. You can keep editing or move on to the next activity."}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onKeepEditing}>
          Keep Editing
        </Button>
        <Button variant="primary" onClick={onContinue}>
          {isLastStep ? "Proceed to Final Submission" : "Continue to Next Activity"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
