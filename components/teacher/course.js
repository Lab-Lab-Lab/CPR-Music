import { FaPlus, FaMarker, FaTrash } from 'react-icons/fa';
import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import ListGroup from 'react-bootstrap/ListGroup';
import ListGroupItem from 'react-bootstrap/ListGroupItem';
import Row from 'react-bootstrap/Row';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import Link from 'next/link';
import Alert from 'react-bootstrap/Alert';
import { useState } from 'react';
import {
  getAssignedPieces,
  getAllPieces,
  mutateUnassignPiece,
  mutateAssignPiece,
  getStudentAssignments,
} from '../../api';
import PieceActivityList from '../pieceActivityList';

// for the teacher, it should:
// 1. permit assigning of pieces
// 2. permit export grades
// 3. invite to grade an assignment (this is weird bc it's at a level below piece while #1 is at the piece level)
//

export default function TeacherCourseView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { slug } = router.query;
  const [assignError, setAssignError] = useState(null);
  const {
    isLoadingPieces,
    error,
    data: allPieces,
  } = useQuery(['allPieces', slug], getAllPieces(slug), {
    enabled: !!slug,
  });
  const {
    isLoading: loaded,
    error: assignmentsError,
    data: assignments,
    refetch: refetchStudentAssns, // per https://react-query-v3.tanstack.com/guides/disabling-queries when the query has the enabled property,
    // The query will ignore query client invalidateQueries and refetchQueries calls that would normally result in the query refetching.
  } = useQuery(['assignments', slug], getStudentAssignments(slug), {
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
  const {
    isLoadingAssignedActs,
    errorAssignedActs,
    data: assignedPieces,
    refetch: refetchAssignedPieces, // per https://react-query-v3.tanstack.com/guides/disabling-queries when the query has the enabled property,
    // The query will ignore query client invalidateQueries and refetchQueries calls that would normally result in the query refetching.
  } = useQuery(['assignedPieces', slug], getAssignedPieces(assignments), {
    enabled: !!assignments,
  });
  const unassignMutation = useMutation(mutateUnassignPiece(slug), {
    onMutate: async (unassignedPiece) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['assignedPieces', slug]);
      // Snapshot the previous value
      const previousAssigned = queryClient.getQueryData([
        'assignedPieces',
        slug,
      ]);
      // Optimistically update to the new value
      queryClient.setQueryData(['assignedPieces', slug], (old) => {
        const updated = old;
        delete updated[unassignedPiece.slug];
        return updated;
      });
      // Return a context object with the snapshotted value
      return { previousAssigned };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, unassignedPiece, context) => {
      queryClient.setQueryData(
        ['assignedPieces', slug],
        context.previousAssigned,
      );
    },
    // Always refetch after error or success:
    onSettled: async () => {
      await queryClient.invalidateQueries('assignments');
      await refetchStudentAssns();
      await queryClient.invalidateQueries(['assignedPieces', slug]);
      refetchAssignedPieces(); // per https://react-query-v3.tanstack.com/guides/disabling-queries when the query has the enabled property,
      // The query will ignore query client invalidateQueries and refetchQueries calls that would normally result in the query refetching.
    },
  });
  const unassign = (piece) => unassignMutation.mutate(piece);

  const assignMutation = useMutation(mutateAssignPiece(slug), {
    onMutate: async (newPiece) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['assignedPieces', slug]);
      // Snapshot the previous value
      const previousAssigned = queryClient.getQueryData([
        'assignedPieces',
        slug,
      ]);
      // Optimistically update to the new value
      queryClient.setQueryData(['assignedPieces', slug], (old) => ({
        ...old,
        [newPiece.slug]: newPiece,
      }));
      // Return a context object with the snapshotted value
      return { previousAssigned };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, newPiece, context) => {
      console.error('assignMutation - onError');
      console.error(err);
      // assume this is because they haven't assigned instruments yet?
      setAssignError(err);
      queryClient.setQueryData(
        ['assignedPieces', slug],
        context.previousAssigned,
      );
    },
    // Always refetch after error or success:
    onSettled: async () => {
      await queryClient.invalidateQueries('assignments');
      await refetchStudentAssns();
      await queryClient.invalidateQueries(['assignedPieces', slug]);
      refetchAssignedPieces(); // per https://react-query-v3.tanstack.com/guides/disabling-queries when the query has the enabled property,
      // The query will ignore query client invalidateQueries and refetchQueries calls that would normally result in the query refetching.
    },
  });
  const assign = (piecePlan) => assignMutation.mutate(piecePlan);
  if (isLoadingPieces || isLoadingAssignedActs) return 'Loading...';
  if (error || errorAssignedActs)
    return `An error has occurred: ${
      error?.message ?? errorAssignedActs?.message
    }`;

  return (
    <>
      {assignError && (
        <Row>
          <Col>
            <Alert key="danger" variant="danger">
              <Alert.Heading>
                Please assign students&apos; instruments
              </Alert.Heading>
              <p>
                Sorry for the trouble, but just once per new course, we need you
                to{' '}
                <Link href={`/courses/${slug}/instruments`}>
                  choose students&apos; instruments
                </Link>{' '}
                prior to assigning pieces.
              </p>
            </Alert>
          </Col>
        </Row>
      )}
      <Row>
        <Col>
          <h2>Assign New Piece</h2>
          <ListGroup>
            {allPieces &&
              allPieces
                .filter((piece) => {
                  let reslt = true;
                  if (
                    assignedPieces &&
                    Object.values(assignedPieces).findIndex(
                      (assignedPiece) => assignedPiece.id === piece.id,
                    ) !== -1
                  ) {
                    reslt = false;
                  }
                  return reslt;
                })
                .map((piece, pidx) => (
                  <ListGroupItem
                    key={`${piece.id}`}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <div>{piece.name}</div>
                    <Button onClick={() => assign(piece.piece_plan_id)}>
                      Assign <FaPlus />
                    </Button>
                  </ListGroupItem>
                ))}
          </ListGroup>
        </Col>
        <Col>
          <h2>Assigned Pieces</h2>

          {assignedPieces && Object.values(assignedPieces).length > 0 ? (
            <Accordion
              defaultActiveKey={Object.values(assignedPieces)[0]}
              alwaysOpen
            >
              {Object.values(assignedPieces).map((piece) => (
                <Accordion.Item eventKey={piece.id} key={piece.id}>
                  <Accordion.Header>{piece.name}</Accordion.Header>
                  <Accordion.Body>
                    <Row>
                      <Col md={9}>
                        <PieceActivityList
                          slug={slug}
                          piece={piece.slug}
                          activities={piece.activities}
                        />
                      </Col>
                      <Col style={{ textAlign: 'center' }}>
                        <Button
                          variant="danger"
                          onClick={() => {
                            unassign(piece);
                          }}
                        >
                          Delete <FaTrash />
                        </Button>
                      </Col>
                    </Row>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : (
            <p>There are no pieces assigned to this course.</p>
          )}
        </Col>
      </Row>
    </>
  );
}
