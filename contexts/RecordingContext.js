'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const RecordingContext = createContext();

export const useRecording = () => {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
};

export const RecordingProvider = ({ children }) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isBlocked, setIsBlocked] = useState(true);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [mimeType, setMimeType] = useState('');
  const [recordingTime, setRecordingTime] = useState({ min: 0, sec: 0 });
  
  // Take management
  const [takeNo, setTakeNo] = useState(0);
  const [activeTakeNo, setActiveTakeNo] = useState(-1);
  const [blobInfo, setBlobInfo] = useState([]);
  const [blobURL, setBlobURL] = useState('');
  const [blobData, setBlobData] = useState(null);
  
  // Refs
  const chunksRef = useRef([]);
  const accompanimentRef = useRef(null);
  
  // Silence detection
  const [silenceData, setSilenceData] = useState(null);
  const [ignoreSilence, setIgnoreSilence] = useState(false);
  const [showAudioDrop, setShowAudioDrop] = useState(false);
  
  // Multitrack recording integration
  const [isRecordingToTrack, setIsRecordingToTrack] = useState(false);
  const [currentRecordingTrackId, setCurrentRecordingTrackId] = useState(null);
  const recordingCallbackRef = useRef(null);
  
  // Get supported MIME type
  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav'
    ];
    
    if (typeof MediaRecorder !== 'undefined') {
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
    }
    
    return null;
  }, []);
  
  // Add a take to the list
  const addTake = useCallback((takeInfo) => {
    setBlobInfo(prev => [...prev, takeInfo]);
    setTakeNo(prev => prev + 1);
  }, []);
  
  // Delete a take
  const deleteTake = useCallback((index) => {
    setBlobInfo(prev => {
      const newInfo = [...prev];
      const deleted = newInfo.splice(index, 1)[0];
      if (deleted && deleted.url) {
        URL.revokeObjectURL(deleted.url);
      }
      return newInfo;
    });
    
    // Update active take if necessary
    setActiveTakeNo(prev => {
      if (prev === blobInfo[index]?.take) {
        return -1;
      }
      return prev;
    });
  }, [blobInfo]);
  
  // Clear all recording data
  const clearRecordingData = useCallback(() => {
    // Clean up blob URLs
    blobInfo.forEach(info => {
      if (info.url) {
        URL.revokeObjectURL(info.url);
      }
    });
    
    setBlobInfo([]);
    setTakeNo(0);
    setActiveTakeNo(-1);
    setBlobURL('');
    setBlobData(null);
    setSilenceData(null);
    setIgnoreSilence(false);
    setIsRecordingToTrack(false);
    setCurrentRecordingTrackId(null);
  }, [blobInfo]);
  
  // Set up recording to a specific track
  const setupTrackRecording = useCallback((trackId, onRecordingComplete) => {
    setIsRecordingToTrack(true);
    setCurrentRecordingTrackId(trackId);
    recordingCallbackRef.current = onRecordingComplete;
  }, []);
  
  // Clear track recording setup
  const clearTrackRecording = useCallback(() => {
    setIsRecordingToTrack(false);
    setCurrentRecordingTrackId(null);
    recordingCallbackRef.current = null;
  }, []);
  
  // Handle recording completion for tracks
  useEffect(() => {
    if (isRecordingToTrack && blobURL && recordingCallbackRef.current && blobData) {
      // Call the callback with the recorded blob URL
      const callback = recordingCallbackRef.current;
      const url = blobURL;
      const data = blobData;
      
      // Clear first to prevent re-triggering
      clearTrackRecording();
      
      // Then call the callback
      callback(url, data);
    }
  }, [blobURL, blobData, isRecordingToTrack]); // Remove clearTrackRecording from deps to prevent loop
  
  // Clean up on unmount
  // NOTE: We use a ref to track blob URLs to avoid dependency issues
  const blobInfoRef = useRef(blobInfo);

  useEffect(() => {
    blobInfoRef.current = blobInfo;
  }, [blobInfo]);

  useEffect(() => {
    return () => {
      // Clean up blob URLs only on unmount (not when blobInfo changes)
      blobInfoRef.current.forEach(info => {
        if (info.url) {
          URL.revokeObjectURL(info.url);
        }
      });
    };
  }, []); // Empty deps - cleanup only runs on unmount
  
  const value = {
    // State
    isRecording,
    setIsRecording,
    isBlocked,
    setIsBlocked,
    mediaRecorder,
    setMediaRecorder,
    mimeType,
    setMimeType,
    recordingTime,
    setRecordingTime,
    takeNo,
    setTakeNo,
    activeTakeNo,
    setActiveTakeNo,
    blobInfo,
    setBlobInfo,
    blobURL,
    setBlobURL,
    blobData,
    setBlobData,
    chunksRef,
    accompanimentRef,
    silenceData,
    setSilenceData,
    ignoreSilence,
    setIgnoreSilence,
    showAudioDrop,
    setShowAudioDrop,
    
    // Multitrack recording
    isRecordingToTrack,
    currentRecordingTrackId,
    setupTrackRecording,
    clearTrackRecording,
    
    // Methods
    getSupportedMimeType,
    addTake,
    deleteTake,
    clearRecordingData
  };
  
  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};