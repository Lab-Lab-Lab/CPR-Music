import { useRouter } from 'next/router';
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useDispatch } from 'react-redux';
import dynamic from 'next/dynamic';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
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

const ExploratoryCompose = dynamic(() => import('../../exploratoryCompose'), {
  ssr: false,
});

const VariationsFromMotiveScore = dynamic(
  () => import('../../variationsFromMotiveScore'),
  {
    ssr: false,
  },
);

export default function CreativityActivity() {
  const dispatch = useDispatch();
  // I think this should show the melody for the current piece, but in the student's transposition
  // need to get the student's current assignment
  const router = useRouter();
  const { slug, piece } = router.query;
  const actCategory = 'Create';
  const [melodyJson, setMelodyJson] = useState('');

  const composition = useRef('');

  const tonicJson = useRef('');
  const subdominantJson = useRef('');
  const dominantJson = useRef('');

  const [startedVariationGeneration, setStartedVariationGeneration] =
    useState(false);

  const selectedMeasure = useRef({});
  const setSelectedMeasure = useCallback((measure) => {
    selectedMeasure.current = measure;
  }, []);

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

  const handleTonicUpdate = useCallback((data) => {
    tonicJson.current = data;
  }, []);

  const handleSubdominantUpdate = useCallback((data) => {
    subdominantJson.current = data;
  }, []);

  const handleDominantUpdate = useCallback((data) => {
    dominantJson.current = data;
  }, []);

  const generateVariations = useCallback((data) => {
    if (startedVariationGeneration) return;
    setStartedVariationGeneration(true);
  }, []);

  return flatIOScoreForTransposition ? (
    <div className="cpr-create">
      <FlatMelodyViewer score={scoreJSON} onLoad={setMelodyJson} />
      <h2>Motive 1 - Tonic</h2>
      <div className="row">
        <div className="col-md-6">
          Create a melody one measure in length using only these 5 pitches. You
          can use rests or note durations from 1/8 - 1/2.
          <ChordScaleBucketScore
            height={150}
            referenceScoreJSON={melodyJson}
            chordScaleBucket="tonic"
            colors="tonic"
            instrumentName={currentAssignment?.instrument}
          />
        </div>
        <div className="col-md-6">
          <ExploratoryCompose
            referenceScoreJSON={melodyJson}
            trim={1}
            onUpdate={handleTonicUpdate}
            colors="tonic"
            instrumentName={currentAssignment?.instrument}
          />
        </div>
      </div>

      <h2>Motive 2 - Subdominant</h2>
      <div className="row">
        <div className="col-md-6">
          Create a melody one measure in length using only these 5 pitches. You
          can use rests or note durations from 1/8 - 1/2.
          <ChordScaleBucketScore
            height={150}
            referenceScoreJSON={melodyJson}
            chordScaleBucket="subdominant"
            colors="subdominant"
            instrumentName={currentAssignment?.instrument}
          />
        </div>
        <div className="col-md-6">
          <ExploratoryCompose
            referenceScoreJSON={melodyJson}
            trim={1}
            onUpdate={handleSubdominantUpdate}
            colors="subdominant"
            instrumentName={currentAssignment?.instrument}
          />
        </div>
      </div>

      <h2>Motive 3 - Dominant</h2>
      <div className="row">
        <div className="col-md-6">
          Create a melody one measure in length using only these 5 pitches. You
          can use rests or note durations from 1/8 - 1/2.
          <ChordScaleBucketScore
            height={150}
            referenceScoreJSON={melodyJson}
            chordScaleBucket="dominant"
            colors="dominant"
            instrumentName={currentAssignment?.instrument}
          />
        </div>
        <div className="col-md-6">
          <ExploratoryCompose
            referenceScoreJSON={melodyJson}
            trim={1}
            onUpdate={handleDominantUpdate}
            colors="dominant"
            instrumentName={currentAssignment?.instrument}
          />
        </div>
      </div>

      <Button variant="primary" onClick={generateVariations}>
        Begin Composing
      </Button>

      {startedVariationGeneration && (
        <div>
          <h2>Variations on your motives</h2>
          <Tabs
            defaultActiveKey="tonic-palette"
            id="justify-tab-example"
            className="mb-3"
            justify
            variant="underline"
          >
            <Tab eventKey="tonic-palette" title="Tonic" className="tonic">
              <VariationsFromMotiveScore
                referenceScoreJSON={tonicJson.current}
                height={300}
                width={700}
                onSelect={setSelectedMeasure}
              />
            </Tab>
            <Tab
              eventKey="subdominant-palette"
              title="Subdominant"
              className="subdominant"
            >
              <VariationsFromMotiveScore
                referenceScoreJSON={subdominantJson.current}
                height={300}
                width={700}
                onSelect={setSelectedMeasure}
              />
            </Tab>
            <Tab
              eventKey="dominant-palette"
              title="Dominant"
              className="dominant"
            >
              <VariationsFromMotiveScore
                referenceScoreJSON={dominantJson.current}
                height={300}
                width={700}
                onSelect={setSelectedMeasure}
              />
            </Tab>
          </Tabs>
          <h2>Final Composition</h2>
          <FlatEditor
            edit
            score={{
              scoreId: 'blank',
            }}
            onUpdate={(data) => {
              composition.current = data;
            }}
            submittingStatus={mutation.status}
            orig={melodyJson}
            colors={currentAssignment?.part?.chord_scale_pattern}
            selectedMeasure={selectedMeasure}
            debugMsg="final explore composition flateditor instance"
            instrumentName={currentAssignment?.instrument}
          />
          <Recorder
            submit={submitCreativity}
            accompaniment={currentAssignment?.part?.piece?.accompaniment}
          />
        </div>
      )}
    </div>
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

  // return <p>Creativity</p>
}
