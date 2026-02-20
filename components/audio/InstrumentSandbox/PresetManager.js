'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Card, Row, Col, Button, ListGroup, Badge, Form } from 'react-bootstrap';
import { FaSave, FaTrash, FaCheck, FaFolder, FaMagic, FaGuitar, FaKeyboard, FaWater, FaBell, FaMusic, FaWaveSquare, FaDrum, FaMicrophone } from 'react-icons/fa';
import { GiSoundWaves, GiPianoKeys } from 'react-icons/gi';
import { MdGraphicEq } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';

const PresetManager = ({ show, onHide, onSelect, currentPreset }) => {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Default factory presets
  const factoryPresets = [
    {
      name: 'Default Saw',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 8000,
        filterResonance: 2,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        detune: 0,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 0,
        delay: 0,
        distortion: 0,
        osc2Enabled: false,
        osc2Type: 'sawtooth',
        osc2Detune: 7,
        osc2Pitch: 0,
        oscMix: 50,
        subOscEnabled: false,
        subOscType: 'square',
        subOscLevel: 50,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0,
        noiseType: 'white',
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Deep Bass',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 400,
        filterResonance: 15,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.2,
        sustain: 0.8,
        release: 0.2,
        detune: -5,
        lfoRate: 0.5,
        lfoAmount: 10,
        reverb: 10,
        delay: 0,
        distortion: 20,
        osc2Enabled: false,
        subOscEnabled: true,
        subOscType: 'square',
        subOscLevel: 60,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Dual Saw Lead',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 3500,
        filterResonance: 10,
        filterType: 'lowpass',
        attack: 0.005,
        decay: 0.05,
        sustain: 0.6,
        release: 0.5,
        detune: 0,
        lfoRate: 5,
        lfoAmount: 5,
        reverb: 20,
        delay: 30,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: 7,
        osc2Pitch: 0,
        oscMix: 45,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Ambient Pad',
      params: {
        oscillatorType: 'triangle',
        filterCutoff: 1200,
        filterResonance: 2,
        filterType: 'lowpass',
        attack: 1.5,
        decay: 0.5,
        sustain: 0.7,
        release: 2.0,
        detune: 12,
        lfoRate: 0.2,
        lfoAmount: 15,
        reverb: 60,
        delay: 40,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sine',
        osc2Pitch: 12,
        osc2Detune: 2,
        oscMix: 30,
        subOscEnabled: false,
        noiseLevel: 5,
        noiseType: 'pink',
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Funky Bass',
      params: {
        oscillatorType: 'square',
        filterCutoff: 800,
        filterResonance: 20,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.3,
        sustain: 0.2,
        release: 0.1,
        detune: 2,
        lfoRate: 8,
        lfoAmount: 30,
        reverb: 15,
        delay: 10,
        distortion: 5,
        osc2Enabled: false,
        subOscEnabled: true,
        subOscType: 'sine',
        subOscLevel: 70,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Noise Sweep',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 2000,
        filterResonance: 15,
        filterType: 'bandpass',
        attack: 0.5,
        decay: 0.3,
        sustain: 0.5,
        release: 1.0,
        detune: 0,
        lfoRate: 2,
        lfoAmount: 40,
        reverb: 40,
        delay: 20,
        distortion: 0,
        osc2Enabled: false,
        subOscEnabled: false,
        noiseLevel: 50,
        noiseType: 'white',
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Super Saw',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 5000,
        filterResonance: 5,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.1,
        sustain: 0.8,
        release: 0.3,
        detune: 10,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 25,
        delay: 15,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: -10,
        osc2Pitch: 0,
        oscMix: 50,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Hi-Pass Pluck',
      params: {
        oscillatorType: 'square',
        filterCutoff: 4000,
        filterResonance: 8,
        filterType: 'highpass',
        attack: 0.001,
        decay: 0.2,
        sustain: 0.1,
        release: 0.5,
        detune: 0,
        lfoRate: 6,
        lfoAmount: 10,
        reverb: 30,
        delay: 20,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'triangle',
        osc2Pitch: -12,
        osc2Detune: 3,
        oscMix: 35,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Filter Sweep',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 500,
        filterResonance: 12,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.3,
        sustain: 0.6,
        release: 0.5,
        detune: 5,
        lfoRate: 3,
        lfoAmount: 10,
        reverb: 35,
        delay: 25,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: -5,
        osc2Pitch: 0,
        oscMix: 50,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0,
        // Filter envelope
        filterEnvAmount: 80,
        filterAttack: 0.02,
        filterDecay: 0.5,
        filterSustain: 0.3,
        filterRelease: 0.8,
        // No PWM for sawtooth
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        // LFO2 modulating filter
        lfo2Target: 'filter',
        lfo2Rate: 0.5,
        lfo2Amount: 30,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'PWM Pad',
      params: {
        oscillatorType: 'square',
        filterCutoff: 2000,
        filterResonance: 5,
        filterType: 'lowpass',
        attack: 0.8,
        decay: 0.2,
        sustain: 0.8,
        release: 1.5,
        detune: 0,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 50,
        delay: 35,
        distortion: 0,
        osc2Enabled: false,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0,
        // Filter envelope
        filterEnvAmount: -50,
        filterAttack: 1.0,
        filterDecay: 0.5,
        filterSustain: 0.6,
        filterRelease: 2.0,
        // PWM settings
        pulseWidth: 50,
        pwmAmount: 70,
        pwmRate: 0.3,
        // No LFO2
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Tremolo Lead',
      params: {
        oscillatorType: 'square',
        filterCutoff: 4000,
        filterResonance: 8,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.05,
        sustain: 0.8,
        release: 0.2,
        detune: 2,
        lfoRate: 5,
        lfoAmount: 8,
        reverb: 20,
        delay: 15,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'triangle',
        osc2Detune: 1,
        osc2Pitch: 12,
        oscMix: 30,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0,
        // Filter envelope
        filterEnvAmount: 40,
        filterAttack: 0.001,
        filterDecay: 0.1,
        filterSustain: 0.5,
        filterRelease: 0.2,
        // No PWM
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        // LFO2 modulating amplitude
        lfo2Target: 'amp',
        lfo2Rate: 6,
        lfo2Amount: 40,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'FM Bell',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 10000,
        filterResonance: 1,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.5,
        sustain: 0.2,
        release: 2.0,
        detune: 0,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 45,
        delay: 30,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sine',
        osc2Detune: 0,
        osc2Pitch: 7,  // Perfect fifth for bell-like tone
        oscMix: 20,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: -30,
        filterAttack: 0.001,
        filterDecay: 0.3,
        filterSustain: 0.2,
        filterRelease: 1.0,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 65,  // FM creates the bell harmonics
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Ring Mod Robot',
      params: {
        oscillatorType: 'square',
        filterCutoff: 3000,
        filterResonance: 8,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.1,
        sustain: 0.8,
        release: 0.1,
        detune: 0,
        lfoRate: 3,
        lfoAmount: 5,
        reverb: 20,
        delay: 15,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'square',
        osc2Detune: 3,
        osc2Pitch: 19,  // Non-harmonic interval for metallic sound
        oscMix: 50,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 50,
        filterAttack: 0.001,
        filterDecay: 0.05,
        filterSustain: 0.7,
        filterRelease: 0.1,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'filter',
        lfo2Rate: 8,
        lfo2Amount: 20,
        fmAmount: 0,
        ringModAmount: 80,  // Ring modulation for metallic/robotic sound
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Sync Lead',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 5000,
        filterResonance: 10,
        filterType: 'lowpass',
        attack: 0.005,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        detune: 2,
        lfoRate: 5,
        lfoAmount: 3,
        reverb: 25,
        delay: 20,
        distortion: 15,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: 5,
        osc2Pitch: 7,  // Sync sweep range
        oscMix: 40,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 40,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'pitch',
        lfo2Rate: 0.3,
        lfo2Amount: 15,  // Slow pitch sweep for sync
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: true,  // Oscillator sync for aggressive lead
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'FM Piano',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 8000,
        filterResonance: 2,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.3,
        sustain: 0.4,
        release: 0.5,
        detune: 1,
        lfoRate: 4.5,
        lfoAmount: 2,
        reverb: 30,
        delay: 10,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sine',
        osc2Detune: 0,
        osc2Pitch: 0,
        oscMix: 30,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: -20,
        filterAttack: 0.001,
        filterDecay: 0.5,
        filterSustain: 0.3,
        filterRelease: 0.5,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 35,  // Moderate FM for electric piano tone
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Bit Crushed Chaos',
      params: {
        oscillatorType: 'square',
        filterCutoff: 2000,
        filterResonance: 15,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.1,
        sustain: 0.9,
        release: 0.1,
        detune: 10,
        lfoRate: 8,
        lfoAmount: 20,
        reverb: 25,
        delay: 35,
        distortion: 30,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: -7,
        osc2Pitch: 0,
        oscMix: 60,
        subOscEnabled: false,
        noiseLevel: 10,
        noiseType: 'white',
        filterEnvAmount: 60,
        filterAttack: 0.001,
        filterDecay: 0.05,
        filterSustain: 0.3,
        filterRelease: 0.1,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'filter',
        lfo2Rate: 15,
        lfo2Amount: 40,
        fmAmount: 30,
        ringModAmount: 20,
        oscSync: false,
        bitCrushBits: 4,  // Lo-fi 4-bit sound
        bitCrushRate: 8000,  // Reduced sample rate
        waveFoldAmount: 50,  // Wave folding distortion
        feedbackAmount: 35,  // Some feedback chaos
        formantShift: 0
      },
      factory: true
    },
    {
      name: 'Vowel Morph',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 1000,
        filterResonance: 5,
        filterType: 'lowpass',
        attack: 0.05,
        decay: 0.2,
        sustain: 0.7,
        release: 0.3,
        detune: 5,
        lfoRate: 0.5,
        lfoAmount: 5,
        reverb: 40,
        delay: 20,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'square',
        osc2Detune: 2,
        osc2Pitch: 12,
        oscMix: 40,
        subOscEnabled: false,
        noiseLevel: 5,
        noiseType: 'pink',
        filterEnvAmount: 30,
        filterAttack: 0.1,
        filterDecay: 0.3,
        filterSustain: 0.5,
        filterRelease: 0.5,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 50  // Morphing through vowel sounds
      },
      factory: true
    },
    {
      name: 'Glitch Machine',
      params: {
        oscillatorType: 'triangle',
        filterCutoff: 5000,
        filterResonance: 20,
        filterType: 'bandpass',
        attack: 0.001,
        decay: 0.01,
        sustain: 0.5,
        release: 0.05,
        detune: -20,
        lfoRate: 20,
        lfoAmount: 50,
        reverb: 10,
        delay: 40,
        distortion: 20,
        osc2Enabled: true,
        osc2Type: 'square',
        osc2Detune: 100,
        osc2Pitch: -12,
        oscMix: 70,
        subOscEnabled: false,
        noiseLevel: 30,
        noiseType: 'white',
        filterEnvAmount: 80,
        filterAttack: 0.001,
        filterDecay: 0.02,
        filterSustain: 0.1,
        filterRelease: 0.05,
        pulseWidth: 25,
        pwmAmount: 60,
        pwmRate: 13,
        lfo2Target: 'amp',
        lfo2Rate: 11,
        lfo2Amount: 70,
        fmAmount: 40,
        ringModAmount: 60,
        oscSync: false,
        bitCrushBits: 6,
        bitCrushRate: 11000,
        waveFoldAmount: 70,
        feedbackAmount: 60,
        formantShift: 30
      },
      factory: true
    },
    {
      name: 'Feedback Loop',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 1500,
        filterResonance: 25,
        filterType: 'lowpass',
        attack: 0.5,
        decay: 0.5,
        sustain: 0.6,
        release: 1.0,
        detune: 0,
        lfoRate: 0.2,
        lfoAmount: 10,
        reverb: 60,
        delay: 50,
        distortion: 15,
        osc2Enabled: false,
        subOscEnabled: true,
        subOscType: 'sine',
        subOscLevel: 80,
        noiseLevel: 20,
        noiseType: 'pink',
        filterEnvAmount: -40,
        filterAttack: 0.3,
        filterDecay: 0.5,
        filterSustain: 0.4,
        filterRelease: 1.0,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'filter',
        lfo2Rate: 0.1,
        lfo2Amount: 60,
        fmAmount: 0,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 12,
        bitCrushRate: 22000,
        waveFoldAmount: 30,
        feedbackAmount: 85,  // Maximum safe feedback
        formantShift: 0,
        grainSize: 100,
        grainSpeed: 1.0,
        grainReverse: false,
        grainFreeze: false,
        combFreq: 440,
        combFeedback: 0,
        combMix: 0,
        sampleHoldRate: 10,
        sampleHoldAmount: 0,
        sampleHoldTarget: 'pitch'
      },
      factory: true
    },
    {
      name: 'Stutter Glitch',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 3000,
        filterResonance: 10,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.05,
        sustain: 0.8,
        release: 0.1,
        detune: 5,
        lfoRate: 12,
        lfoAmount: 15,
        reverb: 30,
        delay: 40,
        distortion: 20,
        osc2Enabled: true,
        osc2Type: 'square',
        osc2Detune: 20,
        osc2Pitch: -5,
        oscMix: 60,
        subOscEnabled: false,
        noiseLevel: 15,
        noiseType: 'white',
        filterEnvAmount: 50,
        filterAttack: 0.001,
        filterDecay: 0.03,
        filterSustain: 0.4,
        filterRelease: 0.1,
        pulseWidth: 30,
        pwmAmount: 50,
        pwmRate: 18,
        lfo2Target: 'amp',
        lfo2Rate: 16,
        lfo2Amount: 50,
        fmAmount: 25,
        ringModAmount: 30,
        oscSync: false,
        bitCrushBits: 8,
        bitCrushRate: 16000,
        waveFoldAmount: 40,
        feedbackAmount: 45,
        formantShift: 0,
        grainSize: 50,  // Small grain size for stutter effect
        grainSpeed: 0.5,  // Half speed playback
        grainReverse: false,
        grainFreeze: false,
        combFreq: 440,
        combFeedback: 0,
        combMix: 0,
        sampleHoldRate: 20,
        sampleHoldAmount: 60,
        sampleHoldTarget: 'pitch'  // Random pitch jumps
      },
      factory: true
    },
    {
      name: 'Metallic Bell',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 8000,
        filterResonance: 3,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.8,
        sustain: 0.2,
        release: 2.5,
        detune: 0,
        lfoRate: 2,
        lfoAmount: 3,
        reverb: 50,
        delay: 35,
        distortion: 5,
        osc2Enabled: true,
        osc2Type: 'triangle',
        osc2Detune: 0,
        osc2Pitch: 19,  // Non-harmonic interval
        oscMix: 25,
        subOscEnabled: false,
        noiseLevel: 5,
        noiseType: 'pink',
        filterEnvAmount: -40,
        filterAttack: 0.001,
        filterDecay: 0.5,
        filterSustain: 0.1,
        filterRelease: 1.5,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        fmAmount: 45,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 16,
        bitCrushRate: 44100,
        waveFoldAmount: 0,
        feedbackAmount: 0,
        formantShift: 0,
        grainSize: 100,
        grainSpeed: 1.0,
        grainReverse: false,
        grainFreeze: false,
        combFreq: 800,  // Comb filter for metallic resonance
        combFeedback: 70,  // High resonance
        combMix: 50,  // 50% wet
        sampleHoldRate: 10,
        sampleHoldAmount: 0,
        sampleHoldTarget: 'pitch'
      },
      factory: true
    },
    {
      name: 'Frozen Texture',
      params: {
        oscillatorType: 'triangle',
        filterCutoff: 2000,
        filterResonance: 8,
        filterType: 'bandpass',
        attack: 0.5,
        decay: 0.3,
        sustain: 0.8,
        release: 1.5,
        detune: 10,
        lfoRate: 0.3,
        lfoAmount: 20,
        reverb: 70,
        delay: 55,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'sine',
        osc2Detune: -8,
        osc2Pitch: 12,
        oscMix: 45,
        subOscEnabled: true,
        subOscType: 'square',
        subOscLevel: 40,
        noiseLevel: 25,
        noiseType: 'pink',
        filterEnvAmount: 30,
        filterAttack: 0.3,
        filterDecay: 0.5,
        filterSustain: 0.6,
        filterRelease: 1.2,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'filter',
        lfo2Rate: 0.15,
        lfo2Amount: 50,
        fmAmount: 15,
        ringModAmount: 0,
        oscSync: false,
        bitCrushBits: 14,
        bitCrushRate: 32000,
        waveFoldAmount: 20,
        feedbackAmount: 25,
        formantShift: 0,
        grainSize: 300,  // Large grains
        grainSpeed: 0.7,  // Slow motion
        grainReverse: true,  // Reversed playback
        grainFreeze: false,  // Can freeze manually
        combFreq: 440,
        combFeedback: 0,
        combMix: 0,
        sampleHoldRate: 10,
        sampleHoldAmount: 0,
        sampleHoldTarget: 'pitch'
      },
      factory: true
    },
    {
      name: 'Random Walk',
      params: {
        oscillatorType: 'square',
        filterCutoff: 1500,
        filterResonance: 18,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.15,
        sustain: 0.6,
        release: 0.3,
        detune: 0,
        lfoRate: 8,
        lfoAmount: 10,
        reverb: 35,
        delay: 45,
        distortion: 15,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: 5,
        osc2Pitch: 0,
        oscMix: 55,
        subOscEnabled: false,
        noiseLevel: 10,
        noiseType: 'white',
        filterEnvAmount: 60,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.4,
        filterRelease: 0.3,
        pulseWidth: 40,
        pwmAmount: 35,
        pwmRate: 7,
        lfo2Target: 'pitch',
        lfo2Rate: 3,
        lfo2Amount: 30,
        fmAmount: 20,
        ringModAmount: 15,
        oscSync: false,
        bitCrushBits: 10,
        bitCrushRate: 18000,
        waveFoldAmount: 35,
        feedbackAmount: 30,
        formantShift: 0,
        grainSize: 100,
        grainSpeed: 1.0,
        grainReverse: false,
        grainFreeze: false,
        combFreq: 440,
        combFeedback: 0,
        combMix: 0,
        sampleHoldRate: 8,  // Sample & hold creates random stepped modulation
        sampleHoldAmount: 80,  // High amount
        sampleHoldTarget: 'filter'  // Random filter cutoff changes
      },
      factory: true
    },
    {
      name: 'IDM Pluck',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 4000,
        filterResonance: 12,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.15,
        sustain: 0.1,
        release: 0.4,
        detune: 3,
        lfoRate: 10,
        lfoAmount: 5,
        reverb: 40,
        delay: 30,
        distortion: 12,
        osc2Enabled: true,
        osc2Type: 'triangle',
        osc2Detune: -4,
        osc2Pitch: -12,
        oscMix: 40,
        subOscEnabled: true,
        subOscType: 'sine',
        subOscLevel: 50,
        noiseLevel: 8,
        noiseType: 'pink',
        filterEnvAmount: 70,
        filterAttack: 0.001,
        filterDecay: 0.1,
        filterSustain: 0.2,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'amp',
        lfo2Rate: 12,
        lfo2Amount: 25,
        fmAmount: 30,
        ringModAmount: 10,
        oscSync: false,
        bitCrushBits: 12,
        bitCrushRate: 24000,
        waveFoldAmount: 25,
        feedbackAmount: 20,
        formantShift: 0,
        grainSize: 80,  // Short grains for glitchy texture
        grainSpeed: 1.2,  // Slightly faster
        grainReverse: false,
        grainFreeze: false,
        combFreq: 1200,  // Higher resonant frequency
        combFeedback: 55,  // Moderate resonance
        combMix: 35,  // Subtle metallic character
        sampleHoldRate: 15,
        sampleHoldAmount: 40,
        sampleHoldTarget: 'pwm'  // Random pulse width variations
      },
      factory: true
    }
  ];

  // Load presets from localStorage
  useEffect(() => {
    const loadedPresets = JSON.parse(localStorage.getItem('instrumentPresets') || '[]');
    setPresets([...factoryPresets, ...loadedPresets]);
  }, []);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
  };

  const handleApplyPreset = () => {
    if (selectedPreset) {
      onSelect(selectedPreset);
    }
  };

  const handleDeletePreset = (presetToDelete, e) => {
    e.stopPropagation();
    if (presetToDelete.factory) {
      alert('Cannot delete factory presets');
      return;
    }

    if (confirm(`Are you sure you want to delete "${presetToDelete.name}"?`)) {
      const updatedPresets = presets.filter(p => p !== presetToDelete);
      const userPresets = updatedPresets.filter(p => !p.factory);
      localStorage.setItem('instrumentPresets', JSON.stringify(userPresets));
      setPresets(updatedPresets);

      if (selectedPreset === presetToDelete) {
        setSelectedPreset(null);
      }
    }
  };

  const getCategoryIcon = (preset) => {
    const name = preset.name.toLowerCase();

    // Bass presets - deep purple
    if (name.includes('bass')) return <FaGuitar size={20} style={{ color: '#9b59b6' }} />;
    if (name.includes('funky')) return <FaGuitar size={20} style={{ color: '#8e44ad' }} />;

    // Lead presets - bright blue
    if (name.includes('lead')) return <FaKeyboard size={20} style={{ color: '#3498db' }} />;
    if (name.includes('dual')) return <IoMusicalNotes size={20} style={{ color: '#2980b9' }} />;

    // Pad presets - teal
    if (name.includes('pad')) return <FaWater size={20} style={{ color: '#1abc9c' }} />;
    if (name.includes('ambient')) return <FaWater size={20} style={{ color: '#16a085' }} />;
    if (name.includes('pwm')) return <IoMusicalNotes size={20} style={{ color: '#1abc9c' }} />;

    // Bell/Pluck presets - gold
    if (name.includes('bell')) return <FaBell size={20} style={{ color: '#f39c12' }} />;
    if (name.includes('pluck')) return <GiPianoKeys size={20} style={{ color: '#e67e22' }} />;

    // Effect-based presets - green
    if (name.includes('sweep')) return <MdGraphicEq size={20} style={{ color: '#27ae60' }} />;
    if (name.includes('filter')) return <MdGraphicEq size={20} style={{ color: '#2ecc71' }} />;
    if (name.includes('tremolo')) return <FaMicrophone size={20} style={{ color: '#27ae60' }} />;

    // Noise/Texture presets - orange/red
    if (name.includes('noise')) return <GiSoundWaves size={20} style={{ color: '#e74c3c' }} />;
    if (name.includes('texture')) return <GiSoundWaves size={20} style={{ color: '#d35400' }} />;
    if (name.includes('frozen')) return <FaWater size={20} style={{ color: '#3498db' }} />;

    // Saw presets - pink
    if (name.includes('saw')) return <FaWaveSquare size={20} style={{ color: '#e91e63' }} />;
    if (name.includes('super')) return <FaDrum size={20} style={{ color: '#c2185b' }} />;

    // Warm/Pure presets - warm orange
    if (name.includes('warm') || name.includes('triangle')) return <GiSoundWaves size={20} style={{ color: '#ff9800' }} />;
    if (name.includes('pure') || name.includes('sine')) return <FaMusic size={20} style={{ color: '#ff5722' }} />;

    // Experimental/Glitch presets - neon colors
    if (name.includes('glitch')) return <MdGraphicEq size={20} style={{ color: '#00ff00' }} />;
    if (name.includes('stutter')) return <FaDrum size={20} style={{ color: '#00ffff' }} />;
    if (name.includes('bit crush') || name.includes('chaos')) return <FaMicrophone size={20} style={{ color: '#ff00ff' }} />;
    if (name.includes('feedback')) return <GiSoundWaves size={20} style={{ color: '#ff6b6b' }} />;
    if (name.includes('vowel') || name.includes('morph')) return <FaMicrophone size={20} style={{ color: '#a29bfe' }} />;
    if (name.includes('robot') || name.includes('ring')) return <FaDrum size={20} style={{ color: '#fd79a8' }} />;
    if (name.includes('sync')) return <FaWaveSquare size={20} style={{ color: '#fdcb6e' }} />;
    if (name.includes('fm')) return <FaKeyboard size={20} style={{ color: '#fab1a0' }} />;
    if (name.includes('metallic')) return <FaBell size={20} style={{ color: '#c0c0c0' }} />;
    if (name.includes('random')) return <MdGraphicEq size={20} style={{ color: '#6c5ce7' }} />;
    if (name.includes('idm')) return <GiPianoKeys size={20} style={{ color: '#74b9ff' }} />;

    // Default preset - gray-blue
    if (name.includes('default')) return <FaWaveSquare size={20} style={{ color: '#607d8b' }} />;

    // Fallback - primary blue
    return <FaMusic size={20} style={{ color: '#0d6efd' }} />;
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-light border-secondary">
        <Modal.Title className="d-flex align-items-center gap-2">
          <FaFolder /> Preset Manager
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark">
        <Row>
          {/* Preset List */}
          <Col md={8}>
            <Card className="bg-secondary border-0">
              <Card.Header className="bg-dark text-light border-secondary">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Available Presets</span>
                  <Badge bg="primary">{presets.length} presets</Badge>
                </div>
              </Card.Header>
              <Card.Body className="p-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <ListGroup variant="flush">
                  {presets.map((preset, index) => (
                    <ListGroup.Item
                      key={index}
                      className={`bg-dark text-light border-secondary ${selectedPreset === preset ? 'border border-primary' : ''}`}
                      action
                      onClick={() => handleSelectPreset(preset)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                          <div className="d-flex align-items-center justify-content-center" style={{ width: '24px' }}>
                            {getCategoryIcon(preset)}
                          </div>
                          <div>
                            <div className="fw-bold">{preset.name}</div>
                            <div className="small text-muted">
                              {preset.factory ? (
                                <Badge bg="info" size="sm">Factory</Badge>
                              ) : (
                                <Badge bg="success" size="sm">Custom</Badge>
                              )}
                              {currentPreset === preset.name && (
                                <Badge bg="warning" className="ms-2" size="sm">
                                  <FaCheck /> Current
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {!preset.factory && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={(e) => handleDeletePreset(preset, e)}
                          >
                            <FaTrash />
                          </Button>
                        )}
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>

          {/* Preset Details */}
          <Col md={4}>
            <Card className="bg-secondary border-0">
              <Card.Header className="bg-dark text-light border-secondary">
                <span>Preset Details</span>
              </Card.Header>
              <Card.Body className="text-light">
                {selectedPreset ? (
                  <div>
                    <h6 className="mb-3">{selectedPreset.name}</h6>
                    <div className="small">
                      <div className="mb-2">
                        <strong>Oscillator:</strong> {selectedPreset.params.oscillatorType}
                      </div>
                      <div className="mb-2">
                        <strong>Filter:</strong> {selectedPreset.params.filterCutoff}Hz
                      </div>
                      <div className="mb-2">
                        <strong>Envelope:</strong> A:{selectedPreset.params.attack}s D:{selectedPreset.params.decay}s
                      </div>
                      <div className="mb-2">
                        <strong>Effects:</strong>
                        <div className="ms-2">
                          Reverb: {selectedPreset.params.reverb}%<br />
                          Delay: {selectedPreset.params.delay}%<br />
                          Distortion: {selectedPreset.params.distortion}%
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted py-5">
                    <FaMagic size={48} className="mb-3" />
                    <p>Select a preset to view details</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Modal.Body>

      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApplyPreset}
          disabled={!selectedPreset}
        >
          Apply Preset
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PresetManager;