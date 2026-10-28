import * as THREE from 'three';
import { DISTRICTS, DistrictInfo } from './types.ts';
import { ParticleManager } from './particles.ts';
import { audio } from './audio.ts';

interface SpringProp {
  mesh: THREE.Object3D;
  worldPos: THREE.Vector3;
  targetScale: number;
  delay: number;
  elapsed: number;
  popped: boolean;
  done: boolean;
}

interface DistrictVisual {
  padGroup: THREE.Group;
  solutionGroup: THREE.Group;
  citizens: THREE.Group[];
  springProps: SpringProp[];
  solved: boolean;
  animData?: Record<string, unknown>;
}

export class GameWorld {
  public scene: THREE.Scene;
  public islandGroup: THREE.Group;
  public waterMesh: THREE.Mesh;
  public activeMarker: THREE.Group;
  public particles: ParticleManager;

  // Sky & lighting
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private fog: THREE.Fog;
  private currentSkyColor: THREE.Color;
  private targetSkyColor: THREE.Color;
  private currentLightIntensity: number;
  private targetLightIntensity: number;
  private clouds: THREE.Mesh[] = [];

  // 9 District Visuals
  private districtsVisuals: Map<number, DistrictVisual> = new Map();

  // Shared reusable geometries
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private sphereGeo = new THREE.SphereGeometry(1, 12, 12);
  private cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
  private coneGeo = new THREE.ConeGeometry(1, 1, 16);
  private capsuleGeo = new THREE.CapsuleGeometry(0.18, 0.45, 8, 12);

  constructor() {
    this.scene = new THREE.Scene();

    // Overcast grey-blue start
    this.currentSkyColor = new THREE.Color(0x8ea4b3);
    this.targetSkyColor = new THREE.Color(0x8ea4b3);
    this.scene.background = this.currentSkyColor;

    this.fog = new THREE.Fog(this.currentSkyColor, 25, 80);
    this.scene.fog = this.fog;

    // Lights
    this.hemiLight = new THREE.HemisphereLight(0xd4e2ea, 0x5a7560, 0.65);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff0d0, 0.7);
    this.dirLight.position.set(16, 26, 14);
    this.scene.add(this.dirLight);

    this.currentLightIntensity = 0.7;
    this.targetLightIntensity = 0.7;

    // Island root group
    this.islandGroup = new THREE.Group();
    this.scene.add(this.islandGroup);

    // Particle manager
    this.particles = new ParticleManager();
    this.islandGroup.add(this.particles.group);

    // Build base island + water
    this.waterMesh = this.buildWater();
    this.buildIsland();
    this.buildTownSquare();
    this.buildClouds();

    // Build 9 district pads + buildings
    this.buildAllDistricts();

