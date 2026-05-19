import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { FaBook, FaDrum, FaGuitar, FaLink, FaPenFancy } from 'react-icons/fa';
import ListGroup from 'react-bootstrap/ListGroup';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { Accordion } from 'react-bootstrap';
import Layout from '../layout';
import Instructions from './instructions';
import { getMySubmissionsForAssignment } from '../../api';
import RecentSubmission from './recentSubmission';

export default function StudentAssignment({ children, assignment }) {
  const router = useRouter();

  const { slug, piece, actCategory = 'Create', partType } = router.query;

  const {
    isLoading,
    isIdle,
    error,
    data: submissions,
  } = useQuery(
    ['submissions', slug, assignment?.id],
    () => getMySubmissionsForAssignment({ slug, assignmentId: assignment?.id }),
    {
      enabled: !!assignment && !!slug && !!assignment.id,
    },
  );

  // const
  const composer = assignment?.part?.piece?.composer?.name;
  const composerCheat = composer?.split(' ').pop();
  const connectLink = `Connect ${composerCheat}`;
  const hasCompose = ['Benjamin', 'Danyew', 'Green'].includes(composerCheat);

  const pieceName = assignment?.piece_name ?? assignment?.part?.piece?.name;

  return (
    <Layout>
      {assignment && assignment?.id && pieceName ? (
        <Row>
          {/* piece subnav (navigate to next/other activity, else?) */}
          {/* moved to navbar */}
          <Col>
            <h1>
              {(actCategory === 'Perform' || actCategory === 'Create') &&
                `${actCategory} `}
              {assignment?.activity?.activity_type?.name} Activity
            </h1>
            <Instructions
              body={assignment?.activity_body ?? assignment?.activity?.body}
            />
            {assignment.submissions.length > 0 ? (
              <Accordion defaultActiveKey="0" alwaysOpen className="cpr-create">
                <Accordion.Item eventKey="0">
                  <Accordion.Header>Current Submission</Accordion.Header>
                  <Accordion.Body>
                    <RecentSubmission assn={assignment} />
                  </Accordion.Body>
                </Accordion.Item>
                {/* tasks */}
                <Accordion.Item eventKey="1">
                  <Accordion.Header>Submit Again?</Accordion.Header>
                  <Accordion.Body>{children}</Accordion.Body>
                </Accordion.Item>
              </Accordion>
            ) : (
              children
            )}
          </Col>
        </Row>
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
      )}
    </Layout>
  );
}
