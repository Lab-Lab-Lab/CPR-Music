/**
 * Test component for Activity Logger - Phase 1 verification
 * This component is for testing purposes only and can be removed once logging is fully integrated
 */

'use client';

import { useEffect, useState } from 'react';
import { useAudio } from '../../../contexts/DAWProvider';
import { Button, Card, Badge } from 'react-bootstrap';

export default function ActivityLoggerTest({ show = false }) {
  const { activityLogger, dawMode, setDawMode } = useAudio();
  const [stats, setStats] = useState(null);
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    if (activityLogger && show) {
      // Update stats every second
      const interval = setInterval(() => {
        const currentStats = activityLogger.getStats();
        setStats(currentStats);
        // Sync isLogging state with activityLogger's state
        setIsLogging(currentStats.isActive);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activityLogger, show]);

  if (!show || !activityLogger) {
    return null;
  }

  const handleStartLogging = () => {
    if (activityLogger && !isLogging) {
      activityLogger.startSession({
        assignmentId: 'test-assignment',
        userId: 'test-user',
        courseId: 'test-course'
      });
      setIsLogging(true);
      console.log('📊 Test: Started logging session');
    }
  };

  const handleStopLogging = () => {
    if (activityLogger && isLogging) {
      activityLogger.endSession();
      setIsLogging(false);
      console.log('📊 Test: Stopped logging session');
    }
  };

  const handleTestEvent = () => {
    if (activityLogger && isLogging) {
      activityLogger.logEvent('test_event', {
        message: 'Test event from test component',
        timestamp: Date.now()
      });
      console.log('📊 Test: Logged test event');
    }
  };

  const handleExportLog = () => {
    if (activityLogger) {
      const logData = activityLogger.toJSON();
      console.log('📊 Activity Log Export:', logData);
      alert('Log exported to console - check browser console');
    }
  };

  const handleTestModeSwitch = (mode) => {
    setDawMode(mode);
    console.log('📊 Test: Switched to mode:', mode);
  };

  return (
    <Card className="mt-2 mb-2" style={{ backgroundColor: '#f8f9fa', border: '2px dashed #dee2e6' }}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">
            🧪 Activity Logger Test Panel
            {isLogging && <Badge bg="success" className="ms-2">ACTIVE</Badge>}
          </h6>
        </div>

        {stats && (
          <div className="mb-3" style={{ fontSize: '0.9rem' }}>
            <div>Session ID: <code>{stats.sessionId}</code></div>
            <div>Status: {stats.isActive ? '🟢 Active' : '⚪ Inactive'}</div>
            <div>Current Mode: {stats.currentMode || 'None'}</div>
            <div>Events Logged: {stats.eventCount}</div>
            <div>Duration: {stats.duration}s</div>
            <div>Modes Used: {stats.modesUsed.join(', ') || 'None'}</div>
          </div>
        )}

        <div className="d-flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={isLogging ? 'danger' : 'success'}
            onClick={isLogging ? handleStopLogging : handleStartLogging}
          >
            {isLogging ? 'Stop Logging' : 'Start Logging'}
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleTestEvent}
            disabled={!isLogging}
          >
            Log Test Event
          </Button>

          <Button
            size="sm"
            variant="info"
            onClick={handleExportLog}
          >
            Export Log
          </Button>

          {/* Mode switch test buttons */}
          <div className="d-flex gap-1">
            <Button
              size="sm"
              variant={dawMode === 'single' ? 'warning' : 'outline-warning'}
              onClick={() => handleTestModeSwitch('single')}
              disabled={!isLogging}
            >
              Single
            </Button>
            <Button
              size="sm"
              variant={dawMode === 'multi' ? 'warning' : 'outline-warning'}
              onClick={() => handleTestModeSwitch('multi')}
              disabled={!isLogging}
            >
              Multi
            </Button>
          </div>
        </div>

        <div className="mt-2">
          <small className="text-muted">
            This panel is for testing the activity logger.
            Remove show prop or set to false to hide.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
}