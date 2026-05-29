import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Spinner from 'react-bootstrap/Spinner';
import Link from 'next/link';
import { Button, Table } from 'react-bootstrap';
import { FaMusic } from 'react-icons/fa';
import { fetchInstruments, fetchRoster } from '../../actions';

function StudentsWithInstruments() {
  const userInfo = useSelector((state) => state.currentUser);
  const { items: instruments, loaded: instrumentsLoaded } = useSelector(
    (state) => state.instruments,
  );
  const roster = useSelector((state) => state.roster);
  const router = useRouter();
  const { slug } = router.query;
  const dispatch = useDispatch();
  useEffect(() => {
    if ('token' in userInfo) {
      if (!instrumentsLoaded) {
        dispatch(fetchInstruments(userInfo.token));
      }
      if (
        (!roster.loaded && slug) ||
        (roster.loaded && slug && slug !== roster.courseSlug)
      ) {
        dispatch(
          fetchRoster({ djangoToken: userInfo.token, courseSlug: slug }),
        );
      }
    }
  }, [dispatch, slug, userInfo]);

  // FIXME the greater than 1 here is a bit of a hack. because the course will already have the teacher enrollment, simply checking for any enrollment is insufficient to hide this section when there are no students

  return roster?.items && Object.values(roster.items).length > 1 ? (
    <div>
      <h2>Current Students</h2>
      {roster?.items && Object.values(roster.items).length && instruments ? (
        <Table striped hover>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Username</th>
              <th>Instrument</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(roster.items)
              .filter((e) => e.role !== 'Teacher')
              .map((enrollment, index) => (
                <tr key={enrollment.id}>
                  <td>{index + 1}</td>
                  <td>{enrollment.user.name}</td>
                  <td>{enrollment.user.username}</td>
                  <td>
                    {enrollment.instrument &&
                    instruments[enrollment.instrument.id]
                      ? instruments[enrollment.instrument.id].name
                      : 'No Instrument Assigned'}
                  </td>
                </tr>
              ))}
          </tbody>
        </Table>
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
      <Link href={`/courses/${slug}/instruments`}>
        <Button className="my-3" variant="primary">
          Set Instrument Assignments <FaMusic />
        </Button>
      </Link>
    </div>
  ) : null;
}

export default StudentsWithInstruments;
