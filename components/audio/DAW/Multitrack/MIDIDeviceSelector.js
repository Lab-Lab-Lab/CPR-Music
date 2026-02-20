// components/audio/DAW/Multitrack/MIDIDeviceSelector.js
'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, ListGroup } from 'react-bootstrap';
import { FaKeyboard, FaPlug, FaCircle } from 'react-icons/fa';
import { MdPiano, MdSettings } from 'react-icons/md';

export default function MIDIDeviceSelector({ 
  show, 
  onHide, 
  onDeviceSelect,
  midiInputManager,
  currentDevice = null 
}) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(currentDevice);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [midiActivity, setMidiActivity] = useState({});

  // Initialize MIDI and get devices
  useEffect(() => {
    if (show && midiInputManager) {
      initializeMIDI();
    }
  }, [show, midiInputManager]);

  const initializeMIDI = async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const initialized = await midiInputManager.initialize();
      
      if (!initialized) {
        setError('MIDI access denied. Please check your browser permissions.');
        return;
      }
      
      // Get available devices
      const inputDevices = midiInputManager.getInputDevices();
      setDevices(inputDevices);
      
      // Set up activity monitoring
      midiInputManager.addListener('message', handleMidiActivity);
      
      // Listen for device changes
      midiInputManager.addListener('devicechange', updateDevices);
      
    } catch (err) {
      setError('Failed to initialize MIDI: ' + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const updateDevices = () => {
    const inputDevices = midiInputManager.getInputDevices();
    setDevices(inputDevices);
  };

  const handleMidiActivity = (message) => {
    // Flash activity indicator for the device
    setMidiActivity(prev => ({
      ...prev,
      [message.device]: true
    }));
    
    // Clear after 100ms
    setTimeout(() => {
      setMidiActivity(prev => ({
        ...prev,
        [message.device]: false
      }));
    }, 100);
  };

  const handleDeviceSelect = () => {
    if (selectedDevice && onDeviceSelect) {
      onDeviceSelect(selectedDevice);
      onHide();
    }
  };

  const handleTestDevice = (deviceId) => {
    // Connect temporarily to test
    midiInputManager.connectInput(deviceId, (message) => {
      console.log('MIDI Test:', message);
    });
    
    // Disconnect after 5 seconds
    setTimeout(() => {
      midiInputManager.disconnectInput(deviceId);
    }, 5000);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (midiInputManager) {
        midiInputManager.removeListener('message', handleMidiActivity);
        midiInputManager.removeListener('devicechange', updateDevices);
      }
    };
  }, [midiInputManager]);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaKeyboard className="me-2" />
          Select MIDI Input Device
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark">
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {isInitializing ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Initializing MIDI...</span>
            </div>
            <p className="mt-3 text-muted">Initializing MIDI devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-5">
            <MdPiano size={64} className="text-muted mb-3" />
            <h5 className="text-muted">No MIDI devices found</h5>
            <p className="text-muted">
              Connect a MIDI keyboard or controller and refresh
            </p>
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={initializeMIDI}
            >
              Refresh Devices
            </Button>
          </div>
        ) : (
          <ListGroup variant="flush">
            {devices.map((device) => (
              <ListGroup.Item
                key={device.id}
                action
                active={selectedDevice === device.id}
                onClick={() => setSelectedDevice(device.id)}
                className="d-flex align-items-center justify-content-between"
                style={{
                  backgroundColor: selectedDevice === device.id ? '#4a7c9e' : 'transparent',
                  borderColor: '#444'
                }}
              >
                <div className="d-flex align-items-center">
                  <FaPlug className="me-3" size={20} />
                  <div>
                    <h6 className="mb-0">{device.name}</h6>
                    <small className="text-muted">{device.manufacturer}</small>
                  </div>
                </div>
                
                <div className="d-flex align-items-center gap-2">
                  {/* Activity indicator */}
                  <FaCircle 
                    size={10} 
                    className={midiActivity[device.name] ? 'text-success' : 'text-muted'}
                    style={{
                      transition: 'color 0.1s ease',
                      filter: midiActivity[device.name] ? 'drop-shadow(0 0 3px #0f0)' : 'none'
                    }}
                  />
                  
                  {/* Connection state */}
                  <Badge bg={device.state === 'connected' ? 'success' : 'secondary'}>
                    {device.state}
                  </Badge>
                  
                  {/* Test button */}
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestDevice(device.id);
                    }}
                  >
                    Test
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
        
        <div className="mt-3 p-3 bg-secondary bg-opacity-10 rounded">
          <h6 className="text-muted mb-2">
            <MdSettings className="me-2" />
            MIDI Input Tips
          </h6>
          <ul className="mb-0 small text-muted">
            <li>Connect your MIDI device before opening this dialog</li>
            <li>Activity indicator shows incoming MIDI messages</li>
            <li>Click "Test" to monitor MIDI input for 5 seconds</li>
            <li>Some browsers require HTTPS for MIDI access</li>
          </ul>
        </div>
      </Modal.Body>
      
      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleDeviceSelect}
          disabled={!selectedDevice}
        >
          Select Device
        </Button>
      </Modal.Footer>
    </Modal>
  );
}