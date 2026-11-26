// Skyline Courier — the flight model. Arcade, not a simulator: throttle sets the
// speed the plane chases, the stick sets pitch and bank, bank turns the nose, and
// below stall speed the nose drops and she sinks. All angles in radians.
import * as THREE from 'three';
import { CONFIG, clamp, lerp } from './config.js';
import { terrainHeight } from './world.js';

const P = CONFIG.plane;
const RUNWAY = CONFIG.runway;
const G = 9.81;

export class FlightState {
  constructor() {
    this.resetAirborne();
  }

  resetAirborne() {
    this.pos = new THREE.Vector3(0, 150, 620);
    this.heading = 0; // 0 = north (-z), grows clockwise
    this.pitch = 0;
    this.roll = 0;
    this.speed = 55;
    this.throttle = 0.7;
    this.gearDown = true;
    this.flaps = false;
    this.fuel = P.fuelCapacity;
    this.hull = P.hull;
    this.verticalSpeed = 0;
    this.onGround = false;
    this.landed = false;
    this.crashed = false;
    this.stalled = false;
    this.events = [];
  }

  resetOnRunway() {
    this.resetAirborne();
    this.pos.set(RUNWAY.x, 2.0, RUNWAY.z + RUNWAY.length / 2 - 40);
    this.heading = 0;
    this.speed = 0;
    this.throttle = 0;
    this.gearDown = true;
    this.onGround = true;
  }

