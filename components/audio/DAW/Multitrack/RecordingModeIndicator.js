'use client';

import { useMultitrack } from '../../../../contexts/DAWProvider';
import { FaCrosshairs } from 'react-icons/fa';
import styles from './RecordingModeIndicator.module.css';

/**
 * Visual indicator for recording mode and position
 */
export default function RecordingModeIndicator() {
  const { selectedTrackId, tracks, cursorPosition } = useMultitrack();

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  if (!selectedTrack) {
    return (
      <div className={styles.indicator}>
        <span className={styles.noTrack}>No track selected</span>
      </div>
    );
  }

  return (
    <div className={styles.indicator}>
      <FaCrosshairs className={styles.icon} />
      <div className={styles.info}>
        <div className={styles.trackName}>{selectedTrack.name}</div>
        <div className={styles.position}>@ {cursorPosition.toFixed(1)}s</div>
      </div>
    </div>
  );
}
