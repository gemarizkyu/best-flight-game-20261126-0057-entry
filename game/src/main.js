// Skyline Courier — bootstrap and the game loop: build the valley, wire the menus,
// fly the loop. State is menu | playing | paused | over; the camera is orbit on
// the menu, chase or cockpit in the air.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { buildWorld, buildRings, ringRoute } from './world.js';
import { buildAircraft, updateAircraftVisuals } from './aircraft.js';
import { FlightState } from './physics.js';
import { Mission } from './missions.js';
import { Hud } from './hud.js';
import { SoundEngine } from './audio.js';
import { CameraRig } from './render.js';
import { applyShot } from './shots.js';

const sceneCanvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const world = buildWorld(scene);
const ringMeshes = buildRings(scene, ringRoute(8));
const aircraft = buildAircraft();
scene.add(aircraft.group);

const plane = new FlightState();
const input = new Input(sceneCanvas);
const hud = new Hud(document.getElementById('hud'));
const sound = new SoundEngine();
const rig = new CameraRig(renderer, scene);

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('over');
const statusEl = document.getElementById('status');

let mode = 'orbit'; // orbit | chase | cockpit
let state = 'menu'; // menu | playing | paused | over
let mission = new Mission(CONFIG.missions.ring, ringMeshes, onMissionEvent);
let frames = 0;
let lastBoundaryToast = 0;
const shotName = new URLSearchParams(window.location.search).get('shot');

function showOnly(el) {
  for (const o of [menuEl, pauseEl, overEl]) o.classList.toggle('hidden', o !== el);
  if (!el) for (const o of [menuEl, pauseEl, overEl]) o.classList.add('hidden');
}
function setStatus(text) { statusEl.textContent = text; }

function nextRingPos() {
  if (mission.nextRing < mission.def.rings) return mission.route[mission.nextRing];
  return null;
}

// The visible plane follows the physics state: position plus the same
// pitch / heading / roll the flight model flies by.
function syncAircraft() {
  aircraft.group.position.copy(plane.pos);
  aircraft.group.quaternion.setFromEuler(
    new THREE.Euler(plane.pitch, plane.heading, plane.roll, 'YXZ'),
  );
}

function onMissionEvent(type, detail) {
  if (type === 'brief' || type === 'info' || type === 'warning') {
    hud.toast(detail);
  } else if (type === 'ring') {
    sound.ring();
    const streak = detail.streak > 1 ? ` · streak x${detail.streak}` : '';
    hud.toast(`Ring ${detail.index + 1} threaded · score ${detail.score}${streak}`);
  } else if (type === 'complete') {
    sound.fanfare();
    endFlight(true, detail);
  } else if (type === 'failed') {
    sound.thud();
    endFlight(false, detail);
  }
}

function endFlight(won, detail) {
  state = 'over';
  document.getElementById('over-title').textContent = won ? 'MISSION COMPLETE' : 'MISSION FAILED';
  document.getElementById('over-text').textContent = detail.text;
  document.getElementById('over-score').textContent =
    `Score ${detail.score} · Rings ${mission.ringsHit}/${mission.def.rings}`;
  showOnly(overEl);
  setStatus(`${won ? 'Mission complete' : 'Mission failed'}. Score ${detail.score}.`);
}

function startMission(id) {
  mission = new Mission(CONFIG.missions[id], ringMeshes, onMissionEvent);
  if (id === 'cargo') plane.resetOnRunway();
  else plane.resetAirborne();
  mode = 'chase';
  state = 'playing';
  showOnly(null);
  sound.ensure();
  sound.click();
  mission.start();
  setStatus(`${mission.def.name} started. ${mission.def.brief}`);
}

function showMenu() {
  state = 'menu';
  mode = 'orbit';
  plane.resetOnRunway();
  mission = new Mission(CONFIG.missions.ring, ringMeshes, onMissionEvent);
  aircraft.group.visible = true;
  showOnly(menuEl);
  setStatus('Skyline Courier menu. Choose a mission to fly.');
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showOnly(pauseEl);
    setStatus('Paused.');
  } else if (state === 'paused') {
    state = 'playing';
    showOnly(null);
    setStatus('Resumed.');
  }
}

