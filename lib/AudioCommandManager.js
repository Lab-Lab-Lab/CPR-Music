/**
 * Command pattern implementation for audio editing operations
 * Provides stable undo/redo functionality
 */

class AudioCommand {
  constructor(name, audioData, metadata = {}) {
    this.name = name;
    this.timestamp = Date.now();
    this.audioData = audioData; // Can be URL, Blob, or ArrayBuffer
    this.metadata = metadata; // Additional info like regions, effects applied, etc.
  }
}

export class AudioCommandManager {
  constructor(maxHistorySize = 50) {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = maxHistorySize;
    this.listeners = new Set();
  }

  /**
   * Execute a new command
   */
  execute(command) {
    // Remove any commands after current index (branching history)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new command
    this.history.push(command);
    
    // Enforce max history size
    if (this.history.length > this.maxHistorySize) {
      // Clean up old audio data if it's a blob URL
      const removed = this.history.shift();
      this.cleanupCommand(removed);
    } else {
      this.currentIndex++;
    }
    
    this.notifyListeners();
  }

  /**
   * Undo to previous state
   */
  undo() {
    if (!this.canUndo()) return null;
    
    this.currentIndex--;
    this.notifyListeners();
    return this.getCurrentCommand();
  }

  /**
   * Redo to next state
   */
  redo() {
    if (!this.canRedo()) return null;
    
    this.currentIndex++;
    this.notifyListeners();
    return this.getCurrentCommand();
  }

  /**
   * Get current command
   */
  getCurrentCommand() {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex];
  }

  /**
   * Check if undo is possible
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Add a state change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove a state change listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    const state = {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      currentIndex: this.currentIndex,
      historyLength: this.history.length
    };
    
    this.listeners.forEach(callback => callback(state));
  }

  /**
   * Clean up resources for a command
   * NOTE: We should NOT revoke blob URLs because they might be referenced
   * by takes or other parts of the application. Blob URLs will be cleaned
   * up when the page unloads or when explicitly managed by the take system.
   */
  cleanupCommand(command) {
    // Commented out to prevent revoking blob URLs that are still in use
    // if (command.audioData && typeof command.audioData === 'string' &&
    //     command.audioData.startsWith('blob:')) {
    //   URL.revokeObjectURL(command.audioData);
    // }
  }

  /**
   * Clear all history
   */
  clear() {
    // Clean up all blob URLs
    this.history.forEach(cmd => this.cleanupCommand(cmd));
    
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  /**
   * Get history info for debugging
   */
  getHistoryInfo() {
    return {
      history: this.history.map((cmd, idx) => ({
        name: cmd.name,
        timestamp: cmd.timestamp,
        isCurrent: idx === this.currentIndex
      })),
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  /**
   * Get all commands (for saving state)
   */
  getAllCommands() {
    return this.history.slice(0, this.currentIndex + 1);
  }

  /**
   * Add a command without executing (for restoring state)
   */
  addCommand(command) {
    this.history.push(command);
    this.currentIndex = this.history.length - 1;
    this.notifyListeners();
  }
}

// Singleton instance
let commandManagerInstance = null;

export function getCommandManager() {
  if (!commandManagerInstance) {
    commandManagerInstance = new AudioCommandManager();
  }
  return commandManagerInstance;
}

// Helper function to create commands
export function createAudioCommand(name, audioData, metadata = {}) {
  return new AudioCommand(name, audioData, metadata);
}