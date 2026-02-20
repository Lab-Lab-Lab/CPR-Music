/**
 * Activity Constants for DAW Study Protocol
 *
 * Defines operation types and required completions for each study activity step
 */

// Operation types for tracking (matching backend event types)
export const OPERATION_TYPES = {
  // Activity 1: Selections and Removal
  REGION_SELECTED: 'region_created',
  REGION_DESELECTED: 'region_deselected',
  REGION_DELETED: 'clip_delete',  // Reusing existing event
  UNDO_PERFORMED: 'undo_action',
  REDO_PERFORMED: 'redo_action',
  SILENCE_TRIMMED_START: 'silence_trimmed_start',
  SILENCE_TRIMMED_END: 'silence_trimmed_end',

  // Activity 2: Selections and Retaining
  AUDIO_RESTORED: 'audio_restored',
  SCISSOR_USED: 'clip_cut',  // Reusing existing event
  REGION_RETAINED: 'region_retained',

  // Activity 3: EQ & Mixes
  AUDIO_TRACK_ADDED: 'track_added',
  RECORDING_PERFORMED: 'recording_completed',
  CLIP_DRAGGED: 'clip_move',
  CLIP_COPIED: 'clip_copy',
  CLIP_PASTED: 'clip_paste',
  CLIPS_DELETED: 'clip_delete',
  TAKES_IMPORTED: 'takes_imported',
  MIXDOWN_CREATED: 'mixdown_created',
  SOLO_USED: 'mixing_solo',
  EFFECTS_RACK_TOGGLED: 'effects_rack_toggled',
  EQ_LOADED: 'effect_applied',  // When effectType is 'equalizer'
  EQ_PRESET_APPLIED: 'eq_preset_applied',

  // Activity 4: Effects Playground
  EFFECT_EXPERIMENTED: 'effect_applied',
};

// Required operations for each activity step
export const ACTIVITY_REQUIREMENTS = {
  1: {
    name: 'Selections and Removal',
    required: [
      OPERATION_TYPES.REGION_SELECTED,
      OPERATION_TYPES.REGION_DESELECTED,
      OPERATION_TYPES.REGION_DELETED,
      // Note: silence trimming operations are OR'd - only need one
    ],
    alternateRequired: [
      [OPERATION_TYPES.SILENCE_TRIMMED_START, OPERATION_TYPES.SILENCE_TRIMMED_END]
    ],
    minRequired: 4  // Must complete core operations + one silence trim
  },
  2: {
    name: 'Selections and Retaining',
    required: [
      OPERATION_TYPES.AUDIO_RESTORED,
      OPERATION_TYPES.REGION_SELECTED,
      OPERATION_TYPES.SCISSOR_USED,
      OPERATION_TYPES.REGION_RETAINED,
    ],
    minRequired: 4  // Must complete all
  },
  3: {
    name: 'EQ & Mixes',
    required: [
      OPERATION_TYPES.AUDIO_TRACK_ADDED,
      OPERATION_TYPES.RECORDING_PERFORMED,
      OPERATION_TYPES.CLIP_DRAGGED,
      OPERATION_TYPES.CLIP_COPIED,
      OPERATION_TYPES.CLIP_PASTED,
      OPERATION_TYPES.CLIPS_DELETED,
      OPERATION_TYPES.TAKES_IMPORTED,
      OPERATION_TYPES.MIXDOWN_CREATED,
      OPERATION_TYPES.SOLO_USED,
      OPERATION_TYPES.EFFECTS_RACK_TOGGLED,
      OPERATION_TYPES.EQ_LOADED,
      OPERATION_TYPES.EQ_PRESET_APPLIED,
    ],
    minRequired: 12  // Must complete all
  },
  4: {
    name: 'Effects Playground',
    required: [
      OPERATION_TYPES.EFFECT_EXPERIMENTED,
    ],
    minRequired: 3,  // Must use at least 3 effects
    countMultiple: true  // Count multiple uses of the same operation
  }
};

// Question IDs for each activity
export const ACTIVITY_QUESTIONS = {
  1: {
    Q1: 'waveform_correspondence',
    Q2: 'canvas_sound_comparison',
    Q3: 'waveform_change_observation',
    Q4: 'deletion_improvement',
  },
  2: {
    Q1: 'operation_efficiency',
    Q2: 'user_time_comparison',
    Q3: 'user_ease_comparison',
    Q4: 'result_similarity',
  },
  3: {
    Q1: 'countdown_behavior',
    Q2: 'playhead_gap_prediction',
    Q3: 'mixdown_understanding',
    Q4: 'frequency_graph_relation',
    Q5: 'eq_sound_change',
  },
  4: {
    Q1: 'when_to_use_daw',
    Q2: 'band_orchestra_usage',
    Q3: 'personal_music_usage',
    Q4: 'other_usage',
  }
};

