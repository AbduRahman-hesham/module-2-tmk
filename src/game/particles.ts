import * as THREE from 'three';

interface SparkleParticle {
  mesh: THREE.Mesh;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface DustRing {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
}

interface ConfettiPiece {
  mesh: THREE.Mesh;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotSpeedX: number;
  rotSpeedY: number;
  wobbleSpeed: number;
  wobblePhase: number;
}

export class ParticleManager {
  public group: THREE.Group;

  // Max 60 pooled sparkle particles as required
  private sparkles: SparkleParticle[] = [];
  private static MAX_SPARKLES = 60;

  // Dust ring pool (4 rings)
  private dustRings: DustRing[] = [];

  // Ending confetti pieces (40 pieces)
  private confetti: ConfettiPiece[] = [];
  private confettiActive: boolean = false;

  constructor() {
    this.group = new THREE.Group();

    this.initSparklePool();
    this.initDustRingPool();
    this.initConfettiPool();
  }

  private initSparklePool() {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const colors = [0xfacc15, 0xffffff, 0x38bdf8, 0xf472b6, 0x4ade80, 0xfbbf24];

    for (let i = 0; i < ParticleManager.MAX_SPARKLES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.sparkles.push({
        mesh,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.6,
        baseScale: 1,
      });
    }
  }

  private initDustRingPool() {
    const ringGeo = new THREE.RingGeometry(0.3, 0.48, 16);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.dustRings.push({
        mesh,
        material: mat,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        life: 0,
        maxLife: 0.5,
      });
    }
  }

  private initConfettiPool() {
    const confGeo = new THREE.BoxGeometry(0.18, 0.12, 0.02);
    const colors = [0xf43f5e, 0x06b6d4, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0xfacc15];

    // 40 confetti pieces as required
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(confGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.confetti.push({
        mesh,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotSpeedX: 0,
        rotSpeedY: 0,
        wobbleSpeed: 0,
        wobblePhase: 0,
      });
    }
  }

  /**
   * Spawn expanding dust ring on ground
   */
  public spawnDustRing(x: number, y: number, z: number) {
    const ring = this.dustRings.find((r) => !r.active);
    if (!ring) return;

    ring.active = true;
    ring.x = x;
    ring.y = y + 0.05;
    ring.z = z;
    ring.life = 0;
    ring.maxLife = 0.45;
    ring.mesh.position.set(ring.x, ring.y, ring.z);
    ring.mesh.scale.set(0.4, 0.4, 0.4);
    ring.material.opacity = 0.75;
    ring.mesh.visible = true;
  }

  /**
   * Spawn sparkles (e.g. 8 for building pop-in, 20 for firework burst)
   */
  public spawnSparkles(x: number, y: number, z: number, count: number = 8, burstSpeed: number = 2.5) {
    let spawned = 0;
    for (let i = 0; i < this.sparkles.length && spawned < count; i++) {
      const p = this.sparkles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;

        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.2) * Math.PI;
        const speed = (0.5 + Math.random() * 0.8) * burstSpeed;

        p.vx = Math.cos(theta) * Math.cos(phi) * speed;
        p.vy = Math.sin(phi) * speed + 1.2;
        p.vz = Math.sin(theta) * Math.cos(phi) * speed;

        p.life = 0;
        p.maxLife = 0.45 + Math.random() * 0.25;
        p.baseScale = 0.7 + Math.random() * 0.6;

        p.mesh.position.set(x, y, z);
        p.mesh.scale.set(p.baseScale, p.baseScale, p.baseScale);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        p.mesh.visible = true;

        spawned++;
      }
    }
  }

  /**
   * 3 firework bursts (20 sparkles each, staggered in time)
   */
  public triggerFireworks() {
    const burstPositions = [
      { x: -3.5, y: 7.5, z: -2.0, delay: 0 },
      { x: 3.2, y: 8.8, z: 1.5, delay: 350 },
      { x: 0.0, y: 9.5, z: -4.0, delay: 750 },
    ];

    burstPositions.forEach(({ x, y, z, delay }) => {
      setTimeout(() => {
        this.spawnSparkles(x, y, z, 20, 3.8);
      }, delay);
    });
  }

  /**
   * Confetti fires once for ending (40 small flat boxes)
   */
  public fireConfetti() {
    this.confettiActive = true;

    this.confetti.forEach((c) => {
      c.active = true;
      // Spread across sky above the island
      c.x = (Math.random() - 0.5) * 16;
      c.y = 10 + Math.random() * 6;
      c.z = (Math.random() - 0.5) * 16;

      c.vx = (Math.random() - 0.5) * 0.8;
      c.vy = -(1.2 + Math.random() * 1.5); // Fall speed
      c.vz = (Math.random() - 0.5) * 0.8;

      c.rotSpeedX = (Math.random() - 0.5) * 8;
      c.rotSpeedY = (Math.random() - 0.5) * 8;
      c.wobbleSpeed = 2 + Math.random() * 3;
      c.wobblePhase = Math.random() * Math.PI * 2;

      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.visible = true;
    });
  }

  public update(dt: number) {
    // 1. Update Sparkles
    for (let i = 0; i < this.sparkles.length; i++) {
      const p = this.sparkles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          const t = p.life / p.maxLife;

          // Physics with gravity
          p.vy -= 7.5 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;

          p.mesh.position.set(p.x, p.y, p.z);

          // Scale & fade out
          const s = (1 - t) * p.baseScale;
          p.mesh.scale.set(s, s, s);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * t;
        }
      }
    }

    // 2. Update Dust Rings
    for (let i = 0; i < this.dustRings.length; i++) {
      const r = this.dustRings[i];
      if (r.active) {
        r.life += dt;
        if (r.life >= r.maxLife) {
          r.active = false;
          r.mesh.visible = false;
        } else {
          const t = r.life / r.maxLife;
          const s = THREE.MathUtils.lerp(0.4, 2.2, t);
          r.mesh.scale.set(s, s, s);
          r.material.opacity = (1 - t) * 0.75;
        }
      }
    }

    // 3. Update Confetti
    if (this.confettiActive) {
      let anyActive = false;
      for (let i = 0; i < this.confetti.length; i++) {
        const c = this.confetti[i];
        if (c.active) {
          anyActive = true;
          c.y += c.vy * dt;
          c.x += (c.vx + Math.sin(c.wobblePhase) * 0.8) * dt;
          c.z += (c.vz + Math.cos(c.wobblePhase) * 0.8) * dt;
          c.wobblePhase += c.wobbleSpeed * dt;

          c.mesh.rotation.x += c.rotSpeedX * dt;
          c.mesh.rotation.y += c.rotSpeedY * dt;

          c.mesh.position.set(c.x, c.y, c.z);

          // When hit ground/water level, stop falling
          if (c.y <= -0.2) {
            c.active = false;
          }
        }
      }
      if (!anyActive) {
        this.confettiActive = false;
      }
    }
  }

  public reset() {
    this.sparkles.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });
    this.dustRings.forEach((r) => {
      r.active = false;
      r.mesh.visible = false;
    });
    this.confetti.forEach((c) => {
      c.active = false;
      c.mesh.visible = false;
    });
    this.confettiActive = false;
  }
}
