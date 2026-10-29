import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { Alert, Button } from 'react-bootstrap';
import { getDueSurveys } from '../api';

const DISMISS_KEY = 'surveyReminderDismissed';

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch (_) {
    return false;
  }
}

// Nags (never blocks) about research surveys that are due. Survey links go to
// Qualtrics in the same tab; Qualtrics redirects back via the backend, which
// records the completion and lands the user on /courses?survey=completed.
export default function SurveyReminder() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(readDismissed);
  const { data: surveys = [] } = useQuery('dueSurveys', getDueSurveys, {
    staleTime: 5 * 60 * 1000,
  });
  const returned = router.query.survey;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch (_) {
      // reminder will just come back on the next page load
    }
    setDismissed(true);
  };

  return (
    <>
      {returned === 'completed' && (
        <Alert variant="success" dismissible>
          Thanks for completing the survey!
        </Alert>
      )}
      {returned === 'invalid' && (
        <Alert variant="warning" dismissible>
          We couldn&apos;t record that survey. If you finished it, let the
          research team know.
        </Alert>
      )}
      {/* /onboarding lists due surveys itself */}
      {!dismissed &&
        surveys.length > 0 &&
        router.pathname !== '/onboarding' && (
          <Alert variant="info">
            <Alert.Heading as="h2" className="h5">
              {surveys.length === 1
                ? 'A research survey is ready for you'
                : `${surveys.length} research surveys are ready for you`}
            </Alert.Heading>
            <ul className="mb-2">
              {surveys.map((survey) => (
                <li key={survey.id} className="mb-1">
                  <strong>{survey.title}</strong>
                  {survey.description && ` — ${survey.description}`}{' '}
                  <Button href={survey.url} size="sm" className="ms-1">
                    Take survey
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="link" size="sm" className="p-0" onClick={dismiss}>
              Remind me later
            </Button>
          </Alert>
        )}
    </>
  );
}
