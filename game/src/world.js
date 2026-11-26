// Skyline Courier — the valley itself: seeded terrain, river, lake, town, runway,
// clouds, trees and the golden rings. Everything is built from the seed in config,
// so the same seed always grows the same valley.
import * as THREE from 'three';
import { CONFIG, clamp, lerp } from './config.js';
import { fbm, mulberry32, seededShuffle } from './random.js';

const WORLD = CONFIG.world;
const RUNWAY = CONFIG.runway;

// The river winds north-south on the west side of the valley.
export function riverXAt(z) {
  return -520 + 260 * Math.sin(z * 0.0011 + 1.3) + 90 * Math.sin(z * 0.0027 + 0.4);
}

// Distance from (x, z) to the runway rectangle, metres (0 when inside it).
function distanceToRunway(x, z) {
  const dx = Math.max(Math.abs(x - RUNWAY.x) - RUNWAY.width / 2 - 40, 0);
  const dz = Math.max(Math.abs(z - RUNWAY.z) - RUNWAY.length / 2 - 40, 0);
  return Math.hypot(dx, dz);
}

// Ground height, metres. The flight model, the trees and the rings all ask this.
export function terrainHeight(x, z) {
  const seed = WORLD.seed;
  const dist = Math.hypot(x, z - RUNWAY.z);
  const mountain = smoothstep(650, 1900, dist);
  let h = Math.pow(fbm(x * 0.0016 + 11, z * 0.0016 + 7, seed), 1.7) * WORLD.maxHeight * (0.25 + 0.75 * mountain);
  h += fbm(x * 0.008, z * 0.008, seed + 5) * 6 * (1 - mountain * 0.5);
  // Carve the river valley down to the water.
  const riverD = Math.abs(x - riverXAt(z));
  const carve = smoothstep(0, 70, riverD);
  h = h * (0.12 + 0.88 * carve) + (1 - carve) * 0.5;
  // The lake bowl, west-north of the runway.
  const lakeD = Math.hypot((x + 760) / 280, (z + 640) / 190);
  if (lakeD < 1) h = Math.min(h, 1.5 + lakeD * 4);
  // Flatten the airfield so the runway sits on honest ground.
  const flat = smoothstep(0, 130, distanceToRunway(x, z));
  return lerp(0.4, h, flat);
}

function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function groundColor(x, z, h, slope) {
  const n = fbm(x * 0.02, z * 0.02, WORLD.seed + 31);
  let r, g, b;
  if (h < 4.5) { r = 0.76; g = 0.69; b = 0.47; }              // sandy shore
  else if (slope > 0.55 || h > 150) { r = 0.42; g = 0.38; b = 0.33; } // rock
  else if (h > 205) { r = 0.93; g = 0.94; b = 0.96; }         // snow caps
  else if (n < 0.45) { r = 0.29; g = 0.5; b = 0.2; }          // meadow green
  else if (n < 0.7) { r = 0.36; g = 0.55; b = 0.22; }         // field green
  else { r = 0.55; g = 0.58; b = 0.25; }                      // dry grass
  // Patchwork fields: broad dry rectangles of farmland in the low valley.
  const field = fbm(x * 0.006 + 50, z * 0.006 + 9, WORLD.seed + 7);
  if (field > 0.62 && h < 60 && slope < 0.3) { r = 0.66; g = 0.57; b = 0.32; }
  const shade = 0.86 + n * 0.26;
  return [r * shade, g * shade, b * shade];
}

function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const hx = terrainHeight(x + 4, z) - terrainHeight(x - 4, z);
    const hz = terrainHeight(x, z + 4) - terrainHeight(x, z - 4);
    const slope = Math.hypot(hx, hz) / 8;
    const [r, g, b] = groundColor(x, z, h, slope);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

function buildWater(scene) {
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x3d7ab5, transparent: true, opacity: 0.88 });
  // River ribbon, following the curve.
  const points = [];
  for (let z = -2000; z <= 2000; z += 80) points.push(new THREE.Vector3(riverXAt(z), 3.1, z));
  const ribbon = new THREE.BufferGeometry();
  const verts = [], idx = [];
  points.forEach((p, i) => {
    verts.push(p.x - 30, p.y, p.z, p.x + 30, p.y, p.z);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  ribbon.setIndex(idx);
  ribbon.computeVertexNormals();
  scene.add(new THREE.Mesh(ribbon, waterMat));
  // The lake, a flat disc.
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-760, 3.1, -640);
  lake.scale.set(280, 190, 1);
  scene.add(lake);
}

