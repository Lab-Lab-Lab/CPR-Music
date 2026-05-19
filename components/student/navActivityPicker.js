import { useRouter } from 'next/router';
import { Form, ListGroup, Nav, Spinner } from 'react-bootstrap';
import { useQuery } from 'react-query';
import { getStudentAssignments } from '../../api';

// FIXME: probably should not need this function at all, this info should probably have come from the backend?
function assnToKey(assignment, debugStr = '') {
  if (assignment.activity_type_category.startsWith('Perform')) {
    // for Perform or PerformPost activities, need also Melody or Bassline
    return `${assignment.activity_type_category}/${assignment.activity_type_name}`;
  }
  if (assignment.activity_type_category === 'Create') {
    // for Create activities, need to know which experience?
    if (
      assignment.activity_type_name === 'Aural' ||
      assignment.activity_type_name === 'Creativity'
    ) {
      return 'Create';
    }
    return `${assignment.activity_type_category}/${assignment.activity_type_name.toLowerCase()}`;
  }
  if (assignment.activity_type_category.startsWith('Connect')) {
    return 'Connect';
  }
  return assignment.activity_type_category;
}

// Full category/name path, used for grade routes which always need both segments
function assnToGradeKey(assignment) {
  const category = assignment.activity_type_category.startsWith('Connect')
    ? 'Connect'
    : assignment.activity_type_category.startsWith('Perform')
      ? 'Perform'
      : assignment.activity_type_category;
  return `${category}/${assignment.activity_type_name}`;
}

// FIXME: probably should not need this function at all, this info should probably have come from the backend?
function assnToContent(assignment) {
  let assnTypeCat = assignment.activity_type_category;
  if (assnTypeCat.startsWith('Perform') || assnTypeCat.startsWith('Connect')) {
    assnTypeCat = assnTypeCat.substring(0, 'Perform'.length);
  }

  const contentByType = {
    Perform: `${assignment.activity_type_name}`,
    Create: `Create - ${assignment.activity_type_name}`,
    Respond: `${assignment.activity_type_name}`,
    Connect: `${assnTypeCat}`,
  };

  return contentByType[assnTypeCat];
}

function NavActivityPicker(assignment) {
  const router = useRouter();

  const { slug, piece, actCategory = 'Create' } = router.query;

  const currentActivity = actCategory;
  const isGrading = router.asPath.endsWith('/grade');
  const currentRouteSuffix = router.asPath.substring(
    `/courses/${slug}/${piece}/`.length,
  ).replace(/\/grade$/, '');

  const changeActivity = (ev) => {
    const value = ev.target.value;
    const suffix = isGrading ? `${value}/grade` : value;
    router.push(`/courses/${slug}/${piece}/${suffix}`);
  };

  const {
    isLoading,
    error: assignmentsError,
    data: assignments,
  } = useQuery(['assignments', slug], getStudentAssignments(slug), {
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  // const
  const composer = assignment?.part?.piece?.composer?.name;
  const composerCheat = composer?.split(' ').pop();
  const connectLink = `Connect ${composerCheat}`;
  const pieceAssignments = assignments?.[piece];

  if (!pieceAssignments && isLoading) {
    return (
      <Nav.Item>
        <Spinner
          as="span"
          animation="border"
          size="sm"
          role="status"
          aria-hidden="true"
          variant="light"
        >
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Nav.Item>
    );
  }

  return pieceAssignments ? (
    <Nav.Item>
      <Form>
        <Form.Select
          onChange={changeActivity}
          defaultValue={currentRouteSuffix}
        >
          <option value="">Choose an activity</option>
          {pieceAssignments
            .filter((assn, i, arr) => {
              const keyFn = isGrading ? assnToGradeKey : assnToKey;
              return arr.findIndex((a) => keyFn(a) === keyFn(assn)) === i;
            })
            .map((assn) => {
              const value = isGrading ? assnToGradeKey(assn) : assnToKey(assn);
              return (
                <option key={value} value={value}>
                  {assnToContent(assn)}
                </option>
              );
            })}
        </Form.Select>
      </Form>
    </Nav.Item>
  ) : null;
}

export { NavActivityPicker, assnToKey, assnToContent };
