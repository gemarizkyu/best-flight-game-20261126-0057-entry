// Skyline Courier — the cameras. Chase view trails the Kite-7 on a soft spring so
// it never fights the pilot; cockpit view sits in the pilot's seat; orbit view
// circles the parked plane behind the menu.
import * as THREE from 'three';
import { CONFIG, clamp, lerp } from './config.js';

export class CameraRig {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);
    this.camera.position.set(0, 160, 660);
    this.orbitAngle = 0;
    this.chasePos = new THREE.Vector3(0, 160, 660);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  update(dt, plane, mode, world, mission, time) {
    if (mode === 'cockpit') {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(plane.pitch, plane.heading, plane.roll, 'YXZ'));
      const eye = plane.pos.clone()
        .add(new THREE.Vector3(0, 0.95, 0).applyQuaternion(q))
        .add(new THREE.Vector3(0, 0, -0.4).applyQuaternion(q));
      const look = plane.pos.clone().add(new THREE.Vector3(0, 0, -60).applyQuaternion(q));
      this.camera.position.copy(eye);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(look);
      this.camera.rotation.z += plane.roll * 0.25;
      return;
    }
    if (mode === 'orbit') {
      this.orbitAngle += dt * 0.12;
      const r = 26;
      const cx = plane.pos.x + Math.sin(this.orbitAngle) * r;
      const cz = plane.pos.z + Math.cos(this.orbitAngle) * r;
      this.camera.position.set(cx, plane.pos.y + 7, cz);
      this.camera.lookAt(plane.pos.x, plane.pos.y + 1, plane.pos.z);
      return;
    }
    // Chase: the ideal spot trails behind and above the plane's own axes.
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(plane.pitch, plane.heading, plane.roll, 'YXZ'));
    const ideal = plane.pos.clone()
      .add(new THREE.Vector3(0, 0, CONFIG.camera.chaseDistance).applyQuaternion(q))
      .add(new THREE.Vector3(0, CONFIG.camera.chaseHeight, 0));
    const k = 1 - Math.exp(-CONFIG.camera.chaseStiffness * dt);
    this.chasePos.lerp(ideal, k);
    this.camera.position.copy(this.chasePos);
    const look = plane.pos.clone().add(new THREE.Vector3(0, 1.2, -26).applyQuaternion(q));
    this.camera.lookAt(look);
    this.camera.rotation.z += plane.roll * 0.12;
  }

  // Clouds drift, the windsock swings, the next ring breathes. Cheap life.
  // Time here is the clock's elapsed seconds, so the motion is smooth at
  // any frame rate and identical for the same seed.
  animateWorld(dt, world, mission, time) {
    for (const cloud of world.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 2000) cloud.position.x = -2000;
    }
    if (world.runway.userData.windsock) {
      world.runway.userData.windsock.rotation.y = Math.sin(time * 0.5) * 0.35;
    }
    if (mission && mission.state === 'flying' && mission.nextRing < mission.def.rings) {
      const next = mission.ringMeshes.meshes[mission.nextRing];
      const pulse = 1 + Math.sin(time * 4) * 0.05;
      next.scale.setScalar(pulse);
      next.userData.halo.material.opacity = 0.12 + Math.sin(time * 4) * 0.05;
    }
  }
}
