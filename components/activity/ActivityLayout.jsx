/**
 * ActivityLayout
 *
 * Main layout wrapper for activity pages with instructions, editor, and submit
 */

import { Container, Row, Col } from 'react-bootstrap';
import ActivityInstructions from './ActivityInstructions';
import ActivitySubmitButton from './ActivitySubmitButton';

export default function ActivityLayout({
  step,
  instructions,
  questions,
  questionResponses,
  completedOperations,
  canSubmit,
  progress,
  isSubmitting,
  onResponseChange,
  onSubmit,
  children,
}) {
  return (
    <Container fluid className="activity-layout py-4">
      <Row>
        <Col lg={12}>
          {/* Instructions Section */}
          <ActivityInstructions
            step={step}
            instructions={instructions}
            questions={questions}
            questionResponses={questionResponses}
            completedOperations={completedOperations}
            onResponseChange={onResponseChange}
          />
        </Col>
      </Row>

      <Row>
        <Col lg={12}>
          {/* Editor Section - children prop renders the DAW/editor */}
          <div className="editor-section mb-4">{children}</div>
        </Col>
      </Row>

      <Row>
        <Col lg={12} className="d-flex justify-content-center">
          {/* Submit Button Section */}
          <ActivitySubmitButton
            canSubmit={canSubmit}
            progress={progress}
            isSubmitting={isSubmitting}
            onClick={onSubmit}
          />
        </Col>
      </Row>
    </Container>
  );
}