function handlePlaneEvent(event) {
  if (event === 'takeoff') {
    sound.click();
    hud.toast('Airborne! Gear up with G when you are ready.');
  } else if (event === 'landed') {
    sound.click();
    hud.toast('Wheels down — a clean landing.');
    mission.onLanded(plane, false);
  } else if (event === 'landed-belly') {
    sound.thud();
    hud.toast('Belly landing! The hull took the hit.');
    mission.onLanded(plane, true);
  } else if (event === 'scraped') {
    sound.thud();
    hud.toast(`Scraped the ground — hull ${Math.max(0, Math.round(plane.hull))}% left.`);
  } else if (event === 'crashed') {
    mission.onCrashed();
  } else if (event === 'fuel-empty') {
    hud.toast('Fuel empty — she is gliding now. Find the strip.');
  } else if (event === 'boundary') {
    const now = performance.now();
    if (now - lastBoundaryToast > 6000) {
      lastBoundaryToast = now;
      hud.toast('Leaving the valley — turning back.');
    }
  }
}

function handleKeys() {
  if (input.pollPressed('KeyC') && state === 'playing') {
    mode = mode === 'cockpit' ? 'chase' : 'cockpit';
    sound.click();
    hud.toast(mode === 'cockpit' ? 'Cockpit view' : 'Chase view');
  }
  if (input.pollPressed('KeyG') && state === 'playing') {
    plane.gearDown = !plane.gearDown;
    sound.click();
    hud.toast(plane.gearDown ? 'Gear down' : 'Gear up');
  }
  if (input.pollPressed('KeyF') && state === 'playing') {
    plane.flaps = !plane.flaps;
    sound.click();
    hud.toast(plane.flaps ? 'Flaps down — slower, steadier' : 'Flaps up');
  }
  if (input.pollPressed('KeyM')) {
    const muted = sound.toggleMute();
    hud.toast(muted ? 'Sound off' : 'Sound on');
  }
  if (input.pollPressed('KeyP') || input.pollPressed('Escape')) {
    if (state === 'playing' || state === 'paused') togglePause();
  }
  if (input.pollPressed('KeyR')) {
    if (state === 'playing' || state === 'over') startMission(mission.def.id);
  }
}

// Menu and overlay buttons.
document.querySelectorAll('.mission').forEach((btn) => {
  btn.addEventListener('click', () => startMission(btn.dataset.mission));
});
document.getElementById('resume').addEventListener('click', togglePause);
document.getElementById('quit-to-menu').addEventListener('click', showMenu);
document.getElementById('fly-again').addEventListener('click', () => startMission(mission.def.id));
document.getElementById('over-menu').addEventListener('click', showMenu);

// The game object the screenshot setups drive.
const game = {
  plane,
  mission,
  setMode(next) { mode = next; },
  showMenu,
  startMission,
};

// A read-only handle for local play-testing (screenshots, probes): no secrets,
// just the live state so a script can ask where the plane and rings are.
window.__game = { plane, get mission() { return mission; }, ringMeshes, aircraft, get state() { return state; } };

showMenu();
if (shotName) applyShot(shotName, game);

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  input.update(dt);
  handleKeys();

  if (state === 'playing') {
    const events = plane.step(dt, input);
    mission.update(dt, plane);
    for (const event of events) handlePlaneEvent(event);
    aircraft.group.visible = mode !== 'cockpit';
    syncAircraft();
    updateAircraftVisuals(aircraft, plane.speed, plane.throttle, plane.gearDown, dt);
    sound.setFlight(plane.throttle, plane.speed, true);
    hud.draw(plane, mission, mode, nextRingPos());
  } else if (state === 'menu') {
    syncAircraft();
    updateAircraftVisuals(aircraft, 0, 0, true, dt);
  }

  rig.update(dt, plane, state === 'menu' ? 'orbit' : mode, world, mission, t);
  rig.animateWorld(dt, world, mission, t);
  renderer.render(scene, rig.camera);

  frames++;
  if (shotName && frames === 45) window.__shotReady = true;
}
frame();
