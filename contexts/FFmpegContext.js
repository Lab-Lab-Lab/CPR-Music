'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const FFmpegContext = createContext();

export const useFFmpeg = () => {
  const context = useContext(FFmpegContext);
  if (!context) {
    throw new Error('useFFmpeg must be used within FFmpegProvider');
  }
  return context;
};

export const FFmpegProvider = ({ children }) => {
  const ffmpegRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize FFmpeg instance
  useEffect(() => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
  }, []);
  
  // Load FFmpeg
  const loadFFmpeg = useCallback(async () => {
    if (loaded || isLoading || !ffmpegRef.current) return;
    
    setIsLoading(true);
    
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const ffmpeg = ffmpegRef.current;
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      setLoaded(true);
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loaded, isLoading]);
  
  // Get FFmpeg instance (safe accessor)
  const getFFmpeg = useCallback(() => {
    if (!loaded || !ffmpegRef.current) {
      console.warn('FFmpeg not loaded yet');
      return null;
    }
    return ffmpegRef.current;
  }, [loaded]);
  
  // Check if FFmpeg is ready
  const isReady = useCallback(() => {
    return loaded && ffmpegRef.current !== null;
  }, [loaded]);
  
  const value = {
    ffmpegRef,
    loaded,
    isLoading,
    loadFFmpeg,
    getFFmpeg,
    isReady,
  };
  
  return (
    <FFmpegContext.Provider value={value}>
      {children}
    </FFmpegContext.Provider>
  );
};