// Skyline Courier — keyboard + mouse input, smoothed into stick axes.
// Arrow keys fly the plane; A/D is rudder; Shift/Ctrl work the throttle;
// mouse drag steers the same way. All keys are captured so arrows never scroll.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered keys, consumed by pollPressed()
    this.mouseDown = false;
    this.dragX = 0; // accumulated drag this frame, pixels
    this.dragY = 0;
    this.pitchAxis = 0; // -1 (nose down) .. 1 (nose up), smoothed
    this.rollAxis = 0;   // -1 (left) .. 1 (right), smoothed
    this.yawAxis = 0;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      // Arrows and Space scroll the page by default; the game owns them.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.dragX += e.clientX - this.lastX;
      this.dragY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
  }

  held(code) { return this.keys.has(code); }
  // True once per physical press; call once per frame per key.
  pollPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  // Blend keyboard and mouse-drag into stick axes. dt is seconds.
  update(dt) {
    let pitch = 0, roll = 0, yaw = 0;
    if (this.held('ArrowUp')) pitch += 1;
    if (this.held('ArrowDown')) pitch -= 1;
    if (this.held('ArrowLeft')) roll -= 1;
    if (this.held('ArrowRight')) roll += 1;
    if (this.held('KeyA')) yaw -= 1;
    if (this.held('KeyD')) yaw += 1;
    // Mouse drag: right = bank right, up = nose up (drag the sky toward you).
    if (this.mouseDown) {
      roll += Math.max(-1, Math.min(1, this.dragX / 90));
      pitch -= Math.max(-1, Math.min(1, this.dragY / 90));
    }
    this.dragX = 0;
    this.dragY = 0;
    const k = Math.min(1, dt * 10);
    this.pitchAxis += (Math.max(-1, Math.min(1, pitch)) - this.pitchAxis) * k;
    this.rollAxis += (Math.max(-1, Math.min(1, roll)) - this.rollAxis) * k;
    this.yawAxis += (Math.max(-1, Math.min(1, yaw)) - this.yawAxis) * k;
  }

  get throttleUp() { return this.held('ShiftLeft') || this.held('ShiftRight') || this.held('Equal'); }
  get throttleDown() { return this.held('ControlLeft') || this.held('ControlRight') || this.held('Minus'); }
}
