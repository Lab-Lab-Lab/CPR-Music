/**
 * ActivityInstructions
 *
 * Renders activity instructions with conditionally unlocked questions
 */

import { Card, Form, Alert } from 'react-bootstrap';
import { FaCheckCircle, FaLock } from 'react-icons/fa';
import { useState, useEffect } from 'react';

export default function ActivityInstructions({
  step,
  instructions,
  questions = [],
  questionResponses = {},
  completedOperations = [],
  onResponseChange,
}) {
  const [localResponses, setLocalResponses] = useState(questionResponses);

  useEffect(() => {
    setLocalResponses(questionResponses);
  }, [questionResponses]);

  const handleChange = (questionId, value) => {
    setLocalResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    // Debounce the save
    if (onResponseChange) {
      onResponseChange(questionId, value);
    }
  };

  const isQuestionUnlocked = (question) => {
    if (!question.requiredOperation) return true;
    return completedOperations.includes(question.requiredOperation);
  };

  return (
    <Card className="mb-3">
      <Card.Header className="bg-primary text-white">
        <h4 className="mb-0">Activity {step} Instructions</h4>
      </Card.Header>
      <Card.Body>
        {/* Render instructions */}
        <div className="instructions-content">
          {instructions.map((instruction, idx) => {
            if (instruction.type === 'text') {
              return (
                <div key={idx} className="mb-3">
                  {instruction.content}
                </div>
              );
            }

            if (instruction.type === 'list') {
              return (
                <ul key={idx} className="mb-3">
                  {instruction.items.map((item, itemIdx) => (
                    <li key={itemIdx}>{item}</li>
                  ))}
                </ul>
              );
            }

            if (instruction.type === 'alert') {
              return (
                <Alert key={idx} variant={instruction.variant || 'info'}>
                  {instruction.content}
                </Alert>
              );
            }

            return null;
          })}
        </div>

        {/* Render questions */}
        {questions.length > 0 && (
          <div className="questions-section mt-4">
            <h5 className="mb-3">Reflection Questions</h5>
            {questions.map((question) => {
              const unlocked = isQuestionUnlocked(question);
              const hasResponse = localResponses[question.id]?.trim().length > 0;

              return (
                <div
                  key={question.id}
                  className={`question-item mb-3 p-3 border rounded ${
                    !unlocked ? 'bg-light' : ''
                  }`}
                >
                  <div className="d-flex align-items-start gap-2 mb-2">
                    {unlocked ? (
                      hasResponse ? (
                        <FaCheckCircle className="text-success mt-1" />
                      ) : (
                        <span className="text-muted mt-1">○</span>
                      )
                    ) : (
                      <FaLock className="text-muted mt-1" />
                    )}
                    <div className="flex-grow-1">
                      <label className="fw-bold mb-2">
                        {question.question}
                      </label>
                      {!unlocked && (
                        <div className="text-muted small mb-2">
                          <em>
                            This question will unlock after you complete:{' '}
                            {question.unlockHint || 'the required operation'}
                          </em>
                        </div>
                      )}
                      <Form.Control
                        as={question.type === 'textarea' ? 'textarea' : 'input'}
                        rows={question.type === 'textarea' ? 3 : undefined}
                        placeholder={
                          unlocked
                            ? 'Type your response here...'
                            : 'Complete the required operations to unlock'
                        }
                        disabled={!unlocked}
                        value={localResponses[question.id] || ''}
                        onChange={(e) => handleChange(question.id, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
