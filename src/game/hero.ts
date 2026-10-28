import * as THREE from 'three';
import { HeroGender } from './types.ts';
import { audio } from './audio.ts';

export class Hero {
  public group: THREE.Group;
  public heroMesh: THREE.Mesh | THREE.Group;
  public shadowMesh: THREE.Mesh;
  private currentGender: HeroGender = 'boy';

  // Position & movement
  public currentPos: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0);
  private startHopPos: THREE.Vector3 = new THREE.Vector3();
  private targetHopPos: THREE.Vector3 = new THREE.Vector3();
  private isHopping: boolean = false;
  private hopProgress: number = 0;
  private hopDuration: number = 1.2;
  private idleTime: number = 0;

  // Squash on landing
  private squashTime: number = 0;
  private isSquashing: boolean = false;

  // Reaction animations
  // happy = jump + spin
  private isHappy: boolean = false;
  private happyTime: number = 0;
  private happyDuration: number = 1.1;

  // wrong = quick shake + dip
  private isWrong: boolean = false;
  private wrongTime: number = 0;
  private wrongDuration: number = 0.6;

  // Ending spin jump
  private isSpinJumping: boolean = false;
  private spinJumpTime: number = 0;

  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

  constructor(parent: THREE.Group) {
    this.group = new THREE.Group();
    parent.add(this.group);

    // Round blob shadow on ground
    const shadowGeo = new THREE.CircleGeometry(0.55, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1f3c26,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.set(0, 0.34, 0);
    this.group.add(this.shadowMesh);

    // Initial dummy mesh while loading
    this.heroMesh = this.createFallbackCapsule('boy');
    this.heroMesh.position.set(0, 1.25, 0);
    this.group.add(this.heroMesh);
  }

  public setHero(gender: HeroGender) {
    this.currentGender = gender;
    const imgPath = `/characters/${gender}.png`;

    this.textureLoader.load(
      imgPath,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;

        this.group.remove(this.heroMesh);

        // Flat plane with chosen PNG, height ~ 1.8
        const planeGeo = new THREE.PlaneGeometry(1.8, 1.8);
        const planeMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.set(0, 1.25, 0);
        this.heroMesh = plane;
        this.group.add(this.heroMesh);
      },
      undefined,
      (err) => {
        console.warn(`Could not load character image ${imgPath}, using colored capsule fallback`, err);
        this.group.remove(this.heroMesh);
        this.heroMesh = this.createFallbackCapsule(gender);
        this.heroMesh.position.set(0, 1.25, 0);
        this.group.add(this.heroMesh);
      }
    );
  }

  private createFallbackCapsule(gender: HeroGender): THREE.Group {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.9, 12, 16);
    const bodyMat = new THREE.MeshLambertMaterial({
      color: gender === 'boy' ? 0x2563eb : 0xec4899,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const capGeo = new THREE.SphereGeometry(0.38, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.45;
    group.add(cap);

    const visorGeo = new THREE.BoxGeometry(0.4, 0.08, 0.3);
    const visorMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.45, 0.35);
    group.add(visor);

    const glassGeo = new THREE.TorusGeometry(0.12, 0.025, 8, 16);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    [-0.15, 0.15].forEach((x) => {
      const g = new THREE.Mesh(glassGeo, glassMat);
      g.position.set(x, 0.28, 0.35);
      group.add(g);
    });

    return group;
  }

  public teleport(pos: [number, number, number]) {
    this.currentPos.set(pos[0], pos[1], pos[2]);
    this.isHopping = false;
    this.isHappy = false;
    this.isWrong = false;
    this.isSquashing = false;
    this.isSpinJumping = false;
    this.shadowMesh.position.set(pos[0], pos[1] + 0.24, pos[2]);
    this.heroMesh.position.set(pos[0], pos[1] + 1.15, pos[2]);
    this.heroMesh.scale.set(1, 1, 1);
  }

  public hopTo(targetSpot: [number, number, number]) {
    this.startHopPos.copy(this.currentPos);
    this.targetHopPos.set(targetSpot[0], targetSpot[1], targetSpot[2]);
    this.isHopping = true;
    this.hopProgress = 0;
    this.hopDuration = 1.2;
    this.isHappy = false;
    this.isWrong = false;

    audio.playHop();
  }

  /**
   * happy = jump + spin
   */
  public playHappy() {
    this.isHappy = true;
    this.happyTime = 0;
    this.isWrong = false;
  }

  /**
   * wrong = quick shake + dip
   */
  public playWrong() {
    this.isWrong = true;
    this.wrongTime = 0;
    this.isHappy = false;
  }

  /**
   * Ending spin-jump
   */
  public playSpinJump() {
    this.isSpinJumping = true;
    this.spinJumpTime = 0;
  }

  public update(dt: number, camera: THREE.Camera) {
    this.idleTime += dt;

    if (this.isHopping) {
      this.hopProgress += dt / this.hopDuration;
      if (this.hopProgress >= 1.0) {
        this.hopProgress = 1.0;
        this.isHopping = false;
        this.currentPos.copy(this.targetHopPos);

        // Trigger squash on landing
        this.isSquashing = true;
        this.squashTime = 0;
      }

      const t = this.hopProgress;
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const currentX = THREE.MathUtils.lerp(this.startHopPos.x, this.targetHopPos.x, easeT);
      const currentZ = THREE.MathUtils.lerp(this.startHopPos.z, this.targetHopPos.z, easeT);
      const baseY = THREE.MathUtils.lerp(this.startHopPos.y, this.targetHopPos.y, easeT);

      // Arc jump
      const arcHeight = Math.sin(t * Math.PI) * 1.6;
      const currentY = baseY + arcHeight;

      this.currentPos.set(currentX, baseY, currentZ);
      this.heroMesh.position.set(currentX, currentY + 1.15, currentZ);

      // Jump stretch
      const jumpStretch = Math.sin(t * Math.PI) * 0.25;
      this.heroMesh.scale.set(1 - jumpStretch * 0.4, 1 + jumpStretch, 1);

      this.shadowMesh.position.set(currentX, baseY + 0.24, currentZ);
      const shadowScale = Math.max(0.35, 1 - arcHeight * 0.35);
      this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);

      this.heroMesh.quaternion.copy(camera.quaternion);
      return;
    }

    // Squash on landing spring recovery
    if (this.isSquashing) {
      this.squashTime += dt;
      const st = this.squashTime / 0.26;
      if (st >= 1.0) {
        this.isSquashing = false;
        this.heroMesh.scale.set(1, 1, 1);
      } else {
        // Squash down (0.75 height, 1.3 width) then spring back
        const squashFactor = Math.sin(st * Math.PI);
        const sy = 1 - squashFactor * 0.28;
        const sx = 1 + squashFactor * 0.28;
        this.heroMesh.scale.set(sx, sy, 1);
        this.heroMesh.position.set(this.currentPos.x, this.currentPos.y + 1.15 * sy, this.currentPos.z);
        this.heroMesh.quaternion.copy(camera.quaternion);
        return;
      }
    }

    // Happy reaction (jump + spin)
    if (this.isHappy) {
      this.happyTime += dt;
      const ht = this.happyTime / this.happyDuration;
      if (ht >= 1.0) {
        this.isHappy = false;
        this.heroMesh.scale.set(1, 1, 1);
      } else {
        const jumpY = Math.sin(ht * Math.PI) * 1.35;
        this.heroMesh.position.set(this.currentPos.x, this.currentPos.y + 1.15 + jumpY, this.currentPos.z);

        // Spin 360 degrees
        this.heroMesh.quaternion.copy(camera.quaternion);
        this.heroMesh.rotateY(ht * Math.PI * 2);

        const stretch = Math.sin(ht * Math.PI) * 0.2;
        this.heroMesh.scale.set(1 - stretch * 0.3, 1 + stretch, 1);

        this.shadowMesh.position.set(this.currentPos.x, this.currentPos.y + 0.24, this.currentPos.z);
        const shadowScale = Math.max(0.4, 1 - jumpY * 0.4);
        this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
        return;
      }
    }

    // Wrong reaction (quick shake + dip)
    if (this.isWrong) {
      this.wrongTime += dt;
      const wt = this.wrongTime / this.wrongDuration;
      if (wt >= 1.0) {
        this.isWrong = false;
        this.heroMesh.position.set(this.currentPos.x, this.currentPos.y + 1.15, this.currentPos.z);
      } else {
        const shakeX = Math.sin(wt * Math.PI * 8) * (1 - wt) * 0.15;
        const dipY = -Math.sin(wt * Math.PI) * 0.22;

        this.heroMesh.position.set(this.currentPos.x + shakeX, this.currentPos.y + 1.15 + dipY, this.currentPos.z);
        this.heroMesh.scale.set(1.08, 0.92, 1);
        this.heroMesh.quaternion.copy(camera.quaternion);
        return;
      }
    }

    // Ending continuous spin jump
    if (this.isSpinJumping) {
      this.spinJumpTime += dt;
      const jumpCycle = (this.spinJumpTime * 2.2) % 1.0;
      const jumpY = Math.sin(jumpCycle * Math.PI) * 1.5;

      this.heroMesh.position.set(this.currentPos.x, this.currentPos.y + 1.15 + jumpY, this.currentPos.z);
      this.heroMesh.quaternion.copy(camera.quaternion);
      this.heroMesh.rotateY(this.spinJumpTime * Math.PI * 3);

      this.shadowMesh.position.set(this.currentPos.x, this.currentPos.y + 0.24, this.currentPos.z);
      const shadowScale = Math.max(0.35, 1 - jumpY * 0.4);
      this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
      return;
    }

    // Default Idle bob + gentle breathing
    const idleBob = Math.sin(this.idleTime * 3.5) * 0.05;
    const breathe = 1 + Math.sin(this.idleTime * 2.5) * 0.03;

    this.heroMesh.position.set(
      this.currentPos.x,
      this.currentPos.y + 1.15 + idleBob,
      this.currentPos.z
    );
    this.heroMesh.scale.set(1 / breathe, breathe, 1);

    this.shadowMesh.position.set(
      this.currentPos.x,
      this.currentPos.y + 0.24,
      this.currentPos.z
    );
    this.shadowMesh.scale.set(1, 1, 1);

    // Face camera
    this.heroMesh.quaternion.copy(camera.quaternion);
  }
}
