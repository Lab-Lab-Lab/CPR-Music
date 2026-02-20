# Instrument Sandbox Parameters Guide

## Real-Time Parameters (affect currently playing notes)

These parameters update immediately and affect all active notes:

### Modulation
- **LFO Rate & Amount**: Vibrato/filter modulation
- **LFO2 Rate & Amount**: Secondary modulation (pitch/filter/amp)
- **PWM Rate & Amount**: Pulse width modulation (square waves only)

### Effects
- **Distortion, Delay, Reverb**: Standard effects (0-100%)
- **Bit Crusher**: Bit depth (1-16) and sample rate (1000-44100 Hz)
- **Wave Folder**: Fold amount (0-100%)
- **Feedback Amount**: Internal feedback loop (0-90%)
- **Formant Shift**: Vowel morphing (0-100)

### Experimental (New!)
- **Granular**:
  - Grain Size: 10-500ms
  - Playback Speed: 0.1x-2.0x
  - Reverse/Freeze toggles
  - *NOTE: Only active when parameters differ from defaults*

- **Comb Filter**:
  - Frequency: 50-2000 Hz
  - Resonance: 0-95%
  - Mix: 0-100% (*must be > 0 to hear*)

- **Sample & Hold**:
  - Rate: 0.5-50 Hz
  - Amount: 0-100% (*must be > 0 to hear*)
  - Target: Pitch, Filter, or PWM

## Per-Note Parameters (only affect new notes)

These parameters are "frozen" when a note starts and won't change for already-playing notes:

### Oscillators
- **Oscillator Type**: Sine, Square, Sawtooth, Triangle
- **Oscillator 2**: Type, Detune, Pitch, Mix
- **Sub Oscillator**: Type, Level
- **Detune**: Fine tuning
- **FM Amount, Ring Mod, Oscillator Sync**: Cross-modulation

### Filter
- **Filter Cutoff**: Base frequency (20-20000 Hz)
- **Filter Resonance**: Q factor (0-30)
- **Filter Type**: Lowpass, Highpass, Bandpass, Notch
- **Filter Envelope**: Attack, Decay, Sustain, Release, Amount

### Amplitude Envelope
- **Attack**: 0-2 seconds
- **Decay**: 0-2 seconds
- **Sustain**: 0-1 level
- **Release**: 0-5 seconds

### Sound Sources
- **Noise Level & Type**: White, Pink, Brown noise
- **Pulse Width**: Square wave duty cycle (5-95%)

## Tips for Hearing New Features

1. **Granular Effects**:
   - Change grain size away from 100ms
   - Try speed values < 1.0 for slow motion
   - Enable reverse or freeze for dramatic effects

2. **Comb Filter**:
   - Increase Mix to at least 30-50%
   - Set resonance (feedback) to 50-70%
   - Try frequencies 200-1000 Hz for metallic tones

3. **Sample & Hold**:
   - Set Amount to at least 40-60%
   - Rate of 5-15 Hz works well for rhythmic effects
   - Try Pitch target for random note variations
   - Try Filter target for stepped filter sweeps

4. **Testing**: Try the new presets:
   - "Stutter Glitch" - granular + S&H
   - "Metallic Bell" - comb filter showcase
   - "Frozen Texture" - reversed grains
   - "Random Walk" - S&H filter modulation
   - "IDM Pluck" - combination of all three

## Console Debugging

Open the browser console to see when effects are activated. Look for messages like:
```
[SandboxSynth] Granular active: {...}
[SandboxSynth] Comb filter active: {...}
[SandboxSynth] Sample & Hold active: {...}
```

These logs will confirm your parameter changes are being applied.
