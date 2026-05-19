import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useDispatch } from 'react-redux';
import dynamic from 'next/dynamic';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { Col, Row } from 'react-bootstrap';
import { getStudentAssignments, mutateCreateSubmission } from '../../../api';
import { Recorder } from '../../recorder';
import { postRecording } from '../../../actions';

const ExploratoryCompose = dynamic(() => import('../../exploratoryCompose'), {
  ssr: false,
});

const FlatMelodyViewer = dynamic(() => import('../../flatMelodyViewer'), {
  ssr: false,
});

const MergingScore = dynamic(() => import('../../mergingScore'), {
  ssr: false,
});

const ChordScaleBucketScore = dynamic(
  () => import('../../chordScaleBucketScore'),
  {
    ssr: false,
  },
);

const MEASURES_PER_STEP = 4;

export default function CreativityActivity() {
  const dispatch = useDispatch();
  // I think this should show the melody for the current piece, but in the student's transposition
  // need to get the student's current assignment
  const router = useRouter();
  const { slug, piece } = router.query;
  const actCategory = 'Create';
  const [melodyJson, setMelodyJson] = useState('');

  // let's just store the calculated 4 measure slices of
  // the score and the corresponding colors
  const [subScores, setSubScores] = useState([]);
  const [subColors, setSubColors] = useState([]);
  // const [scoreData, setScoreData] = useState([]);
  const scoreDataRef = useRef([]);
  // const [totalScoreJSON, setTotalScoreJSON] = useState('');
  const totalScoreJSON = useRef('');
  const [isDoneComposing, setIsDoneComposing] = useState(false);

  // const userInfo = useSelector((state) => state.currentUser);

  const {
    isLoading: loaded,
    error: assignmentsError,
    data: assignments,
  } = useQuery(['assignments', slug], getStudentAssignments(slug), {
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const currentAssignment =
    assignments &&
    Object.values(assignments)
      .reduce((prev, current) => [...prev, ...current], [])
      .filter(
        (assn) =>
          assn.piece_slug === piece &&
          assn.activity_type_category === actCategory,
      )?.[0];

  // only when melodyJson is updated, calculate the steps
  useEffect(() => {
    if (melodyJson && melodyJson.length > 0) {
      const referenceScoreObj = JSON.parse(melodyJson);
      const partialScores = [];
      const partialColors = [];

      scoreDataRef.current = [];
      const measureCount =
        referenceScoreObj['score-partwise'].part[0].measure.length;
      for (let i = 0; i < measureCount; i += MEASURES_PER_STEP) {
        const slice = JSON.parse(melodyJson);
        slice['score-partwise'].part[0].measure = slice[
          'score-partwise'
        ].part[0].measure.slice(i, i + MEASURES_PER_STEP);
        slice['score-partwise'].part[0].measure[0].attributes[0].clef =
          referenceScoreObj[
            'score-partwise'
          ].part[0].measure[0].attributes[0].clef;
        slice['score-partwise'].part[0].measure[0].attributes[0].key =
          referenceScoreObj[
            'score-partwise'
          ].part[0].measure[0].attributes[0].key;

        slice['score-partwise'].part[0].measure[0].attributes[0].divisions =
          referenceScoreObj[
            'score-partwise'
          ].part[0].measure[0].attributes[0].divisions;
        slice['score-partwise'].part[0].measure[0].attributes[0].time =
          referenceScoreObj[
            'score-partwise'
          ].part[0].measure[0].attributes[0].time;
        slice['score-partwise'].part[0].measure[0].attributes[0][
          'staff-details'
        ] =
          referenceScoreObj['score-partwise'].part[0].measure[0].attributes[0][
          'staff-details'
          ];

        partialScores.push(JSON.stringify(slice));

        const colorSlice = currentAssignment?.part?.chord_scale_pattern?.slice(
          i,
          i + MEASURES_PER_STEP,
        );
        partialColors.push(colorSlice);
        scoreDataRef.current.push({});
      }
      setSubScores(partialScores);
      setSubColors(partialColors);
    }
  }, [melodyJson]);

  const mutation = useMutation(mutateCreateSubmission({ slug }));

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
        composition: totalScoreJSON.current,
        submissionId,
      }),
    );
  let scoreJSON;
  if (flatIOScoreForTransposition) {
    scoreJSON = JSON.parse(flatIOScoreForTransposition);
  }

  const onMerged = useCallback((mergedData) => {
    totalScoreJSON.current = mergedData;
  }, []);

  function handleSubmit(i) {
    return (data) => {
      scoreDataRef.current[i] = data;
    };
  }

  return flatIOScoreForTransposition ? (
    <>
      <FlatMelodyViewer
        score={scoreJSON}
        onLoad={setMelodyJson}
        debugMsg="Failed to load in theoretical"
      />
      {melodyJson && (
        <Row>
          <Col md={4}>
            <div className="all-buckets position-sticky top-0">
              <ChordScaleBucketScore
                height={150}
                referenceScoreJSON={melodyJson}
                chordScaleBucket="tonic"
                colors="tonic"
                instrumentName={currentAssignment?.instrument}
              />
              <ChordScaleBucketScore
                height={150}
                referenceScoreJSON={melodyJson}
                chordScaleBucket="subdominant"
                colors="subdominant"
                instrumentName={currentAssignment?.instrument}
              />
              <ChordScaleBucketScore
                height={150}
                referenceScoreJSON={melodyJson}
                chordScaleBucket="dominant"
                colors="dominant"
                instrumentName={currentAssignment?.instrument}
              />
            </div>
          </Col>
          <Col md>
            {subScores &&
              subScores.map((subScore, idx) => (
                <div key={uuidv4()}>
                  <h2 id={`step-${idx + 1}`}>Step {idx + 1}</h2>
                  <ExploratoryCompose
                    referenceScoreJSON={subScore}
                    colors={subColors[idx]}
                    onUpdate={handleSubmit(idx)}
                  />
                </div>
              ))}
            <Button
              onClick={() => {
                setIsDoneComposing(true);
              }}
            >
              Done Composing
            </Button>
            <h2>Step {subScores.length + 1} - Combined</h2>
            {scoreDataRef.current &&
              scoreDataRef.current.length > 0 &&
              isDoneComposing && (
                <MergingScore
                  giveJSON={onMerged}
                  scores={scoreDataRef}
                  instrumentName={currentAssignment?.instrument}
                />
              )}
            <Recorder
              submit={submitCreativity}
              accompaniment={currentAssignment?.part?.piece?.accompaniment}
            />
          </Col>
        </Row>
      )}
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
