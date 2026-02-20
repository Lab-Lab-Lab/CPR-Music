'use client';

import { FaPlus } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/DAWProvider';
import styles from './AddTrackButton.module.css';

/**
 * Large button for adding new blank tracks
 */
export default function AddTrackButton() {
  const { addTrack } = useMultitrack();

  const handleAddTrack = () => {
    const newTrack = addTrack();
    console.log('Added new blank track:', newTrack.name);
  };

  return (
    <div className={styles.addTrackContainer}>
      <button
        className={styles.addTrackButton}
        onClick={handleAddTrack}
        title="Add new track"
      >
        <FaPlus className={styles.plusIcon} />
        <span className={styles.label}>Add Track</span>
      </button>
    </div>
  );
}
