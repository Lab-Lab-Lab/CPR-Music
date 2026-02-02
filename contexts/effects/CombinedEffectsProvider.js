'use client';

/**
 * Combined Effects Provider
 *
 * This provider composes all individual effect providers and also provides
 * backward compatibility through the useEffects hook that combines all contexts.
 *
 * For new code:
 * - Import specific hooks like useEQ, useDynamics, useModulation, etc.
 * - Components will only re-render when their specific context changes
 *
 * For existing code (backward compatibility):
 * - useEffects continues to work but will re-render on any effect change
 * - Gradually migrate to specific hooks for better performance
 */

import { createContext, useContext, useMemo, useCallback, useEffect, useRef } from 'react';
import { EQProvider, useEQ } from './EQContext';
import { DynamicsProvider, useDynamics } from './DynamicsContext';
import { ModulationProvider, useModulation } from './ModulationContext';
import { TimeBasedProvider, useTimeBased } from './TimeBasedContext';
import { SpecialEffectsProvider, useSpecialEffects } from './SpecialEffectsContext';
import { GlobalEffectsProvider, useGlobalEffects } from './GlobalEffectsContext';

// Legacy combined context for backward compatibility
const LegacyCombinedContext = createContext();

/**
 * Internal component that consumes all contexts and provides combined value
 */
