import * as THREE from 'three';
import type { StationId } from './types';

export interface PatientRig {
  backrest: THREE.Group;
  footSection: THREE.Group;
  chest: THREE.Mesh;
  skin: THREE.MeshStandardMaterial;
  lips: THREE.MeshStandardMaterial;
  cannula: THREE.Object3D;
  mask: THREE.Object3D;
  hives: THREE.Object3D;
  juice: THREE.Object3D;
}

export interface World {
  scene: THREE.Scene;
  stations: Map<StationId, THREE.Object3D>;
  stationBoxes: Map<StationId, THREE.Box3>;
  obstacles: THREE.Box3[];
  patient: PatientRig;
  monitorScreen: THREE.Mesh;
  pumpScreen: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
  ivBag: THREE.Mesh;
  whiteboard: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
  labels: THREE.Group;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Meshes the third-person camera must not pass through. */
  camBlockers: THREE.Object3D[];
  /** GTA-style mission marker at the Room 304 doorway. */
  marker: THREE.Group;
  markerPos: THREE.Vector3;
  /** Walkable floor rectangles for the radar: [minX, minZ, maxX, maxZ]. */
  mapRects: [number, number, number, number][];
  /** Patrol routes for background NPCs. */
  npcRoutes: THREE.Vector3[][];
  benchSeats: THREE.Vector3[];
  /** Emissive materials that pulse (marker, exit signs). */
  animated: ((t: number) => void)[];
  dispose(): void;
}

const ROOM = { w: 10, d: 8, h: 3 };
/** The corridor runs along the room's front wall. */
const CORRIDOR = { z0: 4, z1: 8.2, halfLen: 16 };

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function sphere(r: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture };
}

