import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { useMutation, useQuery } from 'react-query';
import { Button, ListGroup, Spinner } from 'react-bootstrap';
import { FaCheckCircle, FaRegCircle } from 'react-icons/fa';
import Layout from '../components/layout';
import { getDueSurveys, getOnboarding, mutateFinishOnboarding } from '../api';
import { gotMyProfile } from '../actions';

function Step({ done, title, children }) {
  return (
    <ListGroup.Item className="d-flex gap-3 py-3">
      {done ? (
        <FaCheckCircle className="text-success mt-1 flex-shrink-0" size={20} />
      ) : (
        <FaRegCircle className="text-secondary mt-1 flex-shrink-0" size={20} />
      )}
      <div>
        <h2 className="h5 mb-1">{title}</h2>
        {children}
      </div>
    </ListGroup.Item>
  );
}

// First-time setup checklist for new teachers. Course pages stay locked (see
// components/layout.js) until they create a course and add students; surveys
// are listed here but never required.
export default function Onboarding() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: progress, isLoading } = useQuery('onboarding', getOnboarding);
  const { data: surveys = [] } = useQuery('dueSurveys', getDueSurveys);

  const finish = useMutation(mutateFinishOnboarding, {
    onSuccess: (data) => {
      dispatch(gotMyProfile({ onboarded_at: data.onboarded_at }));
      router.push('/courses');
    },
  });

  if (isLoading || !progress) {
    return (
      <Layout>
        <Spinner animation="border" size="sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Layout>
    );
  }

  const { course } = progress;
  return (
    <Layout>
      <h1>Welcome to MusicCPR</h1>
      <p className="lead">A few steps to get your class ready.</p>

      <ListGroup className="mb-4" style={{ maxWidth: '48rem' }}>
        <Step done={surveys.length === 0} title="Research surveys">
          {surveys.length === 0 ? (
            <p className="mb-0 text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="mb-0 ps-3">
              {surveys.map((survey) => (
                <li key={survey.id} className="mb-1">
                  {survey.title}{' '}
                  <Button href={survey.url} size="sm" className="ms-1">
                    Take survey
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Step>

        <Step done={!!course} title="Create your course">
          {course ? (
            <p className="mb-0">
              {course.name} —{' '}
              <Link href={`/courses/${course.slug}/edit`}>edit details</Link>
            </p>
          ) : (
            <Link href="/courses/new" passHref legacyBehavior>
              <Button size="sm">Create a course</Button>
            </Link>
          )}
        </Step>

        <Step done={progress.student_count > 0} title="Add your students">
          {!course && <p className="mb-0 text-muted">Create a course first.</p>}
          {course && progress.student_count > 0 && (
            <p className="mb-0">
              {progress.student_count} student
              {progress.student_count === 1 ? '' : 's'} enrolled —{' '}
              <Link href={`/courses/${course.slug}/edit`}>manage roster</Link>
            </p>
          )}
          {course && progress.student_count === 0 && (
            <Link href={`/courses/${course.slug}/edit`} passHref legacyBehavior>
              <Button size="sm">Upload your roster</Button>
            </Link>
          )}
        </Step>
      </ListGroup>

      <Button
        variant="success"
        onClick={() => finish.mutate()}
        disabled={finish.isLoading || progress.student_count === 0}
      >
        Finish setup
      </Button>
      {progress.student_count === 0 && (
        <p className="text-muted small mt-2">
          Create your course and add your students to finish setup.
        </p>
      )}
    </Layout>
  );
}