function LegacyCombinedProvider({ children }) {
  const eq = useEQ();
  const dynamics = useDynamics();
  const modulation = useModulation();
  const timeBased = useTimeBased();
  const specialEffects = useSpecialEffects();
  const globalEffects = useGlobalEffects();

  // Combined reset function
  const resetEffects = useCallback(() => {
    eq.resetEQ();
    dynamics.resetDynamics();
    modulation.resetModulation();
    timeBased.resetTimeBased();
    specialEffects.resetSpecialEffects();
    globalEffects.resetGlobalEffects();
  }, [eq, dynamics, modulation, timeBased, specialEffects, globalEffects]);

  // Combine all contexts into single value for backward compatibility
  const combinedValue = useMemo(() => ({
    // EQ
    filters: eq.filters,
    setFilters: eq.setFilters,
    eqPresent: eq.eqPresent,
    setEqPresent: eq.setEqPresent,
    toggleEQ: eq.toggleEQ,
    eqLinearPhase: eq.eqLinearPhase,
    setEqLinearPhase: eq.setEqLinearPhase,
    eqSpectrumAnalyzer: eq.eqSpectrumAnalyzer,
    setEqSpectrumAnalyzer: eq.setEqSpectrumAnalyzer,
    eqBypass: eq.eqBypass,
    setEqBypass: eq.setEqBypass,
    eqGain: eq.eqGain,
    setEqGain: eq.setEqGain,
    eqMidSideMode: eq.eqMidSideMode,
    setEqMidSideMode: eq.setEqMidSideMode,
    eqMidFilters: eq.eqMidFilters,
    setEqMidFilters: eq.setEqMidFilters,
    eqSideFilters: eq.eqSideFilters,
    setEqSideFilters: eq.setEqSideFilters,
    eqMidGain: eq.eqMidGain,
    setEqMidGain: eq.setEqMidGain,
    eqSideGain: eq.eqSideGain,
    setEqSideGain: eq.setEqSideGain,
    eqStereoLink: eq.eqStereoLink,
    setEqStereoLink: eq.setEqStereoLink,

    // Dynamics - Compressor
    compressorPresent: dynamics.compressorPresent,
    setCompressorPresent: dynamics.setCompressorPresent,
    toggleCompressor: dynamics.toggleCompressor,
    compressorThreshold: dynamics.compressorThreshold,
    setCompressorThreshold: dynamics.setCompressorThreshold,
    compressorRatio: dynamics.compressorRatio,
    setCompressorRatio: dynamics.setCompressorRatio,
    compressorAttack: dynamics.compressorAttack,
    setCompressorAttack: dynamics.setCompressorAttack,
    compressorRelease: dynamics.compressorRelease,
    setCompressorRelease: dynamics.setCompressorRelease,
    compressorKnee: dynamics.compressorKnee,
    setCompressorKnee: dynamics.setCompressorKnee,
    compressorMakeup: dynamics.compressorMakeup,
    setCompressorMakeup: dynamics.setCompressorMakeup,
    compressorLookahead: dynamics.compressorLookahead,
    setCompressorLookahead: dynamics.setCompressorLookahead,
    compressorSidechain: dynamics.compressorSidechain,
    setCompressorSidechain: dynamics.setCompressorSidechain,
    compressorModel: dynamics.compressorModel,
    setCompressorModel: dynamics.setCompressorModel,
    compressorAutoMakeup: dynamics.compressorAutoMakeup,
    setCompressorAutoMakeup: dynamics.setCompressorAutoMakeup,

    // Compressor Mid/Side
    compressorMidSideMode: dynamics.compressorMidSideMode,
    setCompressorMidSideMode: dynamics.setCompressorMidSideMode,
    compressorMidThreshold: dynamics.compressorMidThreshold,
    setCompressorMidThreshold: dynamics.setCompressorMidThreshold,
    compressorMidRatio: dynamics.compressorMidRatio,
    setCompressorMidRatio: dynamics.setCompressorMidRatio,
    compressorMidAttack: dynamics.compressorMidAttack,
    setCompressorMidAttack: dynamics.setCompressorMidAttack,
    compressorMidRelease: dynamics.compressorMidRelease,
    setCompressorMidRelease: dynamics.setCompressorMidRelease,
    compressorMidMakeup: dynamics.compressorMidMakeup,
    setCompressorMidMakeup: dynamics.setCompressorMidMakeup,
    compressorSideThreshold: dynamics.compressorSideThreshold,
    setCompressorSideThreshold: dynamics.setCompressorSideThreshold,
    compressorSideRatio: dynamics.compressorSideRatio,
    setCompressorSideRatio: dynamics.setCompressorSideRatio,
    compressorSideAttack: dynamics.compressorSideAttack,
    setCompressorSideAttack: dynamics.setCompressorSideAttack,
    compressorSideRelease: dynamics.compressorSideRelease,
    setCompressorSideRelease: dynamics.setCompressorSideRelease,
    compressorSideMakeup: dynamics.compressorSideMakeup,
    setCompressorSideMakeup: dynamics.setCompressorSideMakeup,

    // Compressor Multiband
    compressorMultibandMode: dynamics.compressorMultibandMode,
    setCompressorMultibandMode: dynamics.setCompressorMultibandMode,
    compressorCrossoverFreqs: dynamics.compressorCrossoverFreqs,
    setCompressorCrossoverFreqs: dynamics.setCompressorCrossoverFreqs,
    compressorBand0Threshold: dynamics.compressorBand0Threshold,
    setCompressorBand0Threshold: dynamics.setCompressorBand0Threshold,
    compressorBand0Ratio: dynamics.compressorBand0Ratio,
    setCompressorBand0Ratio: dynamics.setCompressorBand0Ratio,
    compressorBand0Attack: dynamics.compressorBand0Attack,
    setCompressorBand0Attack: dynamics.setCompressorBand0Attack,
    compressorBand0Release: dynamics.compressorBand0Release,
    setCompressorBand0Release: dynamics.setCompressorBand0Release,
    compressorBand0Makeup: dynamics.compressorBand0Makeup,
    setCompressorBand0Makeup: dynamics.setCompressorBand0Makeup,
    compressorBand1Threshold: dynamics.compressorBand1Threshold,
    setCompressorBand1Threshold: dynamics.setCompressorBand1Threshold,
    compressorBand1Ratio: dynamics.compressorBand1Ratio,
    setCompressorBand1Ratio: dynamics.setCompressorBand1Ratio,
    compressorBand1Attack: dynamics.compressorBand1Attack,
    setCompressorBand1Attack: dynamics.setCompressorBand1Attack,
    compressorBand1Release: dynamics.compressorBand1Release,
    setCompressorBand1Release: dynamics.setCompressorBand1Release,
    compressorBand1Makeup: dynamics.compressorBand1Makeup,
    setCompressorBand1Makeup: dynamics.setCompressorBand1Makeup,
    compressorBand2Threshold: dynamics.compressorBand2Threshold,
    setCompressorBand2Threshold: dynamics.setCompressorBand2Threshold,
    compressorBand2Ratio: dynamics.compressorBand2Ratio,
    setCompressorBand2Ratio: dynamics.setCompressorBand2Ratio,
    compressorBand2Attack: dynamics.compressorBand2Attack,
    setCompressorBand2Attack: dynamics.setCompressorBand2Attack,
    compressorBand2Release: dynamics.compressorBand2Release,
    setCompressorBand2Release: dynamics.setCompressorBand2Release,
    compressorBand2Makeup: dynamics.compressorBand2Makeup,
    setCompressorBand2Makeup: dynamics.setCompressorBand2Makeup,
    compressorBand3Threshold: dynamics.compressorBand3Threshold,
    setCompressorBand3Threshold: dynamics.setCompressorBand3Threshold,
    compressorBand3Ratio: dynamics.compressorBand3Ratio,
    setCompressorBand3Ratio: dynamics.setCompressorBand3Ratio,
    compressorBand3Attack: dynamics.compressorBand3Attack,
    setCompressorBand3Attack: dynamics.setCompressorBand3Attack,
    compressorBand3Release: dynamics.compressorBand3Release,
    setCompressorBand3Release: dynamics.setCompressorBand3Release,
    compressorBand3Makeup: dynamics.compressorBand3Makeup,
    setCompressorBand3Makeup: dynamics.setCompressorBand3Makeup,

    // Dynamics - Gate
    gatePresent: dynamics.gatePresent,
    setGatePresent: dynamics.setGatePresent,
    toggleGate: dynamics.toggleGate,
    gateThreshold: dynamics.gateThreshold,
    setGateThreshold: dynamics.setGateThreshold,
    gateRatio: dynamics.gateRatio,
    setGateRatio: dynamics.setGateRatio,
    gateAttack: dynamics.gateAttack,
    setGateAttack: dynamics.setGateAttack,
    gateRelease: dynamics.gateRelease,
    setGateRelease: dynamics.setGateRelease,
    gateHold: dynamics.gateHold,
    setGateHold: dynamics.setGateHold,
    gateRange: dynamics.gateRange,
    setGateRange: dynamics.setGateRange,

    // Dynamics - Limiter
    limiterPresent: dynamics.limiterPresent,
    setLimiterPresent: dynamics.setLimiterPresent,
    toggleLimiter: dynamics.toggleLimiter,
    limiterCeiling: dynamics.limiterCeiling,
    setLimiterCeiling: dynamics.setLimiterCeiling,
    limiterRelease: dynamics.limiterRelease,
    setLimiterRelease: dynamics.setLimiterRelease,
    limiterLookahead: dynamics.limiterLookahead,
    setLimiterLookahead: dynamics.setLimiterLookahead,
    limiterAlgorithm: dynamics.limiterAlgorithm,
    setLimiterAlgorithm: dynamics.setLimiterAlgorithm,
    limiterIsrMode: dynamics.limiterIsrMode,
    setLimiterIsrMode: dynamics.setLimiterIsrMode,
    limiterDithering: dynamics.limiterDithering,
    setLimiterDithering: dynamics.setLimiterDithering,
    limiterMasteringMode: dynamics.limiterMasteringMode,
    setLimiterMasteringMode: dynamics.setLimiterMasteringMode,
    limiterInputGain: dynamics.limiterInputGain,
    setLimiterInputGain: dynamics.setLimiterInputGain,
    limiterOutputGain: dynamics.limiterOutputGain,
    setLimiterOutputGain: dynamics.setLimiterOutputGain,

    // Modulation - Chorus
    chorusPresent: modulation.chorusPresent,
    setChorusPresent: modulation.setChorusPresent,
    toggleChorus: modulation.toggleChorus,
    chorusRate: modulation.chorusRate,
    setChorusRate: modulation.setChorusRate,
    chorusDepth: modulation.chorusDepth,
    setChorusDepth: modulation.setChorusDepth,
    chorusDelay: modulation.chorusDelay,
    setChorusDelay: modulation.setChorusDelay,
    chorusFeedback: modulation.chorusFeedback,
    setChorusFeedback: modulation.setChorusFeedback,
    chorusWetMix: modulation.chorusWetMix,
    setChorusWetMix: modulation.setChorusWetMix,
    chorusVoices: modulation.chorusVoices,
    setChorusVoices: modulation.setChorusVoices,
    chorusStereoWidth: modulation.chorusStereoWidth,
    setChorusStereoWidth: modulation.setChorusStereoWidth,
    chorusPhaseOffset: modulation.chorusPhaseOffset,
    setChorusPhaseOffset: modulation.setChorusPhaseOffset,
    chorusTempoSync: modulation.chorusTempoSync,
    setChorusTempoSync: modulation.setChorusTempoSync,
    chorusNoteDivision: modulation.chorusNoteDivision,
    setChorusNoteDivision: modulation.setChorusNoteDivision,
    chorusWaveform: modulation.chorusWaveform,
    setChorusWaveform: modulation.setChorusWaveform,
    chorusOutputGain: modulation.chorusOutputGain,
    setChorusOutputGain: modulation.setChorusOutputGain,

    // Modulation - Phaser
    phaserPresent: modulation.phaserPresent,
    setPhaserPresent: modulation.setPhaserPresent,
    togglePhaser: modulation.togglePhaser,
    phaserRate: modulation.phaserRate,
    setPhaserRate: modulation.setPhaserRate,
    phaserDepth: modulation.phaserDepth,
    setPhaserDepth: modulation.setPhaserDepth,
    phaserFeedback: modulation.phaserFeedback,
    setPhaserFeedback: modulation.setPhaserFeedback,
    phaserStages: modulation.phaserStages,
    setPhaserStages: modulation.setPhaserStages,
    phaserWetMix: modulation.phaserWetMix,
    setPhaserWetMix: modulation.setPhaserWetMix,
    phaserTempoSync: modulation.phaserTempoSync,
    setPhaserTempoSync: modulation.setPhaserTempoSync,
    phaserNoteDivision: modulation.phaserNoteDivision,
    setPhaserNoteDivision: modulation.setPhaserNoteDivision,
    phaserWaveform: modulation.phaserWaveform,
    setPhaserWaveform: modulation.setPhaserWaveform,
    phaserFreqRange: modulation.phaserFreqRange,
    setPhaserFreqRange: modulation.setPhaserFreqRange,
    phaserResonance: modulation.phaserResonance,
    setPhaserResonance: modulation.setPhaserResonance,
    phaserStereoPhase: modulation.phaserStereoPhase,
    setPhaserStereoPhase: modulation.setPhaserStereoPhase,
    phaserOutputGain: modulation.phaserOutputGain,
    setPhaserOutputGain: modulation.setPhaserOutputGain,

    // Modulation - Flanger
    flangerPresent: modulation.flangerPresent,
    setFlangerPresent: modulation.setFlangerPresent,
    toggleFlanger: modulation.toggleFlanger,
    flangerRate: modulation.flangerRate,
    setFlangerRate: modulation.setFlangerRate,
    flangerDepth: modulation.flangerDepth,
    setFlangerDepth: modulation.setFlangerDepth,
    flangerFeedback: modulation.flangerFeedback,
    setFlangerFeedback: modulation.setFlangerFeedback,
    flangerDelay: modulation.flangerDelay,
    setFlangerDelay: modulation.setFlangerDelay,
    flangerMix: modulation.flangerMix,
    setFlangerMix: modulation.setFlangerMix,
    flangerTempoSync: modulation.flangerTempoSync,
    setFlangerTempoSync: modulation.setFlangerTempoSync,
    flangerNoteDivision: modulation.flangerNoteDivision,
    setFlangerNoteDivision: modulation.setFlangerNoteDivision,
    flangerThroughZero: modulation.flangerThroughZero,
    setFlangerThroughZero: modulation.setFlangerThroughZero,
    flangerStereoPhase: modulation.flangerStereoPhase,
    setFlangerStereoPhase: modulation.setFlangerStereoPhase,
    flangerManualOffset: modulation.flangerManualOffset,
    setFlangerManualOffset: modulation.setFlangerManualOffset,

    // Modulation - Tremolo
    tremoloPresent: modulation.tremoloPresent,
    setTremoloPresent: modulation.setTremoloPresent,
    toggleTremolo: modulation.toggleTremolo,
    tremoloRate: modulation.tremoloRate,
    setTremoloRate: modulation.setTremoloRate,
    tremoloDepth: modulation.tremoloDepth,
    setTremoloDepth: modulation.setTremoloDepth,
    tremoloWaveform: modulation.tremoloWaveform,
    setTremoloWaveform: modulation.setTremoloWaveform,
    tremoloPhase: modulation.tremoloPhase,
    setTremoloPhase: modulation.setTremoloPhase,
    tremoloTempoSync: modulation.tremoloTempoSync,
    setTremoloTempoSync: modulation.setTremoloTempoSync,
    tremoloNoteDivision: modulation.tremoloNoteDivision,
    setTremoloNoteDivision: modulation.setTremoloNoteDivision,

    // Modulation - Auto-Pan
    autoPanPresent: modulation.autoPanPresent,
    setAutoPanPresent: modulation.setAutoPanPresent,
    toggleAutoPan: modulation.toggleAutoPan,
    autoPanRate: modulation.autoPanRate,
    setAutoPanRate: modulation.setAutoPanRate,
    autoPanDepth: modulation.autoPanDepth,
    setAutoPanDepth: modulation.setAutoPanDepth,
    autoPanWaveform: modulation.autoPanWaveform,
    setAutoPanWaveform: modulation.setAutoPanWaveform,
    autoPanPhase: modulation.autoPanPhase,
    setAutoPanPhase: modulation.setAutoPanPhase,
    autoPanTempoSync: modulation.autoPanTempoSync,
    setAutoPanTempoSync: modulation.setAutoPanTempoSync,
    autoPanNoteDivision: modulation.autoPanNoteDivision,
    setAutoPanNoteDivision: modulation.setAutoPanNoteDivision,

    // Modulation - Ring Modulator
    ringModPresent: modulation.ringModPresent,
    setRingModPresent: modulation.setRingModPresent,
    toggleRingMod: modulation.toggleRingMod,
    ringModFrequency: modulation.ringModFrequency,
    setRingModFrequency: modulation.setRingModFrequency,
    ringModWaveform: modulation.ringModWaveform,
    setRingModWaveform: modulation.setRingModWaveform,
    ringModMix: modulation.ringModMix,
    setRingModMix: modulation.setRingModMix,
    ringModDepth: modulation.ringModDepth,
    setRingModDepth: modulation.setRingModDepth,
    ringModMode: modulation.ringModMode,
    setRingModMode: modulation.setRingModMode,
    ringModSync: modulation.ringModSync,
    setRingModSync: modulation.setRingModSync,
    ringModOffset: modulation.ringModOffset,
    setRingModOffset: modulation.setRingModOffset,
    ringModPhase: modulation.ringModPhase,
    setRingModPhase: modulation.setRingModPhase,
    ringModFilterFreq: modulation.ringModFilterFreq,
    setRingModFilterFreq: modulation.setRingModFilterFreq,
    ringModFilterType: modulation.ringModFilterType,
    setRingModFilterType: modulation.setRingModFilterType,
    ringModOutputGain: modulation.ringModOutputGain,
    setRingModOutputGain: modulation.setRingModOutputGain,
    ringModStereoSpread: modulation.ringModStereoSpread,
    setRingModStereoSpread: modulation.setRingModStereoSpread,

    // Modulation - Auto-Wah
    autoWahPresent: modulation.autoWahPresent,
    setAutoWahPresent: modulation.setAutoWahPresent,
    toggleAutoWah: modulation.toggleAutoWah,
    autoWahMode: modulation.autoWahMode,
    setAutoWahMode: modulation.setAutoWahMode,
    autoWahFilterType: modulation.autoWahFilterType,
    setAutoWahFilterType: modulation.setAutoWahFilterType,
    autoWahSensitivity: modulation.autoWahSensitivity,
    setAutoWahSensitivity: modulation.setAutoWahSensitivity,
    autoWahFrequency: modulation.autoWahFrequency,
    setAutoWahFrequency: modulation.setAutoWahFrequency,
    autoWahRange: modulation.autoWahRange,
    setAutoWahRange: modulation.setAutoWahRange,
    autoWahQ: modulation.autoWahQ,
    setAutoWahQ: modulation.setAutoWahQ,
    autoWahAttack: modulation.autoWahAttack,
    setAutoWahAttack: modulation.setAutoWahAttack,
    autoWahRelease: modulation.autoWahRelease,
    setAutoWahRelease: modulation.setAutoWahRelease,
    autoWahLfoRate: modulation.autoWahLfoRate,
    setAutoWahLfoRate: modulation.setAutoWahLfoRate,
    autoWahLfoDepth: modulation.autoWahLfoDepth,
    setAutoWahLfoDepth: modulation.setAutoWahLfoDepth,
    autoWahLfoWaveform: modulation.autoWahLfoWaveform,
    setAutoWahLfoWaveform: modulation.setAutoWahLfoWaveform,
    autoWahLfoPhase: modulation.autoWahLfoPhase,
    setAutoWahLfoPhase: modulation.setAutoWahLfoPhase,
    autoWahHybridBalance: modulation.autoWahHybridBalance,
    setAutoWahHybridBalance: modulation.setAutoWahHybridBalance,
    autoWahMix: modulation.autoWahMix,
    setAutoWahMix: modulation.setAutoWahMix,
    autoWahTempoSync: modulation.autoWahTempoSync,
    setAutoWahTempoSync: modulation.setAutoWahTempoSync,
    autoWahNoteDivision: modulation.autoWahNoteDivision,
    setAutoWahNoteDivision: modulation.setAutoWahNoteDivision,

    // Time-Based - Echo (legacy)
    rvbPresent: timeBased.rvbPresent,
    setRvbPresent: timeBased.setRvbPresent,
    toggleReverb: timeBased.toggleReverb,
    inGain: timeBased.inGain,
    setInGain: timeBased.setInGain,
    outGain: timeBased.outGain,
    setOutGain: timeBased.setOutGain,
    delay: timeBased.delay,
    setDelay: timeBased.setDelay,
    decay: timeBased.decay,
    setDecay: timeBased.setDecay,
    echoDelay: timeBased.echoDelay,
    setEchoDelay: timeBased.setEchoDelay,
    echoFeedback: timeBased.echoFeedback,
    setEchoFeedback: timeBased.setEchoFeedback,
    echoInputGain: timeBased.echoInputGain,
    setEchoInputGain: timeBased.setEchoInputGain,
    echoOutputGain: timeBased.echoOutputGain,
    setEchoOutputGain: timeBased.setEchoOutputGain,

    // Time-Based - Reverb
    reverbPresent: timeBased.reverbPresent,
    setReverbPresent: timeBased.setReverbPresent,
    toggleReverbNew: timeBased.toggleReverbNew,
    reverbPreset: timeBased.reverbPreset,
    setReverbPreset: timeBased.setReverbPreset,
    reverbWetMix: timeBased.reverbWetMix,
    setReverbWetMix: timeBased.setReverbWetMix,
    reverbPreDelay: timeBased.reverbPreDelay,
    setReverbPreDelay: timeBased.setReverbPreDelay,
    reverbOutputGain: timeBased.reverbOutputGain,
    setReverbOutputGain: timeBased.setReverbOutputGain,
    reverbHighDamp: timeBased.reverbHighDamp,
    setReverbHighDamp: timeBased.setReverbHighDamp,
    reverbLowDamp: timeBased.reverbLowDamp,
    setReverbLowDamp: timeBased.setReverbLowDamp,
    reverbEarlyLate: timeBased.reverbEarlyLate,
    setReverbEarlyLate: timeBased.setReverbEarlyLate,
    reverbStereoWidth: timeBased.reverbStereoWidth,
    setReverbStereoWidth: timeBased.setReverbStereoWidth,

    // Time-Based - Reverse Reverb
    reverseReverbPresent: timeBased.reverseReverbPresent,
    setReverseReverbPresent: timeBased.setReverseReverbPresent,
    toggleReverseReverb: timeBased.toggleReverseReverb,
    reverseReverbPreset: timeBased.reverseReverbPreset,
    setReverseReverbPreset: timeBased.setReverseReverbPreset,
    reverseReverbMix: timeBased.reverseReverbMix,
    setReverseReverbMix: timeBased.setReverseReverbMix,
    reverseReverbFade: timeBased.reverseReverbFade,
    setReverseReverbFade: timeBased.setReverseReverbFade,
    reverseReverbPredelay: timeBased.reverseReverbPredelay,
    setReverseReverbPredelay: timeBased.setReverseReverbPredelay,
    reverseReverbBuildup: timeBased.reverseReverbBuildup,
    setReverseReverbBuildup: timeBased.setReverseReverbBuildup,

    // Time-Based - Advanced Delay
    advDelayPresent: timeBased.advDelayPresent,
    setAdvDelayPresent: timeBased.setAdvDelayPresent,
    toggleAdvDelay: timeBased.toggleAdvDelay,
    advDelayTime: timeBased.advDelayTime,
    setAdvDelayTime: timeBased.setAdvDelayTime,
    advDelayFeedback: timeBased.advDelayFeedback,
    setAdvDelayFeedback: timeBased.setAdvDelayFeedback,
    advDelayMix: timeBased.advDelayMix,
    setAdvDelayMix: timeBased.setAdvDelayMix,
    advDelayPingPong: timeBased.advDelayPingPong,
    setAdvDelayPingPong: timeBased.setAdvDelayPingPong,
    advDelayFilterFreq: timeBased.advDelayFilterFreq,
    setAdvDelayFilterFreq: timeBased.setAdvDelayFilterFreq,
    advDelayFilterType: timeBased.advDelayFilterType,
    setAdvDelayFilterType: timeBased.setAdvDelayFilterType,
    advDelayTempoSync: timeBased.advDelayTempoSync,
    setAdvDelayTempoSync: timeBased.setAdvDelayTempoSync,
    advDelayNoteDivision: timeBased.advDelayNoteDivision,
    setAdvDelayNoteDivision: timeBased.setAdvDelayNoteDivision,
    advDelayTaps: timeBased.advDelayTaps,
    setAdvDelayTaps: timeBased.setAdvDelayTaps,
    advDelaySpread: timeBased.advDelaySpread,
    setAdvDelaySpread: timeBased.setAdvDelaySpread,
    advDelayModRate: timeBased.advDelayModRate,
    setAdvDelayModRate: timeBased.setAdvDelayModRate,
    advDelayModDepth: timeBased.advDelayModDepth,
    setAdvDelayModDepth: timeBased.setAdvDelayModDepth,
    advDelayModWaveform: timeBased.advDelayModWaveform,
    setAdvDelayModWaveform: timeBased.setAdvDelayModWaveform,
    advDelaySaturation: timeBased.advDelaySaturation,
    setAdvDelaySaturation: timeBased.setAdvDelaySaturation,
    advDelayDiffusion: timeBased.advDelayDiffusion,
    setAdvDelayDiffusion: timeBased.setAdvDelayDiffusion,
    advDelayStereoWidth: timeBased.advDelayStereoWidth,
    setAdvDelayStereoWidth: timeBased.setAdvDelayStereoWidth,
    advDelayOutputGain: timeBased.advDelayOutputGain,
    setAdvDelayOutputGain: timeBased.setAdvDelayOutputGain,

    // Special Effects - Distortion
    distortionPresent: specialEffects.distortionPresent,
    setDistortionPresent: specialEffects.setDistortionPresent,
    toggleDistortion: specialEffects.toggleDistortion,
    distortionType: specialEffects.distortionType,
    setDistortionType: specialEffects.setDistortionType,
    distortionDrive: specialEffects.distortionDrive,
    setDistortionDrive: specialEffects.setDistortionDrive,
    distortionTone: specialEffects.distortionTone,
    setDistortionTone: specialEffects.setDistortionTone,
    distortionPresence: specialEffects.distortionPresence,
    setDistortionPresence: specialEffects.setDistortionPresence,
    distortionBass: specialEffects.distortionBass,
    setDistortionBass: specialEffects.setDistortionBass,
    distortionMid: specialEffects.distortionMid,
    setDistortionMid: specialEffects.setDistortionMid,
    distortionTreble: specialEffects.distortionTreble,
    setDistortionTreble: specialEffects.setDistortionTreble,
    distortionOutputGain: specialEffects.distortionOutputGain,
    setDistortionOutputGain: specialEffects.setDistortionOutputGain,
    distortionAsymmetry: specialEffects.distortionAsymmetry,
    setDistortionAsymmetry: specialEffects.setDistortionAsymmetry,
    distortionHarmonics: specialEffects.distortionHarmonics,
    setDistortionHarmonics: specialEffects.setDistortionHarmonics,
    distortionWetMix: specialEffects.distortionWetMix,
    setDistortionWetMix: specialEffects.setDistortionWetMix,

    // Special Effects - Pitch Shifter
    pitchShiftPresent: specialEffects.pitchShiftPresent,
    setPitchShiftPresent: specialEffects.setPitchShiftPresent,
    togglePitchShift: specialEffects.togglePitchShift,
    pitchShiftSemitones: specialEffects.pitchShiftSemitones,
    setPitchShiftSemitones: specialEffects.setPitchShiftSemitones,
    pitchShiftCents: specialEffects.pitchShiftCents,
    setPitchShiftCents: specialEffects.setPitchShiftCents,
    pitchShiftFormant: specialEffects.pitchShiftFormant,
    setPitchShiftFormant: specialEffects.setPitchShiftFormant,
    pitchShiftFormantCorrection: specialEffects.pitchShiftFormantCorrection,
    setPitchShiftFormantCorrection: specialEffects.setPitchShiftFormantCorrection,
    pitchShiftMix: specialEffects.pitchShiftMix,
    setPitchShiftMix: specialEffects.setPitchShiftMix,
    pitchShiftQuality: specialEffects.pitchShiftQuality,
    setPitchShiftQuality: specialEffects.setPitchShiftQuality,
    pitchShiftGrainSize: specialEffects.pitchShiftGrainSize,
    setPitchShiftGrainSize: specialEffects.setPitchShiftGrainSize,
    pitchShiftOverlap: specialEffects.pitchShiftOverlap,
    setPitchShiftOverlap: specialEffects.setPitchShiftOverlap,
    pitchShiftStretch: specialEffects.pitchShiftStretch,
    setPitchShiftStretch: specialEffects.setPitchShiftStretch,
    pitchShiftPreserveTimbre: specialEffects.pitchShiftPreserveTimbre,
    setPitchShiftPreserveTimbre: specialEffects.setPitchShiftPreserveTimbre,
    pitchShiftOutputGain: specialEffects.pitchShiftOutputGain,
    setPitchShiftOutputGain: specialEffects.setPitchShiftOutputGain,
    pitchShiftPan: specialEffects.pitchShiftPan,
    setPitchShiftPan: specialEffects.setPitchShiftPan,

    // Special Effects - Stereo Widener
    stereoWidenerPresent: specialEffects.stereoWidenerPresent,
    setStereoWidenerPresent: specialEffects.setStereoWidenerPresent,
    toggleStereoWidener: specialEffects.toggleStereoWidener,
    stereoWidenerWidth: specialEffects.stereoWidenerWidth,
    setStereoWidenerWidth: specialEffects.setStereoWidenerWidth,
    stereoWidenerDelay: specialEffects.stereoWidenerDelay,
    setStereoWidenerDelay: specialEffects.setStereoWidenerDelay,
    stereoWidenerBassRetain: specialEffects.stereoWidenerBassRetain,
    setStereoWidenerBassRetain: specialEffects.setStereoWidenerBassRetain,
    stereoWidenerBassFreq: specialEffects.stereoWidenerBassFreq,
    setStereoWidenerBassFreq: specialEffects.setStereoWidenerBassFreq,
    stereoWidenerMode: specialEffects.stereoWidenerMode,
    setStereoWidenerMode: specialEffects.setStereoWidenerMode,
    stereoWidenerMidGain: specialEffects.stereoWidenerMidGain,
    setStereoWidenerMidGain: specialEffects.setStereoWidenerMidGain,
    stereoWidenerSideGain: specialEffects.stereoWidenerSideGain,
    setStereoWidenerSideGain: specialEffects.setStereoWidenerSideGain,
    stereoWidenerPhase: specialEffects.stereoWidenerPhase,
    setStereoWidenerPhase: specialEffects.setStereoWidenerPhase,
    stereoWidenerCorrelation: specialEffects.stereoWidenerCorrelation,
    setStereoWidenerCorrelation: specialEffects.setStereoWidenerCorrelation,
    stereoWidenerHighFreqLimit: specialEffects.stereoWidenerHighFreqLimit,
    setStereoWidenerHighFreqLimit: specialEffects.setStereoWidenerHighFreqLimit,
    stereoWidenerSafetyLimit: specialEffects.stereoWidenerSafetyLimit,
    setStereoWidenerSafetyLimit: specialEffects.setStereoWidenerSafetyLimit,
    stereoWidenerOutputGain: specialEffects.stereoWidenerOutputGain,
    setStereoWidenerOutputGain: specialEffects.setStereoWidenerOutputGain,

    // Special Effects - Filter
    filterPresent: specialEffects.filterPresent,
    setFilterPresent: specialEffects.setFilterPresent,
    toggleFilter: specialEffects.toggleFilter,
    filterType: specialEffects.filterType,
    setFilterType: specialEffects.setFilterType,
    filterFrequency: specialEffects.filterFrequency,
    setFilterFrequency: specialEffects.setFilterFrequency,
    filterResonance: specialEffects.filterResonance,
    setFilterResonance: specialEffects.setFilterResonance,
    filterGain: specialEffects.filterGain,
    setFilterGain: specialEffects.setFilterGain,
    filterLfoRate: specialEffects.filterLfoRate,
    setFilterLfoRate: specialEffects.setFilterLfoRate,
    filterLfoDepth: specialEffects.filterLfoDepth,
    setFilterLfoDepth: specialEffects.setFilterLfoDepth,
    filterLfoWaveform: specialEffects.filterLfoWaveform,
    setFilterLfoWaveform: specialEffects.setFilterLfoWaveform,
    filterLfoTempoSync: specialEffects.filterLfoTempoSync,
    setFilterLfoTempoSync: specialEffects.setFilterLfoTempoSync,
    filterLfoNoteDiv: specialEffects.filterLfoNoteDiv,
    setFilterLfoNoteDiv: specialEffects.setFilterLfoNoteDiv,
    filterMix: specialEffects.filterMix,
    setFilterMix: specialEffects.setFilterMix,

    // Special Effects - Glitch
    glitchPresent: specialEffects.glitchPresent,
    setGlitchPresent: specialEffects.setGlitchPresent,
    toggleGlitch: specialEffects.toggleGlitch,
    glitchDivision: specialEffects.glitchDivision,
    setGlitchDivision: specialEffects.setGlitchDivision,
    glitchProbability: specialEffects.glitchProbability,
    setGlitchProbability: specialEffects.setGlitchProbability,
    glitchRepeats: specialEffects.glitchRepeats,
    setGlitchRepeats: specialEffects.setGlitchRepeats,
    glitchReverse: specialEffects.glitchReverse,
    setGlitchReverse: specialEffects.setGlitchReverse,
    glitchPitch: specialEffects.glitchPitch,
    setGlitchPitch: specialEffects.setGlitchPitch,
    glitchCrush: specialEffects.glitchCrush,
    setGlitchCrush: specialEffects.setGlitchCrush,
    glitchGate: specialEffects.glitchGate,
    setGlitchGate: specialEffects.setGlitchGate,

    // Special Effects - Frequency Shifter
    freqShiftPresent: specialEffects.freqShiftPresent,
    setFreqShiftPresent: specialEffects.setFreqShiftPresent,
    toggleFreqShift: specialEffects.toggleFreqShift,
    freqShiftAmount: specialEffects.freqShiftAmount,
    setFreqShiftAmount: specialEffects.setFreqShiftAmount,
    freqShiftFeedback: specialEffects.freqShiftFeedback,
    setFreqShiftFeedback: specialEffects.setFreqShiftFeedback,
    freqShiftMix: specialEffects.freqShiftMix,
    setFreqShiftMix: specialEffects.setFreqShiftMix,

    // Special Effects - Granular
    granularPresent: specialEffects.granularPresent,
    setGranularPresent: specialEffects.setGranularPresent,
    toggleGranular: specialEffects.toggleGranular,
    granularGrainSize: specialEffects.granularGrainSize,
    setGranularGrainSize: specialEffects.setGranularGrainSize,
    granularPosition: specialEffects.granularPosition,
    setGranularPosition: specialEffects.setGranularPosition,
    granularSpray: specialEffects.granularSpray,
    setGranularSpray: specialEffects.setGranularSpray,
    granularPitch: specialEffects.granularPitch,
    setGranularPitch: specialEffects.setGranularPitch,
    granularDensity: specialEffects.granularDensity,
    setGranularDensity: specialEffects.setGranularDensity,
    granularReverse: specialEffects.granularReverse,
    setGranularReverse: specialEffects.setGranularReverse,

    // Special Effects - Paulstretch
    paulstretchPresent: specialEffects.paulstretchPresent,
    setPaulstretchPresent: specialEffects.setPaulstretchPresent,
    togglePaulstretch: specialEffects.togglePaulstretch,
    paulstretchFactor: specialEffects.paulstretchFactor,
    setPaulstretchFactor: specialEffects.setPaulstretchFactor,
    paulstretchWindow: specialEffects.paulstretchWindow,
    setPaulstretchWindow: specialEffects.setPaulstretchWindow,
    paulstretchSmooth: specialEffects.paulstretchSmooth,
    setPaulstretchSmooth: specialEffects.setPaulstretchSmooth,

    // Special Effects - Spectral
    spectralPresent: specialEffects.spectralPresent,
    setSpectralPresent: specialEffects.setSpectralPresent,
    toggleSpectral: specialEffects.toggleSpectral,

    // Global
    globalBPM: globalEffects.globalBPM,
    setGlobalBPM: globalEffects.setGlobalBPM,
    tempoSyncEnabled: globalEffects.tempoSyncEnabled,
    setTempoSyncEnabled: globalEffects.setTempoSyncEnabled,
    cutRegion: globalEffects.cutRegion,
    setCutRegion: globalEffects.setCutRegion,

    // Combined reset
    resetEffects,
  }), [
    eq,
    dynamics,
    modulation,
    timeBased,
    specialEffects,
    globalEffects,
    resetEffects,
  ]);

  return (
    <LegacyCombinedContext.Provider value={combinedValue}>
      {children}
    </LegacyCombinedContext.Provider>
  );
}

