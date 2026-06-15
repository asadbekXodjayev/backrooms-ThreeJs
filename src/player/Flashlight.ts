import * as THREE from 'three';

/**
 * The held flashlight — the one strong dynamic light. A SpotLight that tracks
 * the camera with a little lag (handheld feel) and flickers as batteries drain.
 */
export class Flashlight {
  light: THREE.SpotLight;
  target: THREE.Object3D;
  on = true;
  private base = 3.2;

  constructor(scene: THREE.Scene, castShadow: boolean) {
    this.light = new THREE.SpotLight(0xfff2cc, this.base, 22, Math.PI / 6.2, 0.45, 1.3);
    this.light.castShadow = castShadow;
    if (castShadow) {
      this.light.shadow.mapSize.set(1024, 1024);
      this.light.shadow.camera.near = 0.2;
      this.light.shadow.camera.far = 22;
      this.light.shadow.bias = -0.0008;
    }
    this.target = new THREE.Object3D();
    this.light.target = this.target;
    scene.add(this.light, this.target);
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
    this.target.position.copy(cam.position).add(dir.multiplyScalar(6));

    const batK = battery <= 0 ? 0 : THREE.MathUtils.clamp(0.25 + battery * 0.9, 0.25, 1);
    const want = this.on ? this.base * batK * flicker : 0;
    this.light.intensity += (want - this.light.intensity) * 0.4;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.light, this.target);
    this.light.dispose();
  }
}
