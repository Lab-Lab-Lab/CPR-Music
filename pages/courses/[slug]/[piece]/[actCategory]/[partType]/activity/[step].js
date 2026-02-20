/**
 * Activity Page - Dynamic route for DAW study activities
 *
 * Route: /courses/:slug/:piece/:actCategory/:partType/activity/:step
 * Steps: 1-4 corresponding to the 4 study activities
 */

import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchActivities, fetchSingleStudentAssignment } from '../../../../../../../actions';
import StudentAssignment from '../../../../../../../components/student/assignment';
import { DAWProvider } from '../../../../../../../contexts/DAWProvider';
import { useActivityProgress } from '../../../../../../../hooks/useActivityProgress';
import {
  ActivityLayout,
  ActivitySubmitModal,
  ConsentReminderModal,
} from '../../../../../../../components/activity';
import { getActivityConfig } from '../../../../../../../lib/activity/activityConfigs';

// Dynamically import components
const FlatEditor = dynamic(() => import('../../../../../../../components/flatEditor'), {
  ssr: false,
});

const Recorder = dynamic(() => import('../../../../../../../components/recorder'), {
  ssr: false,
});

const DAW = dynamic(() => import('../../../../../../../components/audio/DAW'), {
  ssr: false,
});

export default function ActivityPage() {
  const router = useRouter();
  const { slug, piece, actCategory, partType, step, email } = router.query;
  const stepNumber = parseInt(step, 10);
  const dispatch = useDispatch();

  // Qualtrics Survey 2 redirect URL (TODO: Replace with actual Qualtrics URL)
  const SURVEY_2_URL = process.env.NEXT_PUBLIC_QUALTRICS_SURVEY_2_URL || 'https://qualtrics.com/survey/2';

  // Redux state - MUST be called before any conditional returns
  const userInfo = useSelector((state) => state.currentUser);
  const { items: activities, loaded: loadedActivities } = useSelector(
    (state) => state.activities
  );
  const assignment = useSelector((state) => state.selectedAssignment);

  // Local state - MUST be called before any conditional returns
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [hasSeenConsent, setHasSeenConsent] = useState(false);
  const [parsedScore, setParsedScore] = useState();
  const [preferredSample, setPreferredSample] = useState();

  // Activity progress hook
  const {
    currentStep,
    stepCompletions,
    questionResponses,
    isLoading,
    isSubmitting,
    canSubmit,
    progress,
    logOperation,
    saveResponse,
    submitStep,
  } = useActivityProgress({
    slug,
    assignmentId: assignment?.id,
    initialStep: stepNumber,
    email: email || null, // Pass email from Qualtrics
  });

  // Audio persistence configuration for DAW (Activity Study only)
  const [audioPersistenceConfig, setAudioPersistenceConfig] = useState({
    enabled: false
  });

  // Fetch activities and assignment
  useEffect(() => {
    if (slug && userInfo.token) {
      dispatch(fetchActivities({ slug }));
    }
  }, [slug, userInfo.token, dispatch]);

  useEffect(() => {
    if (loadedActivities && activities && piece) {
      let comparablePartType = partType;
      if (comparablePartType?.startsWith('Melody')) {
        comparablePartType = comparablePartType.substring(0, 'Melody'.length);
      } else if (comparablePartType?.startsWith('Bassline')) {
        comparablePartType = comparablePartType.substring(0, 'Bassline'.length);
      }

      const assignmentId = activities[piece]?.filter(
        (assn) =>
          assn.piece_slug === piece &&
          assn.part_type === comparablePartType &&
          assn.activity_type_category === actCategory
      )?.[0]?.id;

      if (assignmentId) {
        dispatch(
          fetchSingleStudentAssignment({
            slug,
            assignmentId,
          })
        );
      }
    }
  }, [slug, loadedActivities, activities, partType, piece, actCategory, dispatch]);

  // Parse score and get preferred sample
  useEffect(() => {
    if (!assignment) return;

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
  }, [assignment, userInfo.instrument]);

  // Load audio state for persistence (Activities 2-4)
  useEffect(() => {
    const loadAudioState = async () => {
      if (!slug || !assignment?.id || isLoading) return;

      try {
        // Import dynamically to avoid circular dependency
        const { getActivityProgress } = await import('../../../../../../../api');
        const progressData = await getActivityProgress({
          slug,
          assignmentId: assignment.id
        });

        if (progressData) {
          // Configure audio persistence with loaded state
          setAudioPersistenceConfig({
            enabled: true,
            slug,
            assignmentId: assignment.id,
            initialAudioState: progressData
          });

          console.log('✅ Audio persistence configured for activity', stepNumber);
        }
      } catch (error) {
        console.error('Failed to load audio state:', error);
        // Still enable persistence, just without initial state
        setAudioPersistenceConfig({
          enabled: true,
          slug,
          assignmentId: assignment.id
        });
      }
    };

    loadAudioState();
  }, [slug, assignment?.id, isLoading, stepNumber]);

  // Show consent modal on first load of Activity 1
  useEffect(() => {
    if (stepNumber === 1 && !hasSeenConsent && !isLoading) {
      // Check if user has seen consent in this session
      const consentSeen = sessionStorage.getItem('daw_study_consent_seen');
      if (!consentSeen) {
        setShowConsentModal(true);
      } else {
        setHasSeenConsent(true);
      }
    }
  }, [stepNumber, hasSeenConsent, isLoading]);

  // Handle consent acceptance
  const handleConsentAccept = () => {
    sessionStorage.setItem('daw_study_consent_seen', 'true');
    setHasSeenConsent(true);
    setShowConsentModal(false);
  };

  // Handle step submission
  const handleSubmit = async () => {
    try {
      // Pass the stepNumber from URL as the step being submitted
      // This ensures we submit the correct step even if backend has stale data
      await submitStep(questionResponses, stepNumber);
      setShowSubmitModal(true);
    } catch (error) {
      console.error('Failed to submit step:', error);
      alert('Failed to submit. Please try again.');
    }
  };

  // Handle continuing to next activity
  const handleContinue = () => {
    console.log('🚀 handleContinue called:', {
      currentStep,
      stepNumber,
      slug,
      piece,
      actCategory,
      partType,
      email
    });

    setShowSubmitModal(false);

    if (currentStep <= 4) {
      // Navigate to next activity, preserving email parameter
      const nextUrl = `/courses/${slug}/${piece}/${actCategory}/${partType}/activity/${currentStep}`;
      console.log('📍 Navigating to:', nextUrl);
      router.push(email ? `${nextUrl}?email=${encodeURIComponent(email)}` : nextUrl);
    } else {
      // All activities complete - redirect to Qualtrics Survey 2
      console.log('✅ All activities complete, redirecting to survey');
      if (email) {
        // Redirect to Qualtrics with email parameter
        window.location.href = `${SURVEY_2_URL}?email=${encodeURIComponent(email)}`;
      } else {
        // No email provided, navigate back to assignment page
        router.push(`/courses/${slug}/${piece}/${actCategory}/${partType}`);
      }
    }
  };

  // Handle keep editing
  const handleKeepEditing = () => {
    setShowSubmitModal(false);
  };

  // Get activity configuration
  const activityConfig = getActivityConfig(stepNumber);
  const stepKey = String(stepNumber);
  const completedOps = stepCompletions[stepKey] || [];

  // Debug: Log what operations are actually completed
  console.log('🔍 Activity Page Debug:', {
    stepNumber,
    stepKey,
    stepCompletions,
    completedOps,
    completedOpsLength: completedOps.length,
    completedOpsArray: [...completedOps] // Expand the array to see actual values
  });

  // Pre-populate bassline for Activity 3
  const initialTracks = stepNumber === 3 ? [{
    name: 'Air for Band - Bassline',
    type: 'audio',
    audioURL: '/media/sample_audio/Air_for_Band_Bass_Line.mp3',
    volume: 1,
    pan: 0,
    muted: false,
    color: '#4a9eff',
    clips: [{
      id: `clip-bassline-${Date.now()}`,
      start: 0,
      duration: 0, // Will be set when audio loads
      color: '#4a9eff',
      src: '/media/sample_audio/Air_for_Band_Bass_Line.mp3',
      offset: 0,
      name: 'Air for Band - Bassline',
    }],
  }] : [];

  if (isLoading) {
    return (
      <StudentAssignment assignment={assignment}>
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </StudentAssignment>
    );
  }

  return (
    <StudentAssignment assignment={assignment}>
      <DAWProvider
        initialTracks={initialTracks}
        persistenceConfig={audioPersistenceConfig}
      >
        {/* Consent Modal */}
        <ConsentReminderModal
          show={showConsentModal}
          onAccept={handleConsentAccept}
        />

        {/* Submit Success Modal */}
        <ActivitySubmitModal
          show={showSubmitModal}
          onKeepEditing={handleKeepEditing}
          onContinue={handleContinue}
          currentStep={stepNumber}
          isLastStep={currentStep > 4}
        />

        {/* Main Activity Layout */}
        <ActivityLayout
          step={stepNumber}
          instructions={activityConfig.instructions}
          questions={activityConfig.questions}
          questionResponses={questionResponses}
          completedOperations={completedOps}
          canSubmit={canSubmit && !!assignment?.id}
          progress={progress}
          isSubmitting={isSubmitting}
          onResponseChange={saveResponse}
          onSubmit={handleSubmit}
        >
          {/* Sheet Music (Activities 1-2) */}
          {(stepNumber === 1 || stepNumber === 2) && parsedScore && (
            <div className="mb-4">
              <h3>Your Part</h3>
              <FlatEditor score={parsedScore} />
              {preferredSample && (
                <dl className="mb-0 mt-3">
                  <dt>Sample Recording</dt>
                  <dd className="mb-0">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={preferredSample} />
                  </dd>
                </dl>
              )}
            </div>
          )}

          {/* Recording Interface with DAW (Activities 1-2) */}
          {(stepNumber === 1 || stepNumber === 2) && (
            <Recorder
              accompaniment={assignment?.part?.piece?.accompaniment}
              submit={null} // No submission from recorder in study mode
              logOperation={logOperation}
            />
          )}

          {/* Multitrack DAW (Activities 3-4) */}
          {(stepNumber === 3 || stepNumber === 4) && (
            <DAW
              onSubmit={null} // No submission from DAW itself in study mode
              showSubmitButton={false} // Hide DAW's submit button
              logOperation={logOperation} // Pass operation logger to DAW
              initialTracks={initialTracks} // Pre-populate tracks for Activity 3
            />
          )}
        </ActivityLayout>
      </DAWProvider>
    </StudentAssignment>
  );
}
