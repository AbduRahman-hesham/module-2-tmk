import * as THREE from 'three';
import { DISTRICTS } from './types.ts';

export class GameCamera {
  public camera: THREE.PerspectiveCamera;
  public isMenuMode: boolean = true;
  private menuOrbitAngle: number = 0;

  // Zoom factor (zooms out ~6% with each solved level)
  private zoomFactor: number = 1.0;

  // Transition state
  private isTransitioning: boolean = false;
  private transitionTime: number = 0;
  private transitionDuration: number = 1.2;
  private startPos: THREE.Vector3 = new THREE.Vector3();
  private targetPos: THREE.Vector3 = new THREE.Vector3();
  private startLookAt: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Active district
  private currentDistrictIndex: number = 0;

  // Camera screen shake on wrong choice
  private isShaking: boolean = false;
  private shakeTime: number = 0;
  private shakeDuration: number = 0.35;
  private shakeIntensity: number = 0.25;

  // Ending wide overview
  private isEndingView: boolean = false;
  private totalTime: number = 0;

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    this.setMenuPose();
  }

  public setMenuPose() {
    this.isMenuMode = true;
    this.isEndingView = false;
    this.isTransitioning = false;
    this.isShaking = false;
  }

  public addZoomOut(percent: number = 0.06) {
    this.zoomFactor *= 1 + percent;
  }

  public resetZoom() {
    this.zoomFactor = 1.0;
    this.isEndingView = false;
  }

  /**
   * Short camera shake on a wrong choice
   */
  public triggerShake(duration: number = 0.35, intensity: number = 0.22) {
    this.isShaking = true;
    this.shakeTime = 0;
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  /**
   * Pull back camera to show the whole island for the ending
   */
  public pullBackForEnding() {
    this.isEndingView = true;
    this.isMenuMode = false;

    const aspect = this.camera.aspect;
    const portraitMul = aspect < 1.0 ? Math.max(1.0, 1.45 / aspect) : 1.0;

    this.startPos.copy(this.camera.position);
    this.targetPos.set(0, 20 * portraitMul, 24 * portraitMul);

    this.startLookAt.copy(this.currentLookAt);
    this.targetLookAt.set(0, 1.0, 0);

    this.isTransitioning = true;
    this.transitionTime = 0;
    this.transitionDuration = 1.8;
  }

  public flyToDistrict(districtId: number, instant: boolean = false) {
    this.isMenuMode = false;
    this.isEndingView = false;
    const d = DISTRICTS.find((item) => item.id === districtId) || DISTRICTS[0];
    this.currentDistrictIndex = DISTRICTS.indexOf(d);

    const aspect = this.camera.aspect;
    const portraitMul = aspect < 1.0 ? Math.max(1.0, 1.3 / aspect) : 1.0;
    const totalZoom = this.zoomFactor * portraitMul;

    const dx = d.position[0];
    const dz = d.position[2];

    const camX = (dx * 0.65) + 12 * totalZoom;
    const camY = (11 + totalZoom * 3.5);
    const camZ = (dz * 0.65) + 14 * totalZoom;

    const lookX = d.position[0] * 0.7;
    const lookY = 0.8;
    const lookZ = d.position[2] * 0.7;

    if (instant) {
      this.camera.position.set(camX, camY, camZ);
      this.currentLookAt.set(lookX, lookY, lookZ);
      this.camera.lookAt(this.currentLookAt);
      this.isTransitioning = false;
    } else {
      this.startPos.copy(this.camera.position);
      this.targetPos.set(camX, camY, camZ);

      this.startLookAt.copy(this.currentLookAt);
      this.targetLookAt.set(lookX, lookY, lookZ);

      this.isTransitioning = true;
      this.transitionTime = 0;
      this.transitionDuration = 1.2;
    }
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (!this.isMenuMode && !this.isTransitioning) {
      if (this.isEndingView) {
        this.pullBackForEnding();
      } else {
        const currentDistrict = DISTRICTS[this.currentDistrictIndex] || DISTRICTS[0];
        this.flyToDistrict(currentDistrict.id, true);
      }
    }
  }

  public get isMoving(): boolean {
    return this.isTransitioning;
  }

  public update(dt: number) {
    this.totalTime += dt;

    if (this.isMenuMode) {
      this.menuOrbitAngle += dt * 0.22;
      const aspect = this.camera.aspect;
      const portraitMul = aspect < 1.0 ? Math.max(1.0, 1.35 / aspect) : 1.0;

      const radius = 22 * portraitMul;
      const camY = 15 * portraitMul;
      const x = Math.sin(this.menuOrbitAngle) * radius;
      const z = Math.cos(this.menuOrbitAngle) * radius;

      this.camera.position.set(x, camY, z);
      this.currentLookAt.set(0, 1.2, 0);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    if (this.isTransitioning) {
      this.transitionTime += dt;
      let t = this.transitionTime / this.transitionDuration;
      if (t >= 1.0) {
        t = 1.0;
        this.isTransitioning = false;
      }

      // Smooth ease-in-out
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.camera.position.lerpVectors(this.startPos, this.targetPos, ease);
      this.currentLookAt.lerpVectors(this.startLookAt, this.targetLookAt, ease);
      this.camera.lookAt(this.currentLookAt);
    } else {
      // Slight organic camera float
      const floatX = Math.sin(this.totalTime * 0.7) * 0.08;
      const floatY = Math.cos(this.totalTime * 0.9) * 0.06;

      this.camera.position.x = this.targetPos.x + floatX;
      this.camera.position.y = this.targetPos.y + floatY;
      this.camera.lookAt(this.currentLookAt);
    }

    // Camera shake on wrong choice
    if (this.isShaking) {
      this.shakeTime += dt;
      const st = this.shakeTime / this.shakeDuration;
      if (st >= 1.0) {
        this.isShaking = false;
      } else {
        const decay = 1 - st;
        const offset = Math.sin(this.shakeTime * 45) * this.shakeIntensity * decay;
        this.camera.position.x += offset;
      }
    }
  }
}
