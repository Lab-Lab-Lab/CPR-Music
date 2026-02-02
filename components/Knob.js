'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './Knob.module.css';

/**
 * Custom rotary knob component for audio controls
 */
export default function Knob({ 
  value = 0, 
  min = 0, 
  max = 1, 
  step = 0.01,
  onChange,
  label = '',
  displayValue,
  size = 50,
  color = '#7bafd4'
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const knobRef = useRef(null);
  const startAngle = useRef(0);
  const startValue = useRef(0);
  const knobCenter = useRef({ x: 0, y: 0 });
  const lastValidAngle = useRef(0);
  const totalRotation = useRef(0);
  
  useEffect(() => {
    setInternalValue(value);
  }, [value]);
  
  // Convert value to rotation angle (0-270 degrees)
  const valueToAngle = (val) => {
    const normalized = (val - min) / (max - min);
    return normalized * 270 - 135; // -135 to 135 degrees
  };
  
  // Calculate angle from mouse position relative to knob center
  const getAngleFromMouse = (mouseX, mouseY) => {
    const deltaX = mouseX - knobCenter.current.x;
    const deltaY = mouseY - knobCenter.current.y;
    // atan2 returns angle in radians, convert to degrees
    let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    // Normalize to 0-360 range for consistency
    if (angle < 0) angle += 360;
    return angle;
  };

  // Convert angle change to value change
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const currentAngle = getAngleFromMouse(e.clientX, e.clientY);
    let angleDelta = currentAngle - lastValidAngle.current;
    
    // Handle wrap-around at 0°/360° boundary
    if (angleDelta > 180) {
      angleDelta -= 360;
    } else if (angleDelta < -180) {
      angleDelta += 360;
    }
    
    // Only apply angle change if it's reasonable (prevents massive jumps)
    if (Math.abs(angleDelta) < 90) {
      // Accumulate total rotation
      totalRotation.current += angleDelta;
      lastValidAngle.current = currentAngle;
      
      // Map total rotation to value change
      const rotationRange = 270; // knob rotates 270 degrees total
      const valueRange = max - min;
      const valueDelta = (totalRotation.current / rotationRange) * valueRange;
      
      const newValue = startValue.current + valueDelta;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      const steppedValue = Math.round(clampedValue / step) * step;
      
      setInternalValue(steppedValue);
      onChange && onChange(steppedValue);
    }
  };
  
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    
    // Calculate knob center position
    const rect = knobRef.current.getBoundingClientRect();
    knobCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    // Store starting angle and value
    startAngle.current = getAngleFromMouse(e.clientX, e.clientY);
    lastValidAngle.current = startAngle.current;
    totalRotation.current = 0; // Reset total rotation
    startValue.current = internalValue;
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);
  
  const rotation = valueToAngle(internalValue);
  const displayText = displayValue || internalValue.toFixed(2);
  
  return (
    <div className="text-center">
      <div
        ref={knobRef}
        className={styles.knobContainer}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        role="slider"
        tabIndex={0}
        aria-label={label || 'Knob control'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={internalValue}
        aria-valuetext={displayText}
        onKeyDown={(e) => {
          // Keyboard support for accessibility
          let delta = 0;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = step;
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -step;
          else if (e.key === 'Home') { onChange && onChange(min); return; }
          else if (e.key === 'End') { onChange && onChange(max); return; }
          else return;

          e.preventDefault();
          const newValue = Math.max(min, Math.min(max, internalValue + delta));
          const steppedValue = Math.round(newValue / step) * step;
          setInternalValue(steppedValue);
          onChange && onChange(steppedValue);
        }}
      >
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 100 100"
          className={styles.knobSvg}
        >
          {/* Outer ring */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* Track */}
          <path
            d="M 20 80 A 35 35 0 1 1 80 80"
            fill="none"
            stroke="#666"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Value arc */}
          <path
            d="M 20 80 A 35 35 0 1 1 80 80"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${((internalValue - min) / (max - min)) * 188} 188`}
            className={styles.valueArc}
          />
          
          {/* Knob body */}
          <circle
            cx="50"
            cy="50"
            r="30"
            fill="#2a2a2a"
            stroke="#555"
            strokeWidth="1"
          />
          
          {/* Pointer */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="25"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${rotation} 50 50)`}
          />
          
          {/* Center dot */}
          <circle
            cx="50"
            cy="50"
            r="5"
            fill="#444"
          />
        </svg>
      </div>
      
      <div className="mt-1">
        <small className="text-white d-block">{label}</small>
        <small className="text-muted">{displayText}</small>
      </div>
    </div>
  );
}