function buildRunway(scene) {
  const g = new THREE.Group();
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.width, 0.5, RUNWAY.length),
    new THREE.MeshLambertMaterial({ color: 0x2e3138 }),
  );
  asphalt.position.set(RUNWAY.x, 0.25, RUNWAY.z);
  g.add(asphalt);
  // Centreline dashes and threshold bars.
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  for (let z = RUNWAY.z - RUNWAY.length / 2 + 30; z < RUNWAY.z + RUNWAY.length / 2 - 10; z += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 18), white);
    dash.position.set(RUNWAY.x, 0.55, z);
    g.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 9), white);
      bar.position.set(RUNWAY.x + i * 3.4, 0.55, RUNWAY.z + end * (RUNWAY.length / 2 - 14));
      g.add(bar);
    }
  }
  // Edge lights, warm dots down both sides.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let z = RUNWAY.z - RUNWAY.length / 2; z <= RUNWAY.z + RUNWAY.length / 2; z += 46) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lightMat);
      lamp.position.set(RUNWAY.x + side * (RUNWAY.width / 2 + 2), 1.0, z);
      g.add(lamp);
    }
  }
  // Windsock at the threshold: pole plus an orange cone that swings with the wind.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  pole.position.set(RUNWAY.x + RUNWAY.width / 2 + 9, 4.5, RUNWAY.z - RUNWAY.length / 2 + 12);
  g.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.2, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
  sock.rotation.z = Math.PI / 2 - 0.25;
  sock.position.set(RUNWAY.x + RUNWAY.width / 2 + 11.5, 8.6, RUNWAY.z - RUNWAY.length / 2 + 12);
  g.add(sock);
  g.userData.windsock = sock;
  scene.add(g);
  return g;
}

function buildTown(scene) {
  const rng = mulberry32(WORLD.seed + 77);
  const g = new THREE.Group();
  const wallColors = [0xe8dcc0, 0xd9b48f, 0xc9a06a, 0xe5c9a8, 0xb98d5f];
  const roofColors = [0xa63d2e, 0x8c4a2f, 0x6e3b2a, 0x9c5a34];
  const spots = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) < 1 && Math.abs(gz) < 1) continue; // the square stays open
      spots.push([330 + gx * 42 + (rng() - 0.5) * 14, 640 + gz * 42 + (rng() - 0.5) * 14]);
    }
  }
  for (const [x, z] of seededShuffle(spots, rng).slice(0, 34)) {
    const w = 12 + rng() * 10, d = 10 + rng() * 8, h = 7 + rng() * 13;
    const y = terrainHeight(x, z);
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: wallColors[Math.floor(rng() * wallColors.length)] }));
    house.position.set(x, y + h / 2 - 0.5, z);
    g.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5 + rng() * 2, 4),
      new THREE.MeshLambertMaterial({ color: roofColors[Math.floor(rng() * roofColors.length)] }));
    roof.position.set(x, y + h + 1.4, z);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  }
  // The clock tower on the square, the town's landmark from the air.
  const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 34, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }));
  tower.position.set(330, terrainHeight(330, 640) + 16, 640);
  g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(8, 7, 4),
    new THREE.MeshLambertMaterial({ color: 0x2e5d8a }));
  cap.position.set(330, terrainHeight(330, 640) + 36, 640);
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
  scene.add(g);
  return g;
}

function buildTrees(scene) {
  const rng = mulberry32(WORLD.seed + 201);
  const count = 650;
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 4, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 11, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4126 });
  // White base so the per-instance greens show true instead of doubling dark.
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const x = (rng() - 0.5) * 3800;
    const z = (rng() - 0.5) * 3800;
    const h = terrainHeight(x, z);
    if (h < 7 || h > 130) continue;
    if (distanceToRunway(x, z) < 130) continue;
    if (Math.abs(x - riverXAt(z)) < 48) continue;
    if (Math.hypot(x - 330, z - 640) < 220) continue;
    const s = 0.7 + rng() * 0.9;
    dummy.position.set(x, h + 2 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (2 + 5.5) * s;
    dummy.updateMatrix();
    leaves.setMatrixAt(placed, dummy.matrix);
    color.setHSL(0.33 + rng() * 0.04, 0.55, 0.34 + rng() * 0.14);
    leaves.setColorAt(placed, color);
    placed++;
  }
  trunks.count = placed;
  leaves.count = placed;
  scene.add(trunks);
  scene.add(leaves);
  return { trunks, leaves };
}

