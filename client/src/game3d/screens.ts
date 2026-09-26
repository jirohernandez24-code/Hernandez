import * as THREE from 'three';
import type { Scenario, Vitals } from './types';

function ecgShape(p: number): number {
  const g = (c: number, w: number, a: number) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
  return g(0.12, 0.025, 0.12) + g(0.235, 0.008, -0.12) + g(0.25, 0.01, 1) + g(0.268, 0.009, -0.25) + g(0.48, 0.045, 0.25);
}

function plethShape(p: number): number {
  const g = (c: number, w: number, a: number) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
  return g(0.3, 0.08, 1) + g(0.55, 0.06, 0.35);
}

/** Bedside patient monitor rendered to a canvas texture. */
export class MonitorScreen {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private ecg: number[];
  private pleth: number[];
  private cursor = 0;
  private phase = 0;
  private blink = 0;
  /** Fires on each QRS so audio can beep in sync. */
  onBeat: (() => void) | null = null;

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 348;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.ecg = new Array(320).fill(0);
    this.pleth = new Array(320).fill(0);
  }

  update(dt: number, v: Vitals | null) {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.blink += dt;
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 15px monospace';
    ctx.fillText('BED 304  ·  ADULT', 10, 18);

    if (!v) {
      ctx.fillStyle = this.blink % 1.2 < 0.6 ? '#f59e0b' : '#78350f';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEADS OFF', W / 2, H / 2 - 10);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Apply leads & SpO₂ probe', W / 2, H / 2 + 24);
      ctx.textAlign = 'left';
      this.texture.needsUpdate = true;
      return;
    }

    // Advance waveforms
    const pxPerSec = 120;
    const steps = Math.max(1, Math.round(dt * pxPerSec));
    const beatHz = v.hr / 60;
    for (let i = 0; i < steps; i++) {
      const prev = this.phase;
      this.phase = (this.phase + beatHz / pxPerSec) % 1;
      if (prev < 0.25 && this.phase >= 0.25) this.onBeat?.();
      this.ecg[this.cursor] = ecgShape(this.phase);
      this.pleth[this.cursor] = plethShape((this.phase + 0.85) % 1) * Math.min(1, (v.spo2 - 60) / 35);
      this.cursor = (this.cursor + 1) % this.ecg.length;
    }

    const drawWave = (data: number[], y0: number, amp: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      let pen = false;
      for (let x = 0; x < data.length; x++) {
        const gap = (x - this.cursor + data.length) % data.length;
        if (gap < 14) {
          pen = false;
          continue;
        }
        const y = y0 - data[x] * amp;
        if (pen) ctx.lineTo(x + 8, y);
        else ctx.moveTo(x + 8, y);
        pen = true;
      }
      ctx.stroke();
    };
    ctx.fillStyle = '#22c55e';
    ctx.font = '12px monospace';
    ctx.fillText('II', 10, 46);
    drawWave(this.ecg, 115, 70, '#22c55e');
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('PLETH', 10, 170);
    drawWave(this.pleth, 225, 45, '#38bdf8');
    ctx.fillStyle = '#facc15';
    ctx.fillText('RESP', 10, 262);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < 320; x += 2) {
      const t = (x / pxPerSec) * (v.rr / 60) * Math.PI * 2 + this.blink * (v.rr / 60) * Math.PI * 2;
      const y = 300 - Math.sin(t) * 16;
      if (x === 0) ctx.moveTo(x + 8, y);
      else ctx.lineTo(x + 8, y);
    }
    ctx.stroke();

    // Numerics
    const alarm = (bad: boolean) => bad && this.blink % 1 < 0.5;
    const num = (label: string, value: string, unit: string, y: number, color: string, bad: boolean) => {
      if (alarm(bad)) {
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(338, y - 38, 168, 72);
      }
      ctx.fillStyle = color;
      ctx.font = '600 13px monospace';
      ctx.fillText(label, 346, y - 20);
      ctx.font = 'bold 40px monospace';
      ctx.fillText(value, 346, y + 20);
      ctx.font = '12px monospace';
      ctx.fillText(unit, 470, y - 20);
    };
    num('HR', String(v.hr), 'bpm', 70, '#22c55e', v.hr > 120 || v.hr < 50);
    num('SpO₂', String(v.spo2), '%', 150, '#38bdf8', v.spo2 < 90);
    num('NIBP', `${v.sbp}/${v.dbp}`, 'mmHg', 230, '#f472b6', v.sbp < 90 || v.sbp > 170);
    num('RR', String(v.rr), '/min', 305, '#facc15', v.rr > 28 || v.rr < 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px monospace';
    ctx.fillText(`T ${v.temp.toFixed(1)}°C`, 420, 18);
    this.texture.needsUpdate = true;
  }
}

export function drawPump(canvas: HTMLCanvasElement, texture: THREE.Texture, label: string, running: boolean, t: number) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = running ? '#052e16' : '#450a0a';
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = running ? '#4ade80' : t % 1 < 0.5 ? '#f87171' : '#7f1d1d';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(running ? 'INFUSING' : 'STOPPED', 8, 22);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(label.slice(0, 16), 8, 46);
  ctx.fillText(label.slice(16, 32), 8, 62);
  if (running) {
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(8, 76, ((t * 30) % 112) | 0, 8);
  }
  texture.needsUpdate = true;
}

export function drawWhiteboard(canvas: HTMLCanvasElement, texture: THREE.Texture, s: Scenario) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fbfdff';
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 30px "Comic Sans MS", system-ui';
  ctx.fillText('Welcome to Room ' + s.patient.room, 24, 46);
  ctx.fillStyle = '#111827';
  ctx.font = '22px "Comic Sans MS", system-ui';
  const lines = [
    `Patient: ${s.patient.name}`,
    `Your nurse today: YOU ♥`,
    `Allergies: ${s.patient.allergies}`,
    `Fall risk: HIGH · Call, don't fall!`,
    `Goal: comfort & safety`,
  ];
  lines.forEach((l, i) => ctx.fillText(l, 24, 94 + i * 42));
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 152, 484, 36);
  texture.needsUpdate = true;
}
