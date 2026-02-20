/**
 * Activity Configurations
 *
 * Instructions and questions for each of the 4 DAW study activities
 */

import { OPERATION_TYPES, ACTIVITY_QUESTIONS } from './activityConstants';

export const ACTIVITY_1_CONFIG = {
  name: 'Activity 1: Selections and Removal',
  instructions: [
    {
      type: 'text',
      content: 'In this activity, you will learn how to select and remove portions of audio using the single-track editor.',
    },
    {
      type: 'list',
      items: [
        'Observe the editor. To listen to your recording, press the play button in the lefthand corner.',
        'Observe that there is likely some silence at the start and end of your waveform.',
        'Using your mouse, click and drag anywhere on the waveform to create a region (selection).',
        'Double-click anywhere within the created region to deselect it.',
        'Make another selection by clicking and dragging.',
        'Click the trash can icon to delete that waveform region.',
        'Click the left arrow button (undo) in the top right corner to restore your audio.',
        'Observe the silence at the beginning of your waveform.',
        'Select the silence at the beginning and remove it with the trash can button.',
        'Undo your change, then click the right arrow button (redo) to reapply it.',
        'Repeat this process for the silence at the end of the track.',
      ],
    },
    {
      type: 'alert',
      variant: 'info',
      content: "Don't worry - you can undo any changes! Experiment with the tools to get comfortable.",
    },
  ],
  questions: [
    {
      id: ACTIVITY_QUESTIONS[1].Q1,
      question: 'How does what you see in the waveform correspond to what you hear when playing back?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_SELECTED,
      unlockHint: 'creating your first selection',
    },
    {
      id: ACTIVITY_QUESTIONS[1].Q2,
      question: 'After double-clicking to deselect, how does the canvas sound right now? How does it compare to the original?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_DESELECTED,
      unlockHint: 'deselecting a region',
    },
    {
      id: ACTIVITY_QUESTIONS[1].Q3,
      question: 'What do you observe about how the waveform changed after you clicked the trash button?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_DELETED,
      unlockHint: 'deleting a region',
    },
    {
      id: ACTIVITY_QUESTIONS[1].Q4,
      question: 'Now, listen to your file after trimming the silence. Is this version an improvement to your recording, or do you feel it is worse? Why?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.SILENCE_TRIMMED_END,
      unlockHint: 'trimming silence from both the beginning and end',
    },
  ],
};

export const ACTIVITY_2_CONFIG = {
  name: 'Activity 2: Selections and Retaining',
  instructions: [
    {
      type: 'text',
      content: 'In this activity, you will learn an alternate method to accomplish the same goal as Activity 1, using the "retain" tool.',
    },
    {
      type: 'alert',
      variant: 'info',
      content: 'The retain tool (scissor icon) keeps only the selected region and removes everything else.',
    },
    {
      type: 'list',
      items: [
        'Undo the 2 deletions from Activity 1. Your waveform should be in its original state and the undo button should be greyed-out and disabled.',
        'Select only the region of the sample that you want to keep (the "middle" portion, starting after the beginning silence ends, and ending before the silence starts at the end).',
        'Using the scissor icon, excise (cut out and keep) this audio region.',
      ],
    },
  ],
  questions: [
    {
      id: ACTIVITY_QUESTIONS[2].Q1,
      question: 'What did you notice about the operations themselves - how efficient are they when compared to each other? Did the computer take longer to complete the 1-step approach (retain) versus the 2-step approach (delete twice)?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_RETAINED,
      unlockHint: 'using the scissor/retain tool',
    },
    {
      id: ACTIVITY_QUESTIONS[2].Q2,
      question: 'Did it take YOU longer to do it either way?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_RETAINED,
      unlockHint: 'using the scissor/retain tool',
    },
    {
      id: ACTIVITY_QUESTIONS[2].Q3,
      question: 'Was it easier to do it either way?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_RETAINED,
      unlockHint: 'using the scissor/retain tool',
    },
    {
      id: ACTIVITY_QUESTIONS[2].Q4,
      question: 'How similar was the result, especially around the beginning and end of the sample where some of the track was removed?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.REGION_RETAINED,
      unlockHint: 'using the scissor/retain tool',
    },
  ],
};

