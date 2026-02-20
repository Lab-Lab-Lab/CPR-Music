/**
 * CanvasRenderer - Optimized canvas rendering utilities
 * Handles high-DPI displays and efficient redraw management
 */

export class CanvasRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // Default options
    this.options = {
      backgroundColor: '#1e1e1e',
      waveformColor: '#7bafd4',
      progressColor: '#92ce84',
      cursorColor: '#ffc107',
      regionColor: 'rgba(155, 115, 215, 0.4)',
      timelineColor: '#2a2a2a',
      gridColor: '#555',
      textColor: '#888',
      ...options
    };

    this.setupCanvas();
  }

  /**
   * Setup canvas for high-DPI displays
   */
  setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    // Scale canvas for high-DPI
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Scale context to match device pixel ratio
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Clear canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Draw background
   */
  drawBackground(color = null) {
    this.ctx.fillStyle = color || this.options.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw waveform peaks
   */
  drawWaveform(peaks, options = {}) {
    if (!peaks || !peaks.merged) return;

    const {
      startX = 0,
      width = this.width,
      height = this.height,
      centerY = height / 2,
      scale = 1.5,  // Moderate scale for realistic representation
      color = this.options.waveformColor
    } = options;

    const { min, max } = peaks.merged;
    const barWidth = width / min.length;
    const halfHeight = height / 2;

    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.8;

    // Draw waveform bars
    for (let i = 0; i < min.length; i++) {
      const x = startX + i * barWidth;
      let minHeight = min[i] * halfHeight * scale;
      let maxHeight = max[i] * halfHeight * scale;

      // For true silence (0 values), draw a very thin line
      // This is common at the start of recordings due to MediaRecorder initialization delay
      if (min[i] === 0 && max[i] === 0) {
        // Draw a subtle 1px line to indicate audio is present but silent
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(
          x,
          centerY - 0.5,
          Math.max(1, barWidth - 0.5),
          1
        );
        this.ctx.globalAlpha = 0.8;
      } else {
        // Ensure minimum visible height for very quiet audio
        const minVisibleHeight = 0.5;
        if (Math.abs(maxHeight - minHeight) < minVisibleHeight) {
          maxHeight = Math.max(maxHeight, minVisibleHeight / 2);
          minHeight = Math.min(minHeight, -minVisibleHeight / 2);
        }

        // Draw bar from min to max
        this.ctx.fillRect(
          x,
          centerY - maxHeight,
          Math.max(1, barWidth - 0.5),
          maxHeight - minHeight
        );
      }
    }

    this.ctx.globalAlpha = 1;
  }

  /**
   * Draw progress overlay
   */
  drawProgress(progress, options = {}) {
    const {
      width = this.width,
      height = this.height,
      color = this.options.progressColor
    } = options;

    const progressX = progress * width;

    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.5;
    this.ctx.fillRect(0, 0, progressX, height);
    this.ctx.globalAlpha = 1;
  }

  /**
   * Draw playback cursor
   */
  drawCursor(position, options = {}) {
    const {
      height = this.height,
      color = this.options.cursorColor,
      width = 2
    } = options;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(position, 0);
    this.ctx.lineTo(position, height);
    this.ctx.stroke();
  }

  /**
   * Draw region
   */
  drawRegion(start, end, options = {}) {
    const {
      height = this.height,
      color = this.options.regionColor,
      borderColor = color.replace('0.4', '0.8'),
      borderWidth = 2
    } = options;

    const width = end - start;

    // Fill
    this.ctx.fillStyle = color;
    this.ctx.fillRect(start, 0, width, height);

    // Border
    if (borderWidth > 0) {
      this.ctx.strokeStyle = borderColor;
      this.ctx.lineWidth = borderWidth;
      this.ctx.strokeRect(start, 0, width, height);
    }

    // Handles
    this.drawRegionHandle(start, height);
    this.drawRegionHandle(end, height);
  }

  /**
   * Draw region resize handle
   */
  drawRegionHandle(x, height) {
    const handleWidth = 6;
    const handleHeight = 20;
    const y = (height - handleHeight) / 2;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.fillRect(x - handleWidth / 2, y, handleWidth, handleHeight);
  }

  /**
   * Draw timeline
   */
  drawTimeline(duration, pixelsPerSecond, options = {}) {
    const {
      height = 30,
      backgroundColor = this.options.timelineColor,
      gridColor = this.options.gridColor,
      textColor = this.options.textColor,
      fontSize = 11
    } = options;

    // Background
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, height);

    // Grid lines and labels
    this.ctx.font = `${fontSize}px Arial`;
    this.ctx.fillStyle = textColor;
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;

    const interval = this.getTimeInterval(pixelsPerSecond);
    const majorInterval = interval * 5;

    for (let sec = 0; sec <= duration; sec += interval) {
      const x = sec * pixelsPerSecond;
      const isMajor = sec % majorInterval === 0;

      // Draw tick
      this.ctx.beginPath();
      this.ctx.moveTo(x, height - (isMajor ? 15 : 10));
      this.ctx.lineTo(x, height);
      this.ctx.stroke();

      // Draw label for major ticks
      if (isMajor) {
        const label = this.formatTime(sec);
        this.ctx.fillText(label, x + 3, height - 17);
      }
    }
  }

  /**
   * Get appropriate time interval for timeline
   */
  getTimeInterval(pixelsPerSecond) {
    if (pixelsPerSecond > 300) return 0.5;
    if (pixelsPerSecond > 150) return 1;
    if (pixelsPerSecond > 60) return 2;
    if (pixelsPerSecond > 30) return 5;
    if (pixelsPerSecond > 15) return 10;
    return 30;
  }

  /**
   * Format time for display
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Draw minimap
   */
  drawMinimap(peaks, viewportStart, viewportEnd, options = {}) {
    const {
      height = 40,
      backgroundColor = '#2a2a2a',
      waveformColor = 'rgba(123, 175, 212, 0.5)',
      viewportColor = 'rgba(255, 255, 255, 0.2)'
    } = options;

    // Background
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, height);

    // Waveform overview
    if (peaks) {
      this.drawWaveform(peaks, {
        height,
        centerY: height / 2,
        scale: 0.8,
        color: waveformColor
      });
    }

    // Viewport indicator
    const viewportX = viewportStart * this.width;
    const viewportWidth = (viewportEnd - viewportStart) * this.width;

    this.ctx.fillStyle = viewportColor;
    this.ctx.fillRect(viewportX, 0, viewportWidth, height);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(viewportX, 0, viewportWidth, height);
  }

  /**
   * Create offscreen canvas for layering
   */
  createLayer(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width * this.dpr;
    canvas.height = height * this.dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(this.dpr, this.dpr);

    return { canvas, ctx };
  }

  /**
   * Draw layer onto main canvas
   */
  drawLayer(layer, x = 0, y = 0) {
    this.ctx.drawImage(layer.canvas, x, y, layer.canvas.width / this.dpr, layer.canvas.height / this.dpr);
  }

  /**
   * Resize handler
   */
  resize() {
    this.setupCanvas();
  }

  /**
   * Clean up
   */
  destroy() {
    this.ctx = null;
    this.canvas = null;
  }
}