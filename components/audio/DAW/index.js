// components/audio/DAW/index.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
  Button,
  ButtonGroup,
} from 'react-bootstrap';
import {
  useAudio,
  useEffects,
  useFFmpeg,
  useUI,
  useRecording,
  useMultitrack,
} from '../../../contexts/DAWProvider';
import CustomWaveform from './CustomWaveform';
import EffectsModal from './Effects/EffectsModal';
import EffectControlModal from './Effects/EffectControlModal';
import HelpModal from '../daw-old/dawHelp';
import MultitrackWithTakes from './Multitrack/MultitrackWithTakes';
import RecordingModal from '../RecordingModal';
import RecordingWithTakesModal from '../RecordingWithTakesModal';
import { GrHelpBook } from 'react-icons/gr';
import { PiWarningDuotone } from 'react-icons/pi';
import { MdLayers, MdLayersClear } from 'react-icons/md';
import { FaMicrophone } from 'react-icons/fa';
import { Badge } from 'react-bootstrap';

export default function DAW({
  onSubmit,
  showSubmitButton = false,
  silenceWarning = false,
  logOperation = null, // For study protocol tracking
  initialTracks = [], // Pre-populated tracks for specific activities
}) {
  const { audioURL, dawMode, setDawMode, activityLogger } = useAudio();
  const { loadFFmpeg, loaded: ffmpegLoaded } = useFFmpeg();
  const { showDAW, showHelp, setShowHelp, mapPresent, useEffectsRack } =
    useUI();
  const { blobInfo } = useRecording();
  const { tracks, selectedTrackId } = useMultitrack();

  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showTakesModal, setShowTakesModal] = useState(false);

  // Always use custom waveform - WaveSurfer is deprecated
  const useCustomWaveform = true;

  // Initialize FFmpeg and activity logger when component mounts
  useEffect(() => {
    if (!ffmpegLoaded) {
      loadFFmpeg();
    }

    // Start activity logging session when DAW is first shown
    try {
      if (activityLogger && !activityLogger.isActive) {
        activityLogger.startSession({
          // These will be populated from context in production
          assignmentId: 'unknown',
          userId: 'unknown',
          courseId: 'unknown'
        });
        // Set initial mode
        activityLogger.switchMode(dawMode);
        console.log('📊 Activity logging started with initial mode:', dawMode);
      }
    } catch (error) {
      console.error('📊 Error starting activity logger:', error);
    }
  }, [ffmpegLoaded, loadFFmpeg, activityLogger, dawMode]);

  // Handle switching to single track mode
  const handleSwitchToSingleTrack = useCallback(() => {
    // If no audio URL exists or it's empty, show recording modal
    if (!audioURL || audioURL === '') {
      setShowRecordingModal(true);
    } else {
      setDawMode('single');
    }
  }, [audioURL, setDawMode]);

  // Handle recording completion
  const handleRecordingComplete = useCallback((recordedAudioURL) => {
    setShowRecordingModal(false);
    setDawMode('single');
  }, [setDawMode]);

  if (!showDAW) return null;

  // For multitrack mode
  if (dawMode === 'multi') {
    // Get the selected track
    const selectedTrack = tracks.find(t => t.id === selectedTrackId);
    const hasValidAudio = selectedTrack && selectedTrack.audioURL;

    return (
      <>
        <Card className="mt-2 mb-2" id="daw-card">
          <CardHeader className="pt-1 pb-1 flex-between dawHeaderFooter align-items-center">
            <div className="d-flex align-items-center gap-2">
              <CardTitle className="pt-0 pb-0 mt-0 mb-0">
                Multitrack Editor
              </CardTitle>

              {/* Mode switcher */}
              <ButtonGroup size="sm">
                <Button
                  variant="secondary"
                  onClick={handleSwitchToSingleTrack}
                  title="Single track mode"
                >
                  <MdLayersClear fontSize="1rem" />
                </Button>
                <Button variant="primary" disabled title="Multitrack mode">
                  <MdLayers fontSize="1rem" />
                </Button>
              </ButtonGroup>
            </div>
          </CardHeader>

          <CardBody style={{ backgroundColor: '#2d2c29' }}>
            <MultitrackWithTakes logOperation={logOperation} />
          </CardBody>

          {showSubmitButton && (
            <CardFooter className="dawHeaderFooter">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                  {selectedTrack
                    ? `Selected track: ${selectedTrack.name}`
                    : 'Select a track to submit'}
                </span>
                <Button
                  variant={hasValidAudio ? 'primary' : 'secondary'}
                  disabled={!hasValidAudio}
                  onClick={() => {
                    if (onSubmit && hasValidAudio) {
                      // Generate activity log summary
                      let activityLogData = null;
                      try {
                        if (activityLogger && activityLogger.isActive) {
                          // End the session before generating the log
                          activityLogger.endSession();
                          console.log('📊 Activity session ended');

                          // Generate the final log
                          activityLogData = activityLogger.toCompressedString();
                          console.log('📊 Activity log generated for multitrack submission');

                          // Reset the logger for next session to prevent data contamination
                          activityLogger.reset();
                          console.log('📊 Activity logger reset for next session');
                        }
                      } catch (error) {
                        console.error('📊 Error generating activity log:', error);
                      }

                      // Pass the selected track's audio URL and activity log
                      console.log(`🎵 Submitting audio from track: ${selectedTrack.name}`);
                      onSubmit(selectedTrack.audioURL, activityLogData);
                    }
                  }}
                  title={!hasValidAudio ? "Select a track with audio to submit" : "Submit selected track"}
                >
                  Submit {selectedTrack && `"${selectedTrack.name}"`} {silenceWarning && <PiWarningDuotone />}
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>

        {/* Recording Modal - needed in multitrack mode too */}
        <RecordingModal
          show={showRecordingModal}
          onHide={() => setShowRecordingModal(false)}
          onRecordingComplete={handleRecordingComplete}
        />
      </>
    );
  }

  // Single track mode (existing functionality)
  return (
    <>
      <HelpModal setFn={setShowHelp} shown={showHelp} />

      <Card className="mt-2 mb-2" id="daw-card">
        <CardHeader className="pt-1 pb-1 flex-between dawHeaderFooter align-items-center">
          <div className="d-flex align-items-center gap-2">
            <CardTitle className="pt-0 pb-0 mt-0 mb-0">Audio Editor</CardTitle>

            {/* Mode switcher */}
            <ButtonGroup size="sm">
              <Button variant="primary" disabled title="Single track mode">
                <MdLayersClear fontSize="1rem" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDawMode('multi')}
                title="Multitrack mode"
              >
                <MdLayers fontSize="1rem" />
              </Button>
            </ButtonGroup>

            {/* Recording/Takes Button */}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowTakesModal(true)}
              className="position-relative"
              title="Recording & Takes"
            >
              <FaMicrophone fontSize="1rem" style={{ color: 'white' }} />
              {blobInfo && blobInfo.length > 0 && (
                <Badge
                  bg="secondary"
                  pill
                  className="position-absolute"
                  style={{ top: '-5px', right: '-5px', fontSize: '0.7rem' }}
                >
                  {blobInfo.length}
                </Badge>
              )}
            </Button>
          </div>

          <Button
            className="help-button daw-help align-center"
            onClick={() => setShowHelp(true)}
          >
            <GrHelpBook className="help-ico" fontSize="1.5rem" />
          </Button>
        </CardHeader>

        <CardBody style={{ background: 'lightsteelblue' }}>
          {/* Main waveform area - full width */}
          <div id="waveform-container" style={{ width: '100%' }}>
            <CustomWaveform logOperation={logOperation} />
          </div>
        </CardBody>

        {showSubmitButton && (
          <CardFooter className="dawHeaderFooter">
            <Button
              style={{ float: 'right' }}
              onClick={() => {
                if (onSubmit) {
                  // Generate activity log summary
                  let activityLogData = null;
                  try {
                    if (activityLogger && activityLogger.isActive) {
                      // End the session before generating the log
                      activityLogger.endSession();
                      console.log('📊 Activity session ended');

                      // Generate the final log
                      activityLogData = activityLogger.toCompressedString();
                      console.log('📊 Activity log generated for submission');

                      // Reset the logger for next session to prevent data contamination
                      activityLogger.reset();
                      console.log('📊 Activity logger reset for next session');
                    }
                  } catch (error) {
                    console.error('📊 Error generating activity log:', error);
                  }

                  // Pass both audio URL and activity log
                  onSubmit(audioURL, activityLogData);
                }
              }}
            >
              Submit {silenceWarning && <PiWarningDuotone />}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Effects Modals */}
      <EffectsModal />
      <EffectControlModal />

      {/* Recording Modal for first-time recording */}
      <RecordingModal
        show={showRecordingModal}
        onHide={() => setShowRecordingModal(false)}
        onRecordingComplete={handleRecordingComplete}
      />

      {/* Takes Management Modal for single track mode */}
      <RecordingWithTakesModal
        show={showTakesModal}
        onHide={() => setShowTakesModal(false)}
      />
    </>
  );
}
