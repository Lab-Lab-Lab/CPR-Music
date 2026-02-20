import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchActivities,
  fetchSingleStudentAssignment,
  postRecording,
} from '../../../../../../actions';
import StudentAssignment from '../../../../../../components/student/assignment';
import { DAWProvider } from '../../../../../../contexts/DAWProvider';

const FlatEditor = dynamic(
  () => import('../../../../../../components/flatEditor'),
  {
    ssr: false,
  },
);

// Import the recorder
const Recorder = dynamic(
  () => import('../../../../../../components/recorder'),
  {
    ssr: false,
  },
);

export default function PerformMelody() {
  const router = useRouter();
  const { slug, piece, actCategory, partType } = router.query;
  const dispatch = useDispatch();
  const [parsedScore, setParsedScore] = useState();
  const [preferredSample, setPreferredSample] = useState();

  const userInfo = useSelector((state) => state.currentUser);
  useEffect(() => {
    if (slug && userInfo.token) {
      dispatch(fetchActivities({ slug }));
    }
  }, [slug, userInfo.token]);
  const { items: activities, loaded: loadedActivities } = useSelector(
    (state) => state.activities,
  );

  const assignment = useSelector((state) => state.selectedAssignment);
  useEffect(() => {
    if (loadedActivities) {
      let comparablePartType = partType;
      if (comparablePartType.startsWith('Melody')) {
        comparablePartType = comparablePartType.substring(0, 'Melody'.length);
      } else if (comparablePartType.startsWith('Bassline')) {
        comparablePartType = comparablePartType.substring(0, 'Bassline'.length);
      }
      const assignmentId = activities[piece].filter(
        (assn) =>
          assn.piece_slug === piece &&
          assn.part_type === comparablePartType &&
          assn.activity_type_category === actCategory,
      )?.[0]?.id;
      dispatch(
        fetchSingleStudentAssignment({
          slug,
          assignmentId,
        }),
      );
    }
  }, [slug, loadedActivities, activities, partType]);

  useEffect(() => {
    const score = assignment?.part?.transpositions?.filter(
      (partTransposition) =>
        partTransposition.transposition.name ===
        assignment?.instrument?.transposition,
    )?.[0]?.flatio;
    if (score) {
      setParsedScore(JSON.parse(score));
    }

    // if there's an instrument_sample for the student's instrument, use that,
    // otherwise use the sample from the part
    const myInstrumentId = assignment?.instrument?.id ?? userInfo.instrument;
    const instrumentSample = assignment?.part?.instrument_samples?.find(
      (instrument) => instrument.instrument === myInstrumentId,
    );
    if (instrumentSample) {
      setPreferredSample(instrumentSample.sample_audio);
    } else {
      setPreferredSample(assignment?.part?.sample_audio);
    }
    console.log('preferredSample', preferredSample);
  }, [assignment]);

  return (
    <StudentAssignment assignment={assignment}>
      {parsedScore === undefined ? (
        <Alert variant="danger">
          <Alert.Heading>
            We don&apos;t have a score for this piece for your instrument.
          </Alert.Heading>
          <p>Please ask your teacher to contact us.</p>
          <p>
            If you already have the music from your teacher,{' '}
            <strong>
              you can still record your performance and submit it.
            </strong>
          </p>
        </Alert>
      ) : (
        <>
          <FlatEditor score={parsedScore} />
          {assignment?.part?.sample_audio && (
            <dl className='mb-0'>
              <dt>Sample Recording</dt>
              <dd className='mb-0'>
                {
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio controls src={preferredSample} />
                }
              </dd>
            </dl>
          )}
        </>
      )}
      {partType && (
        <DAWProvider>
          <Recorder
            accompaniment={assignment?.part?.piece?.accompaniment}
            submit={(audio) =>
              dispatch(
                postRecording({
                  token: userInfo.token,
                  slug,
                  assignmentId: assignment.id,
                  audio,
                }),
              )
            }
          />
        </DAWProvider>
      )}
    </StudentAssignment>
  );
}