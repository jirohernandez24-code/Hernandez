/**
 * Adaptive soundtrack synthesized live with Web Audio (no audio files, no licensed tracks).
 *
 * A 16-step sequencer schedules notes slightly ahead of time. The mood picks the arrangement;
 * `intensity` (0..1, driven by patient severity) raises the tempo and brings in drums, a pulsing
 * bassline and a higher arpeggio, so the music tightens as the patient deteriorates.
 */

export type Mood = 'off' | 'menu' | 'explore' | 'tension' | 'code';

const A4 = 440;
const midi = (n: number) => A4 * Math.pow(2, (n - 69) / 12);

/** i–VI–III–VII in A minor (Am, F, C, G): root MIDI note + chord tones. */
const PROGRESSION = [
  { root: 45, tones: [57, 60, 64] }, // Am
  { root: 41, tones: [57, 60, 65] }, // F
  { root: 48, tones: [55, 60, 64] }, // C
  { root: 43, tones: [55, 59, 62] }, // G
];
/** A-minor pentatonic for melody fills. */
const PENTA = [69, 72, 74, 76, 79, 81];

export class Music {
  private ctx: AudioContext;
  private master: GainNode;
  private bus: GainNode;
  private reverb: ConvolverNode;
  private noise: AudioBuffer;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private mood: Mood = 'off';
  private intensity = 0;
  private smoothIntensity = 0;
  private drone: { stop(): void } | null = null;
  enabled = true;
  volume = 0.55;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.bus.connect(this.reverb).connect(wet).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  get bpm() {
    const i = this.smoothIntensity;
    switch (this.mood) {
      case 'menu':
        return 92;
      case 'explore':
        return 96;
      case 'tension':
        return 100 + i * 34;
      default:
        return 90;
    }
  }

  setMood(mood: Mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.drone?.stop();
    this.drone = null;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.enabled && mood !== 'off' ? this.volume : 0, now, 0.4);
    if (mood === 'code') this.drone = this.startDrone();
    if (mood !== 'off' && this.timer === null) {
      this.nextTime = now + 0.05;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on && this.mood !== 'off' ? this.volume : 0, now, 0.2);
  }

  /** Short major-key fanfare (patient stabilized). */
  stingWin() {
    const t = this.ctx.currentTime + 0.05;
    [69, 73, 76, 81, 85].forEach((n, i) => this.pluck(midi(n), t + i * 0.09, 0.9, 0.16, 'triangle'));
    this.pad([57, 61, 64, 69].map(midi), t + 0.4, 2.2, 0.08);
  }

  /** Falling minor phrase (mistake or code). */
  stingFail() {
    const t = this.ctx.currentTime + 0.02;
    [64, 63, 60, 57].forEach((n, i) => this.pluck(midi(n - 12), t + i * 0.16, 0.5, 0.14, 'sawtooth'));
  }

  // ------------------------------------------------------------ sequencer

  private schedule() {
    if (this.mood === 'off' || this.mood === 'code') return;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.smoothIntensity += (this.intensity - this.smoothIntensity) * 0.02;
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % 8;
    }
  }

  private playStep(s: number, t: number) {
    const chord = PROGRESSION[this.bar % 4];
    const i = this.mood === 'tension' ? this.smoothIntensity : 0;
    const beat = 60 / this.bpm;

    // Pad on every bar
    if (s === 0) this.pad(chord.tones.map(midi), t, beat * 4.1, this.mood === 'menu' ? 0.05 : 0.035);

    if (this.mood === 'menu') {
      // Dreamy synthwave: arpeggio, soft kick/snare, gated bass
      const arp = [...chord.tones, chord.tones[1] + 12];
      if (s % 2 === 0) this.pluck(midi(arp[(s / 2) % 4] + 12), t, 0.35, 0.045, 'square');
      if (s % 4 === 0) this.bass(midi(chord.root), t, beat * 0.9, 0.12);
      if (s === 0 || s === 8) this.kick(t, 0.5);
      if (s === 4 || s === 12) this.snare(t, 0.12);
      if (s % 2 === 1) this.hat(t, 0.025);
      return;
    }

    // explore / tension groove
    // Lo-fi bass: roots on the beat; with rising intensity it becomes a driving 8th/16th pulse
    const bassEvery = i > 0.66 ? 1 : i > 0.33 ? 2 : 4;
    if (s % bassEvery === 0) this.bass(midi(chord.root + (s === 10 && i < 0.33 ? 7 : 0)), t, beat * (bassEvery / 4) * 0.9, 0.1 + i * 0.05);
    // Hats: sparse when calm, 16ths under pressure
    if (i > 0.5 ? true : s % 2 === 1) this.hat(t, 0.02 + i * 0.02);
    // Kick: laid back when calm, four-on-the-floor in a crisis
    if (i > 0.4 ? s % 4 === 0 : s === 0 || s === 10) this.kick(t, 0.45 + i * 0.25);
    if (s === 4 || s === 12) this.snare(t, 0.08 + i * 0.06);
    // Melody: a gentle pentatonic motif; arpeggio climbs an octave when things get serious
    if (this.mood === 'explore' && (s === 0 || s === 6 || s === 10) && this.bar % 2 === 0) {
      this.pluck(midi(PENTA[(this.bar + s) % PENTA.length]), t, 0.6, 0.04, 'triangle');
    }
    if (this.mood === 'tension' && i > 0.2 && s % 2 === 0) {
      const arp = chord.tones;
      this.pluck(midi(arp[(s / 2) % 3] + (i > 0.6 ? 24 : 12)), t, 0.18, 0.03 + i * 0.02, 'sawtooth');
    }
    // Heartbeat-like low thump when critical
    if (this.mood === 'tension' && i > 0.75 && (s === 0 || s === 3)) this.kick(t, 0.35, 45);
  }

  // ------------------------------------------------------------ instruments

  private env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private pad(freqs: number[], t: number, dur: number, vol: number) {
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(this.bus);
    for (const fr of freqs) {
      for (const det of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private pluck(freq: number, t: number, dur: number, vol: number, type: OscillatorType) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3500, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    o.type = type;
    o.frequency.value = freq;
    this.env(g, t, vol, 0.005, dur);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bass(freq: number, t: number, dur: number, vol: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    f.Q.value = 4;
    o.type = 'sawtooth';
    o.frequency.value = freq;
    this.env(g, t, vol, 0.01, Math.max(0.08, dur));
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number, vol: number, endFreq = 40) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);
    this.env(g, t, vol, 0.003, 0.3);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.35);
  }

  private noiseHit(t: number, vol: number, dur: number, type: BiquadFilterType, freq: number, toBus = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.002, dur);
    src.connect(f).connect(g).connect(toBus ? this.bus : this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, vol: number) {
    this.noiseHit(t, vol, 0.18, 'bandpass', 1800);
  }

  private hat(t: number, vol: number) {
    this.noiseHit(t, vol, 0.05, 'highpass', 7000, false);
  }

  /** Dark sustained drone with a slow filter sweep (code blue). */
  private startDrone() {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(200, t);
    f.frequency.linearRampToValueAtTime(900, t + 4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 1.5);
    f.connect(g).connect(this.bus);
    const oscs = [33, 40, 45].map((n, k) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = k * 6;
      o.connect(f);
      o.start(t);
      return o;
    });
    return {
      stop: () => {
        const now = this.ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0.0001, now, 0.3);
        oscs.forEach((o) => o.stop(now + 1.5));
      },
    };
  }

  dispose() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.drone?.stop();
  }
}
