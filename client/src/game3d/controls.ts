import * as THREE from 'three';

const RADIUS = 0.28;
const WALK = 2.1;
const RUN = 4.2;
const TURN_SPEED = 1.8;
const EYE = 1.62;
const CAM_DIST = 2.7;
const SHOULDER = 0.5;
const LOOK_SENS = 0.0045;
const TAP_SLOP = 8;

export type ViewMode = 'third' | 'first';

/** GTA-style controller: camera-relative movement, the character turns to face where it walks, over-the-shoulder camera. */
export class PlayerControls {
  /** Feet position (y = 0). */
  readonly position = new THREE.Vector3(-7, 0, 4.8);
  /** Camera yaw/pitch. */
  yaw = -Math.PI / 2;
  pitch = -0.22;
  /** Direction the character faces (world yaw, 0 = +z). */
  heading = Math.PI / 2;
  /** Current ground speed in m/s, for the walk animation. */
  speed = 0;
  mode: ViewMode = 'third';
  enabled = true;
  private camDist = CAM_DIST;
  private ray = new THREE.Raycaster();
  onTap: ((x: number, y: number) => void) | null = null;
  onHover: ((x: number, y: number) => void) | null = null;
  onInteractKey: (() => void) | null = null;

  private keys = new Set<string>();
  private joy = new THREE.Vector2();
  private drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private cleanup: (() => void)[] = [];

  constructor(private surface: HTMLElement, joystick: HTMLElement, knob: HTMLElement) {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };

    on(window, 'keydown', (e) => {
      if (!this.enabled || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'v') this.mode = this.mode === 'third' ? 'first' : 'third';
      if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault();
        this.onInteractKey?.();
      }
    });
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());

    // Look: drag anywhere on the 3D view. Tap/click without dragging = interact.
    on(surface, 'pointerdown', (e) => {
      if (!this.enabled || this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      surface.setPointerCapture(e.pointerId);
    });
    on(surface, 'pointermove', (e) => {
      if (this.drag && e.pointerId === this.drag.id) {
        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        if (Math.hypot(e.clientX - this.drag.sx, e.clientY - this.drag.sy) > TAP_SLOP) this.drag.moved = true;
        if (this.drag.moved) {
          this.yaw -= dx * LOOK_SENS;
          this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SENS, -1.1, 0.6);
        }
      } else if (e.pointerType === 'mouse') {
        this.onHover?.(e.clientX, e.clientY);
      }
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const tapped = !this.drag.moved;
      this.drag = null;
      if (tapped && this.enabled && e.type === 'pointerup') this.onTap?.(e.clientX, e.clientY);
    };
    on(surface, 'pointerup', end);
    on(surface, 'pointercancel', end);

    // Virtual joystick (touch devices)
    let joyId: number | null = null;
    const setJoy = (e: PointerEvent) => {
      const r = joystick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const max = r.width / 2;
      const v = new THREE.Vector2(e.clientX - cx, e.clientY - cy);
      if (v.length() > max) v.setLength(max);
      knob.style.transform = `translate(${v.x}px, ${v.y}px)`;
      this.joy.set(v.x / max, -v.y / max);
    };
    on(joystick, 'pointerdown', (e) => {
      e.stopPropagation();
      joyId = e.pointerId;
      joystick.setPointerCapture(e.pointerId);
      setJoy(e);
    });
    on(joystick, 'pointermove', (e) => {
      if (e.pointerId === joyId) setJoy(e);
    });
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      this.joy.set(0, 0);
      knob.style.transform = '';
    };
    on(joystick, 'pointerup', joyEnd);
    on(joystick, 'pointercancel', joyEnd);
  }

  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    obstacles: THREE.Box3[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    blockers: THREE.Object3D[],
  ) {
    let moving = false;
    if (this.enabled) {
      const k = this.keys;
      let fwd = this.joy.y;
      let strafe = this.joy.x;
      if (k.has('w') || k.has('arrowup')) fwd += 1;
      if (k.has('s') || k.has('arrowdown')) fwd -= 1;
      if (k.has('d')) strafe += 1;
      if (k.has('a')) strafe -= 1;
      if (k.has('arrowleft')) this.yaw += TURN_SPEED * dt;
      if (k.has('arrowright')) this.yaw -= TURN_SPEED * dt;

      const len = Math.hypot(fwd, strafe);
      if (len > 1) {
        fwd /= len;
        strafe /= len;
      }
      const running = k.has('shift') || this.joy.length() > 0.92;
      const target = Math.min(1, len) * (running ? RUN : WALK);
      this.speed += (target - this.speed) * Math.min(1, dt * 10);
      if (len > 0.05) {
        moving = true;
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        const mx = -sin * fwd + cos * strafe;
        const mz = -cos * fwd - sin * strafe;
        const ml = Math.hypot(mx, mz);
        this.moveAxis((mx / ml) * this.speed * dt, 0, obstacles);
        this.moveAxis(0, (mz / ml) * this.speed * dt, obstacles);
        if (this.mode === 'third') {
          const want = Math.atan2(mx, mz);
          let diff = want - this.heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          this.heading += diff * Math.min(1, dt * 12);
        }
      }
      this.position.x = THREE.MathUtils.clamp(this.position.x, bounds.minX, bounds.maxX);
      this.position.z = THREE.MathUtils.clamp(this.position.z, bounds.minZ, bounds.maxZ);
    }
    if (!moving) this.speed += (0 - this.speed) * Math.min(1, dt * 10);

    if (this.mode === 'first') {
      this.heading = this.yaw + Math.PI;
      camera.position.set(this.position.x, EYE, this.position.z);
      camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }

    // Over-the-shoulder chase camera with wall collision
    const pivot = new THREE.Vector3(this.position.x, 1.5, this.position.z);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    pivot.addScaledVector(right, SHOULDER);
    const back = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    let want = CAM_DIST;
    this.ray.set(pivot, back);
    this.ray.far = CAM_DIST + 0.3;
    const hit = this.ray.intersectObjects(blockers, false)[0];
    if (hit) want = Math.max(0.35, hit.distance - 0.25);
    // Snap in fast when blocked, ease out slowly (like GTA)
    this.camDist += (want - this.camDist) * Math.min(1, dt * (want < this.camDist ? 20 : 4));
    camera.position.copy(pivot).addScaledVector(back, this.camDist);
    camera.position.y = Math.min(camera.position.y, 2.85);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private moveAxis(dx: number, dz: number, obstacles: THREE.Box3[]) {
    const nx = this.position.x + dx;
    const nz = this.position.z + dz;
    for (const b of obstacles) {
      if (nx > b.min.x - RADIUS && nx < b.max.x + RADIUS && nz > b.min.z - RADIUS && nz < b.max.z + RADIUS) return;
    }
    this.position.x = nx;
    this.position.z = nz;
  }

  dispose() {
    this.cleanup.forEach((f) => f());
  }
}