// Helper to check if an activity step is complete
export function isStepComplete(stepNumber, completedOperations, activityLogs = []) {
  const requirements = ACTIVITY_REQUIREMENTS[stepNumber];
  if (!requirements) {
    console.log('❌ isStepComplete: No requirements found for step', stepNumber);
    return false;
  }

  const stepKey = String(stepNumber);
  const completed = completedOperations[stepKey] || [];

  console.log('🔍 isStepComplete check:', {
    stepNumber,
    stepKey,
    completedOperations,
    completed,
    requiredOps: requirements.required,
    minRequired: requirements.minRequired,
  });

  // For activities that count multiple occurrences (like Activity 4)
  if (requirements.countMultiple) {
    // Count occurrences of the required operation in activity logs
    const stepLogs = activityLogs.filter(log => String(log.step) === stepKey);
    const operationCounts = {};

    stepLogs.forEach(log => {
      if (requirements.required.includes(log.operation)) {
        operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
      }
    });

    // Sum all operation counts
    const totalCount = Object.values(operationCounts).reduce((sum, count) => sum + count, 0);
    return totalCount >= requirements.minRequired;
  }

  // Standard check: count unique operations
  const completedCount = requirements.required.filter(op =>
    completed.includes(op)
  ).length;

  // Check alternate requirements (OR logic)
  let alternateCount = 0;
  if (requirements.alternateRequired) {
    requirements.alternateRequired.forEach(alternates => {
      // Check if at least one of the alternate operations is completed
      if (alternates.some(op => completed.includes(op))) {
        alternateCount++;
      }
    });
  }

  const totalCompletedCount = completedCount + alternateCount;
  const isComplete = totalCompletedCount >= requirements.minRequired;

  console.log('🔍 isStepComplete result:', {
    completedCount,
    alternateCount,
    totalCompletedCount,
    minRequired: requirements.minRequired,
    isComplete,
  });

  return isComplete;
}

// Helper to get progress percentage for a step
export function getStepProgress(stepNumber, completedOperations, activityLogs = []) {
  const requirements = ACTIVITY_REQUIREMENTS[stepNumber];
  if (!requirements) return 0;

  const stepKey = String(stepNumber);
  const completed = completedOperations[stepKey] || [];

  // For activities that count multiple occurrences (like Activity 4)
  if (requirements.countMultiple) {
    const stepLogs = activityLogs.filter(log => String(log.step) === stepKey);
    const operationCounts = {};

    stepLogs.forEach(log => {
      if (requirements.required.includes(log.operation)) {
        operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
      }
    });

    const totalCount = Object.values(operationCounts).reduce((sum, count) => sum + count, 0);
    return Math.min(100, Math.round((totalCount / requirements.minRequired) * 100));
  }

  // Standard check: count unique operations
  const completedCount = requirements.required.filter(op =>
    completed.includes(op)
  ).length;

  // Check alternate requirements (OR logic)
  let alternateCount = 0;
  if (requirements.alternateRequired) {
    requirements.alternateRequired.forEach(alternates => {
      // Check if at least one of the alternate operations is completed
      if (alternates.some(op => completed.includes(op))) {
        alternateCount++;
      }
    });
  }

  const totalCompletedCount = completedCount + alternateCount;
  return Math.round((totalCompletedCount / requirements.minRequired) * 100);
}

// Helper to get missing operations for a step
export function getMissingOperations(stepNumber, completedOperations, activityLogs = []) {
  const requirements = ACTIVITY_REQUIREMENTS[stepNumber];
  if (!requirements) return [];

  const stepKey = String(stepNumber);
  const completed = completedOperations[stepKey] || [];

  // For activities that count multiple occurrences (like Activity 4)
  if (requirements.countMultiple) {
    const stepLogs = activityLogs.filter(log => String(log.step) === stepKey);
    const operationCounts = {};

    stepLogs.forEach(log => {
      if (requirements.required.includes(log.operation)) {
        operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
      }
    });

    const totalCount = Object.values(operationCounts).reduce((sum, count) => sum + count, 0);
    const remaining = requirements.minRequired - totalCount;

    // Return array indicating how many more operations needed
    if (remaining > 0) {
      return [{ operation: requirements.required[0], remaining }];
    }
    return [];
  }

  // Standard check: list unique operations not yet completed
  const missing = requirements.required.filter(op => !completed.includes(op));

  // Check alternate requirements (OR logic)
  if (requirements.alternateRequired) {
    requirements.alternateRequired.forEach(alternates => {
      // If none of the alternate operations are completed, add one as missing
      if (!alternates.some(op => completed.includes(op))) {
        missing.push(alternates[0]); // Show first alternate as the one to complete
      }
    });
  }

  return missing;
}
