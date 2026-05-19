import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useDispatch, useSelector } from 'react-redux';
import dynamic from 'next/dynamic';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { getStudentAssignments, mutateCreateSubmission } from '../../../api';
import { Recorder } from '../../recorder';
import { postRecording } from '../../../actions';

const FlatEditor = dynamic(() => import('../../flatEditor'), {
  ssr: false,
});

const FlatMelodyViewer = dynamic(() => import('../../flatMelodyViewer'), {
  ssr: false,
});

const ChordScaleBucketScore = dynamic(
  () => import('../../chordScaleBucketScore'),
  {
    ssr: false,
  },
);

export default function CreativityAuralActivity() {
  const dispatch = useDispatch();
  // I think this should show the melody for the current piece, but in the student's transposition
  // need to get the student's current assignment
  const router = useRouter();
  const { slug, piece } = router.query;
  const actCategory = 'Create';
  const [json, setJson] = useState('');
  const composition = useRef('');

  const userInfo = useSelector((state) => state.currentUser);

  const {
    isLoading: loaded,
    error: assignmentsError,
    data: assignments,
  } = useQuery(['assignments', slug], getStudentAssignments(slug), {
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
  const mutation = useMutation(mutateCreateSubmission({ slug }));

  const currentAssignment =
    assignments &&
    Object.values(assignments)
      .reduce((prev, current) => [...prev, ...current], [])
      .filter(
        (assn) =>
          assn.piece_slug === piece &&
          assn.activity_type_category === actCategory,
      )?.[0];
  const currentTransposition = currentAssignment?.transposition;
  const flatIOScoreForTransposition =
    currentAssignment?.part?.transpositions?.filter(
      (partTransposition) =>
        partTransposition.transposition.name === currentTransposition,
    )?.[0]?.flatio;

  const submitCreativity = ({ audio, submissionId }) =>
    dispatch(
      postRecording({
        slug,
        assignmentId: currentAssignment.id,
        audio,
        composition: composition.current,
        submissionId,
      }),
    );
  let scoreJSON;
  if (flatIOScoreForTransposition) {
    scoreJSON = JSON.parse(flatIOScoreForTransposition);
  }
  return flatIOScoreForTransposition ? (
    <>
      <FlatMelodyViewer score={scoreJSON} onLoad={setJson} />
      {json && (
        <>
          <Row>
            <Col md={4}>
              <ChordScaleBucketScore
                height={150}
                referenceScoreJSON={json}
                chordScaleBucket="tonic"
                colors="tonic"
                instrumentName={currentAssignment?.instrument}
              />
            </Col>
            <Col md={4}>
              <ChordScaleBucketScore
                height={150}
                referenceScoreJSON={json}
                chordScaleBucket="subdominant"
                colors="subdominant"
                instrumentName={currentAssignment?.instrument}
              />
            </Col>
            <Col md={4}>
              <ChordScaleBucketScore
                height={150}
                referenceScoreJSON={json}
                chordScaleBucket="dominant"
                colors="dominant"
                instrumentName={currentAssignment?.instrument}
              />
            </Col>
          </Row>
          <FlatEditor
            edit
            score={{
              scoreId: 'blank',
            }}
            submittingStatus={mutation.status}
            onUpdate={(data) => {
              composition.current = data;
            }}
            orig={json}
            colors={currentAssignment?.part?.chord_scale_pattern}
            instrumentName={currentAssignment?.instrument}
          />
        </>
      )}
      <Recorder
        submit={submitCreativity}
        accompaniment={currentAssignment?.part?.piece?.accompaniment}
      />
    </>
  ) : (
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
