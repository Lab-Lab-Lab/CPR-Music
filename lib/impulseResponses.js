/**
 * Embedded Impulse Responses for Reverb
 * These are simplified IRs suitable for basic reverb effects
 * In production, you'd want higher quality samples
 */

// Helper to create simple algorithmic impulse responses
function createImpulseResponse(audioContext, duration, decay, options = {}) {
  const length = audioContext.sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    
    for (let i = 0; i < length; i++) {
      // Create noise
      let sample = (Math.random() * 2 - 1);
      
      // Apply exponential decay
      sample *= Math.pow(1 - i / length, decay);
      
      // Apply frequency shaping if specified
      if (options.highFreqDamping && i > length * 0.1) {
        // Simple low-pass effect
        const dampingFactor = 1 - (options.highFreqDamping * (i / length));
        sample *= dampingFactor;
      }
      
      // Add early reflections
      if (options.earlyReflections && i < length * 0.1) {
        const reflectionCount = options.earlyReflections;
        for (let r = 1; r <= reflectionCount; r++) {
          const reflectionDelay = Math.floor(i + (r * audioContext.sampleRate * 0.01));
          if (reflectionDelay < length) {
            sample += (Math.random() * 2 - 1) * 0.5 * Math.pow(0.7, r);
          }
        }
      }
      
      // Stereo spread
      if (channel === 1 && options.stereoSpread) {
        sample *= (1 + (Math.random() - 0.5) * options.stereoSpread);
      }
      
      channelData[i] = sample;
    }
  }
  
  return impulse;
}

// Impulse Response Presets
export const impulseResponsePresets = {
  // Small Room - short, bright
  smallRoom: {
    name: 'Small Room',
    duration: 0.8,
    decay: 2,
    options: {
      highFreqDamping: 0.3,
      earlyReflections: 3,
      stereoSpread: 0.2
    },
    // Default effect parameters for this preset
    parameters: {
      wetMix: 0.25,
      preDelay: 10,
      highDamp: 0.3,
      lowDamp: 0.1,
      earlyLate: 0.6,
      stereoWidth: 0.8,
      outputGain: 1.0
    },
    // Reverse reverb specific parameters
    reverseParameters: {
      wetMix: 0.6,
      fadeTime: 0.05,
      predelay: 0,
      buildupTime: 0.3
    }
  },

  // Medium Hall - balanced
  mediumHall: {
    name: 'Medium Hall',
    duration: 1.8,
    decay: 2.5,
    options: {
      highFreqDamping: 0.4,
      earlyReflections: 5,
      stereoSpread: 0.4
    },
    parameters: {
      wetMix: 0.35,
      preDelay: 20,
      highDamp: 0.5,
      lowDamp: 0.15,
      earlyLate: 0.5,
      stereoWidth: 1.0,
      outputGain: 1.0
    },
    reverseParameters: {
      wetMix: 0.7,
      fadeTime: 0.1,
      predelay: 0,
      buildupTime: 0.5
    }
  },

  // Large Hall - long, spacious
  largeHall: {
    name: 'Large Hall',
    duration: 3.0,
    decay: 3,
    options: {
      highFreqDamping: 0.5,
      earlyReflections: 7,
      stereoSpread: 0.6
    },
    parameters: {
      wetMix: 0.45,
      preDelay: 30,
      highDamp: 0.6,
      lowDamp: 0.2,
      earlyLate: 0.4,
      stereoWidth: 1.2,
      outputGain: 0.9
    },
    reverseParameters: {
      wetMix: 0.75,
      fadeTime: 0.15,
      predelay: 10,
      buildupTime: 0.8
    }
  },

  // Church - very long, lots of reflections
  church: {
    name: 'Church',
    duration: 4.5,
    decay: 3.5,
    options: {
      highFreqDamping: 0.6,
      earlyReflections: 10,
      stereoSpread: 0.8
    },
    parameters: {
      wetMix: 0.5,
      preDelay: 40,
      highDamp: 0.7,
      lowDamp: 0.25,
      earlyLate: 0.3,
      stereoWidth: 1.4,
      outputGain: 0.85
    },
    reverseParameters: {
      wetMix: 0.8,
      fadeTime: 0.2,
      predelay: 20,
      buildupTime: 1.2
    }
  },

  // Plate - metallic, bright
  plate: {
    name: 'Plate',
    duration: 2.5,
    decay: 1.5,
    options: {
      highFreqDamping: 0.2,
      earlyReflections: 2,
      stereoSpread: 0.9
    },
    parameters: {
      wetMix: 0.3,
      preDelay: 5,
      highDamp: 0.2,
      lowDamp: 0.3,
      earlyLate: 0.7,
      stereoWidth: 1.5,
      outputGain: 1.0
    },
    reverseParameters: {
      wetMix: 0.65,
      fadeTime: 0.05,
      predelay: 0,
      buildupTime: 0.4
    }
  },

  // Cave - dark, long
  cave: {
    name: 'Cave',
    duration: 5.0,
    decay: 4,
    options: {
      highFreqDamping: 0.8,
      earlyReflections: 12,
      stereoSpread: 0.7
    },
    parameters: {
      wetMix: 0.6,
      preDelay: 50,
      highDamp: 0.8,
      lowDamp: 0.4,
      earlyLate: 0.2,
      stereoWidth: 1.0,
      outputGain: 0.8
    },
    reverseParameters: {
      wetMix: 0.85,
      fadeTime: 0.25,
      predelay: 30,
      buildupTime: 1.5
    }
  }
};

// Function to get all preset names
export function getPresetNames() {
  return Object.keys(impulseResponsePresets);
}

// Function to create an impulse response buffer
export function createImpulseBuffer(audioContext, presetKey) {
  const preset = impulseResponsePresets[presetKey];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetKey}`);
  }
  
  return createImpulseResponse(
    audioContext,
    preset.duration,
    preset.decay,
    preset.options
  );
}