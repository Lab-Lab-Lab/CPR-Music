import ListGroup from 'react-bootstrap/ListGroup';
import ListGroupItem from 'react-bootstrap/ListGroupItem';
import { Card, Col, Row } from 'react-bootstrap';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import RTE from './rte';

const FlatEditor = dynamic(() => import('../../flatEditor'), {
  ssr: false,
});

export default function GradePerform({ submissions }) {
  const [isFormFocused, setFormFocus] = useState(false);
  const audioRef = useRef();
  const gradeKeyDown = (ev) => {
    if (ev.key === ' ') {
      if (audioRef?.current?.paused) {
        audioRef.current.play();
      } else {
        audioRef?.current?.pause();
      }
    }
  };

  return (
    <Row>
      <Col>
        {submissions ? (
          <h2>
            Grading: {submissions?.[0]?.assignment?.part?.piece?.name} -{' '}
            {submissions?.[0]?.assignment?.activity?.activity_type?.category}{' '}
            Activity
          </h2>
        ) : (
          <h2>No Submissions to Grade</h2>
        )}
        {/* TODO: should I show the flat score viewer during grading of perform? */}
        {/* <FlatEditor height={200} /> */}
        {submissions &&
          submissions.map((submission, submissionIdx) => {
            let rte;
            let reflection;
            let parsedScore;

            if (
              submission?.assignment?.activity?.activity_type?.category ===
                'Create' &&
              submission?.content
            ) {
              try {
                parsedScore = JSON.parse(submission.content);
              } catch (e) {
                console.error(e, submission.content);
              }
            }

            if (
              submission?.assignment?.activity?.activity_type?.category ===
                'Respond' &&
              submission?.content
            ) {
              const content = JSON.parse(submission.content);
              reflection = content.reflection;
              rte = { r: content.r, t: content.t, e: content.e };
            }
            return (
              <Row
                className={[
                  {
                    border: isFormFocused,
                  },
                  'border-primary',
                  'border-3',
                ]}
                key={submission.id}
              >
                <Col>
                  <Card>
                    <Card.Body>
                      <Card.Title>
                        {submission.assignment.enrollment.user.name}
                      </Card.Title>
                      <Card.Text>
                        {submission.attachments?.[0]?.file && (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <audio
                            controls
                            src={submission.attachments[0].file}
                            ref={audioRef}
                          />
                        )}

                        {submission?.assignment?.activity?.activity_type
                          ?.category === 'Respond' &&
                          submission?.content && (
                            <Row>
                              <Col>
                                <p>{reflection}</p>
                              </Col>
                              <Col xs={1}>
                                <dl>
                                  <dt>R</dt>
                                  <dd>
                                    <code>{rte.r}</code>
                                  </dd>
                                  <dt>T</dt>
                                  <dd>
                                    <code>{rte.t}</code>
                                  </dd>
                                  <dt>E</dt>
                                  <dd>
                                    <code>{rte.e}</code>
                                  </dd>
                                </dl>
                              </Col>
                            </Row>
                          )}

                        {submission?.assignment?.activity?.activity_type?.category.includes(
                          'Connect',
                        ) && <p>{submission?.content}</p>}
                      </Card.Text>
                    </Card.Body>
                    <ListGroup className="list-group-flush">
                      {/* TODO: what time should I show here? */}
                      {submission.attachments?.[0]?.submitted && (
                        <ListGroupItem>
                          <time dateTime={submission.attachments[0].submitted}>
                            {submission.attachments[0].submitted}
                          </time>
                        </ListGroupItem>
                      )}
                      <ListGroupItem>{submission.id}</ListGroupItem>
                      {submission?.assignment?.activity?.activity_type
                        ?.category === 'Create' &&
                        submission?.content && (
                          <ListGroupItem>
                            {parsedScore ? (
                              <ErrorBoundary
                                fallback={<div>Something went wrong</div>}
                              >
                                <FlatEditor scoreJSON={parsedScore} />
                              </ErrorBoundary>
                            ) : (
                              <div>
                                <p>no score/erroneous score</p>
                                <pre>{submission.content}</pre>
                              </div>
                            )}
                          </ListGroupItem>
                        )}
                      <ListGroupItem>
                        {submission.attachments.length} submission
                        {submission.attachments.length === 1 ? '' : 's'}
                      </ListGroupItem>
                    </ListGroup>
                  </Card>
                </Col>
                <Col onKeyDown={gradeKeyDown}>
                  <RTE submission={submission} />
                </Col>
              </Row>
            );
          })}
      </Col>
    </Row>
  );
}
