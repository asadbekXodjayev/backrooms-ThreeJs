import * as THREE from 'three';

/**
 * The held flashlight — the one strong dynamic light. A SpotLight that tracks
 * the camera with a little lag (handheld feel) and flickers as batteries drain.
 */
export class Flashlight {
  light: THREE.SpotLight;
  target: THREE.Object3D;
  on = true;
  private base = 4.2;
  // Soft warm pool that fakes the beam bouncing off the floor in front of you.
  private floor: THREE.PointLight;

  constructor(scene: THREE.Scene, castShadow: boolean) {
    this.light = new THREE.SpotLight(0xfff2cc, this.base, 26, Math.PI / 6.2, 0.45, 1.3);
    this.light.castShadow = castShadow;
    if (castShadow) {
      this.light.shadow.mapSize.set(1024, 1024);
      this.light.shadow.camera.near = 0.2;
      this.light.shadow.camera.far = 26;
      this.light.shadow.bias = -0.0008;
    }
    this.target = new THREE.Object3D();
    this.light.target = this.target;
    this.floor = new THREE.PointLight(0xffe7b8, 0, 6.5, 1.6);
    scene.add(this.light, this.target, this.floor);
  }

  setShadow(on: boolean) {
    this.light.castShadow = on;
  }

  toggle(): boolean {
    this.on = !this.on;
    return this.on;
  }

  /** Track the camera. `flicker` 0..1 scales brightness; `battery` dims it. */
  update(cam: THREE.PerspectiveCamera, battery: number, flicker: number) {
    // position just below the eye, like a held torch
    const off = new THREE.Vector3(0.18, -0.18, 0);
    off.applyQuaternion(cam.quaternion);
    this.light.position.copy(cam.position).add(off);

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.target.position.copy(cam.position).add(dir.clone().multiplyScalar(6));

    const batK = battery <= 0 ? 0 : THREE.MathUtils.clamp(0.25 + battery * 0.9, 0.25, 1);
    const want = this.on ? this.base * batK * flicker : 0;
    this.light.intensity += (want - this.light.intensity) * 0.4;

    // Floor reflection: a dim pool a couple of metres ahead, pinned near the
    // ground, tracking the same battery/flicker so the bounce dies with the beam.
    this.floor.position.copy(cam.position).add(dir.multiplyScalar(2.6));
    this.floor.position.y = 0.12;
    const floorWant = this.on ? this.base * batK * flicker * 0.38 : 0;
    this.floor.intensity += (floorWant - this.floor.intensity) * 0.4;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.light, this.target, this.floor);
    this.light.dispose();
    this.floor.dispose();
  }
}
