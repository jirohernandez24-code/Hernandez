import * as THREE from 'three';

export interface AvatarLook {
  skin: number;
  top: number;
  pants: number;
  hair: number;
  shoes?: number;
  /** Long white coat (doctor). */
  coat?: boolean;
  bun?: boolean;
  stethoscope?: boolean;
  scale?: number;
}

export interface Avatar {
  group: THREE.Group;
  /** Advance the walk cycle. `speed` is ground speed in m/s (0 = idle). */
  animate(dt: number, speed: number): void;
  /** Sit on a chair (static pose). */
  sit(): void;
}

function std(color: number, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function capsule(r: number, len: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
  mesh.castShadow = true;
  return mesh;
}

function ball(r: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  mesh.castShadow = true;
  return mesh;
}

/** Builds a stylized low-poly person out of primitives, rigged with simple pivots for a procedural walk cycle. */
export function createAvatar(look: AvatarLook): Avatar {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const skin = std(look.skin, 0.6);
  const top = std(look.top, 0.85);
  const pants = std(look.pants, 0.85);
  const hairMat = std(look.hair, 0.55);
  const shoeMat = std(look.shoes ?? 0xf1f5f9, 0.5);

  // Legs: hip pivot → thigh → knee pivot → shin → shoe
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.92, 0);
    const thigh = capsule(0.078, 0.34, pants);
    thigh.position.y = -0.22;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    const shin = capsule(0.064, 0.32, pants);
    shin.position.y = -0.2;
    knee.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.24), shoeMat);
    shoe.position.set(0, -0.42, 0.05);
    shoe.castShadow = true;
    knee.add(shoe);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }

  // Torso
  const pelvis = capsule(0.15, 0.08, pants);
  pelvis.position.y = 0.95;
  pelvis.scale.set(1.15, 1, 0.8);
  body.add(pelvis);
  const torso = capsule(0.17, 0.3, top);
  torso.position.y = 1.26;
  torso.scale.set(1.12, 1, 0.72);
  body.add(torso);
  // V-neck detail + chest pocket + ID badge
  const vneck = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3), skin);
  vneck.rotation.x = Math.PI;
  vneck.position.set(0, 1.47, 0.105);
  vneck.scale.z = 0.3;
  body.add(vneck);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.01), std(0xffffff, 0.3));
  badge.position.set(0.09, 1.33, 0.125);
  body.add(badge);
  const badgeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.015, 0.012), std(0x2563eb, 0.3));
  badgeStripe.position.set(0.09, 1.36, 0.126);
  body.add(badgeStripe);

  if (look.coat) {
    const coatMat = std(0xf8fafc, 0.8);
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.75, 16, 1, true, 0.35, Math.PI * 2 - 0.7), coatMat);
    coat.material.side = THREE.DoubleSide;
    coat.position.y = 1.05;
    coat.scale.z = 0.75;
    coat.castShadow = true;
    body.add(coat);
    const coatTop = capsule(0.175, 0.3, coatMat);
    coatTop.position.y = 1.27;
    coatTop.scale.set(1.15, 1, 0.76);
    body.add(coatTop);
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.02), top);
    shirt.position.set(0, 1.3, 0.13);
    body.add(shirt);
  }

  if (look.stethoscope) {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 24, Math.PI * 1.25), std(0x1f2937, 0.4));
    tube.position.set(0, 1.43, 0.02);
    tube.rotation.set(Math.PI / 2 - 0.35, 0, -Math.PI * 0.125 - Math.PI / 2);
    body.add(tube);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 16), std(0xcbd5e1, 0.2));
    bell.material.metalness = 0.9;
    bell.rotation.x = Math.PI / 2;
    bell.position.set(-0.08, 1.26, 0.13);
    body.add(bell);
  }

  // Arms: shoulder pivot → upper arm (sleeve) → elbow pivot → forearm (skin) → hand
  const arms: { shoulder: THREE.Group; elbow: THREE.Group }[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.225, 1.45, 0);
    const upper = capsule(0.056, 0.2, look.coat ? std(0xf8fafc, 0.8) : top);
    upper.position.y = -0.14;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = capsule(0.045, 0.2, look.coat ? std(0xf8fafc, 0.8) : skin);
    fore.position.y = -0.13;
    elbow.add(fore);
    const hand = ball(0.05, skin);
    hand.position.y = -0.29;
    hand.scale.set(0.8, 1.1, 0.6);
    elbow.add(hand);
    shoulder.add(elbow);
    shoulder.rotation.z = side * 0.08;
    body.add(shoulder);
    arms.push({ shoulder, elbow });
  }

  // Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), skin);
  neck.position.y = 1.55;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 1.68;
  body.add(head);
  const skull = ball(0.112, skin);
  skull.scale.set(0.92, 1.05, 1);
  head.add(skull);
  const hairCap = ball(0.118, hairMat);
  hairCap.scale.set(0.97, 0.95, 1.02);
  hairCap.position.set(0, 0.025, -0.018);
  head.add(hairCap);
  if (look.bun) {
    const bun = ball(0.055, hairMat);
    bun.position.set(0, 0.07, -0.11);
    head.add(bun);
  }
  const dark = std(0x111111, 0.3);
  for (const side of [-1, 1]) {
    const eye = ball(0.013, dark);
    eye.position.set(side * 0.038, 0.012, 0.1);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.01), hairMat);
    brow.position.set(side * 0.038, 0.042, 0.104);
    head.add(brow);
    const ear = ball(0.022, skin);
    ear.position.set(side * 0.105, 0, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  }
  const nose = ball(0.017, skin);
  nose.position.set(0, -0.012, 0.112);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), std(0x9a4b45, 0.5));
  mouth.position.set(0, -0.05, 0.1);
  head.add(mouth);

  const s = look.scale ?? 1;
  group.scale.setScalar(s);

  let phase = Math.random() * 10;
  let blend = 0;
  let sitting = false;

  return {
    group,
    sit() {
      sitting = true;
      for (const { hip, knee } of legs) {
        hip.rotation.x = -Math.PI / 2;
        knee.rotation.x = Math.PI / 2;
      }
      body.position.y = -0.45;
      for (const { shoulder, elbow } of arms) {
        shoulder.rotation.x = -0.3;
        elbow.rotation.x = -0.9;
      }
    },
    animate(dt, speed) {
      if (sitting) {
        head.rotation.y = Math.sin(phase * 0.2) * 0.3;
        phase += dt;
        return;
      }
      const target = Math.min(1, speed / 2.2);
      blend += (target - blend) * Math.min(1, dt * 8);
      phase += dt * (3 + speed * 2.6);
      const sw = Math.sin(phase);
      const run = Math.max(0, (speed - 2.6) / 2);
      const amp = 0.55 * blend + 0.25 * run;
      legs[0].hip.rotation.x = sw * amp;
      legs[1].hip.rotation.x = -sw * amp;
      legs[0].knee.rotation.x = Math.max(0, -Math.cos(phase)) * amp * 1.4;
      legs[1].knee.rotation.x = Math.max(0, Math.cos(phase)) * amp * 1.4;
      arms[0].shoulder.rotation.x = -sw * amp * 0.8;
      arms[1].shoulder.rotation.x = sw * amp * 0.8;
      arms[0].elbow.rotation.x = -0.25 - blend * 0.35 - run * 0.6;
      arms[1].elbow.rotation.x = -0.25 - blend * 0.35 - run * 0.6;
      body.position.y = Math.abs(Math.cos(phase)) * 0.035 * blend;
      body.rotation.x = run * 0.12;
      // idle breathing
      torso.scale.y = 1 + Math.sin(phase * 0.35) * 0.012 * (1 - blend);
    },
  };
}

export const LOOKS = {
  player: { skin: 0xb88a70, top: 0x1f8a8a, pants: 0x1f8a8a, hair: 0x1c130e, bun: true, stethoscope: true, shoes: 0xffffff },
  nurse2: { skin: 0x8d5a3b, top: 0x1e3a8a, pants: 0x1e3a8a, hair: 0x0f0a07, bun: false, shoes: 0x111827 },
  doctor: { skin: 0xe6b894, top: 0x6b7f99, pants: 0x334155, hair: 0x6b4f33, coat: true, stethoscope: true, shoes: 0x3f2d20 },
  aide: { skin: 0xd9a47e, top: 0x7c3aed, pants: 0x7c3aed, hair: 0x2b1b12, bun: true, shoes: 0xe5e7eb },
  visitor: { skin: 0xb07a55, top: 0xb45309, pants: 0x1f2937, hair: 0x3a3a3a, shoes: 0x1f2937 },
} satisfies Record<string, AvatarLook>;