    // Active marker
    this.activeMarker = this.buildActiveMarker();
    this.islandGroup.add(this.activeMarker);
    this.setActiveDistrict(1);
  }

  private buildWater(): THREE.Mesh {
    const waterGeo = new THREE.CylinderGeometry(44, 44, 0.4, 48);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x38bdf8,
      flatShading: true,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -2.1;
    this.scene.add(water);

    const rippleGeo = new THREE.RingGeometry(11.1, 12.2, 40);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const ripple = new THREE.Mesh(rippleGeo, rippleMat);
    ripple.position.y = -1.88;
    this.islandGroup.add(ripple);

    return water;
  }

  private buildIsland() {
    // Dirt base
    const dirtGeo = new THREE.CylinderGeometry(11.0, 9.4, 3.8, 32);
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8d5b35, flatShading: true });
    const dirt = new THREE.Mesh(dirtGeo, dirtMat);
    dirt.position.y = -1.9;
    this.islandGroup.add(dirt);

    // Grass top
    const grassGeo = new THREE.CylinderGeometry(11.2, 11.1, 0.6, 32);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x5ecb45, flatShading: true });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = 0;
    this.islandGroup.add(grass);

    // Sandy rim
    const rimGeo = new THREE.TorusGeometry(11.1, 0.22, 12, 36);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xfde047 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.28;
    this.islandGroup.add(rim);
  }

  private buildTownSquare() {
    const plazaGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.08, 24);
    const plazaMat = new THREE.MeshLambertMaterial({ color: 0xf5eeea });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0.32, 0);
    this.islandGroup.add(plaza);

    const borderGeo = new THREE.RingGeometry(2.4, 2.65, 24);
    borderGeo.rotateX(-Math.PI / 2);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.set(0, 0.365, 0);
    this.islandGroup.add(border);

    // Center fountain
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 0.35, 18),
      new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    );
    basin.position.set(0, 0.5, 0);
    this.islandGroup.add(basin);

    const fWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 0.32, 16),
      new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
    );
    fWater.position.set(0, 0.54, 0);
    this.islandGroup.add(fWater);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0x06d6a0 })
    );
    globe.position.set(0, 0.85, 0);
    this.islandGroup.add(globe);
  }

  private buildClouds() {
    const cloudGeo = new THREE.SphereGeometry(2.0, 8, 8);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.85,
    });

    const positions = [
      [-16, 12, -18],
      [15, 14, -14],
      [-14, 13, 15],
      [18, 11, 16],
      [0, 15, -20],
    ];

    positions.forEach(([x, y, z]) => {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(x, y, z);
      cloud.scale.set(1.4, 0.6, 1.0);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    });
  }

  private buildActiveMarker(): THREE.Group {
    const marker = new THREE.Group();
    const arrowGeo = new THREE.ConeGeometry(0.35, 0.65, 4);
    arrowGeo.rotateX(Math.PI);
    const arrowMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    marker.add(arrow);

    const ringGeo = new THREE.RingGeometry(0.3, 0.48, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.45;
    marker.add(ring);

    return marker;
  }

  private buildAllDistricts() {
    DISTRICTS.forEach((d) => {
      const padGroup = new THREE.Group();
      padGroup.position.set(d.position[0], 0.32, d.position[2]);

      // District pad
      const padGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.1, 24);
      const padMat = new THREE.MeshLambertMaterial({ color: d.color, flatShading: true });
      const pad = new THREE.Mesh(padGeo, padMat);
      padGroup.add(pad);

      const ringGeo = new THREE.RingGeometry(1.4, 1.58, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.055;
      padGroup.add(ring);

      const solutionGroup = new THREE.Group();
      solutionGroup.visible = false;
      padGroup.add(solutionGroup);

      const springProps: SpringProp[] = [];
      let animData: Record<string, unknown> | undefined;

      // Construct the piece for this level
      if (d.id === 1) {
        animData = this.buildMarketPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 2) {
        animData = this.buildWorkPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 3) {
        animData = this.buildHousingPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 4) {
        animData = this.buildTownPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 5) {
        animData = this.buildHarborPiece(solutionGroup, padGroup, springProps, d.position);
      } else if (d.id === 6) {
        // 🏦 Bank: box + 4 columns + cone roof
        animData = this.buildBankPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 7) {
        // 🏢 Skyscraper: 3 stacked boxes
        animData = this.buildSkyscraperPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 8) {
        // 🌳 Park: green disc + fountain
        animData = this.buildParkPiece(solutionGroup, springProps, d.position);
      } else if (d.id === 9) {
        // 🕰️ Clock tower: box + cone + clock circle
        animData = this.buildClockTowerPiece(solutionGroup, springProps, d.position);
      }

      // 2 simple citizens per district (idle only, no speech bubbles)
      const citizens = this.buildIdleCitizens(padGroup);

      this.islandGroup.add(padGroup);

      this.districtsVisuals.set(d.id, {
        padGroup,
        solutionGroup,
        citizens,
        springProps,
        solved: false,
        animData,
      });
    });
  }

  // 1. Market: Bakery + wheat field
  private buildMarketPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const piece = new THREE.Group();

    // Bakery
    const b = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0xfbbf24 }));
    b.scale.set(0.9, 0.7, 0.8);
    b.position.set(-0.35, 0.35, 0);
    piece.add(b);

    const roof = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: 0xd97706 }));
    roof.scale.set(0.7, 0.5, 0.7);
    roof.position.set(-0.35, 0.95, 0);
    roof.rotateY(Math.PI / 4);
    piece.add(roof);

    const chim = new THREE.Mesh(this.cylinderGeo, new THREE.MeshLambertMaterial({ color: 0x78716c }));
    chim.scale.set(0.12, 0.45, 0.12);
    chim.position.set(-0.15, 1.05, 0.2);
    piece.add(chim);

    // Wheat patch
    const wheatMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    for (let i = 0; i < 6; i++) {
      const wheat = new THREE.Mesh(this.boxGeo, wheatMat);
      wheat.scale.set(0.14, 0.38, 0.14);
      wheat.position.set(0.35 + (i % 2) * 0.22, 0.19, -0.3 + Math.floor(i / 2) * 0.25);
      piece.add(wheat);
    }

    piece.scale.set(0, 0, 0);
    group.add(piece);

    springs.push({
      mesh: piece,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 2. Work: Factory with smokestack + glowing windows
  private buildWorkPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const factory = new THREE.Group();

    const body = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x0284c7 }));
    body.scale.set(1.2, 0.8, 0.9);
    body.position.y = 0.4;
    factory.add(body);

    const stack = new THREE.Mesh(this.cylinderGeo, new THREE.MeshLambertMaterial({ color: 0x0369a1 }));
    stack.scale.set(0.16, 0.85, 0.16);
    stack.position.set(0.35, 1.05, -0.2);
    factory.add(stack);

    const winMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    [-0.3, 0.3].forEach((x) => {
      const win = new THREE.Mesh(this.boxGeo, winMat);
      win.scale.set(0.24, 0.24, 0.05);
      win.position.set(x, 0.48, 0.46);
      factory.add(win);
    });

    factory.scale.set(0, 0, 0);
    group.add(factory);

    springs.push({
      mesh: factory,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 3. Housing: 3 colorful cottages
  private buildHousingPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const colors = [0xf472b6, 0x38bdf8, 0xfbbf24];
    const roofs = [0xdb2777, 0x0284c7, 0xd97706];

    [-0.45, 0.0, 0.45].forEach((x, i) => {
      const house = new THREE.Group();
      house.position.set(x, 0, (i % 2 === 0 ? -0.15 : 0.25));

      const b = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: colors[i] }));
      b.scale.set(0.36, 0.42, 0.36);
      b.position.y = 0.21;
      house.add(b);

      const r = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: roofs[i] }));
      r.scale.set(0.32, 0.28, 0.32);
      r.position.y = 0.54;
      r.rotateY(Math.PI / 4);
      house.add(r);

      house.scale.set(0, 0, 0);
      group.add(house);

      springs.push({
        mesh: house,
        worldPos: new THREE.Vector3(pos[0] + x, 0.35, pos[2]),
        targetScale: 1,
        delay: i * 0.12,
        elapsed: 0,
        popped: false,
        done: false,
      });
    });

    return {};
  }

  // 4. Town: School with flag + smooth road
  private buildTownPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const school = new THREE.Group();

    const road = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x475569 }));
    road.scale.set(1.4, 0.04, 0.6);
    road.position.set(0, 0.04, -0.4);
    school.add(road);

    const b = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x818cf8 }));
    b.scale.set(0.85, 0.65, 0.6);
    b.position.set(0, 0.35, 0.25);
    school.add(b);

    const r = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: 0x4f46e5 }));
    r.scale.set(0.6, 0.35, 0.6);
    r.position.set(0, 0.82, 0.25);
    r.rotateY(Math.PI / 4);
    school.add(r);

    const pole = new THREE.Mesh(this.cylinderGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pole.scale.set(0.03, 0.45, 0.03);
    pole.position.set(0.35, 0.78, 0.25);
    school.add(pole);

    const flag = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0xef4444 }));
    flag.scale.set(0.16, 0.1, 0.02);
    flag.position.set(0.43, 0.95, 0.25);
    school.add(flag);

    school.scale.set(0, 0, 0);
    group.add(school);

    springs.push({
      mesh: school,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 5. Harbor: Dock + trade ship + fruit crates
  private buildHarborPiece(group: THREE.Group, padGroup: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const plankMat = new THREE.MeshLambertMaterial({ color: 0xa16207 });
    const plank = new THREE.Mesh(this.boxGeo, plankMat);
    plank.scale.set(1.2, 0.14, 2.2);
    plank.position.set(0.3, -0.05, -0.7);
    padGroup.add(plank);

    const harborSet = new THREE.Group();

    // Ship
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x0284c7 }));
    hull.scale.set(1.0, 0.45, 1.6);
    ship.add(hull);

    const bow = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: 0x0369a1 }));
    bow.scale.set(0.5, 0.45, 0.7);
    bow.position.set(0, 0, 1.0);
    bow.rotateX(Math.PI / 2);
    ship.add(bow);

    const mast = new THREE.Mesh(this.cylinderGeo, new THREE.MeshLambertMaterial({ color: 0x78350f }));
    mast.scale.set(0.04, 1.1, 0.04);
    mast.position.set(0, 0.6, 0);
    ship.add(mast);

    const sail = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    sail.scale.set(0.45, 0.8, 0.04);
    sail.position.set(0.18, 0.7, 0);
    sail.rotateZ(-Math.PI / 2);
    ship.add(sail);

    ship.position.set(1.2, -1.8, -3.2);
    harborSet.add(ship);

    // Crates
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    [-0.2, 0.1].forEach((x, i) => {
      const crate = new THREE.Mesh(this.boxGeo, crateMat);
      crate.scale.set(0.24, 0.24, 0.24);
      crate.position.set(x, 0.12, -0.5 + i * 0.25);
      harborSet.add(crate);
    });

    harborSet.scale.set(0, 0, 0);
    group.add(harborSet);

    springs.push({
      mesh: harborSet,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 6. 🏦 Bank (box + 4 columns + cone roof)
  private buildBankPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const bank = new THREE.Group();

    // Box building
    const b = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
    b.scale.set(1.1, 0.7, 0.8);
    b.position.set(0, 0.35, -0.05);
    bank.add(b);

    // 4 Columns in front
    const colMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    [-0.38, -0.13, 0.13, 0.38].forEach((cx) => {
      const col = new THREE.Mesh(this.cylinderGeo, colMat);
      col.scale.set(0.06, 0.65, 0.06);
      col.position.set(cx, 0.35, 0.38);
      bank.add(col);
    });

    // Cone / pediment roof
    const roof = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: 0xca8a04 }));
    roof.scale.set(0.8, 0.45, 0.8);
    roof.position.set(0, 0.9, -0.05);
    roof.rotateY(Math.PI / 4);
    bank.add(roof);

    bank.scale.set(0, 0, 0);
    group.add(bank);

    springs.push({
      mesh: bank,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 7. 🏢 Skyscraper (3 stacked boxes)
  private buildSkyscraperPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const tower = new THREE.Group();

    // Tier 1 (bottom)
    const t1 = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x0284c7 }));
    t1.scale.set(0.9, 0.7, 0.9);
    t1.position.y = 0.35;
    tower.add(t1);

    // Tier 2 (middle)
    const t2 = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x38bdf8 }));
    t2.scale.set(0.7, 0.7, 0.7);
    t2.position.y = 1.05;
    tower.add(t2);

    // Tier 3 (top)
    const t3 = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0x7dd3fc }));
    t3.scale.set(0.5, 0.6, 0.5);
    t3.position.y = 1.7;
    tower.add(t3);

    // Antenna
    const ant = new THREE.Mesh(this.cylinderGeo, new THREE.MeshLambertMaterial({ color: 0xef4444 }));
    ant.scale.set(0.03, 0.4, 0.03);
    ant.position.y = 2.2;
    tower.add(ant);

    tower.scale.set(0, 0, 0);
    group.add(tower);

    springs.push({
      mesh: tower,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 8. 🌳 Park (green disc + fountain)
  private buildParkPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const park = new THREE.Group();

    // Green grass disc
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.06, 24),
      new THREE.MeshLambertMaterial({ color: 0x22c55e })
    );
    disc.position.y = 0.06;
    park.add(disc);

    // Fountain
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16),
      new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    );
    basin.position.y = 0.18;
    park.add(basin);

    const fWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16),
      new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
    );
    fWater.position.y = 0.22;
    park.add(fWater);

    const jet = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x67e8f9 })
    );
    jet.position.y = 0.42;
    park.add(jet);

    // 2 Small park trees
    [[-0.6, 0.4], [0.6, -0.3]].forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0.06, tz);

      const trunk = new THREE.Mesh(this.cylinderGeo, new THREE.MeshLambertMaterial({ color: 0x854d0e }));
      trunk.scale.set(0.06, 0.4, 0.06);
      trunk.position.y = 0.2;
      tree.add(trunk);

      const leaves = new THREE.Mesh(this.sphereGeo, new THREE.MeshLambertMaterial({ color: 0x16a34a }));
      leaves.scale.setScalar(0.28);
      leaves.position.y = 0.45;
      tree.add(leaves);

      park.add(tree);
    });

    park.scale.set(0, 0, 0);
    group.add(park);

    springs.push({
      mesh: park,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // 9. 🕰️ Clock tower (box + cone + clock circle)
  private buildClockTowerPiece(group: THREE.Group, springs: SpringProp[], pos: [number, number, number]): Record<string, unknown> {
    const tower = new THREE.Group();

    // Box tower
    const body = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0xea580c }));
    body.scale.set(0.7, 1.4, 0.7);
    body.position.y = 0.7;
    tower.add(body);

    // Clock circle
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    clock.position.set(0, 1.15, 0.36);
    tower.add(clock);

    // Clock hands
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.12, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    hand.position.set(0, 1.18, 0.37);
    tower.add(hand);

    // Cone roof
    const roof = new THREE.Mesh(this.coneGeo, new THREE.MeshLambertMaterial({ color: 0x9a3412 }));
    roof.scale.set(0.55, 0.6, 0.55);
    roof.position.y = 1.7;
    roof.rotateY(Math.PI / 4);
    tower.add(roof);

    tower.scale.set(0, 0, 0);
    group.add(tower);

    springs.push({
      mesh: tower,
      worldPos: new THREE.Vector3(pos[0], 0.35, pos[2]),
      targetScale: 1,
      delay: 0,
      elapsed: 0,
      popped: false,
      done: false,
    });

    return {};
  }

  // Simple idle citizens (no mood bubbles, no clouds)
  private buildIdleCitizens(padGroup: THREE.Group): THREE.Group[] {
    const citizens: THREE.Group[] = [];
    const citizenColors = [0x38bdf8, 0xf472b6, 0x4ade80, 0xfacc15, 0xa78bfa, 0xfb7185];
    const offsets = [
      [-0.45, 0.45],
      [0.45, 0.45],
    ];

    offsets.forEach(([ox, oz], i) => {
      const citizen = new THREE.Group();
      citizen.position.set(ox, 0.08, oz);

      const color = citizenColors[(i * 3 + Math.floor(Math.random() * 2)) % citizenColors.length];
      const body = new THREE.Mesh(this.capsuleGeo, new THREE.MeshLambertMaterial({ color }));
      body.position.y = 0.3;
      citizen.add(body);

      const head = new THREE.Mesh(this.sphereGeo, new THREE.MeshLambertMaterial({ color: 0xffedd5 }));
      head.scale.setScalar(0.16);
      head.position.y = 0.6;
      citizen.add(head);

      padGroup.add(citizen);
      citizens.push(citizen);
    });

    return citizens;
  }

  public setActiveDistrict(districtId: number) {
    const d = DISTRICTS.find((item) => item.id === districtId);
    if (!d) return;
    this.activeMarker.position.set(d.position[0], 2.8, d.position[2]);
  }

  /**
   * Reward: Correct answer -> solution building pops in with scale 0 -> 1.15 -> 1 spring
   */
  public rewardDistrict(districtId: number) {
    const vis = this.districtsVisuals.get(districtId);
    if (!vis) return;

    vis.solved = true;
    vis.solutionGroup.visible = true;

    vis.springProps.forEach((sp) => {
      sp.elapsed = 0;
      sp.popped = false;
      sp.done = false;
    });
  }

  /**
   * Sky mood: Each correct answer brightens the sky one step (out of 9)
   */
  public updateSkyMood(correctCount: number) {
    const factor = Math.min(1.0, correctCount / 9);

    const overcast = new THREE.Color(0x8ea4b3);
    const sunny = new THREE.Color(0xa0e3ff);
    this.targetSkyColor.lerpColors(overcast, sunny, factor);

    this.targetLightIntensity = 0.7 + factor * 0.6;

    const cloudTone = 0.75 + factor * 0.25;
    this.clouds.forEach((cloud) => {
      (cloud.material as THREE.MeshLambertMaterial).color.setRGB(cloudTone, cloudTone, cloudTone);
    });
  }

  public resetAll() {
    this.districtsVisuals.forEach((vis) => {
      vis.solved = false;
      vis.solutionGroup.visible = false;
      vis.springProps.forEach((sp) => {
        sp.mesh.scale.set(0, 0, 0);
        sp.done = false;
        sp.popped = false;
      });
    });

    this.particles.reset();

    this.targetSkyColor.set(0x8ea4b3);
    this.currentSkyColor.set(0x8ea4b3);
    this.scene.background = this.currentSkyColor;
    this.fog.color = this.currentSkyColor;
    this.targetLightIntensity = 0.7;
    this.currentLightIntensity = 0.7;
    this.dirLight.intensity = 0.7;
    this.hemiLight.intensity = 0.65;
  }

  private updateSpringProps(springs: SpringProp[], dt: number) {
    for (let i = 0; i < springs.length; i++) {
      const sp = springs[i];
      if (sp.done) continue;

      sp.elapsed += dt;
      if (sp.elapsed >= sp.delay) {
        const animT = (sp.elapsed - sp.delay) / 0.32;

        if (!sp.popped) {
          sp.popped = true;
          this.particles.spawnDustRing(sp.worldPos.x, sp.worldPos.y, sp.worldPos.z);
          this.particles.spawnSparkles(sp.worldPos.x, sp.worldPos.y + 0.3, sp.worldPos.z, 8);
          audio.playBuildPop();
        }

        if (animT >= 1.0) {
          sp.mesh.scale.set(sp.targetScale, sp.targetScale, sp.targetScale);
          sp.done = true;
        } else {
          let s = 0;
          if (animT < 0.6) {
            s = (animT / 0.6) * 1.15;
          } else {
            s = 1.15 - ((animT - 0.6) / 0.4) * 0.15;
          }
          const finalS = s * sp.targetScale;
          sp.mesh.scale.set(finalS, finalS, finalS);
        }
      }
    }
  }

  public update(time: number, dt: number) {
    this.islandGroup.position.y = Math.sin(time * 1.5) * 0.12;
    this.islandGroup.rotation.z = Math.sin(time * 0.9) * 0.008;
    this.islandGroup.rotation.x = Math.cos(time * 0.8) * 0.008;

    this.activeMarker.rotation.y += 0.025;
    this.activeMarker.position.y = 2.8 + Math.sin(time * 4) * 0.2;

    this.waterMesh.rotation.y = time * 0.02;

    this.currentSkyColor.lerp(this.targetSkyColor, dt * 1.5);
    this.scene.background = this.currentSkyColor;
    this.fog.color = this.currentSkyColor;

    this.currentLightIntensity = THREE.MathUtils.lerp(this.currentLightIntensity, this.targetLightIntensity, dt * 1.5);
    this.dirLight.intensity = this.currentLightIntensity;

    this.particles.update(dt);

    this.districtsVisuals.forEach((vis) => {
      this.updateSpringProps(vis.springProps, dt);

      // Citizens only idle bob
      vis.citizens.forEach((c, i) => {
        c.position.y = 0.08 + Math.sin((time * 3) + i * 0.8) * 0.03;
      });
    });
  }
}
