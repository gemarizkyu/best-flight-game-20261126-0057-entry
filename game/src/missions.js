// Skyline Courier — missions: what the pilot is trying to do, and what it is worth.
// Ring Run is a race against the clock; Cargo Run adds a takeoff and a landing;
// Free Flight is just the valley. Rings are checked by distance to the next ring.
import { CONFIG } from './config.js';
import { ringRoute } from './world.js';

export class Mission {
  constructor(def, ringMeshes, onEvent) {
    this.def = def;
    this.ringMeshes = ringMeshes; // { meshes } from world.buildRings
    this.onEvent = onEvent;       // (type, detail) -> hud / audio side effects
    this.reset();
  }

  reset() {
    this.state = 'ready'; // ready | flying | done | failed
    this.timeLeft = this.def.timeLimit;
    this.score = 0;
    this.ringsHit = 0;
    this.nextRing = 0;
    this.streak = 0;
    this.reason = '';
    this.route = ringRoute(this.def.rings);
    this.ringMeshes.meshes.forEach((m, i) => {
      m.visible = i < this.def.rings;
      m.userData.halo.visible = i < this.def.rings;
      this.paintRing(m, i === 0 ? 'next' : 'todo');
    });
  }

  paintRing(mesh, kind) {
    const color = kind === 'next' ? 0xffb020 : kind === 'done' ? 0x37d67a : 0x35d0ff;
    mesh.material.color.setHex(color);
    mesh.userData.halo.material.color.setHex(color);
  }

  start() {
    this.state = 'flying';
    this.onEvent('brief', this.def.brief);
  }

  // The plane's position each frame; returns nothing, reports through onEvent.
  update(dt, plane) {
    if (this.state !== 'flying') return;
    if (this.def.timeLimit > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.fail('Out of time — the rings are still out there.');
        return;
      }
    }
    if (this.nextRing < this.def.rings) {
      const target = this.route[this.nextRing];
      const d = plane.pos.distanceTo(target);
      if (d < 12.5) {
        const bonus = this.streak * CONFIG.scoring.ringStreakBonus;
        this.score += this.def.ringScore + bonus;
        this.ringsHit++;
        this.streak++;
        const hit = this.ringMeshes.meshes[this.nextRing];
        this.paintRing(hit, 'done');
        this.onEvent('ring', { index: this.nextRing, score: this.score, streak: this.streak });
        this.nextRing++;
        if (this.nextRing < this.def.rings) {
          this.paintRing(this.ringMeshes.meshes[this.nextRing], 'next');
        } else if (this.def.id === 'ring') {
          this.complete(`All ${this.def.rings} rings threaded with ${this.timeLeft.toFixed(0)}s to spare.`);
        } else {
          this.onEvent('info', 'All rings threaded — bring her home to the strip.');
        }
      }
    }
    if (plane.fuel <= 0 && !this._fuelWarned) {
      this._fuelWarned = true;
      this.onEvent('warning', 'Fuel empty — she is gliding now. Find the strip.');
    }
    if (plane.hull <= 0 && !plane.crashed) {
      this.fail('The Kite-7 gave up — hull damage beyond flying.');
    }
  }

  // Called when physics reports a landing.
  onLanded(plane, belly) {
    if (this.state !== 'flying') return;
    if (this.def.id === 'cargo') {
      if (this.nextRing < this.def.rings) {
        this.fail('Down on the strip, but the cargo run is unfinished — rings remain.');
        return;
      }
      const timeBonus = Math.round(this.timeLeft) * this.def.timeBonusPerSecond;
      this.score += this.def.landingScore + timeBonus - (belly ? 150 : 0);
      this.complete(belly
        ? 'Cargo delivered — belly landing, but the parcel survived.'
        : `Cargo delivered, wheels down on the strip. Time bonus +${timeBonus}.`);
    } else if (this.def.id === 'ring') {
      this.score += 100;
      this.complete('Down safe on the strip. The valley applauds.');
    } else {
      this.complete('A gentle touchdown. Free flight ends where it began.');
    }
  }

  onCrashed() {
    if (this.state === 'flying') this.fail('The Kite-7 is down. The valley keeps her secret.');
  }

  complete(text) {
    this.state = 'done';
    this.reason = text;
    if (this.def.timeLimit > 0 && this.def.id === 'ring') {
      this.score += Math.round(this.timeLeft) * this.def.timeBonusPerSecond;
    }
    this.onEvent('complete', { text, score: this.score });
  }

  fail(text) {
    this.state = 'failed';
    this.reason = text;
    this.onEvent('failed', { text, score: this.score });
  }
}
