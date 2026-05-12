import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { mutateGradeSubmission } from '../../../api';
import { beginUpload, uploadFailed, uploadSucceeded } from '../../../actions';
import StatusIndicator from '../../statusIndicator';

export default function RTE({ submission, submitAction, autoFocus = false, teacher = false }) {
  const router = useRouter();
  const userInfo = useSelector((state) => state.currentUser);
  const { slug } = router.query;
  const [isFormFocused, setFormFocus] = useState(false);
  const [rhythm, setRhythm] = useState(submission?.grade?.rhythm ?? '');
  const [tone, setTone] = useState(submission?.grade?.tone ?? '');
  const [expression, setExpression] = useState(
    submission?.grade?.expression ?? '',
  );
  const audioRef = useRef();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const gradeMutation = useMutation(mutateGradeSubmission(slug), {
    onMutate: async (newGrade) => {
      dispatch(beginUpload(`grade-${submission.id}`));
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries('gradeableSubmissions');
      // Snapshot the previous value
      const previousSubmissions = queryClient.getQueryData(
        'gradeableSubmissions',
      );
      // Optimistically update to the new value
      queryClient.setQueryData('gradeableSubmissions', (old) => {
        if (old) {
          return [
            ...old.map((sub) =>
              sub.id === newGrade.sub
                ? { ...sub, grades: [...sub.grades, newGrade] }
                : sub,
            ),
          ];
        }
        return [];
      });
      // Return a context object with the snapshotted value
      return { previousSubmissions };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, newGrade, context) => {
      dispatch(uploadFailed(`grade-${submission.id}`));
      queryClient.setQueryData(
        'gradeableSubmissions',
        context.previousSubmissions,
      );
    },
    onSuccess: () => {
      dispatch(uploadSucceeded(`grade-${submission.id}`));
    },
    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries('gradeableSubmissions');
    },
  });
  const grade = ({ sub, r, t, e, grader }) =>
    gradeMutation.mutate({
      studentSubmission: sub,
      rhythm: r,
      tone: t,
      expression: e,
      grader,
    });

  return (
    <Form
      onSubmit={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!submitAction) {
          grade({
            sub: submission.id,
            r: rhythm,
            t: tone,
            e: expression,
            grader: userInfo.id,
          });
        } else {
          submitAction({
            r: rhythm,
            t: tone,
            e: expression,
            grader: userInfo.id,
          });
        }
      }}
    >
      <dl>
        <dt>Rhythym</dt>
        {teacher && <div><dd>(continuous rating scale). Mark the highest level of achievement the student reached:</dd>
          <dd>
            <ol>
              <li>Tempo was inconsistent; student did not perform with a clear sense of meter.</li>
              <li>Student was sometimes able to maintain a consistent tempo and sense of meter.</li>
              <li>Student's tempo was consistent and they performed with a sense of meter, but not all of their rhythms were accurate.</li>
              <li>Except for a few missed rhythms, student's performance was nearly accurate.</li>
              <li>Student's performance was accurate with consistent tempo, sense of meter, and accurate rhythms.</li>
            </ol>
          </dd></div>}
        <dd><Form.Group className="mb-3" controlId="Rhythm">

          <FloatingLabel
            controlId="floatingInput"
            label="Rhythm"
            className="mb-3"
          >
            <Form.Control
              type="number"
              defaultValue={rhythm}
              onChange={(ev) => {
                setRhythm(ev.target.value);
              }}
              placeholder="1"
              min={1}
              max={5}
              autoFocus={autoFocus}
              onFocus={() => setFormFocus(true)}
              onBlur={() => setFormFocus(false)}
            />
          </FloatingLabel>
        </Form.Group></dd>
        <dt>Tonality</dt>
        {teacher && <div><dd>(continuous rating scale). Mark the highest level of achievement the student reached:</dd>
          <dd><ol>
            <li>Student was unable to start and end on the correct note.</li>
            <li>Student performed with a sense of tonality, but pitches were not centered.</li>
            <li>Student's pitches were mostly centered and their performance of phrase endings was accurate.</li>
            <li>Student's pitches were centered and their overall performance was nearly accurate.</li>
            <li>Student's performance was accurate with a sense of tonality and centered pitches throughout.</li>
          </ol></dd></div>}
        <dd>
          <Form.Group className="mb-3" controlId="Tone">
            <FloatingLabel controlId="floatingInput" label="Tone" className="mb-3">
              <Form.Control
                type="number"
                defaultValue={tone}
                onChange={(ev) => {
                  setTone(ev.target.value);
                }}
                placeholder="1"
                min={1}
                max={5}
                onFocus={() => setFormFocus(true)}
                onBlur={() => setFormFocus(false)}
              />
            </FloatingLabel>
          </Form.Group>
        </dd>
        <dt>Expression</dt>
        {teacher && <div><dd>(additive rating scale). Give the student one point for each skill they achieved.</dd>
          <dd>
            <ol>
              <li>Student performed with accurate articulation.</li>
              <li>Student performed with a sense of phrasing, tension, and release.</li>
              <li>Student performed with characteristic tone quality.</li>
              <li>Student performed with appropriate dynamics.</li>
              <li>Student performed with a sense of movement that can be felt by listeners.</li>
            </ol>
          </dd></div>}
        <dd>
          <Form.Group className="mb-3" controlId="Expression">
            <FloatingLabel
              controlId="floatingInput"
              label="Expression"
              className="mb-3"
            >
              <Form.Control
                type="number"
                defaultValue={expression}
                onChange={(ev) => {
                  setExpression(ev.target.value);
                }}
                placeholder="1"
                min={1}
                max={5}
                onFocus={() => setFormFocus(true)}
                onBlur={() => setFormFocus(false)}
              />
            </FloatingLabel>
          </Form.Group>
        </dd>
      </dl>
      <Button variant="primary" type="submit" className="mb-3">
        Submit
      </Button>{' '}
      <StatusIndicator
        statusId={
          (submitAction ? submission?.id : `grade-${submission.id}`) ??
          'respond'
        }
      />
    </Form>
  );
}
