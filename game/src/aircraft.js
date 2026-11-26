// Skyline Courier — the Kite-7, a little courier prop plane built from primitives:
// cream fuselage, teal wings, orange cheatline, spinning prop, retractable gear.
// No model file, no borrowed art: every part is shaped here.
import * as THREE from 'three';

const CREAM = 0xf3e6c8;
const TEAL = 0x1f7a6d;
const TEAL_DARK = 0x155e53;
const ORANGE = 0xff7a1a;

function liveryTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = '#123f3a';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildAircraft() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: CREAM });
  const teal = new THREE.MeshLambertMaterial({ color: TEAL });
  const tealDark = new THREE.MeshLambertMaterial({ color: TEAL_DARK });
  const orange = new THREE.MeshLambertMaterial({ color: ORANGE });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd4e8, transparent: true, opacity: 0.55, shininess: 120,
  });

  // Fuselage: a tube along -z (nose points -z, the direction of flight).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 5.4, 14), cream);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.2;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 14), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.7;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.8, 12), cream);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.8;
  plane.add(tailCone);

  // Orange cheatline down each flank, plus the KITE-7 mark.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 4.6), orange);
    stripe.position.set(side * 0.86, -0.05, 0.1);
    plane.add(stripe);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: liveryTexture('KITE-7'), transparent: true }),
    );
    decal.position.set(side * 0.88, 0.28, -0.4);
    decal.rotation.y = side * Math.PI / 2;
    plane.add(decal);
  }

  // Canopy: a glass bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(0.9, 0.75, 1.7);
  canopy.position.set(0, 0.55, -0.9);
  plane.add(canopy);

  // Main wing, low and straight, with teal tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.18, 1.7), teal);
  wing.position.set(0, -0.15, -0.6);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.7), orange);
    tip.position.set(side * 4.5, -0.15, -0.6);
    plane.add(tip);
  }
  // Tail: horizontal stabiliser and a tall fin.
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.1), teal);
  stabiliser.position.set(0, 0.15, 3.6);
  plane.add(stabiliser);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.4), tealDark);
  fin.position.set(0, 0.75, 3.7);
  fin.rotation.x = -0.18;
  plane.add(fin);

  // Propeller: hub, two blades and a blur disc that fades in with rpm.
  const prop = new THREE.Group();
  prop.position.z = -4.55;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), tealDark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), bladeMat);
    blade.rotation.z = angle;
    blade.position.y = 0;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 28),
    new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  prop.add(disc);
  plane.add(prop);

  // Landing gear: two mains and a nose wheel, on one group so it can swing away.
  const gear = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), legMat);
    leg.position.set(side * 1.1, -0.9, -0.6);
    leg.rotation.z = side * 0.25;
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.35, -1.45, -0.6);
    gear.add(wheel);
  }
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), legMat);
  noseLeg.position.set(0, -0.85, -3.0);
  gear.add(noseLeg);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), tyreMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, -1.35, -3.0);
  gear.add(noseWheel);
  plane.add(gear);

  // Navigation lights: red port, green starboard, white tail.
  const lights = [];
  const lamp = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    plane.add(m);
    lights.push(m);
    return m;
  };
  lamp(0xff2a2a, -4.85, -0.15, -0.6);
  lamp(0x2aff5a, 4.85, -0.15, -0.6);
  lamp(0xffffff, 0, 0.3, 4.7);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: plane, prop, disc, gear, lights };
}

// Per-frame dressing: spin the prop with speed, fade the blur disc in, fold the gear.
export function updateAircraftVisuals(aircraft, speed, throttle, gearDown, dt) {
  const rpm = 4 + throttle * 26 + speed * 0.12;
  aircraft.prop.rotation.z += rpm * dt;
  aircraft.disc.material.opacity = Math.min(0.22, throttle * 0.28);
  const target = gearDown ? 0 : -Math.PI / 2 + 0.12;
  aircraft.gear.rotation.x += (target - aircraft.gear.rotation.x) * Math.min(1, dt * 5);
  const blink = (performance.now() % 1200) < 120;
  aircraft.lights.forEach((l) => { l.visible = blink || l.material.color.getHex() !== 0xffffff; });
}
