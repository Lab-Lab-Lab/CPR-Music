// components/audio/DAW/Multitrack/MIDIInputManager.js
'use client';

/**
 * MIDIInputManager - Handles Web MIDI API connections and routing
 * Singleton pattern to ensure only one instance manages MIDI devices
 */
class MIDIInputManager {
  constructor() {
    if (MIDIInputManager.instance) {
      return MIDIInputManager.instance;
    }

    this.midiAccess = null;
    this.initializationPromise = null; // Track initialization in progress
    this.inputs = new Map();
    this.outputs = new Map();
    this.listeners = new Map();
    this.activeInputs = new Set();
    this.midiLearnTarget = null;
    this.midiLearnCallback = null;

    MIDIInputManager.instance = this;
  }

  async initialize() {
    // If already initialized, return success
    if (this.midiAccess) return true;

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = this._doInitialize();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    return result;
  }

  async _doInitialize() {
    try {
      console.log('Requesting MIDI access...');
      this.midiAccess = await navigator.requestMIDIAccess();
      console.log('MIDI access granted');

      // Setup initial devices
      this.updateDevices();

      // Listen for device changes
      this.midiAccess.onstatechange = (e) => {
        console.log(`MIDI device ${e.port.name} ${e.port.state}`);
        this.updateDevices();
        this.notifyListeners('devicechange', {
          device: e.port,
          state: e.port.state
        });
      };

      return true;
    } catch (error) {
      console.error('MIDI access denied:', error);
      return false;
    }
  }

  updateDevices() {
    if (!this.midiAccess) return;
    
    // Update input devices
    this.inputs.clear();
    for (const input of this.midiAccess.inputs.values()) {
      this.inputs.set(input.id, {
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        state: input.state,
        port: input
      });
    }
    
    // Update output devices
    this.outputs.clear();
    for (const output of this.midiAccess.outputs.values()) {
      this.outputs.set(output.id, {
        id: output.id,
        name: output.name,
        manufacturer: output.manufacturer,
        state: output.state,
        port: output
      });
    }
  }

  getInputDevices() {
    return Array.from(this.inputs.values());
  }

  getOutputDevices() {
    return Array.from(this.outputs.values());
  }

  connectInput(deviceId, callback) {
    const device = this.inputs.get(deviceId);
    if (!device) return false;
    
    // Set up message handler
    device.port.onmidimessage = (event) => {
      const [status, data1, data2] = event.data;
      const channel = (status & 0x0F) + 1;
      const command = status & 0xF0;
      
      const message = {
        command,
        channel,
        data1,
        data2,
        timestamp: event.timeStamp,
        device: device.name
      };
      
      // Decode message type
      switch (command) {
        case 0x90: // Note On
          message.type = 'noteon';
          message.note = data1;
          message.velocity = data2;
          break;
        case 0x80: // Note Off
          message.type = 'noteoff';
          message.note = data1;
          message.velocity = data2;
          break;
        case 0xB0: // Control Change
          message.type = 'cc';
          message.controller = data1;
          message.value = data2;
          break;
        case 0xE0: // Pitch Bend
          message.type = 'pitchbend';
          message.value = (data2 << 7) | data1;
          break;
        case 0xD0: // Channel Pressure
          message.type = 'channelpressure';
          message.pressure = data1;
          break;
        case 0xA0: // Polyphonic Aftertouch
          message.type = 'polyaftertouch';
          message.note = data1;
          message.pressure = data2;
          break;
        case 0xC0: // Program Change
          message.type = 'programchange';
          message.program = data1;
          break;
      }
      
      // Check if MIDI learn is active
      if (this.midiLearnTarget && message.type === 'cc') {
        this.handleMidiLearn(message);
      }
      
      // Call the callback
      callback(message);
      
      // Notify global listeners
      this.notifyListeners('message', message);
    };
    
    this.activeInputs.add(deviceId);
    return true;
  }

  disconnectInput(deviceId) {
    const device = this.inputs.get(deviceId);
    if (!device) return false;
    
    device.port.onmidimessage = null;
    this.activeInputs.delete(deviceId);
    return true;
  }

  // MIDI Learn functionality
  startMidiLearn(target, callback) {
    this.midiLearnTarget = target;
    this.midiLearnCallback = callback;
    this.notifyListeners('midilearn', { active: true, target });
  }

  cancelMidiLearn() {
    this.midiLearnTarget = null;
    this.midiLearnCallback = null;
    this.notifyListeners('midilearn', { active: false });
  }

  handleMidiLearn(message) {
    if (this.midiLearnCallback) {
      this.midiLearnCallback({
        target: this.midiLearnTarget,
        controller: message.controller,
        channel: message.channel
      });
    }
    this.cancelMidiLearn();
  }

  // Event listener management
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  // Send MIDI message to output
  sendMessage(deviceId, message) {
    const device = this.outputs.get(deviceId);
    if (!device) return false;
    
    try {
      device.port.send(message);
      return true;
    } catch (error) {
      console.error('Error sending MIDI:', error);
      return false;
    }
  }

  // Utility to play note through output
  playNote(deviceId, note, velocity = 127, channel = 1) {
    const noteOn = [0x90 | (channel - 1), note, velocity];
    this.sendMessage(deviceId, noteOn);
  }

  stopNote(deviceId, note, channel = 1) {
    const noteOff = [0x80 | (channel - 1), note, 0];
    this.sendMessage(deviceId, noteOff);
  }
}

// IMPORTANT: Export the class as default
export default MIDIInputManager;