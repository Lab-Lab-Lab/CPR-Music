import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import Spinner from 'react-bootstrap/Spinner';
import AddEditCourse from '../../../components/forms/addEditCourse';
// import AddEditStudent from '../../../components/forms/addEditStudent';
import UploadStudents from '../../../components/forms/uploadStudents';
import StudentsWithInstruments from '../../../components/teacher/addStudentWithInstruments';
import Layout from '../../../components/layout';
import { getEnrollments } from '../../../api';

export default function EditCourse() {
  const router = useRouter();
  const { slug } = router.query;

  const {
    isLoading,
    error,
    data: enrollments,
  } = useQuery('enrollments', getEnrollments, { staleTime: 5 * 60 * 1000 });
  const currentEnrollment =
    Array.isArray(enrollments) && enrollments.filter((elem) => elem.course.slug === slug)[0];

  return isLoading ? (
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
  ) : (
    <Layout>
      <h1>Edit {currentEnrollment?.course?.name}</h1>
      <AddEditCourse />
      {/* <AddEditStudent /> */}
      <UploadStudents />

      <StudentsWithInstruments />
    </Layout>
  );
}
