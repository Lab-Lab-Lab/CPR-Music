import { useRouter } from 'next/router';
import { Card, ListGroup, ListGroupItem, Spinner } from 'react-bootstrap';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { getStudentAssignments, mutateAssignmentInstrument } from '../../api';
import SubmissionsStatusBadge from '../submissionStatusBadge';
import { assnToContent, assnToKey } from './navActivityPicker';
import InstrumentSelector from '../instrumentSelector';
import PieceActivityList from '../pieceActivityList';

function PieceAssignments({ piece, canEditInstruments, isTeacher }) {
  const router = useRouter();

  const { slug } = router.query;

  const {
    isLoading,
    error: assignmentsError,
    data: assignments,
  } = useQuery(['assignments', slug], getStudentAssignments(slug), {
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const updateInstrument = (newInstrument) => {
    const pieceId = assignments[piece][0].piece_id;
    mutateAssignmentInstrument(slug, pieceId, newInstrument);
  };

  if (isLoading) {
    return (
      <Spinner
        as="span"
        animation="border"
        size="sm"
        role="status"
        aria-hidden="true"
        variant="primary"
      >
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    );
  }
  if (!slug || assignmentsError || !assignments || !assignments[piece]) {
    if (assignmentsError) {
      console.error(assignmentsError);
    }
    return <p>You have no assignments for this piece at this time.</p>;
  }

  // Build deduplicated activities map for teacher view
  const pieceActivities = {};
  if (isTeacher) {
    for (const assn of assignments[piece]) {
      const key = `${assn.activity_type_category}-${assn.activity_type_name}`;
      if (!pieceActivities[key]) {
        pieceActivities[key] = {
          category: assn.activity_type_category,
          name: assn.activity_type_name,
        };
      }
    }
  }

  return (
    <Card className="student-piece-activity-group">
      <Card.Header className="fw-bold">
        {assignments[piece][0].piece_name}
        {canEditInstruments && (
          <InstrumentSelector
            defaultInstrument={assignments[piece][0].instrument}
            onChange={updateInstrument}
          />
        )}
      </Card.Header>
      {isTeacher ? (
        <Card.Body>
          <PieceActivityList
            slug={slug}
            piece={piece}
            activities={pieceActivities}
          />
        </Card.Body>
      ) : (
        <ListGroup>
          {assignments[piece]
            .filter((assn, i, arr) =>
              arr.findIndex((a) => assnToKey(a) === assnToKey(assn)) === i
            )
            .map((assignment) => (
              <ListGroupItem
                key={`assn-${assignment.id}`}
                className="d-flex justify-content-between"
              >
                <Link
                  passHref
                  legacyBehavior
                  href={`/courses/${slug}/${
                    assignment.piece_slug
                  }/${assnToKey(assignment, 'debug str this is from pieceAssignments')}`}
                >
                  <a>{assnToContent(assignment)}</a>
                </Link>
                <SubmissionsStatusBadge assn={assignment} />
              </ListGroupItem>
            ))}
        </ListGroup>
      )}
    </Card>
  );
}

export { PieceAssignments };
