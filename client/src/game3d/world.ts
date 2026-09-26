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
  dispose(): void;
}

const ROOM = { w: 10, d: 8, h: 3 };

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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d0, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(-6, 6, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  scene.add(sun);
  for (const [x, z] of [[0, -2], [0, 2], [-3, 0], [3, 0]]) {
    const p = new THREE.PointLight(0xffffff, 6, 7, 1.6);
    p.position.set(x, ROOM.h - 0.2, z);
    scene.add(p);
  }

  // ---------- Room shell ----------
  const floorTex = canvasTexture(256, 256, (ctx) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#d6dde3' : '#c9d2da';
        ctx.fillRect(i * 64, j * 64, 64, 64);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(i * 64 + 6, j * 64 + 6, 20, 3);
      }
  }).texture;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(5, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xffffff, { map: floorTex, roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xf5f7fa));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  scene.add(ceiling);
  for (const [x, z] of [[0, -2], [0, 2], [-3, 0], [3, 0]]) {
    scene.add(box(1.2, 0.03, 0.6, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), x, ROOM.h - 0.02, z));
  }

  const wallMat = mat(0xe8eef3);
  const accentMat = mat(0x7fb3c8);
  const walls: [number, number, number, number, number][] = [
    // w, d, x, z, rotY
    [ROOM.w, 0.1, 0, -ROOM.d / 2, 0],
    [ROOM.w, 0.1, 0, ROOM.d / 2, 0],
    [0.1, ROOM.d, -ROOM.w / 2, 0, 0],
    [0.1, ROOM.d, ROOM.w / 2, 0, 0],
  ];
  for (const [w, d, x, z] of walls) {
    scene.add(box(w, ROOM.h, d, wallMat, x, ROOM.h / 2, z));
    // accent stripe + baseboard
    scene.add(box(w + 0.01, 0.12, d + 0.01, accentMat, x, 1.0, z));
    scene.add(box(w + 0.02, 0.1, d + 0.02, mat(0x5b6b7a), x, 0.05, z));
  }

  // Window with sky (left wall)
  const sky = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#6fa8dc');
    g.addColorStop(0.7, '#cfe6f7');
    g.addColorStop(1, '#9fc59a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, r] of [[60, 60, 22], [85, 55, 28], [110, 62, 20], [180, 100, 18], [200, 95, 24]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7c9a74';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 34, 200 - (i % 3) * 22, 26, 80);
  }).texture;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ map: sky }));
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
  const door = new THREE.Group();
  door.add(box(1.1, 2.2, 0.06, mat(0xa47b52), 0, 1.1, 0));
  door.add(box(1.25, 0.08, 0.1, mat(0xffffff), 0, 2.24, 0));
  door.add(box(0.04, 0.04, 0.12, mat(0xcccccc, { metalness: 0.9 }), -0.42, 1.05, -0.05));
  const sign = canvasTexture(256, 96, (ctx) => {
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT · 304', 128, 62);
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: sign.texture }));
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
    bounds: { minX: -ROOM.w / 2 + 0.35, maxX: ROOM.w / 2 - 0.35, minZ: -ROOM.d / 2 + 0.35, maxZ: ROOM.d / 2 - 0.35 },
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
