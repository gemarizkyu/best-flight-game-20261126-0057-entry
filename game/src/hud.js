// Skyline Courier — the glass: a 2D canvas over the 3D view that draws the
// instruments a pilot actually flies by. Artificial horizon, speed and altitude
// tapes, compass, throttle and fuel, and the arrow that points at the next ring.
import { CONFIG, MS_TO_KNOTS, MS_TO_FEET, clamp, radToDeg, angleDelta, formatTime } from './config.js';

const INK = '#eaf6ff';
const DIM = 'rgba(234, 246, 255, 0.55)';
const PANEL = 'rgba(8, 22, 38, 0.55)';
const AMBER = '#ffb020';
const GREEN = '#37d67a';
const RED = '#ff5a4e';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.messages = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  toast(text, ms = 4200) {
    this.messages.push({ text, until: performance.now() + ms });
  }

  draw(plane, mission, mode, nextRingPos) {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    if (!plane) return;
    this.messages = this.messages.filter((m) => m.until > performance.now());

    const knots = Math.round(plane.speed * MS_TO_KNOTS);
    const feet = Math.round(plane.pos.y * MS_TO_FEET);
    // Heading grows counterclockwise from north in the flight model;
    // the compass shows the usual clockwise degrees.
    const headingDeg = (((-radToDeg(plane.heading)) % 360) + 360) % 360;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // --- Top-left: mission, score, rings.
    this.panel(14, 14, 250, 74);
    ctx.fillStyle = INK;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mission.def.name.toUpperCase(), 26, 30);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText(`SCORE ${mission.score}`, 26, 52);
    if (mission.def.rings > 0) {
      ctx.fillText(`RINGS ${mission.ringsHit} / ${mission.def.rings}`, 26, 72);
    } else {
      ctx.fillText('FREE FLIGHT', 26, 72);
    }

    // --- Top-right: clock and fuel.
    this.panel(w - 264, 14, 250, 74);
    ctx.textAlign = 'right';
    ctx.fillStyle = mission.timeLeft < 30 && mission.def.timeLimit > 0 ? RED : INK;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(mission.def.timeLimit > 0 ? formatTime(mission.timeLeft) : '— : —', w - 26, 34);
    ctx.fillStyle = DIM;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`FUEL ${Math.round(plane.fuel)}%`, w - 26, 60);
    ctx.fillStyle = plane.fuel < 20 ? RED : GREEN;
    ctx.fillRect(w - 236, 70, 210 * clamp(plane.fuel / 100, 0, 1), 6);

    this.drawCompass(ctx, w, headingDeg);
    this.drawRingArrow(ctx, w, plane, mission, nextRingPos, headingDeg);
    this.drawSpeedTape(ctx, h, knots, plane.stalled);
    this.drawAltitudeTape(ctx, w, h, feet, plane.verticalSpeed);
    this.drawHorizon(ctx, w, h, plane);
    this.drawThrottle(ctx, w, h, plane);
    this.drawCrosshair(ctx, w, h);
    if (mode === 'cockpit') this.drawDashboard(ctx, w, h, plane);

    // --- Bottom-right: configuration.
    ctx.textAlign = 'right';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = plane.gearDown ? GREEN : DIM;
    ctx.fillText(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', w - 20, h - 58);
    ctx.fillStyle = plane.flaps ? AMBER : DIM;
    ctx.fillText(plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', w - 20, h - 38);
    ctx.fillStyle = DIM;
    ctx.fillText(mode === 'cockpit' ? 'COCKPIT  ·  C toggles view' : 'CHASE  ·  C toggles view', w - 20, h - 18);

    // --- Stall warning, flashing.
    if (plane.stalled && plane.speed > 1) {
      const on = Math.floor(performance.now() / 300) % 2 === 0;
      if (on) {
        ctx.fillStyle = RED;
        ctx.font = '800 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STALL', w / 2, h * 0.30);
      }
    }

    // --- Toasts under the compass.
    ctx.font = '600 15px system-ui, sans-serif';
    this.messages.forEach((m, i) => {
      ctx.fillStyle = 'rgba(8, 22, 38, 0.6)';
      const tw = ctx.measureText(m.text).width + 28;
      ctx.fillRect((w - tw) / 2, 108 + i * 34, tw, 26);
      ctx.fillStyle = INK;
      ctx.fillText(m.text, w / 2, 122 + i * 34);
    });
  }

  panel(x, y, pw, ph) {
    const ctx = this.ctx;
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 10);
    ctx.fill();
  }

  drawCompass(ctx, w, headingDeg) {
    const cx = w / 2, cy = 34, half = 170;
    this.panel(cx - half - 12, 12, (half + 12) * 2, 44);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - half, 16, half * 2, 36);
    ctx.clip();
    for (let d = -180; d <= 180; d += 5) {
      const deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      const x = cx + (d / 180) * half * 2.4;
      const major = deg % 30 === 0;
      ctx.strokeStyle = major ? INK : DIM;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, major ? 22 : 28);
      ctx.lineTo(x, 40);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = INK;
        ctx.font = '700 12px system-ui, sans-serif';
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] ?? String(deg);
        ctx.fillText(label, x, 48 - 26);
      }
    }
    ctx.restore();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 14); ctx.lineTo(cx + 6, 14); ctx.lineTo(cx, 24); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, 66);
  }

  drawRingArrow(ctx, w, plane, mission, nextRingPos, headingDeg) {
    if (!nextRingPos || mission.state !== 'flying' || mission.nextRing >= mission.def.rings) return;
    const dx = nextRingPos.x - plane.pos.x;
    const dz = nextRingPos.z - plane.pos.z;
    const bearing = ((radToDeg(Math.atan2(dx, -dz)) % 360) + 360) % 360;
    const rel = angleDelta(headingDeg * Math.PI / 180, bearing * Math.PI / 180);
    const dist = Math.round(Math.hypot(dx, dz));
    const cx = w / 2, cy = 96;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rel);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(0, 3); ctx.lineTo(-10, 8); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`NEXT RING  ${dist}m`, cx, cy + 26);
  }

  drawSpeedTape(ctx, h, knots, stalled) {
    const x = 20, cy = h / 2, halfH = 110;
    this.panel(x - 6, cy - halfH - 8, 92, halfH * 2 + 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 6, cy - halfH - 8, 92, halfH * 2 + 16);
    ctx.clip();
    ctx.font = '600 12px system-ui, sans-serif';
    for (let k = Math.max(0, knots - 30); k <= knots + 30; k += 10) {
      if (Math.abs(k - knots) < 12) continue; // keep the big readout clear
      const y = cy - (k - knots) * 3.0;
      ctx.fillStyle = k < CONFIG.hud.stallKnots ? RED : DIM;
      ctx.textAlign = 'left';
      ctx.fillText(String(k), x + 6, y + 4);
      ctx.strokeStyle = DIM;
      ctx.beginPath(); ctx.moveTo(x + 40, y); ctx.lineTo(x + 52, y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = stalled ? RED : INK;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const numW = ctx.measureText(String(knots)).width;
    ctx.fillText(String(knots), x + 4, cy + 7);
    ctx.fillStyle = DIM;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('KT', x + 10 + numW, cy + 7);
    ctx.fillText('AIRSPEED', x + 4, cy + halfH - 2);
  }

  drawAltitudeTape(ctx, w, h, feet, verticalSpeed) {
    const x = w - 106, cy = h / 2, halfH = 110;
    this.panel(x - 6, cy - halfH - 8, 92, halfH * 2 + 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 6, cy - halfH - 8, 92, halfH * 2 + 16);
    ctx.clip();
    ctx.font = '600 12px system-ui, sans-serif';
    const step = 100;
    for (let f = Math.max(0, feet - 300); f <= feet + 300; f += step) {
      if (Math.abs(f - feet) < 60) continue; // keep the big readout clear
      const y = cy - (f - feet) * 0.28;
      ctx.fillStyle = DIM;
      ctx.textAlign = 'right';
      ctx.fillText(String(f), x + 78, y + 4);
      ctx.strokeStyle = DIM;
      ctx.beginPath(); ctx.moveTo(x + 30, y); ctx.lineTo(x + 42, y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(feet), x + 58, cy + 7);
    ctx.fillStyle = DIM;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('FT', x + 80, cy + 7);
    const vs = Math.round(verticalSpeed * MS_TO_FEET / 60);
    ctx.fillStyle = Math.abs(vs) > 500 ? AMBER : DIM;
    ctx.fillText(`V/S ${vs > 0 ? '+' : ''}${vs}`, x + 80, cy + halfH - 2);
  }

  drawHorizon(ctx, w, h, plane) {
    const cx = 150, cy = h - 150, r = 62;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    // Banking right rolls the world counterclockwise in the pilot's view;
    // nose up pushes the horizon down, showing more sky.
    ctx.rotate(plane.roll);
    const pitchPx = clamp(plane.pitch, -0.6, 0.6) * 130;
    ctx.fillStyle = '#5fa8dd';
    ctx.fillRect(-r - 4, -r - 4, r * 2 + 8, r + 4 + pitchPx);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-r - 4, pitchPx, r * 2 + 8, r + 4 - pitchPx);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r, pitchPx); ctx.lineTo(r, pitchPx); ctx.stroke();
    ctx.lineWidth = 1;
    for (const deg of [-20, -10, 10, 20]) {
      const y = pitchPx - deg * 1.4;
      ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(18, y); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx, cy - 6);
    ctx.lineTo(cx + 8, cy); ctx.lineTo(cx + 22, cy); ctx.lineTo(cx + 8, cy + 2);
    ctx.lineTo(cx, cy - 2); ctx.lineTo(cx - 8, cy + 2); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = DIM;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 14);
  }

  drawThrottle(ctx, w, h, plane) {
    const x = 20, y = h - 52, bw = 190;
    ctx.fillStyle = PANEL;
    ctx.beginPath(); ctx.roundRect(x, y, bw, 30, 8); ctx.fill();
    ctx.fillStyle = '#3f8f5f';
    ctx.beginPath(); ctx.roundRect(x + 4, y + 4, (bw - 8) * clamp(plane.throttle, 0, 1), 22, 5); ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%`, x + 10, y + 19);
  }

  drawCrosshair(ctx, w, h) {
    const cx = w / 2, cy = h / 2 - 30;
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12);
    ctx.stroke();
  }

  // Cockpit view: a lit instrument panel across the bottom of the windscreen,
  // so the seat reads as a cockpit and not an empty sky.
  drawDashboard(ctx, w, h, plane) {
    const ph = 100;
    const grad = ctx.createLinearGradient(0, h - ph, 0, h);
    grad.addColorStop(0, '#1a2836');
    grad.addColorStop(1, '#0a121c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - ph, w, ph);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
    ctx.fillRect(0, h - ph, w, 2);
    const gauges = [
      { label: 'RPM', value: plane.throttle, max: 1, text: String(Math.round(plane.throttle * 2600)) },
      { label: 'FUEL', value: plane.fuel / 100, max: 1, text: `${Math.round(plane.fuel)}%` },
      { label: 'OIL °C', value: (82 + plane.throttle * 16) / 140, max: 1, text: String(Math.round(82 + plane.throttle * 16)) },
    ];
    const cy = h - ph / 2;
    gauges.forEach((g, i) => {
      const cx = w / 2 + (i - 1) * 150;
      ctx.strokeStyle = 'rgba(234, 246, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(55, 214, 122, 0.12)';
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill();
      for (let a = -210; a <= 30; a += 30) {
        const rad = (a * Math.PI) / 180;
        ctx.strokeStyle = DIM;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * 24, cy + Math.sin(rad) * 24);
        ctx.lineTo(cx + Math.cos(rad) * 28, cy + Math.sin(rad) * 28);
        ctx.stroke();
      }
      const needle = ((-210 + clamp(g.value / g.max, 0, 1) * 240) * Math.PI) / 180;
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(needle) * 22, cy + Math.sin(needle) * 22);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.text, cx, cy + 12);
      ctx.fillStyle = DIM;
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillText(g.label, cx, cy + 44);
    });
    ctx.fillStyle = DIM;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('KITE-7', 24, h - ph / 2);
  }
}
