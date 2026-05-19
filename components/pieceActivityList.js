import { ListGroup, ListGroupItem } from 'react-bootstrap';
import Link from 'next/link';
import { FaMarker } from 'react-icons/fa';

export default function PieceActivityList({ slug, piece, activities }) {
  return (
    <ListGroup>
      {activities &&
        Object.values(activities).length > 0 &&
        Object.keys(activities).map((activityKey) => (
          <ListGroupItem
            key={activityKey}
            className="d-flex justify-content-between"
          >
            <span className="me-auto">{`${activities[activityKey].category} ${activities[activityKey].name}`}</span>
            <Link
              href={`/courses/${slug}/${piece}/${activities[activityKey].category}/${activities[activityKey].name}/grade`}
              passHref
              legacyBehavior
            >
              <a className="btn btn-primary">
                Grade <FaMarker />
              </a>
            </Link>
          </ListGroupItem>
        ))}
    </ListGroup>
  );
}
