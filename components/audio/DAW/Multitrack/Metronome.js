// components/audio/DAW/Multitrack/Metronome.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { BsRecordCircle } from 'react-icons/bs';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function Metronome({ tempo = 120 }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentTempo, setCurrentTempo] = useState(tempo);
  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const timerIDRef = useRef(null);
  
  const { isPlaying, currentTime } = useMultitrack();

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Create click sound
  const playClick = (isAccent = false) => {
    if (!audioContextRef.current || !isEnabled) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Different pitch for accent
    osc.frequency.value = isAccent ? 1000 : 800;
    
    // Short envelope
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  };

  // Scheduling function
  const scheduler = () => {
    if (!audioContextRef.current || !isEnabled || !isPlaying) return;
    
    const ctx = audioContextRef.current;
    const secondsPerBeat = 60.0 / currentTempo;
    
    // Schedule notes while we're less than 0.1 seconds ahead
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const isAccent = currentBeatRef.current % 4 === 0;
      
      // Schedule the click
      setTimeout(() => {
        playClick(isAccent);
      }, (nextNoteTimeRef.current - ctx.currentTime) * 1000);
      
      // Advance to next beat
      nextNoteTimeRef.current += secondsPerBeat;
      currentBeatRef.current++;
    }
  };

  // Start/stop metronome based on playback state
  useEffect(() => {
    if (isPlaying && isEnabled) {
      // Reset timing
      if (audioContextRef.current) {
        nextNoteTimeRef.current = audioContextRef.current.currentTime;
        currentBeatRef.current = Math.floor(currentTime * currentTempo / 60);
      }
      
      // Start scheduler
      scheduler();
      timerIDRef.current = setInterval(scheduler, 25); // Check every 25ms
    } else {
      // Stop scheduler
      if (timerIDRef.current) {
        clearInterval(timerIDRef.current);
        timerIDRef.current = null;
      }
    }
    
    return () => {
      if (timerIDRef.current) {
        clearInterval(timerIDRef.current);
      }
    };
  }, [isPlaying, isEnabled, currentTempo, currentTime]);

  return (
    <div className="metronome-container d-flex align-items-center gap-2">
      <Button
        size="sm"
        variant={isEnabled ? 'primary' : 'outline-secondary'}
        onClick={() => setIsEnabled(!isEnabled)}
        title="Toggle metronome"
      >
        <BsRecordCircle /> Click
      </Button>
      
      <Form.Control
        type="number"
        min="40"
        max="300"
        value={currentTempo}
        onChange={(e) => setCurrentTempo(parseInt(e.target.value) || 120)}
        style={{ width: '70px' }}
        size="sm"
      />
      
      <span className="text-muted small">BPM</span>
    </div>
  );
}