/**
 * Main Combined Effects Provider
 * Composes all individual providers and provides backward compatibility
 */
export function CombinedEffectsProvider({ children }) {
  return (
    <GlobalEffectsProvider>
      <EQProvider>
        <DynamicsProvider>
          <ModulationProvider>
            <TimeBasedProvider>
              <SpecialEffectsProvider>
                <LegacyCombinedProvider>
                  {children}
                </LegacyCombinedProvider>
              </SpecialEffectsProvider>
            </TimeBasedProvider>
          </ModulationProvider>
        </DynamicsProvider>
      </EQProvider>
    </GlobalEffectsProvider>
  );
}

// Track whether deprecation warning has been shown (per session)
let deprecationWarningShown = false;

/**
 * Legacy useEffects hook for backward compatibility
 *
 * @deprecated Use specific hooks for better performance:
 * - useEQ() for EQ and Mid/Side processing
 * - useDynamics() for Compressor, Gate, Limiter
 * - useModulation() for Chorus, Phaser, Flanger, Tremolo, etc.
 * - useTimeBased() for Echo, Reverb, Delay
 * - useSpecialEffects() for Distortion, Pitch Shifter, etc.
 * - useGlobalEffects() for BPM, Tempo Sync
 *
 * This combined hook causes re-renders when ANY effect changes,
 * even if your component only uses one effect type.
 *
 * @example Migration:
 * // Before (causes unnecessary re-renders):
 * const { filters, setFilters, compressorPresent } = useEffects();
 *
 * // After (only re-renders when EQ changes):
 * const { filters, setFilters } = useEQ();
 * const { compressorPresent } = useDynamics();
 */
export function useCombinedEffects() {
  const context = useContext(LegacyCombinedContext);
  if (!context) {
    throw new Error('useCombinedEffects must be used within CombinedEffectsProvider');
  }

  // Show deprecation warning once per session in development
  const hasWarnedRef = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      !deprecationWarningShown &&
      !hasWarnedRef.current
    ) {
      hasWarnedRef.current = true;
      deprecationWarningShown = true;

      console.warn(
        `%c[EffectsContext Migration Notice]%c\n` +
        `You're using the legacy useEffects() hook. Consider migrating to specific hooks for better performance:\n\n` +
        `  import { useEQ, useDynamics, useModulation } from 'contexts/effects';\n\n` +
        `  // Instead of: const { filters, compressorPresent } = useEffects();\n` +
        `  // Use:        const { filters } = useEQ();\n` +
        `  //             const { compressorPresent } = useDynamics();\n\n` +
        `This message appears once per session. See contexts/EffectsContext.js for full migration guide.`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );
    }
  }, []);

  return context;
}