function makeLabel(text: string) {
  const { texture } = canvasTexture(512, 96, (ctx) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 88, 44);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(0.7, 0.13, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Sunset city skyline painted onto a canvas (used for every exterior window). */
function skylineTexture() {
  return canvasTexture(1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1d2b64');
    g.addColorStop(0.35, '#7b4397');
    g.addColorStop(0.6, '#f0765a');
    g.addColorStop(0.78, '#ffc27a');
    g.addColorStop(1, '#ffd9a0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    // sun
    const sg = ctx.createRadialGradient(700, 330, 10, 700, 330, 140);
    sg.addColorStop(0, 'rgba(255,245,200,1)');
    sg.addColorStop(0.25, 'rgba(255,200,120,0.8)');
    sg.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(500, 150, 400, 360);
    // palm-lined far hills
    ctx.fillStyle = 'rgba(90,40,90,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 380);
    for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, 360 + Math.sin(x * 0.01) * 18);
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.fill();
    // skyscrapers, two depth layers
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (const [base, shade, maxH] of [[430, '#3a2346', 220], [470, '#1b1024', 300]] as const) {
      let x = -10;
      while (x < 1024) {
        const w = 30 + rnd() * 60;
        const h = 60 + rnd() * maxH;
        ctx.fillStyle = shade;
        ctx.fillRect(x, base - h, w, h + 60);
        if (rnd() > 0.7) ctx.fillRect(x + w / 2 - 2, base - h - 30, 4, 30); // antenna
        ctx.fillStyle = 'rgba(255,214,140,0.85)';
        for (let wy = base - h + 8; wy < base; wy += 12)
          for (let wx = x + 5; wx < x + w - 6; wx += 9) if (rnd() > 0.62) ctx.fillRect(wx, wy, 4, 5);
        x += w + 4 + rnd() * 10;
      }
    }
    // palm trees silhouettes
    ctx.strokeStyle = '#120a17';
    ctx.fillStyle = '#120a17';
    for (const px of [80, 260, 560, 900]) {
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(px, 512);
      ctx.quadraticCurveTo(px + 12, 430, px + 4, 360);
      ctx.stroke();
      for (let a = 0; a < 7; a++) {
        const ang = (a / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(px + 4 + Math.cos(ang) * 30, 360 + Math.sin(ang) * 12, 34, 6, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }).texture;
}

/** Vinyl hospital floor with speckle and tile seams. */
function floorTexture(base: string, speck: string, repeatX: number, repeatY: number) {
  const t = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? speck : 'rgba(255,255,255,0.35)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  }).texture;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

/** Subtle painted-wall noise so walls don't look flat. */
function wallTexture(color: string) {
  const t = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.012)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
  }).texture;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

function signTexture(text: string, bg: string, fg = '#ffffff', w = 256, h = 96) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = `bold ${Math.round(h * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  }).texture;
}

export function buildWorld(labelNames: Record<StationId, string>): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ef);
  const stations = new Map<StationId, THREE.Object3D>();
  const obstacles: THREE.Box3[] = [];

  const station = (id: StationId, obj: THREE.Object3D) => {
    obj.userData.station = id;
    stations.set(id, obj);
    scene.add(obj);
    return obj;
  };

  // ---------- Lighting ----------
  const camBlockers: THREE.Object3D[] = [];
  const animated: ((t: number) => void)[] = [];
  scene.background = new THREE.Color(0x2a1f3d);
  scene.fog = new THREE.Fog(0x2a1f3d, 18, 40);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x6b5a4a, 0.35));
  // Low golden-hour sun pouring through the room window
  const sun = new THREE.DirectionalLight(0xffa860, 2.6);
  sun.position.set(-12, 5, -3.5);
  sun.target.position.set(0, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.far = 30;
  scene.add(sun, sun.target);
  for (const [x, z] of [[0, -2], [0, 2], [-3, 0], [3, 0]]) {
    const p = new THREE.PointLight(0xfff1dc, 2.6, 7, 1.8);
    p.position.set(x, ROOM.h - 0.2, z);
    scene.add(p);
  }

  // ---------- Room shell ----------
  const floorTex = floorTexture('#cfd6dc', 'rgba(80,95,110,0.35)', 2.5, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xffffff, { map: floorTex, roughness: 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xf5f7fa));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  scene.add(ceiling);
  for (const [x, z] of [[0, -2], [0, 2], [-3, 0], [3, 0]]) {
    scene.add(box(1.2, 0.03, 0.6, mat(0xffffff, { emissive: 0xfff4e0, emissiveIntensity: 1.1 }), x, ROOM.h - 0.02, z));
  }

  const wallMat = mat(0xffffff, { map: wallTexture('#d9e1e7'), roughness: 0.85 });
  const accentMat = mat(0x5f9fb8, { roughness: 0.5 });
  const baseMat = mat(0x4b5a68, { roughness: 0.4 });
  const addWall = (w: number, d: number, x: number, z: number, h = ROOM.h, y = h / 2, trim = true) => {
    const wall = box(w, h, d, wallMat, x, y, z);
    scene.add(wall);
    camBlockers.push(wall);
    if (trim) {
      scene.add(box(w + 0.01, 0.12, d + 0.01, accentMat, x, 1.0, z));
      scene.add(box(w + 0.02, 0.1, d + 0.02, baseMat, x, 0.05, z));
    }
  };
  addWall(ROOM.w, 0.1, 0, -ROOM.d / 2);
  addWall(0.1, ROOM.d, -ROOM.w / 2, 0);
  addWall(0.1, ROOM.d, ROOM.w / 2, 0);
  // Front wall with a doorway (x 2.6 → 3.8) into the corridor
  addWall(7.6, 0.1, -1.2, ROOM.d / 2);
  addWall(1.2, 0.1, 4.4, ROOM.d / 2);
  addWall(1.2, 0.1, 3.2, ROOM.d / 2, 0.7, ROOM.h - 0.35, false);

  // Window with sky (left wall)
  const sky = skylineTexture();
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }));
  win.position.set(-ROOM.w / 2 + 0.06, 1.75, -1.6);
  win.rotation.y = Math.PI / 2;
  scene.add(win);
  const frameMat = mat(0xffffff);
  scene.add(box(0.08, 0.08, 2.3, frameMat, -ROOM.w / 2 + 0.08, 2.42, -1.6));
  scene.add(box(0.08, 0.08, 2.3, frameMat, -ROOM.w / 2 + 0.08, 1.08, -1.6));
  scene.add(box(0.08, 1.4, 0.06, frameMat, -ROOM.w / 2 + 0.08, 1.75, -1.6));

  // Visitor chair
  const chair = new THREE.Group();
  chair.add(box(0.55, 0.08, 0.55, mat(0x2f6f8f), 0, 0.45, 0));
  chair.add(box(0.55, 0.6, 0.08, mat(0x2f6f8f), 0, 0.78, -0.24));
  for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) chair.add(cyl(0.02, 0.02, 0.45, mat(0x999999, { metalness: 0.6 }), x, 0.22, z));
  chair.position.set(-4.2, 0, -0.2);
  chair.rotation.y = Math.PI / 2.5;
  scene.add(chair);
  obstacles.push(new THREE.Box3().setFromObject(chair));

  // ---------- Bed + patient ----------
  const bed = new THREE.Group();
  const frame = mat(0xc4ccd4, { metalness: 0.4, roughness: 0.4 });
  const sheet = mat(0xffffff, { roughness: 0.9 });
  bed.add(box(1.0, 0.12, 2.3, frame, 0, 0.45, -2.2));
  bed.add(box(1.04, 0.95, 0.08, mat(0x8aa4b8), 0, 0.72, -3.37)); // headboard
  bed.add(box(1.04, 0.6, 0.08, mat(0x8aa4b8), 0, 0.6, -1.03)); // footboard
  for (const [x, z] of [[-0.42, -3.2], [0.42, -3.2], [-0.42, -1.2], [0.42, -1.2]]) {
    bed.add(cyl(0.03, 0.03, 0.35, frame, x, 0.22, z));
    const wheel = cyl(0.06, 0.06, 0.04, mat(0x333333), x, 0.06, z);
    wheel.rotation.z = Math.PI / 2;
    bed.add(wheel);
  }
  // side rails
  bed.add(box(0.03, 0.22, 0.9, frame, -0.52, 0.8, -2.7));
  bed.add(box(0.03, 0.22, 0.9, frame, 0.52, 0.8, -2.7));

  const skin = mat(0xc99a78, { roughness: 0.6 });
  const lips = mat(0xb56b62);
  const gown = mat(0x9cc5e0, { roughness: 0.9 });

  const pivotZ = -2.35;
  const backrest = new THREE.Group();
  backrest.position.set(0, 0.62, pivotZ);
  backrest.add(box(0.94, 0.14, 0.95, sheet, 0, -0.07, -0.475));
  const pillow = box(0.6, 0.12, 0.35, mat(0xf4f7fb), 0, 0.06, -0.78);
  backrest.add(pillow);

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 16), gown);
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0, 0.14, -0.35);
  chest.scale.set(1.15, 1, 0.8);
  chest.castShadow = true;
  backrest.add(chest);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10), gown);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(side * 0.27, 0.1, -0.3);
    arm.castShadow = true;
    backrest.add(arm);
    backrest.add(sphere(0.05, skin, side * 0.28, 0.1, 0.0));
  }
  // wristband
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 16), mat(0xffffff));
  band.position.set(0.28, 0.1, -0.06);
  backrest.add(band);
  const allergyBand = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 16), mat(0xe53935));
  allergyBand.position.set(0.28, 0.1, -0.1);
  backrest.add(allergyBand);

  const head = new THREE.Group();
  head.position.set(0, 0.2, -0.78);
  backrest.add(head);
  const skull = sphere(0.12, skin);
  skull.scale.set(1, 1, 1.12);
  head.add(skull);
  const hair = sphere(0.125, mat(0x2d2018));
  hair.scale.set(1.02, 0.8, 1.1);
  hair.position.set(0, -0.03, -0.03);
  head.add(hair);
  for (const side of [-1, 1]) head.add(sphere(0.014, mat(0x1b1b1b), side * 0.042, 0.108, -0.02));
  head.add(sphere(0.02, skin, 0, 0.125, 0.02));
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.012), lips);
  mouth.position.set(0, 0.112, 0.065);
  head.add(mouth);
  head.add(cyl(0.06, 0.06, 0.1, skin, 0, 0, 0.14));

  // Hives (anaphylaxis) – red welts on neck/chest
  const hives = new THREE.Group();
  const welt = mat(0xe0726a, { roughness: 0.8 });
  for (let i = 0; i < 14; i++) {
    // Welts on the neck and upper chest, just above the gown neckline
    const w = sphere(0.008 + Math.random() * 0.008, welt, (Math.random() - 0.5) * 0.12, 0.25, -0.66 + Math.random() * 0.1);
    w.scale.y = 0.35;
    hives.add(w);
  }
  for (let i = 0; i < 16; i++) {
    // ...and raised welts along both forearms
    const side = i % 2 ? 1 : -1;
    const w = sphere(0.012 + Math.random() * 0.008, welt, side * (0.27 + (Math.random() - 0.5) * 0.04), 0.155, -0.5 + Math.random() * 0.42);
    w.scale.y = 0.35;
    hives.add(w);
  }
  hives.visible = false;
  backrest.add(hives);

  // Oxygen devices
  const tubeMat = mat(0xd8f3ff, { transparent: true, opacity: 0.85, roughness: 0.2 });
  const cannula = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.006, 6, 32), tubeMat);
  cannula.rotation.x = Math.PI / 2;
  cannula.position.set(0, 0.1, 0.03);
  cannula.visible = false;
  head.add(cannula);
  const mask = new THREE.Group();
  const maskCone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.08, 20, 1, true), mat(0x9be7c4, { transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  maskCone.position.set(0, 0.15, 0.04);
  maskCone.rotation.x = Math.PI;
  mask.add(maskCone);
  const reservoir = sphere(0.06, mat(0x9be7c4, { transparent: true, opacity: 0.55 }), 0, 0.14, 0.2);
  reservoir.scale.set(1, 0.7, 1.4);
  mask.add(reservoir);
  mask.visible = false;
  head.add(mask);

  const footSection = new THREE.Group();
  footSection.position.set(0, 0.62, pivotZ);
  footSection.add(box(0.94, 0.14, 1.25, sheet, 0, -0.07, 0.625));
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.8, 4, 12), mat(0xf0f0f0));
  legs.rotation.x = Math.PI / 2;
  legs.scale.set(1.5, 1, 0.55);
  legs.position.set(0, 0.07, 0.55);
  footSection.add(legs);
  const blanket = box(0.98, 0.03, 1.3, mat(0x4f7fa8, { roughness: 0.95 }), 0, 0.17, 0.6);
  footSection.add(blanket);
  footSection.add(box(0.98, 0.14, 0.03, mat(0x4f7fa8, { roughness: 0.95 }), 0, 0.1, -0.03));

  bed.add(backrest, footSection);
  station('patient', bed);

  // ---------- Bedside monitor ----------
  const monitor = new THREE.Group();
  monitor.add(cyl(0.025, 0.025, 1.5, frame, 0, 0.75, 0));
  monitor.add(cyl(0.25, 0.28, 0.04, mat(0x444444), 0, 0.02, 0));
  monitor.add(box(0.62, 0.44, 0.12, mat(0x2b2f36), 0, 1.65, 0));
  const monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.38), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  monitorScreen.position.set(0, 1.65, 0.062);
  monitor.add(monitorScreen);
  monitor.position.set(-1.0, 0, -3.35);
  monitor.rotation.y = 0.35;
  station('monitor', monitor);

  // ---------- Wall oxygen / headwall ----------
  const oxygen = new THREE.Group();
  oxygen.add(box(1.6, 0.35, 0.08, mat(0xd5dde5), 0, 1.4, 0));
  oxygen.add(box(0.12, 0.12, 0.05, mat(0x1e9e57), 0.45, 1.4, 0.06));
  const flow = cyl(0.035, 0.035, 0.22, mat(0xe8fff2, { transparent: true, opacity: 0.8 }), 0.45, 1.25, 0.1);
  oxygen.add(flow);
  oxygen.add(sphere(0.02, mat(0x1e9e57), 0.45, 1.3, 0.1));
  oxygen.add(box(0.12, 0.12, 0.05, mat(0xf0f0f0), -0.45, 1.4, 0.06)); // suction
  oxygen.position.set(0.6, 0, -ROOM.d / 2 + 0.06);
  station('oxygen', oxygen);

  // ---------- IV pole + pump ----------
  const iv = new THREE.Group();
  iv.add(cyl(0.018, 0.018, 2.05, frame, 0, 1.02, 0));
  for (let i = 0; i < 5; i++) {
    const leg = box(0.3, 0.03, 0.04, frame, Math.cos((i / 5) * Math.PI * 2) * 0.15, 0.05, Math.sin((i / 5) * Math.PI * 2) * 0.15);
    leg.rotation.y = -(i / 5) * Math.PI * 2;
    iv.add(leg);
  }
  iv.add(box(0.4, 0.02, 0.02, frame, 0, 2.02, 0));
  const ivBag = box(0.16, 0.26, 0.05, mat(0xeaf6ff, { transparent: true, opacity: 0.8, roughness: 0.2 }), 0.14, 1.85, 0);
  iv.add(ivBag);
  const pump = box(0.22, 0.28, 0.14, mat(0xf2f4f6), 0, 1.2, 0.05);
  iv.add(pump);
  const pumpScreen = canvasTexture(128, 96, () => undefined);
  const pumpPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshBasicMaterial({ map: pumpScreen.texture }));
  pumpPlane.position.set(0, 1.24, 0.121);
  iv.add(pumpPlane);
  const tube = cyl(0.005, 0.005, 1.0, tubeMat, 0.14, 1.23, 0.02);
  iv.add(tube);
  iv.position.set(0.85, 0, -2.9);
  station('iv', iv);

  // ---------- Bedside table with glucometer + juice ----------
  const table = new THREE.Group();
  table.add(box(0.5, 0.04, 0.4, mat(0xb58b5b), 0, 0.8, 0));
  table.add(box(0.46, 0.5, 0.36, mat(0xc49a6c), 0, 0.3, 0));
  table.add(box(0.07, 0.12, 0.03, mat(0x3a7bd5), -0.1, 0.88, 0.02)); // glucometer
  table.add(box(0.05, 0.035, 0.005, mat(0x9ee6ff, { emissive: 0x3aa0ff, emissiveIntensity: 0.4 }), -0.1, 0.9, 0.036));
  const cup = cyl(0.04, 0.035, 0.1, mat(0xffffff), 0.12, 0.87, 0.05);
  table.add(cup);
  const juice = new THREE.Group();
  const juiceBox = box(0.06, 0.1, 0.04, mat(0xf5a623), 0.12, 0.87, -0.1);
  juice.add(juiceBox);
  table.add(juice);
  table.position.set(-1.05, 0, -1.9);
  station('bedside', table);
  obstacles.push(new THREE.Box3().setFromObject(table));

  // ---------- Sink + sanitizer ----------
  const sink = new THREE.Group();
  sink.add(box(0.5, 0.85, 0.9, mat(0xb9c6d2), 0, 0.425, 0));
  sink.add(box(0.52, 0.05, 0.92, mat(0xf5f5f5), 0, 0.87, 0));
  sink.add(box(0.3, 0.06, 0.5, mat(0xdde6ee, { metalness: 0.6, roughness: 0.2 }), 0, 0.88, 0));
  const faucet = cyl(0.015, 0.015, 0.25, mat(0xcccccc, { metalness: 0.9, roughness: 0.2 }), -0.18, 1.02, 0);
  sink.add(faucet);
  sink.add(box(0.1, 0.22, 0.12, mat(0xffffff), -0.19, 1.45, 0.3)); // dispenser
  sink.add(box(0.06, 0.05, 0.1, mat(0x38bdf8), -0.13, 1.36, 0.3));
  const handSign = canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 34px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('CLEAN HANDS', 128, 55);
    ctx.font = '22px system-ui';
    ctx.fillText('before & after care', 128, 95);
  });
  const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: handSign.texture }));
  signPlane.position.set(-0.23, 1.8, -0.1);
  signPlane.rotation.y = Math.PI / 2;
  sink.add(signPlane);
  sink.position.set(ROOM.w / 2 - 0.3, 0, 1.4);
  sink.rotation.y = Math.PI;
  station('sink', sink);
  obstacles.push(new THREE.Box3().setFromObject(sink));

  // ---------- Medication cart ----------
  const cart = new THREE.Group();
  cart.add(box(0.6, 0.95, 0.5, mat(0x3b82f6), 0, 0.55, 0));
  for (let i = 0; i < 4; i++) cart.add(box(0.56, 0.02, 0.01, mat(0x1e3a8a), 0, 0.3 + i * 0.2, 0.255));
  for (let i = 0; i < 4; i++) cart.add(box(0.12, 0.03, 0.02, mat(0xe5e7eb, { metalness: 0.5 }), 0, 0.4 + i * 0.2, 0.265));
  cart.add(box(0.64, 0.03, 0.54, mat(0xe5e7eb), 0, 1.04, 0));
  for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) cart.add(sphere(0.04, mat(0x222222), x, 0.04, z));
  const vials = [0xef4444, 0xf59e0b, 0x10b981, 0x6366f1];
  vials.forEach((c, i) => cart.add(cyl(0.02, 0.02, 0.07, mat(c), -0.2 + i * 0.12, 1.09, 0)));
  cart.position.set(-ROOM.w / 2 + 0.4, 0, 1.0);
  cart.rotation.y = Math.PI / 2;
  station('medcart', cart);
  obstacles.push(new THREE.Box3().setFromObject(cart));

  // ---------- Computer on wheels ----------
  const computer = new THREE.Group();
  computer.add(cyl(0.04, 0.04, 0.9, frame, 0, 0.45, 0));
  computer.add(cyl(0.3, 0.3, 0.04, mat(0x444444), 0, 0.04, 0));
  computer.add(box(0.6, 0.03, 0.4, mat(0xe5e7eb), 0, 0.95, 0));
  computer.add(box(0.45, 0.02, 0.15, mat(0x333333), 0, 0.97, 0.08));
  computer.add(box(0.5, 0.33, 0.03, mat(0x222222), 0, 1.25, -0.12));
  const ehr = canvasTexture(256, 170, (ctx) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 170);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 256, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText('EHR · Room 304', 10, 18);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui';
    ['Orders', 'MAR', 'Allergies', 'Notes', 'Labs'].forEach((t, i) => ctx.fillText('▸ ' + t, 14, 50 + i * 22));
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(130, 40, 110, 110);
  });
  const ehrPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ map: ehr.texture }));
  ehrPlane.position.set(0, 1.25, -0.103);
  computer.add(ehrPlane);
  computer.position.set(-3.6, 0, 2.7);
  computer.rotation.y = Math.PI * 0.8;
  station('computer', computer);
  obstacles.push(new THREE.Box3().setFromObject(computer));

  // ---------- Phone ----------
  const phone = new THREE.Group();
  phone.add(box(0.2, 0.28, 0.06, mat(0x1f2937), 0, 1.45, 0));
  phone.add(box(0.06, 0.22, 0.05, mat(0x111827), -0.12, 1.45, 0.03));
  phone.add(box(0.12, 0.06, 0.005, mat(0x86efac, { emissive: 0x22c55e, emissiveIntensity: 0.6 }), 0.02, 1.52, 0.033));
  const redButton = box(0.1, 0.05, 0.02, mat(0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.4 }), 0.02, 1.35, 0.035);
  phone.add(redButton);
  phone.position.set(-2.0, 0, ROOM.d / 2 - 0.08);
  phone.rotation.y = Math.PI;
  station('phone', phone);

  // ---------- Door ----------
  // Door stands open against the room side of the wall; the frame marks the doorway
  const door = new THREE.Group();
  const panel = new THREE.Group();
  panel.add(box(1.1, 2.2, 0.06, mat(0xa47b52, { roughness: 0.45 }), -0.55, 1.1, 0));
  panel.add(box(0.2, 1.1, 0.07, mat(0xd8e6f0, { roughness: 0.1, metalness: 0.1 }), -0.55, 1.45, 0));
  panel.add(box(0.04, 0.04, 0.14, mat(0xcccccc, { metalness: 0.9, roughness: 0.2 }), -0.95, 1.05, 0));
  panel.position.set(0.6, 0, 0);
  panel.rotation.y = -Math.PI / 2;
  door.add(panel);
  const frameM = mat(0xf1f5f9, { roughness: 0.4 });
  door.add(box(0.08, 2.3, 0.16, frameM, -0.62, 1.15, 0));
  door.add(box(0.08, 2.3, 0.16, frameM, 0.62, 1.15, 0));
  door.add(box(1.32, 0.08, 0.16, frameM, 0, 2.3, 0));
  const sign = canvasTexture(256, 96, (ctx) => {
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT · 304', 128, 62);
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: sign.texture, toneMapped: false }));
  signMesh.position.set(0, 2.5, -0.06);
  signMesh.rotation.y = Math.PI;
  door.add(signMesh);
  door.position.set(3.2, 0, ROOM.d / 2 - 0.06);
  station('door', door);

  // ---------- Whiteboard ----------
  const whiteboard = canvasTexture(512, 320, () => undefined);
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: whiteboard.texture }));
  wb.position.set(0.2, 1.7, ROOM.d / 2 - 0.07);
  wb.rotation.y = Math.PI;
  scene.add(wb);
  scene.add(box(1.66, 1.06, 0.03, mat(0x9ca3af), 0.2, 1.7, ROOM.d / 2 - 0.05));

  // Privacy curtain (partially drawn, foot-right side of bed)
  const curtainMat = mat(0x8fbcd4, { side: THREE.DoubleSide, roughness: 0.95 });
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2, 16, 1), curtainMat);
  const pos = curtain.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 12) * 0.05);
  curtain.geometry.computeVertexNormals();
  curtain.position.set(2.0, 1.55, -3.1);
  curtain.rotation.y = Math.PI / 2;
  scene.add(curtain);
  scene.add(box(0.03, 0.03, 3, frame, 2.0, 2.7, -2.5));

  // ---------- Station labels ----------
  const labels = new THREE.Group();
  const stationBoxes = new Map<StationId, THREE.Box3>();
  scene.updateMatrixWorld(true);
  for (const [id, obj] of stations) {
    const bb = new THREE.Box3().setFromObject(obj);
    stationBoxes.set(id, bb);
    const label = makeLabel(labelNames[id]);
    const c = bb.getCenter(new THREE.Vector3());
    label.position.set(c.x, Math.min(bb.max.y + 0.22, ROOM.h - 0.2), c.z);
    if (id === 'patient') label.position.y = 1.55;
    labels.add(label);
  }
  scene.add(labels);
  // Open door panel blocks the strip along the wall
  obstacles.push(new THREE.Box3(new THREE.Vector3(3.72, 0, 2.8), new THREE.Vector3(3.9, 2, 4)));
  const corridor = buildCorridor(scene, obstacles, camBlockers, animated, sky);

  // Bed is an obstacle (slightly shrunk so you can reach the bedside)
  obstacles.push(new THREE.Box3(new THREE.Vector3(-0.5, 0, -3.4), new THREE.Vector3(0.5, 1.2, -1.0)));
  obstacles.push(new THREE.Box3(new THREE.Vector3(-1.2, 0, -3.5), new THREE.Vector3(-0.8, 1.2, -3.2))); // monitor base

  return {
    scene,
    stations,
    stationBoxes,
    obstacles,
    patient: { backrest, footSection, chest, skin, lips, cannula, mask, hives, juice },
    monitorScreen,
    pumpScreen,
    ivBag,
    whiteboard,
    labels,
    bounds: { minX: -CORRIDOR.halfLen + 0.35, maxX: CORRIDOR.halfLen - 0.35, minZ: -ROOM.d / 2 + 0.35, maxZ: CORRIDOR.z1 - 0.35 },
    camBlockers,
    animated,
    ...corridor,
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mm of mats) {
          const withMap = mm as THREE.MeshBasicMaterial;
          withMap.map?.dispose();
          mm.dispose();
        }
      });
    },
  };
}

/** The ward corridor outside Room 304: nurses' station, other rooms, elevator, city window and the mission marker. */
function buildCorridor(
  scene: THREE.Scene,
  obstacles: THREE.Box3[],
  camBlockers: THREE.Object3D[],
  animated: ((t: number) => void)[],
  sky: THREE.Texture,
) {
  const { z0, z1, halfLen } = CORRIDOR;
  const len = halfLen * 2;
  const midZ = (z0 + z1) / 2;
  const depth = z1 - z0;
  const H = ROOM.h;

  // Floor, ceiling, wayfinding stripes
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(len, depth),
    mat(0xffffff, { map: floorTexture('#b9b3a8', 'rgba(90,80,70,0.3)', 8, 1), roughness: 0.32 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, midZ);
  floor.receiveShadow = true;
  scene.add(floor);
  for (const [z, color] of [[5.0, 0x2563eb], [5.14, 0xf5c518]] as const) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.08), mat(color, { roughness: 0.3 }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.002, z);
    scene.add(stripe);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(len, depth), mat(0xeef2f5));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, midZ);
  scene.add(ceiling);
  const panelMat = mat(0xffffff, { emissive: 0xfff4e0, emissiveIntensity: 1.1 });
  for (let x = -halfLen + 2; x < halfLen; x += 4) scene.add(box(1.4, 0.03, 0.5, panelMat, x, H - 0.02, midZ));
  for (const x of [-11, -3, 5, 12]) {
    const p = new THREE.PointLight(0xfff1dc, 3.2, 9, 1.7);
    p.position.set(x, H - 0.25, midZ);
    scene.add(p);
  }

  // Walls
  const wallMat = mat(0xffffff, { map: wallTexture('#d4dce1'), roughness: 0.85 });
  const trimMat = mat(0x5f9fb8, { roughness: 0.5 });
  const baseMat = mat(0x4b5a68, { roughness: 0.4 });
  const wall = (w: number, d: number, x: number, z: number) => {
    const m = box(w, H, d, wallMat, x, H / 2, z);
    scene.add(m);
    camBlockers.push(m);
    scene.add(box(w + 0.01, 0.1, d + 0.01, baseMat, x, 0.05, z));
    scene.add(box(w + 0.01, 0.1, d + 0.01, trimMat, x, 1.0, z));
  };
  const frontLen = halfLen - ROOM.w / 2;
  wall(frontLen, 0.1, -(ROOM.w / 2 + frontLen / 2), z0);
  wall(frontLen, 0.1, ROOM.w / 2 + frontLen / 2, z0);
  wall(len, 0.1, 0, z1);
  wall(0.1, depth, halfLen, midZ);
  // Left end: floor-to-ceiling window onto the city
  const endL = box(0.1, H, depth, wallMat, -halfLen, H / 2, midZ);
  endL.visible = false; // invisible camera blocker behind the glass
  scene.add(endL);
  camBlockers.push(endL);
  const cityWin = new THREE.Mesh(new THREE.PlaneGeometry(depth - 0.6, 2.2), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }));
  cityWin.position.set(-halfLen + 0.06, 1.55, midZ);
  cityWin.rotation.y = Math.PI / 2;
  scene.add(cityWin);
  const mull = mat(0x2b2f36, { metalness: 0.6, roughness: 0.3 });
  for (const dz of [-1.8, -0.6, 0.6, 1.8]) scene.add(box(0.08, 2.3, 0.06, mull, -halfLen + 0.08, 1.55, midZ + dz));
  scene.add(box(0.08, 0.08, depth, mull, -halfLen + 0.08, 0.45, midZ));
  scene.add(box(0.08, 0.08, depth, mull, -halfLen + 0.08, 2.65, midZ));
  // Glass wall carries the rest of the end wall above/below
  scene.add(box(0.1, 0.4, depth, wallMat, -halfLen, 0.2, midZ));
  scene.add(box(0.1, 0.3, depth, wallMat, -halfLen, H - 0.15, midZ));
  // Warm sunset spill from the big window
  const spill = new THREE.PointLight(0xff9a5c, 5, 10, 1.6);
  spill.position.set(-halfLen + 1, 1.6, midZ);
  scene.add(spill);

  // Blocks everything outside the room/corridor footprint
  obstacles.push(new THREE.Box3(new THREE.Vector3(-halfLen - 1, 0, -ROOM.d / 2 - 1), new THREE.Vector3(-ROOM.w / 2, H, z0 + 0.05)));
  obstacles.push(new THREE.Box3(new THREE.Vector3(ROOM.w / 2, 0, -ROOM.d / 2 - 1), new THREE.Vector3(halfLen + 1, H, z0 + 0.05)));
  obstacles.push(new THREE.Box3(new THREE.Vector3(-ROOM.w / 2, 0, z0 - 0.05), new THREE.Vector3(2.6, H, z0 + 0.05)));
  obstacles.push(new THREE.Box3(new THREE.Vector3(3.8, 0, z0 - 0.05), new THREE.Vector3(ROOM.w / 2, H, z0 + 0.05)));

  // Handrail along the back wall
  const rail = cyl(0.03, 0.03, len - 1, mat(0xd6c3a5, { roughness: 0.35 }), 0, 0.9, z1 - 0.1);
  rail.rotation.z = Math.PI / 2;
  scene.add(rail);

  // Patient room doors with number plates
  const doorMat = mat(0xa47b52, { roughness: 0.45 });
  const addRoomDoor = (x: number, z: number, facing: 1 | -1, num: string) => {
    const g = new THREE.Group();
    g.add(box(1.1, 2.2, 0.05, doorMat, 0, 1.1, 0));
    g.add(box(0.18, 0.9, 0.06, mat(0xbcd3e3, { roughness: 0.1 }), -0.3, 1.45, 0));
    g.add(box(0.04, 0.04, 0.1, mat(0xcccccc, { metalness: 0.9, roughness: 0.2 }), 0.42, 1.05, 0.03));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), new THREE.MeshBasicMaterial({ map: signTexture(num, '#0f3b53') }));
    plate.position.set(0.8, 1.65, 0.035);
    g.add(plate);
    g.position.set(x, 0, z);
    g.rotation.y = facing === 1 ? 0 : Math.PI;
    scene.add(g);
  };
  addRoomDoor(-13, z0 + 0.06, 1, '301');
  addRoomDoor(-8.5, z0 + 0.06, 1, '302');
  addRoomDoor(8, z0 + 0.06, 1, '305');
  addRoomDoor(12.5, z0 + 0.06, 1, '306');
  addRoomDoor(-1, z1 - 0.06, -1, '310');
  addRoomDoor(9.5, z1 - 0.06, -1, '312');
  addRoomDoor(14, z1 - 0.06, -1, '314');
  // Room 304 plate beside the open doorway
  const plate304 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshBasicMaterial({ map: signTexture('304', '#f5c518', '#111') }));
  plate304.position.set(4.1, 1.65, z0 + 0.06);
  scene.add(plate304);

  // Nurses' station
  const station = new THREE.Group();
  const counterMat = mat(0xf2efe9, { roughness: 0.3 });
  const woodMat = mat(0x8a6240, { roughness: 0.5 });
  station.add(box(4.2, 1.1, 0.5, woodMat, 0, 0.55, 0));
  station.add(box(4.3, 0.05, 0.6, counterMat, 0, 1.12, 0));
  station.add(box(0.5, 1.1, 1.2, woodMat, -1.85, 0.55, 0.85));
  station.add(box(0.6, 0.05, 1.3, counterMat, -1.85, 1.12, 0.85));
  station.add(box(3.8, 0.04, 0.6, counterMat, 0.2, 0.75, 0.55));
  for (const x of [-0.9, 0.4, 1.5]) {
    station.add(box(0.5, 0.32, 0.03, mat(0x111111), x, 1.05, 0.62));
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.28),
      new THREE.MeshBasicMaterial({ map: signTexture('EHR', '#0b3d91', '#9ad1ff', 128, 80), toneMapped: false }),
    );
    scr.position.set(x, 1.05, 0.64);
    station.add(scr);
    const chair = new THREE.Group();
    chair.add(box(0.45, 0.07, 0.45, mat(0x1f2937), 0, 0.5, 0));
    chair.add(box(0.45, 0.45, 0.06, mat(0x1f2937), 0, 0.78, 0.22));
    chair.add(cyl(0.03, 0.03, 0.45, mat(0x888888, { metalness: 0.7 }), 0, 0.25, 0));
    chair.position.set(x, 0, 1.05);
    station.add(chair);
  }
  const hanging = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.3),
    new THREE.MeshBasicMaterial({ map: signTexture("NURSES' STATION", '#0f3b53', '#fff', 512, 96) }),
  );
  hanging.position.set(0, 2.5, -0.1);
  hanging.rotation.y = Math.PI; // readable from the corridor side
  station.add(hanging);
  const hangingBack = hanging.clone();
  hangingBack.rotation.y = 0;
  hangingBack.position.z = -0.09;
  station.add(hangingBack);
  station.position.set(-7.5, 0, 5.9);
  scene.add(station);
  obstacles.push(new THREE.Box3().setFromObject(station).expandByScalar(-0.05));
  camBlockers.push(station);

  // Crash cart
  const crash = new THREE.Group();
  crash.add(box(0.7, 1.0, 0.5, mat(0xc81e1e, { roughness: 0.35, metalness: 0.2 }), 0, 0.55, 0));
  for (let i = 0; i < 4; i++) crash.add(box(0.66, 0.015, 0.01, mat(0x7f1010), 0, 0.3 + i * 0.2, 0.255));
  crash.add(box(0.5, 0.25, 0.3, mat(0xf5c518), 0, 1.2, 0)); // defibrillator
  crash.add(box(0.25, 0.15, 0.01, mat(0x0a0a0a, { emissive: 0x16a34a, emissiveIntensity: 0.8 }), 0, 1.24, 0.155));
  crash.position.set(6.3, 0, z1 - 0.4);
  crash.rotation.y = Math.PI;
  scene.add(crash);
  obstacles.push(new THREE.Box3().setFromObject(crash));

  // Wheelchair
  const wc = new THREE.Group();
  const metal = mat(0x9ca3af, { metalness: 0.8, roughness: 0.3 });
  wc.add(box(0.5, 0.06, 0.45, mat(0x1f2937), 0, 0.5, 0));
  wc.add(box(0.5, 0.5, 0.05, mat(0x1f2937), 0, 0.78, -0.22));
  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 24), metal);
    wheel.position.set(side * 0.3, 0.3, -0.05);
    wheel.rotation.y = Math.PI / 2;
    wc.add(wheel);
  }
  wc.position.set(-3.3, 0, z1 - 0.45);
  wc.rotation.y = 0.3;
  scene.add(wc);
  obstacles.push(new THREE.Box3().setFromObject(wc));

  // Waiting bench + plants
  const bench = new THREE.Group();
  bench.add(box(2.2, 0.08, 0.5, mat(0x0f766e, { roughness: 0.5 }), 0, 0.46, 0));
  bench.add(box(2.2, 0.45, 0.07, mat(0x0f766e, { roughness: 0.5 }), 0, 0.72, -0.23));
  for (const x of [-1, 1]) bench.add(box(0.06, 0.46, 0.45, metal, x, 0.23, 0));
  bench.position.set(3.6, 0, z1 - 0.35);
  scene.add(bench);
  obstacles.push(new THREE.Box3().setFromObject(bench));
  const benchSeats = [new THREE.Vector3(3.1, 0, z1 - 0.4), new THREE.Vector3(4.3, 0, z1 - 0.4)];
  const plant = (x: number, z: number) => {
    const g = new THREE.Group();
    g.add(cyl(0.22, 0.17, 0.45, mat(0xe7e5e4, { roughness: 0.4 }), 0, 0.22, 0));
    const leaf = mat(0x2f7d32, { roughness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 5), leaf);
      l.position.set(Math.cos(i) * 0.08, 0.85, Math.sin(i) * 0.08);
      l.rotation.set(Math.sin(i * 2) * 0.5, 0, Math.cos(i * 2) * 0.5);
      l.castShadow = true;
      g.add(l);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    obstacles.push(new THREE.Box3().setFromObject(g).expandByScalar(-0.15));
  };
  plant(-halfLen + 0.5, z0 + 0.5);
  plant(-halfLen + 0.5, z1 - 0.5);
  plant(1.8, z1 - 0.4);

  // Framed art on the back wall
  const art = (x: number, colors: string[]) => {
    const tex = canvasTexture(256, 180, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 256, 180);
      colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 180);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(180, 60, 34, 0, Math.PI * 2);
      ctx.fill();
    }).texture;
    const frame = box(1.1, 0.8, 0.04, mat(0x2b2b2b), x, 1.7, z1 - 0.07);
    scene.add(frame);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 }));
    pic.position.set(x, 1.7, z1 - 0.095);
    pic.rotation.y = Math.PI;
    scene.add(pic);
  };
  art(-4.5, ['#0ea5e9', '#a7f3d0', '#fde68a']);
  art(1.2, ['#f472b6', '#fb923c', '#fde047']);
  art(11.8, ['#6366f1', '#22d3ee']);

  // Elevator at the right end with a glowing exit sign
  const elev = new THREE.Group();
  const steel = mat(0xb8c0c8, { metalness: 0.9, roughness: 0.25 });
  elev.add(box(0.06, 2.3, 0.72, steel, 0, 1.15, -0.37));
  elev.add(box(0.06, 2.3, 0.72, steel, 0, 1.15, 0.37));
  elev.add(box(0.1, 0.12, 1.7, mat(0x4b5563), 0.02, 2.36, 0));
  const btn = mat(0xffffff, { emissive: 0xffb020, emissiveIntensity: 2 });
  elev.add(box(0.03, 0.06, 0.06, btn, -0.03, 1.2, 1.0));
  elev.add(box(0.03, 0.06, 0.06, btn, -0.03, 1.1, 1.0));
  elev.position.set(halfLen - 0.08, 0, midZ);
  scene.add(elev);
  const exitMat = new THREE.MeshBasicMaterial({ map: signTexture('EXIT', '#0a7d3b', '#eaffea', 256, 96), toneMapped: false });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), exitMat);
  exit.position.set(halfLen - 0.07, 2.72, midZ);
  exit.rotation.y = -Math.PI / 2;
  scene.add(exit);

  // Sanitizer dispensers in the corridor
  for (const x of [-10.5, 2.1, 10.5]) {
    scene.add(box(0.12, 0.24, 0.1, mat(0xffffff), x, 1.4, z0 + 0.1));
    scene.add(box(0.07, 0.05, 0.08, mat(0x38bdf8), x, 1.3, z0 + 0.12));
  }

  // GTA-style mission marker at the Room 304 doorway
  const marker = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32, 1, true), beamMat);
  beam.position.y = 0.6;
  marker.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  marker.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 2.2;
  marker.add(arrow);
  const markerPos = new THREE.Vector3(3.2, 0, 4.9);
  marker.position.copy(markerPos);
  scene.add(marker);
  animated.push((t) => {
    arrow.position.y = 2.2 + Math.sin(t * 3) * 0.12;
    arrow.rotation.y = t * 2;
    beamMat.opacity = 0.25 + Math.sin(t * 4) * 0.08;
    ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
  });

  return {
    marker,
    markerPos,
    benchSeats,
    mapRects: [
      [-ROOM.w / 2, -ROOM.d / 2, ROOM.w / 2, ROOM.d / 2],
      [-halfLen, z0, halfLen, z1],
      [2.6, z0 - 0.1, 3.8, z0 + 0.1],
    ] as [number, number, number, number][],
    npcRoutes: [
      [new THREE.Vector3(-13, 0, 4.75), new THREE.Vector3(13, 0, 4.75)],
      [new THREE.Vector3(12, 0, 5.6), new THREE.Vector3(-4, 0, 5.6), new THREE.Vector3(-4, 0, 7.0), new THREE.Vector3(12, 0, 7.0)],
      [new THREE.Vector3(-14.5, 0, 5.4), new THREE.Vector3(-10.5, 0, 5.2), new THREE.Vector3(-10.5, 0, 7.4), new THREE.Vector3(-14.5, 0, 7.4)],
    ],
  };
}