function buildClouds(scene) {
  const rng = mulberry32(WORLD.seed + 55);
  // Emissive keeps the puffs bright even on their shaded side, away from the sun.
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff, emissive: 0x8a959e, transparent: true, opacity: 0.85,
  });
  const clouds = [];
  for (let i = 0; i < 24; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < puffs; j++) {
      const r = 14 + rng() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set((rng() - 0.5) * 70, (rng() - 0.5) * 8, (rng() - 0.5) * 36);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set((rng() - 0.5) * 3800, 280 + rng() * 160, (rng() - 0.5) * 3800);
    cloud.userData.speed = 1.5 + rng() * 2;
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

function buildSky(scene) {
  // A canvas gradient wrapped on a far sphere: peach sunset band at the horizon,
  // deep blue overhead. No image file, no network.
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1d4e89');
  grad.addColorStop(0.45, '#5f97c8');
  grad.addColorStop(0.62, '#f6c98a');
  grad.addColorStop(0.72, '#ffd9a0');
  grad.addColorStop(1.0, '#e8d9b8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4800, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);
  // The low sun, a soft glow sprite plus the light that warms the valley.
  const glow = document.createElement('canvas');
  glow.width = 128; glow.height = 128;
  const gctx = glow.getContext('2d');
  const radial = gctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  radial.addColorStop(0, 'rgba(255, 236, 180, 1)');
  radial.addColorStop(0.35, 'rgba(255, 200, 110, 0.55)');
  radial.addColorStop(1, 'rgba(255, 200, 110, 0)');
  gctx.fillStyle = radial;
  gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glow);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false }));
  sun.position.set(-2600, 900, -3600);
  sun.scale.setScalar(800);
  scene.add(sun);
  const light = new THREE.DirectionalLight(0xffd9a0, 2.4);
  light.position.set(-1400, 900, -1900);
  scene.add(light);
  scene.add(new THREE.HemisphereLight(0x9fc4e8, 0x5d7a4a, 1.1));
  scene.fog = new THREE.Fog(0xdfe6ea, WORLD.fogNear, WORLD.fogFar);
}

// Ring route: a valley tour that starts over the runway, threads the river bend,
// climbs past the lake and finishes above the town square.
export function ringRoute(count) {
  const rng = mulberry32(WORLD.seed + 999);
  const waypoints = [
    [0, 150, -260], [180, 130, -620], [-160, 170, -900], [-420, 150, -520],
    [-640, 120, -120], [-380, 180, 240], [60, 200, 420], [330, 160, 640],
    [520, 190, 320], [260, 150, -80], [0, 130, -260],
  ];
  const route = [];
  for (let i = 0; i < count; i++) {
    const [x, y, z] = waypoints[i % waypoints.length];
    route.push(new THREE.Vector3(
      x + (rng() - 0.5) * 40,
      Math.max(y + (rng() - 0.5) * 30, terrainHeight(x, z) + 45),
      z + (rng() - 0.5) * 40,
    ));
  }
  return route;
}

export function buildRings(scene, positions) {
  const group = new THREE.Group();
  const meshes = positions.map((pos, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11, 0.9, 12, 42),
      new THREE.MeshBasicMaterial({ color: 0x35d0ff }),
    );
    ring.position.copy(pos);
    ring.userData.index = i;
    group.add(ring);
    // A faint halo so the ring reads from far away.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(11, 2.6, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x35d0ff, transparent: true, opacity: 0.16 }),
    );
    halo.position.copy(pos);
    group.add(halo);
    ring.userData.halo = halo;
    return ring;
  });
  scene.add(group);
  return { group, meshes };
}

export function buildWorld(scene) {
  buildTerrain(scene);
  buildWater(scene);
  const runway = buildRunway(scene);
  buildTown(scene);
  buildTrees(scene);
  const clouds = buildClouds(scene);
  buildSky(scene);
  return { runway, clouds };
}