  forwardVector() {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.heading, this.roll, 'YXZ'));
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  }

  isOverRunway() {
    return Math.abs(this.pos.x - RUNWAY.x) < RUNWAY.width / 2 + 2
      && Math.abs(this.pos.z - RUNWAY.z) < RUNWAY.length / 2 + 2;
  }

  step(dt, input) {
    this.events = [];
    if (this.crashed) return this.events;
    if (this.landed) {
      // Rolling out after a landing: friction does the rest.
      this.speed = Math.max(0, this.speed - 18 * dt);
      if (this.speed > 0.5) {
        this.pos.addScaledVector(this.forwardVector(), this.speed * dt);
        this.pos.y = terrainHeight(this.pos.x, this.pos.z) + 1.6;
      }
      return this.events;
    }
    if (this.onGround) {
      // Rolling down the strip: throttle spools her up, pitch lifts her off.
      if (input.throttleUp) this.throttle = clamp(this.throttle + dt * 0.6, 0, 1);
      if (input.throttleDown) this.throttle = clamp(this.throttle - dt * 0.6, 0, 1);
      const targetSpeed = this.throttle * P.maxSpeed;
      this.speed += clamp(targetSpeed - this.speed, -7 * dt, P.accel * dt);
      this.speed = Math.max(0, this.speed);
      this.pitch = clamp(this.pitch + input.pitchAxis * P.pitchRate * 0.6 * dt, -0.1, 0.3);
      this.heading += input.rollAxis * 0.15 * dt + input.yawAxis * 0.3 * dt;
      const forward = this.forwardVector();
      forward.y = 0;
      forward.normalize();
      this.pos.addScaledVector(forward, this.speed * dt);
      this.pos.y = terrainHeight(this.pos.x, this.pos.z) + 1.6;
      this.fuel = Math.max(0, this.fuel - lerp(0.1, P.fuelBurnFull, this.throttle) * dt);
      const stall = this.flaps ? P.stallSpeed * 0.82 : P.stallSpeed;
      if (this.speed > stall * 1.05 && this.pitch > 0.04) {
        this.onGround = false;
        this.events.push('takeoff');
      }
      return this.events;
    }

    // Throttle: Shift spools up, Ctrl spools down, about 0.6/s either way.
    if (input.throttleUp) this.throttle = clamp(this.throttle + dt * 0.6, 0, 1);
    if (input.throttleDown) this.throttle = clamp(this.throttle - dt * 0.6, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;

    // Speed chases the throttle's target; flaps bleed speed and lower the stall.
    const stall = this.flaps ? P.stallSpeed * 0.82 : P.stallSpeed;
    const targetSpeed = this.throttle * P.maxSpeed * (this.flaps ? 0.82 : 1);
    const rate = targetSpeed > this.speed ? P.accel : 7;
    this.speed += clamp(targetSpeed - this.speed, -rate * dt, rate * dt);
    this.speed -= this.speed * P.drag * dt * 0.1;
    this.speed = Math.max(0, this.speed);

    // Stick authority fades as the wing unloads near the stall.
    // Note the sign: the Euler the plane flies by turns (0,0,-1) into
    // (-sin h, sin p, -cos h), so heading grows counterclockwise from north
    // and a right bank is a negative roll.
    const authority = clamp(this.speed / stall, 0.35, 1);
    this.pitch = clamp(this.pitch + input.pitchAxis * P.pitchRate * authority * dt, -0.55, 0.55);
    this.roll = clamp(this.roll - input.rollAxis * P.rollRate * authority * dt, -P.maxRoll, P.maxRoll);
    if (Math.abs(input.rollAxis) < 0.05) {
      this.roll -= Math.sign(this.roll) * Math.min(Math.abs(this.roll), P.autoLevel * dt);
    }
    // A banked wing turns the nose: coordinated turn, plus a touch of rudder.
    const turnRate = (G * Math.tan(this.roll)) / Math.max(this.speed, 15);
    this.heading += turnRate * dt - input.yawAxis * 0.22 * dt;

    // The stall: below stall speed the nose drops on its own and she sinks.
    this.stalled = this.speed < stall;
    let sink = 0;
    if (this.stalled) {
      this.pitch = Math.max(this.pitch - 0.3 * dt, -0.45);
      sink = (stall - this.speed) * 0.55;
    }

    const prevY = this.pos.y;
    const forward = this.forwardVector();
    this.pos.addScaledVector(forward, this.speed * dt);
    this.pos.y -= sink * dt;
    this.verticalSpeed = (this.pos.y - prevY) / Math.max(dt, 1e-4);

    // Soft ceiling and a gentle nudge back when the pilot leaves the valley.
    if (this.pos.y > 900) { this.pos.y = 900; this.pitch = Math.min(this.pitch, 0); }
    const distCentre = Math.hypot(this.pos.x, this.pos.z - RUNWAY.z);
    if (distCentre > 2050) {
      // home is a clockwise bearing; the plane's clockwise heading is -heading.
      const home = Math.atan2(-this.pos.x, -(this.pos.z - RUNWAY.z));
      const diff = ((home + this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.heading -= clamp(diff, -0.4 * dt, 0.4 * dt);
      this.events.push('boundary');
    }

    // Fuel burns with the throttle.
    this.fuel = Math.max(0, this.fuel - lerp(0.1, P.fuelBurnFull, this.throttle) * dt);
    if (this.fuel <= 0) this.events.push('fuel-empty');

    // Ground contact: a gentle touchdown on the strip is a landing, anything
    // else at speed is a scrape or a crash.
    const ground = terrainHeight(this.pos.x, this.pos.z);
    const gearHeight = 1.6;
    if (this.pos.y <= ground + gearHeight) {
      const overStrip = this.isOverRunway();
      const gentle = this.verticalSpeed > -6;
      if (overStrip && this.gearDown && gentle && this.speed < 55) {
        this.pos.y = ground + gearHeight;
        this.landed = true;
        this.onGround = true;
        this.pitch = 0;
        this.roll = 0;
        this.events.push('landed');
      } else if (overStrip && !this.gearDown && gentle && this.speed < 40) {
        // Belly landing: survivable, but it costs the hull.
        this.pos.y = ground + 1.0;
        this.landed = true;
        this.onGround = true;
        this.hull -= CONFIG.scoring.scrapeDamage;
        this.events.push('landed-belly');
      } else if (this.verticalSpeed < -9 || this.speed > CONFIG.scoring.crashSpeed) {
        this.crashed = true;
        this.events.push('crashed');
      } else {
        // A scrape: bounce off the dirt, lose hull, keep flying if she holds.
        this.pos.y = ground + gearHeight;
        this.hull -= CONFIG.scoring.scrapeDamage;
        this.speed *= 0.55;
        this.pitch = Math.max(this.pitch, 0.12);
        this.events.push('scraped');
        if (this.hull <= 0) { this.crashed = true; this.events.push('crashed'); }
      }
    }

    return this.events;
  }
}