export const ACTIVITY_3_CONFIG = {
  name: 'Activity 3: EQ & Mixes',
  instructions: [
    {
      type: 'text',
      content: 'In this activity, you will work with the multitrack editor to combine multiple audio tracks and apply equalization (EQ) effects.',
    },
    {
      type: 'list',
      items: [
        'Toggle the multitrack editor using the button at the top.',
        'Add an audio track by clicking the "Add Track" button and selecting "Audio Track".',
        'Click the record button in the track controls on the left side. Wait for the countdown.',
        'Record about ten seconds of audio, then stop recording.',
        'Notice the waveform that appears. Select the grab tool and drag the waveform around.',
        'Add a second audio track and record another short sequence.',
        'Switch to the select tool and click/drag to select multiple waveform clips at once.',
        'Press play to observe how the regions of silence and sound produce what you hear.',
        'Click a single clip, then click the copy button. Click on the timeline to move the playhead, then click paste.',
        'Select all clips and hit backspace to delete them.',
        'Import your recorded take using the "Import from takes" button.',
        'Import the provided bassline for your second audio track.',
        'Drag the waveform clips to align the bassline with your melody.',
        'Click the mixdown button to create a combined track.',
        'Hit the solo button (S) on the new mixdown track to hear it alone.',
        'Save this clip as a take, then switch back to single track editor.',
        'Load your mixdown take in the single track editor.',
        'Toggle the effects rack and hover over Equalizer for a description.',
        'Select the "Warm Bass" preset and observe how the frequency graph changes.',
        'Apply the effect and listen back.',
        'Experiment with other presets and create your own EQ curve.',
      ],
    },
    {
      type: 'alert',
      variant: 'warning',
      content: 'Be careful when making large EQ adjustments. If you see a waveform that appears to be a block of sound, lower your volume before playing back.',
    },
  ],
  questions: [
    {
      id: ACTIVITY_QUESTIONS[3].Q1,
      question: 'What happens when the countdown completes? Does what you see correspond to the live sounds you are making?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.RECORDING_PERFORMED,
      unlockHint: 'recording to a track',
    },
    {
      id: ACTIVITY_QUESTIONS[3].Q2,
      question: 'What do you think will happen if you drag a waveform to the right to create a gap in the canvas and click the play button?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.CLIP_DRAGGED,
      unlockHint: 'dragging a clip',
    },
    {
      id: ACTIVITY_QUESTIONS[3].Q3,
      question: 'What just happened after creating the mixdown? What do you think the new track and waveform on the canvas are?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.MIXDOWN_CREATED,
      unlockHint: 'creating a mixdown',
    },
    {
      id: ACTIVITY_QUESTIONS[3].Q4,
      question: 'Based on the tooltip hints, how do you think what you see in the frequency graph relates to your sound? Remember that any audio file is a collection of sounds of different pitches or frequencies.',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.EQ_LOADED,
      unlockHint: 'loading the EQ effect',
    },
    {
      id: ACTIVITY_QUESTIONS[3].Q5,
      question: 'What, if anything, changed about your sounds after applying the EQ?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.EQ_PRESET_APPLIED,
      unlockHint: 'applying an EQ preset',
    },
  ],
};

export const ACTIVITY_4_CONFIG = {
  name: 'Activity 4: Effects Playground',
  instructions: [
    {
      type: 'text',
      content: 'In this final activity, you have the freedom to experiment with various audio effects and create your own unique sound.',
    },
    {
      type: 'list',
      items: [
        'Continue editing your audio from Activity 3 (or start fresh with a new recording).',
        'Explore the effects rack and try different effects beyond EQ.',
        'Experiment with combining multiple effects.',
        'Listen to how each effect changes your audio.',
        'Try adjusting effect parameters to fine-tune your sound.',
      ],
    },
    {
      type: 'alert',
      variant: 'success',
      content: 'There are no wrong answers here! This is your chance to be creative and explore what the DAW can do.',
    },
  ],
  questions: [
    {
      id: ACTIVITY_QUESTIONS[4].Q1,
      question: 'When might you need to use a DAW like this in your band or orchestra education?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.EFFECT_EXPERIMENTED,
      unlockHint: 'experimenting with at least one effect',
    },
    {
      id: ACTIVITY_QUESTIONS[4].Q2,
      question: 'When might you use these tools in your own music making?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.EFFECT_EXPERIMENTED,
      unlockHint: 'experimenting with at least one effect',
    },
    {
      id: ACTIVITY_QUESTIONS[4].Q3,
      question: 'Can you think of other situations where you might use audio editing?',
      type: 'textarea',
      requiredOperation: OPERATION_TYPES.EFFECT_EXPERIMENTED,
      unlockHint: 'experimenting with at least one effect',
    },
  ],
};

// Export all configs
export const ACTIVITY_CONFIGS = {
  1: ACTIVITY_1_CONFIG,
  2: ACTIVITY_2_CONFIG,
  3: ACTIVITY_3_CONFIG,
  4: ACTIVITY_4_CONFIG,
};

// Helper to get activity config by step number
export function getActivityConfig(step) {
  return ACTIVITY_CONFIGS[step] || {
    name: `Activity ${step}`,
    instructions: [],
    questions: [],
  };
}
