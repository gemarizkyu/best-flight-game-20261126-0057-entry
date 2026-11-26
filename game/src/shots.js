// Skyline Courier — deterministic screenshot setups. ?shot=start shows the menu over
// the parked plane; ?shot=play and ?shot=cockpit put the Kite-7 mid-flight with the
// rings ahead; ?shot=land puts her on final approach, gear down, strip in sight.
// Each setup lands the camera, waits a few frames, then raises window.__shotReady.
import { CONFIG } from './config.js';

export function applyShot(name, game) {
  const plane = game.plane;
  const mission = game.mission;
  if (name === 'start') {
    plane.resetOnRunway();
    game.setMode('orbit');
    game.showMenu();
    return;
  }
  if (name === 'cockpit' || name === 'play') {
    game.startMission('ring');
    // Park the plane on the approach to ring 1 so the golden ring sits
    // dead ahead, centred in the frame. Heading is counterclockwise from
    // north in the flight model: ring 1 bears 0.365 rad clockwise.
    // Altitude 148 puts her 6 m above the ring's centre, inside its throat.
    plane.pos.set(110, 148, 60);
    plane.heading = 0.365;
    plane.pitch = 0;
    plane.roll = 0;
    plane.speed = 66;
    plane.throttle = 0.78;
    plane.gearDown = true;
    game.setMode(name === 'cockpit' ? 'cockpit' : 'chase');
    return;
  }
  if (name === 'land') {
    game.startMission('cargo');
    // Short final: the strip fills the view ahead, gear down, flaps out.
    // Clear onGround: startMission parks her on the strip, but this shot
    // catches her in the air on final approach.
    plane.onGround = false;
    plane.pos.set(0, 62, 480);
    plane.heading = 0;
    plane.pitch = -0.05;
    plane.roll = 0;
    plane.speed = 42;
    plane.throttle = 0.3;
    plane.gearDown = true;
    plane.flaps = true;
    game.setMode('chase');
  }
}

export function shotList() {
  return [
    { name: '1-start.jpg', query: '?shot=start&seed=1' },
    { name: '2-play.jpg', query: '?shot=play&seed=1' },
    { name: '3-cockpit.jpg', query: '?shot=cockpit&seed=1' },
    { name: '4-land.jpg', query: '?shot=land&seed=1' },
  ];
}

// Keep the config import honest: the shot setups read the same runway the game does.
export const SHOT_RUNWAY = CONFIG.runway;
