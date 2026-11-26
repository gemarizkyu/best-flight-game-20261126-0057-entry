// Skyline Courier — every tunable in one place: world, plane, missions, scoring.
// The valley is a fictional place (Merapi Valley, runway 27, town of Kertajaya);
// no real airfield, aircraft or place is copied.
export const CONFIG = {
  world: {
    seed: 7,
    size: 4200,            // terrain square, metres, centred on the runway
    segments: 180,         // terrain mesh resolution
    maxHeight: 260,        // tallest peak, metres
    valleyRadius: 900,     // flat-ish bowl around the runway
    fogNear: 900,
    fogFar: 3400,
  },
  runway: {
    x: 0, z: 120,          // centre of the strip
    length: 460, width: 30,
    headingDeg: 0,         // strip runs north-south; landing heading 270 = westbound "27"
  },
  plane: {
    maxSpeed: 92,          // m/s at full throttle (~179 kt)
    cruiseSpeed: 62,
    stallSpeed: 27,        // below this the nose drops and she sinks
    accel: 14,             // m/s^2 toward throttle target
    drag: 0.12,            // extra bleed at high speed
    pitchRate: 0.85,       // rad/s at full stick
    rollRate: 1.9,         // rad/s at full stick
    maxRoll: 1.25,         // rad, hard bank limit
    autoLevel: 0.9,        // rad/s the wings level themselves
    fuelCapacity: 100,
    fuelBurnCruise: 0.16,  // per second at cruise throttle
    fuelBurnFull: 0.42,    // per second at full throttle
    hull: 100,             // damage points
  },
  camera: {
    chaseDistance: 15,
    chaseHeight: 3.4,
    chaseStiffness: 4.5,   // lerp speed toward the ideal chase spot
  },
  missions: {
    ring: {
      id: 'ring', name: 'Ring Run', timeLimit: 240, rings: 8, // 4 minutes on the clock
      brief: 'Thread all 8 golden rings before the clock runs out.',
      ringScore: 100, timeBonusPerSecond: 5,
    },
    cargo: {
      id: 'cargo', name: 'Cargo Run', timeLimit: 360, rings: 5,
      brief: 'Take off from runway 27, thread 5 rings, land back on the strip.',
      ringScore: 150, landingScore: 400, timeBonusPerSecond: 5,
    },
    free: {
      id: 'free', name: 'Free Flight', timeLimit: 0, rings: 0,
      brief: 'No clock, no rings. Just you, the valley and the sunset.',
      ringScore: 0, timeBonusPerSecond: 0,
    },
  },
  scoring: {
    ringStreakBonus: 25,   // extra per ring when flown back-to-back without a miss
    hardLandingDamage: 30, // hull lost on a touchdown faster than 6 m/s down
    scrapeDamage: 45,      // hull lost on a terrain scrape
    crashSpeed: 55,         // impact above this speed with terrain is fatal
  },
  hud: {
    stallKnots: 52,        // stall speed shown to the pilot, knots
  },
};

// Unit helpers the rest of the game shares.
export const MS_TO_KNOTS = 1.94384;
export const MS_TO_FEET = 3.28084;
export function degToRad(deg) { return (deg * Math.PI) / 180; }
export function radToDeg(rad) { return (rad * 180) / Math.PI; }
export function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Shortest signed angle from a to b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
