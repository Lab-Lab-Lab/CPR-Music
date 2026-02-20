/**
 * ActivitySubmitButton
 *
 * Submit button that shows locked/unlocked state based on activity completion
 */

import { Button } from 'react-bootstrap';
import { FaLock, FaUnlock, FaSpinner } from 'react-icons/fa';

export default function ActivitySubmitButton({
  canSubmit,
  progress,
  isSubmitting,
  onClick,
  children = "Submit and Continue"
}) {
  return (
    <div className="d-flex flex-column align-items-center gap-2">
      {/* Progress indicator */}
      {!canSubmit && (
        <div className="text-muted small">
          <div className="mb-1">Complete all required operations to unlock submission</div>
          <div className="progress" style={{ height: '4px', width: '200px' }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
          <div className="text-center mt-1">{progress}% complete</div>
        </div>
      )}

      {/* Submit button */}
      <Button
        variant={canSubmit ? "primary" : "secondary"}
        size="lg"
        disabled={!canSubmit || isSubmitting}
        onClick={onClick}
        className="d-flex align-items-center gap-2"
      >
        {isSubmitting ? (
          <>
            <FaSpinner className="spinner-border spinner-border-sm" />
            <span>Submitting...</span>
          </>
        ) : (
          <>
            {canSubmit ? <FaUnlock /> : <FaLock />}
            <span>{children}</span>
          </>
        )}
      </Button>

      {canSubmit && (
        <div className="text-success small">
          ✓ All required operations completed!
        </div>
      )}
    </div>
  );
}
