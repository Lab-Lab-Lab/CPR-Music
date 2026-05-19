import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { getEnrollments } from '../../../../api';
import Layout from '../../../../components/layout';
import { PieceAssignments } from '../../../../components/student/pieceAssignments';

export default function PieceActivities() {
  const router = useRouter();
  const { slug, piece } = router.query;
  const { data: enrollments } = useQuery('enrollments', getEnrollments, {
    staleTime: 5 * 60 * 1000,
  });
  const currentEnrollment =
    enrollments && enrollments.filter((elem) => elem.course.slug === slug)[0];
  const isTeacher = currentEnrollment?.role !== 'Student';

  return (
    <Layout>
      <PieceAssignments piece={piece} isTeacher={isTeacher} />
    </Layout>
  );
}
