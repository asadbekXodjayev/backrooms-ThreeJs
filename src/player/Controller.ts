import * as THREE from 'three';
import { Input } from '../core/input';
import { ChunkManager } from '../world/ChunkManager';
import { WALL_H } from '../world/MazeGen';

const STAND_EYE = 1.62;
const CROUCH_EYE = 1.02;
const RADIUS = 0.34;

/**
 * First-person capsule controller. Movement is resolved in 2D against the maze
 * grid (so it can never clip a wall); the eye height is pinned to the floor
 * (so it can never fall through). Adds stamina-gated sprint, crouch, smooth
 * head-bob, and an optional 3rd-person "stickman" camera.
 */
export class Controller {
  pos = new THREE.Vector3(0, 0, 0); // feet
  yaw = 0;
  pitch = 0;
  stamina = 1;
  crouching = false;
  speed = 0;
  moving = false;
  thirdPerson = false;

  onFootstep: ((sprint: boolean) => void) | null = null;

  private eye = STAND_EYE;
  private bobPhase = 0;
  private lastBobSign = 1;
  // vertical physics + bunny-hop chain
  private posY = 0;          // feet height above the floor
  private vy = 0;            // vertical velocity
  private grounded = true;
  private timeSinceLanded = 0;
  private hopChain = 0;      // consecutive well-timed hops
  private hopBoost = 1;      // horizontal speed multiplier earned by chaining
  private avatar: THREE.Group;
  private reducedMotion: boolean;

  constructor(scene: THREE.Scene, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.avatar = this.makeStickman();
    this.avatar.visible = false;
    scene.add(this.avatar);
  }

  teleport(x: number, z: number, yaw = 0) {
    this.pos.set(x, 0, z);
    this.yaw = yaw; this.pitch = 0;
    this.stamina = 1;
    this.posY = 0; this.vy = 0; this.grounded = true;
    this.hopChain = 0; this.hopBoost = 1; this.timeSinceLanded = 0;
  }

  toggleThirdPerson(): boolean {
    this.thirdPerson = !this.thirdPerson;
    this.avatar.visible = this.thirdPerson;
    return this.thirdPerson;
  }

  update(dt: number, input: Input, cm: ChunkManager, cam: THREE.PerspectiveCamera, canMove: boolean) {
    const s = input.state;

    // look
    this.yaw -= s.lookX;
    this.pitch -= s.lookY;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);

