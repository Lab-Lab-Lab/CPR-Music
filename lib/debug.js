/**
 * Debug logging utility with environment-based toggling
 *
 * Usage:
 *   import { debugLog, debugGroup, debugGroupEnd } from '@/lib/debug';
 *   debugLog('AudioEngine', 'Loading audio file', { url, duration });
 *
 * Enable debugging:
 *   - Set localStorage.DEBUG = 'true' in browser console
 *   - Or set process.env.NEXT_PUBLIC_DEBUG = 'true' in .env.local
 */

// Check if debugging is enabled
const isDebugEnabled = () => {
  // Server-side check
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_DEBUG === 'true';
  }

  // Client-side check (localStorage takes precedence)
  try {
    const localStorageDebug = localStorage.getItem('DEBUG');
    if (localStorageDebug !== null) {
      return localStorageDebug === 'true';
    }
  } catch (e) {
    // localStorage might not be available
  }

  // Fall back to environment variable
  return process.env.NEXT_PUBLIC_DEBUG === 'true';
};

/**
 * Debug logging wrapper - only logs when debugging is enabled
 * @param {string} module - Module name (e.g., 'AudioEngine', 'ClipPlayer')
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments to log
 */
export const debugLog = (module, message, ...args) => {
  if (!isDebugEnabled()) return;

  const prefix = `[${module}]`;
  if (args.length > 0) {
    console.log(prefix, message, ...args);
  } else {
    console.log(prefix, message);
  }
};

/**
 * Debug warning wrapper
 */
export const debugWarn = (module, message, ...args) => {
  if (!isDebugEnabled()) return;

  const prefix = `[${module}]`;
  console.warn(prefix, message, ...args);
};

/**
 * Debug error wrapper - always logs errors regardless of debug mode
 */
export const debugError = (module, message, ...args) => {
  const prefix = `[${module}]`;
  console.error(prefix, message, ...args);
};

/**
 * Debug group wrapper
 */
export const debugGroup = (module, label) => {
  if (!isDebugEnabled()) return;
  console.group(`[${module}] ${label}`);
};

/**
 * Debug group end wrapper
 */
export const debugGroupEnd = () => {
  if (!isDebugEnabled()) return;
  console.groupEnd();
};

/**
 * Performance timing utility
 */
export class DebugTimer {
  constructor(module, operation) {
    this.module = module;
    this.operation = operation;
    this.startTime = performance.now();
    this.enabled = isDebugEnabled();
  }

  end() {
    if (!this.enabled) return;
    const elapsed = Math.round(performance.now() - this.startTime);
    debugLog(this.module, `${this.operation} completed in ${elapsed}ms`);
  }

  checkpoint(label) {
    if (!this.enabled) return;
    const elapsed = Math.round(performance.now() - this.startTime);
    debugLog(this.module, `${this.operation} - ${label}: ${elapsed}ms`);
  }
}

/**
 * Helper to check debug status (useful for conditional expensive operations)
 */
export const isDebug = isDebugEnabled;
