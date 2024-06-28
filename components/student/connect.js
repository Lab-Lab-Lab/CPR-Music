import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchActivities,
  fetchSingleStudentAssignment,
  postConnect,
} from '../../actions';
import StatusIndicator from '../statusIndicator';

export default function ConnectActivity() {
  const router = useRouter();
  const { slug, piece, actCategory } = router.query;

  const [reflection, setReflection] = useState('');
  const dispatch = useDispatch();
  const userInfo = useSelector((state) => state.currentUser);
  useEffect(() => {
    if (slug && userInfo.token) {
      dispatch(fetchActivities({ slug }));
    }
  }, [slug, userInfo.token]);
  const { items: activities, loaded: loadedActivities } = useSelector(
    (state) => state.activities
  );
  const currentAssignment = useSelector((state) => state.selectedAssignment);
  const assignment =
    loadedActivities &&
    activities &&
    activities?.[piece].filter(
      (assn) =>
        assn.activity_type_category.startsWith(actCategory)
    )?.[0];
  const assignmentId = assignment?.id;
  useEffect(() => {
    if (loadedActivities && assignmentId) {
      dispatch(
        fetchSingleStudentAssignment({
          slug,
          assignmentId,
        })
      );
    }
  }, [slug, loadedActivities, activities]);

  const submitAction = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    dispatch(
      postConnect({
        slug,
        assignmentId,
        response: reflection,
      })
    );
  };

  return (
    <>
      {currentAssignment && currentAssignment?.part?.piece?.video && (
        <iframe
          src={currentAssignment.part.piece.video}
          width="560"
          height="315"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      )}
      <Form id="connect-form" onSubmit={submitAction}>
        <textarea
          name="response"
          id="response"
          rows="10"
          onChange={(e) => {
            setReflection(e.target.value);
          }}
          style={{ width: '100%' }}
        />
        <Button type="submit">Submit</Button> <StatusIndicator statusId={assignmentId ?? 'connect'} />
      </Form>
    </>
  );
}