    // crouch
    this.crouching = s.crouch;
    const targetEye = this.crouching ? CROUCH_EYE : STAND_EYE;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);

    // movement basis
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let mx = 0, mz = 0;
    if (canMove) { mx = s.moveX; mz = s.moveZ; }
    const inputLen = Math.hypot(mx, mz);

    // speed + stamina
    const wantSprint = s.sprint && !this.crouching && inputLen > 0.1 && this.stamina > 0.02;
    let maxSpeed = this.crouching ? 1.5 : 2.7;
    if (wantSprint) maxSpeed = 4.7;
    // sprint lasts ~7× longer than the original tuning (gentler drain)
    if (wantSprint) this.stamina = Math.max(0, this.stamina - dt * 0.046);
    else this.stamina = Math.min(1, this.stamina + dt * (this.moving ? 0.16 : 0.28));

    // ── jump + bunny hop ─────────────────────────────────────────────────
    // Space jumps. Holding Space auto-jumps the instant you land (auto-bhop);
    // hops chained quickly while moving build a capped horizontal speed boost.
    const GRAVITY = 22, JUMP_V = 5.4;
    const wantJump = canMove && (s.jumpPressed || (s.jump && this.grounded));
    if (this.grounded) {
      this.timeSinceLanded += dt;
      if (wantJump) {
        this.vy = JUMP_V;
        this.grounded = false;
        // a hop that lands and re-launches within the window, while moving,
        // keeps the chain alive and ramps the boost; otherwise it resets.
        if (this.timeSinceLanded < 0.18 && this.moving) this.hopChain = Math.min(this.hopChain + 1, 10);
        else this.hopChain = 0;
        this.hopBoost = 1 + Math.min(this.hopChain * 0.05, 0.5); // up to +50%
      } else if (this.timeSinceLanded > 0.22) {
        // stopped hopping — bleed the momentum back to normal
        this.hopChain = 0; this.hopBoost = 1;
      }
    }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.posY += this.vy * dt;
      if (this.posY <= 0) { this.posY = 0; this.vy = 0; this.grounded = true; this.timeSinceLanded = 0; }
    }
    maxSpeed *= this.hopBoost;

    const vel = new THREE.Vector3();
    vel.addScaledVector(forward, mz);
    vel.addScaledVector(right, mx);
    if (vel.lengthSq() > 0) vel.normalize().multiplyScalar(maxSpeed * Math.min(1, inputLen));

    // integrate + collide
    let nx = this.pos.x + vel.x * dt;
    let nz = this.pos.z + vel.z * dt;
    const resolved = cm.resolveCollision(nx, nz, RADIUS);
    this.pos.x = resolved.x; this.pos.z = resolved.z;

    this.speed = Math.hypot(vel.x, vel.z);
    this.moving = this.speed > 0.2;

    // head-bob + footsteps
    let bobY = 0, bobRoll = 0;
    if (this.moving && this.grounded && !this.reducedMotion) {
      const rate = (wantSprint ? 11 : 7.5);
      this.bobPhase += dt * rate;
      const amp = (this.crouching ? 0.025 : 0.045) * (wantSprint ? 1.3 : 1);
      bobY = Math.sin(this.bobPhase) * amp;
      bobRoll = Math.cos(this.bobPhase * 0.5) * 0.006;
      const sign = Math.sign(Math.sin(this.bobPhase));
      if (sign !== this.lastBobSign && sign < 0) this.onFootstep?.(wantSprint);
      this.lastBobSign = sign;
    } else if (this.moving && this.grounded) {
      // reduced motion: still trigger footstep sounds on a timer-ish phase
      this.bobPhase += dt * 7;
      const sign = Math.sign(Math.sin(this.bobPhase));
      if (sign !== this.lastBobSign && sign < 0) this.onFootstep?.(wantSprint);
      this.lastBobSign = sign;
    }

    // place camera
    const headY = this.eye + bobY + this.posY;
    cam.rotation.order = 'YXZ';
    if (!this.thirdPerson) {
      cam.position.set(this.pos.x, headY, this.pos.z);
      cam.rotation.set(this.pitch, this.yaw, bobRoll);
    } else {
      const head = new THREE.Vector3(this.pos.x, headY, this.pos.z);
      const dir = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      const camPos = head.clone().addScaledVector(dir, -3.4); camPos.y += 0.6;
      // keep the 3rd-person camera out of walls
      const c = cm.resolveCollision(camPos.x, camPos.z, 0.3);
      camPos.x = c.x; camPos.z = c.z;
      camPos.y = Math.min(camPos.y, WALL_H - 0.2);
      cam.position.copy(camPos);
      cam.lookAt(head);
      // pose avatar
      this.avatar.position.set(this.pos.x, this.posY, this.pos.z);
      this.avatar.rotation.y = this.yaw;
      const legSwing = Math.sin(this.bobPhase) * (this.moving ? 0.5 : 0);
      (this.avatar.userData.legL as THREE.Object3D).rotation.x = legSwing;
      (this.avatar.userData.legR as THREE.Object3D).rotation.x = -legSwing;
      (this.avatar.userData.armL as THREE.Object3D).rotation.x = -legSwing;
      (this.avatar.userData.armR as THREE.Object3D).rotation.x = legSwing;
      const crouchScale = this.crouching ? 0.7 : 1;
      this.avatar.scale.y = crouchScale;
    }
  }

  private makeStickman(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x111108, roughness: 0.9, emissive: 0x0a0a06 });
    const limb = (h: number, r = 0.045) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat);

    const torso = limb(0.6, 0.06); torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat); head.position.y = 1.6; g.add(head);

    const legL = limb(0.7); legL.position.set(-0.1, 0.45, 0); legL.geometry.translate(0, -0.35, 0); legL.position.y = 0.8;
    const legR = limb(0.7); legR.position.set(0.1, 0.45, 0); legR.geometry.translate(0, -0.35, 0); legR.position.y = 0.8;
    const armL = limb(0.55, 0.04); armL.geometry.translate(0, -0.27, 0); armL.position.set(-0.16, 1.42, 0);
    const armR = limb(0.55, 0.04); armR.geometry.translate(0, -0.27, 0); armR.position.set(0.16, 1.42, 0);
    g.add(legL, legR, armL, armR);

    g.userData = { legL, legR, armL, armR };
    g.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    return g;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.avatar);
    this.avatar.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
  }
}
