/** Tiny WebAudio synth for monitor beeps and alarms (no audio files needed). */
export class MonitorAudio {
  private ctx: AudioContext | null = null;
  muted = false;
  private alarmCooldown = 0;

  /** Must be called from a user gesture on some browsers. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, gain = 0.06, type: OscillatorType = 'sine', delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Pulse-ox beep: pitch drops as saturation falls, like a real monitor. */
  beat(spo2: number) {
    const f = 440 + Math.max(0, Math.min(40, spo2 - 60)) * 11;
    this.tone(f, 0.09, 0.05, 'sine');
  }

  /** High-priority alarm tone, rate limited. */
  alarm(dt: number, active: boolean) {
    this.alarmCooldown -= dt;
    if (!active || this.alarmCooldown > 0) return;
    this.alarmCooldown = 2.6;
    for (let i = 0; i < 3; i++) this.tone(988, 0.14, 0.05, 'square', i * 0.18);
  }

  good() {
    this.tone(660, 0.12, 0.06, 'triangle');
    this.tone(880, 0.16, 0.06, 'triangle', 0.1);
  }

  bad() {
    this.tone(220, 0.25, 0.07, 'sawtooth');
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
