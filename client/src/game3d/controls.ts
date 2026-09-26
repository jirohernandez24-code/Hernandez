import * as THREE from 'three';

const RADIUS = 0.28;
const SPEED = 2.4;
const TURN_SPEED = 1.8;
const LOOK_SENS = 0.0045;
const TAP_SLOP = 8;

export class PlayerControls {
  readonly position = new THREE.Vector3(3.1, 1.62, 2.9);
  yaw = 0.55;
  pitch = -0.12;
  enabled = true;
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
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
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
          this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SENS, -1.2, 1.0);
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

  update(dt: number, camera: THREE.PerspectiveCamera, obstacles: THREE.Box3[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
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
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const dx = (-sin * fwd + cos * strafe) * SPEED * dt;
      const dz = (-cos * fwd - sin * strafe) * SPEED * dt;
      this.moveAxis(dx, 0, obstacles);
      this.moveAxis(0, dz, obstacles);
      this.position.x = THREE.MathUtils.clamp(this.position.x, bounds.minX, bounds.maxX);
      this.position.z = THREE.MathUtils.clamp(this.position.z, bounds.minZ, bounds.maxZ);
    }
    camera.position.copy(this.position);
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
