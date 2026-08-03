import { useQuery } from 'react-query';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Link from 'next/link';
import { FaMarker } from 'react-icons/fa';
import { getRecentSubmissions } from '../../api';

function submissionBg(total, studentCount) {
  if (total === studentCount) return 'success';
  if (total > 0) return 'warning';
  return 'secondary';
}

export default function ActivityStats({ slug, piece, activity, studentCount }) {
  const { category, name } = activity;
  const {
    isLoading,
    error,
    data: submissions,
  } = useQuery(
    ['submissionStats', slug, piece, name],
    getRecentSubmissions({ slug, piece, partType: name }),
    { enabled: !!slug && !!piece && !!name, staleTime: 60 * 1000 },
  );

  const totalSubmissions = submissions?.length ?? 0;
  const gradedCount = submissions
    ? submissions.filter(
        (s) =>
          s.grade && (s.grade.rhythm || s.grade.tone || s.grade.expression),
      ).length
    : 0;
  const ungradedCount = totalSubmissions - gradedCount;
  const notSubmitted = studentCount - totalSubmissions;

  const renderSubmitted = () => {
    if (isLoading) {
      return <Spinner animation="border" size="sm" variant="primary" />;
    }
    if (error) {
      return <span className="text-danger">err</span>;
    }
    return (
      <>
        <Badge
          bg={submissionBg(totalSubmissions, studentCount)}
          className="me-1"
        >
          {totalSubmissions} / {studentCount}
        </Badge>
        {notSubmitted > 0 && (
          <small className="text-muted">{notSubmitted} missing</small>
        )}
      </>
    );
  };

  const renderGraded = () => {
    if (isLoading) {
      return <Spinner animation="border" size="sm" variant="primary" />;
    }
    if (error) {
      return <span className="text-danger">err</span>;
    }
    if (totalSubmissions === 0) {
      return <span className="text-muted">-</span>;
    }
    return (
      <>
        <Badge bg={ungradedCount === 0 ? 'success' : 'danger'} className="me-1">
          {gradedCount} / {totalSubmissions}
        </Badge>
        {ungradedCount > 0 && (
          <small className="text-muted">{ungradedCount} ungraded</small>
        )}
      </>
    );
  };

  return (
    <tr>
      <td>
        <strong>{category}</strong> {name}
      </td>
      <td className="text-center">{renderSubmitted()}</td>
      <td className="text-center">{renderGraded()}</td>
      <td className="text-end">
        <Link
          href={`/courses/${slug}/${piece}/${category}/${name}/grade`}
          passHref
          legacyBehavior
        >
          <a className="btn btn-sm btn-outline-primary">
            Grade <FaMarker />
          </a>
        </Link>
      </td>
    </tr>
  );
}
