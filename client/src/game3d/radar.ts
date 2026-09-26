export interface Blip {
  x: number;
  z: number;
  color: string;
  kind: 'dot' | 'cross' | 'marker' | 'npc';
}

/** GTA-style circular radar that rotates with the camera. */
export class Radar {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private size = 180;
  private scale = 7; // px per meter

  constructor(private rects: [number, number, number, number][]) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  draw(px: number, pz: number, camYaw: number, heading: number, blips: Blip[]) {
    const { ctx, size, scale } = this;
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#26303a';
    ctx.fillRect(0, 0, size, size);

    // World → radar: translate to player, rotate so camera-forward is up
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(camYaw);
    ctx.scale(scale, scale);
    ctx.translate(-px, -pz);
    ctx.fillStyle = '#5b6b78';
    for (const [x0, z0, x1, z1] of this.rects) ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
    ctx.strokeStyle = '#9fb3c2';
    ctx.lineWidth = 0.12;
    for (const [x0, z0, x1, z1] of this.rects) if (x1 - x0 > 2) ctx.strokeRect(x0, z0, x1 - x0, z1 - z0);
    ctx.restore();

    // Blips (drawn upright, clamped to the rim like GTA)
    const cos = Math.cos(camYaw);
    const sin = Math.sin(camYaw);
    for (const b of blips) {
      const dx = (b.x - px) * scale;
      const dz = (b.z - pz) * scale;
      let rx = dx * cos - dz * sin;
      let ry = dx * sin + dz * cos;
      const r = Math.hypot(rx, ry);
      const max = c - 12;
      if (r > max) {
        if (b.kind !== 'marker' && b.kind !== 'cross') continue;
        rx *= max / r;
        ry *= max / r;
      }
      const x = c + rx;
      const y = c + ry;
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      if (b.kind === 'cross') {
        ctx.fillRect(x - 6, y - 2, 12, 4);
        ctx.fillRect(x - 2, y - 6, 4, 12);
        ctx.strokeRect(x - 6.5, y - 6.5, 13, 13);
      } else if (b.kind === 'marker') {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, b.kind === 'npc' ? 3 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Player arrow
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(camYaw - heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}
