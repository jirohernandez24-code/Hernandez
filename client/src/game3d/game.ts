import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ACTIONS_BY_ID, REPEATABLE, STATION_NAMES, actionsForStation } from './actions';
import { MonitorAudio } from './audio';
import { LOOKS, createAvatar, type Avatar } from './avatar';
import { PlayerControls } from './controls';
import { Music, type Mood } from './music';
import { PostFX } from './post';
import { Radar, type Blip } from './radar';
import { SimulationEngine, type ActionResult } from './engine';
import { SCENARIOS } from './scenarios';
import { MonitorScreen, drawPump, drawWhiteboard } from './screens';
import { GAME_CSS } from './styles';
import type { Scenario, StationId } from './types';
import { buildWorld, type World } from './world';

const REACH = 1.5;
const STYLE_ID = 'w3d-styles';
const FONT_ID = 'w3d-fonts';

interface Npc {
  avatar: Avatar;
  route: THREE.Vector3[];
  idx: number;
  wait: number;
}

/** Room 304 footprint: stations inside are only usable from inside the room. */
const inRoom = (p: THREE.Vector3) => p.z < 3.95 && Math.abs(p.x) < 5;

type Screen = 'menu' | 'briefing' | 'playing' | 'debrief';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const SKIN = {
  base: new THREE.Color(0xc99a78),
  pale: new THREE.Color(0xd8d0c8),
  cyanotic: new THREE.Color(0x9aa3b8),
  flushed: new THREE.Color(0xe07b6a),
};
const LIPS = { base: new THREE.Color(0xb56b62), blue: new THREE.Color(0x6b6f9e) };

const IV_LABEL: Record<string, string> = {
  hypoglycemia: 'NS 0.9%  75 mL/hr',
  'pulmonary-edema': 'NS 0.9% 125 mL/hr',
  anaphylaxis: 'CEFTRIAXONE 1 g  IVPB',
};

export class WardGame {
  private root: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private controls: PlayerControls;
  private monitor = new MonitorScreen();
  private audio = new MonitorAudio();
  private raycaster = new THREE.Raycaster();
  private highlight: THREE.Box3Helper;
  private clock = new THREE.Clock();
  private raf = 0;
  private resizeObs: ResizeObserver;

  private screen: Screen = 'menu';
  private briefingScenario: Scenario | null = null;
  private finishArmed = false;
  private engine: SimulationEngine | null = null;
  private paused = false;
  private menuStation: StationId | null = null;
  private target: { station: StationId; dist: number } | null = null;
  private aim = new THREE.Vector2(0, 0);
  private mouseAimAt = 0;
  private hobAngle = 0.5;
  private legAngle = 0;
  private ivRunning = true;
  private ivLabel = '';
  private codeShownAt = 0;
  private t = 0;
  private post: PostFX;
  private radar: Radar;
  private player: Avatar;
  private npcs: Npc[] = [];
  /** Mission phase: walk to the room first, then the clock starts. */
  private entered = false;
  private stars = 0;
  private bannerTimer = 0;
  private hq = true;
  private music: Music | null = null;
  private musicOn = true;
  private showLabels = true;

  private el: Record<string, HTMLElement> = {};

  constructor(private container: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = GAME_CSS;
      document.head.appendChild(style);
    }
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement('link');
      link.id = FONT_ID;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&display=swap';
      document.head.appendChild(link);
    }

    this.root = document.createElement('div');
    this.root.className = 'w3d';
    this.root.innerHTML = `
      <div class="w3d-hud" data-el="hud" style="display:none">
        <div class="w3d-crosshair" data-el="crosshair"></div>
        <div class="w3d-vitals" data-el="vitals"></div>
        <div class="w3d-help-col">
          <div class="w3d-help" data-el="prompt"></div>
          <div class="w3d-toasts" data-el="toasts"></div>
        </div>
        <div class="w3d-stats">
          <div class="w3d-time" data-el="clock">00:00</div>
          <div class="w3d-money" data-el="score">PTS 0</div>
          <div class="w3d-stars" data-el="stars" title="Patient acuity"></div>
          <div class="w3d-tools">
            <button data-act="hint" title="Get a hint (−3 pts)">HINT</button>
            <button data-act="view" title="Switch camera (V)">CAM</button>
            <button data-act="labels" title="Toggle labels">TAGS</button>
            <button data-act="quality" data-el="qualityBtn" title="Graphics quality">HQ</button>
            <button data-act="music" data-el="musicBtn" title="Toggle music">MUSIC</button>
            <button data-act="sound" data-el="soundBtn" title="Toggle all sound">SND</button>
            <button data-act="pause" title="Pause (Esc)">II</button>
          </div>
        </div>
        <div class="w3d-radar-wrap">
          <div class="w3d-patient" data-el="patient"></div>
          <div data-el="radarHost"></div>
          <div class="w3d-bars">
            <div class="w3d-bar cond"><div data-el="condBar"></div></div>
            <div class="w3d-bar prio"><div data-el="prioBar"></div></div>
          </div>
        </div>
        <div class="w3d-subtitle" data-el="subtitle"></div>
        <div class="w3d-joystick" data-el="joy"><div data-el="knob"></div></div>
        <button class="w3d-use" data-act="use">USE</button>
        <button class="w3d-run" data-act="view">CAM</button>
      </div>
      <div class="w3d-banner" data-el="banner"></div>
      <div data-el="overlay"></div>
    `;
    container.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((n) => (this.el[n.dataset.el!] = n));

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.prepend(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
    this.world = buildWorld(STATION_NAMES);
    // Image-based lighting gives metals, glass and the glossy floor real reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.world.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.world.scene.environmentIntensity = 0.25;
    pmrem.dispose();
    this.post = new PostFX(this.renderer, this.world.scene, this.camera);
    this.radar = new Radar(this.world.mapRects);
    this.el.radarHost.appendChild(this.radar.canvas);
    this.radar.canvas.className = 'w3d-radar';

    this.player = createAvatar(LOOKS.player);
    this.world.scene.add(this.player.group);
    const routes = this.world.npcRoutes;
    for (const [look, route] of [[LOOKS.nurse2, routes[0]], [LOOKS.doctor, routes[1]], [LOOKS.aide, routes[2]]] as const) {
      const avatar = createAvatar(look);
      avatar.group.position.copy(route[0]);
      this.world.scene.add(avatar.group);
      this.npcs.push({ avatar, route, idx: 1, wait: Math.random() * 2 });
    }
    const visitor = createAvatar(LOOKS.visitor);
    visitor.group.position.copy(this.world.benchSeats[1]);
    visitor.group.position.z -= 0.1;
    visitor.group.rotation.y = Math.PI;
    visitor.sit();
    this.world.scene.add(visitor.group);
    this.npcs.push({ avatar: visitor, route: [], idx: 0, wait: 0 });
    (this.world.monitorScreen.material as THREE.MeshBasicMaterial).map = this.monitor.texture;
    this.monitor.onBeat = () => {
      if (this.engine?.monitorAttached && this.screen === 'playing') this.audio.beat(this.engine.vitals.spo2);
    };
    this.highlight = new THREE.Box3Helper(new THREE.Box3(), 0xf5c518);
    this.highlight.visible = false;
    this.world.scene.add(this.highlight);

    this.controls = new PlayerControls(this.renderer.domElement, this.el.joy, this.el.knob);
    this.controls.onHover = (x, y) => {
      this.setAimFromClient(x, y);
      this.mouseAimAt = performance.now();
    };
    this.controls.onTap = (x, y) => {
      this.audio.unlock();
      this.setAimFromClient(x, y);
      this.mouseAimAt = performance.now();
      const hit = this.pick(this.aim);
      if (hit) this.tryInteract(hit.station, hit.dist);
    };
    this.controls.onInteractKey = () => {
      if (this.screen !== 'playing' || this.menuStation || this.paused) return;
      this.audio.unlock();
      this.useNearest();
    };

    this.audio.onContext = (ctx) => {
      this.music = new Music(ctx);
      this.music.setEnabled(this.musicOn && !this.audio.muted);
    };
    // Browsers only allow audio after a user gesture: start the soundtrack on the first touch or click
    this.root.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    window.addEventListener('keydown', this.unlockAudio, { once: true });

    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (btn) this.onButton(btn.dataset.act!, btn.dataset.arg);
    });
    window.addEventListener('keydown', this.onKey);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    this.showMenu();
    this.loop();
  }

  // ---------------------------------------------------------------- screens

  private setOverlay(html: string, clear = false) {
    this.el.overlay.className = html ? `w3d-overlay${clear ? ' clear' : ''}` : '';
    this.el.overlay.innerHTML = html;
  }

  private showMenu() {
    this.screen = 'menu';
    this.engine = null;
    this.el.hud.style.display = 'none';
    this.post.set({ gray: 0, danger: 0 });
    this.controls.enabled = false;
    this.world.marker.visible = true;
    const cards = SCENARIOS.map(
      (s, i) => `<button class="w3d-scn" data-act="pick" data-arg="${s.id}">
        <span class="w3d-scn-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="w3d-scn-body"><b>${esc(s.title)}</b><span>${esc(s.subtitle)}</span></span>
        <span class="w3d-tag ${s.difficulty}">${s.difficulty}</span></button>`,
    ).join('');
    this.setOverlay(`
      <div class="w3d-menu">
        <div class="w3d-logo">NURSE<span>SIM</span></div>
        <div class="w3d-logo-sub">Ward Stories · Night shift at St. Vera General</div>
        <button class="w3d-btn secondary w3d-music-toggle" data-act="music" data-el="menuMusic">${this.musicOn ? '♪ Music: on' : '♪ Music: off'}</button>
        <h4>Missions</h4>
        <div class="w3d-scenarios">${cards}</div>
        <h4>Controls</h4>
        <div class="w3d-controls">
          <span><kbd>W A S D</kbd></span><span>Walk (hold <kbd>Shift</kbd> to run)</span>
          <span><kbd>Drag</kbd> / <kbd>← →</kbd></span><span>Rotate the camera</span>
          <span><kbd>E</kbd> / <kbd>USE</kbd></span><span>Use the nearest equipment or talk to the patient</span>
          <span><kbd>V</kbd> / <kbd>CAM</kbd></span><span>Switch third-person / first-person</span>
          <span><kbd>Esc</kbd></span><span>Pause</span>
        </div>
        <p class="w3d-muted">Priority interventions score the most. Unsafe actions cost points. Hand hygiene, two identifiers and the rights of medication administration always count.</p>
      </div>`);
  }

  private showBriefing(s: Scenario) {
    this.briefingScenario = s;
    this.screen = 'briefing';
    this.controls.enabled = false;
    const p = s.patient;
    this.setOverlay(`
      <div class="w3d-panel">
        <span class="w3d-tag ${s.difficulty}">${s.difficulty}</span>
        <div class="w3d-mission-title">${esc(s.title)}</div>
        <h2>Shift handoff</h2>
        <div class="w3d-chart">
          <table>
            <tr><td>Patient</td><td><b>${esc(p.name)}</b>, ${p.age} ${p.sex} · DOB ${p.dob} · ${p.mrn}</td></tr>
            <tr><td>Diagnosis</td><td>${esc(p.diagnosis)}</td></tr>
            <tr><td>Allergies</td><td style="color:#b91c1c;font-weight:600">${esc(p.allergies)}</td></tr>
            <tr><td>History</td><td>${p.history.map(esc).join(' · ')}</td></tr>
          </table>
        </div>
        <h4>Handoff report</h4>
        <p>${esc(p.handoff)}</p>
        <p class="w3d-muted">You start at the nurses' station. Follow the yellow marker to Room ${p.room}. The patient's clock starts when you walk in. Orders and protocols are on the charting computer inside.</p>
        <div class="w3d-row">
          <button class="w3d-btn" data-act="start">Start mission</button>
          <button class="w3d-btn secondary" data-act="menu">Back</button>
        </div>
      </div>`);
  }

  private startScenario(s: Scenario) {
    this.engine = new SimulationEngine(s);
    this.screen = 'playing';
    this.paused = false;
    this.menuStation = null;
    this.hobAngle = 0.5;
    this.legAngle = 0;
    this.ivRunning = true;
    this.ivLabel = IV_LABEL[s.id] ?? 'NS 0.9%  75 mL/hr';
    this.codeShownAt = 0;
    this.controls.position.set(-7.4, 0, 4.8);
    this.controls.yaw = -Math.PI / 2;
    this.controls.pitch = -0.22;
    this.controls.heading = Math.PI / 2;
    this.controls.enabled = true;
    this.entered = false;
    this.stars = 0;
    this.world.marker.visible = true;
    this.post.set({ gray: 0, danger: 0 });
    this.el.toasts.innerHTML = '';
    this.el.hud.style.display = '';
    const ivMat = this.world.ivBag.material as THREE.MeshStandardMaterial;
    ivMat.color.set(s.id === 'anaphylaxis' ? 0xfff3c4 : 0xeaf6ff);
    this.world.patient.juice.visible = true;
    drawWhiteboard(this.world.whiteboard.canvas, this.world.whiteboard.texture, s);
    this.setOverlay('');
    this.audio.unlock();
    const p = s.patient;
    this.el.patient.innerHTML = `
      <b>${esc(p.name)}</b> · ${p.age}${p.sex} · Rm ${p.room}
      <div class="allergy">ALLERGY: ${esc(p.allergies)}</div>
      <span class="w3d-cond" data-el="cond"></span>`;
    this.el.cond = this.el.patient.querySelector('[data-el=cond]')!;
    this.subtitle(`Go to <em>Room ${p.room}</em>. Your patient ${esc(p.name.split(' ')[0])} needs you.`);
  }

  private showDebrief() {
    const eng = this.engine!;
    if (eng.status !== 'coded') eng.status = 'finished';
    this.screen = 'debrief';
    this.menuStation = null;
    this.controls.enabled = false;
    this.el.hud.style.display = 'none';
    this.hideBanner();
    const r = eng.summary();
    const s = eng.scenario;
    const timeline = r.log
      .map((l) => {
        const p = l.points ? `<span class="p ${l.points > 0 ? 'pos' : 'neg'}">${l.points > 0 ? '+' : ''}${l.points}</span>` : '';
        const icon = l.kind === 'harmful' ? '✖' : l.kind === 'critical' ? '★' : l.kind === 'good' ? '✔' : l.kind === 'info' ? 'ℹ' : '•';
        return `<li><span class="t">${fmtTime(l.time)}</span>${icon} <b>${esc(l.label)}</b>${p}
          <div class="why">${esc(l.feedback)}${l.rationale ? `<br><i>Why: ${esc(l.rationale)}</i>` : ''}</div></li>`;
      })
      .join('');
    const missed = r.missed.length
      ? `<h4>Missed priority interventions</h4><div class="w3d-missed"><ul>${r.missed.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>`
      : '';
    const headline = r.coded
      ? 'The patient coded. Review the priorities below and try again.'
      : r.missed.length
        ? 'The patient survived your shift, but key interventions were missed.'
        : 'Excellent work. You recognized the problem and stabilized your patient.';
    this.setOverlay(`
      <div class="w3d-panel">
        <div class="w3d-mission-title ${r.coded || r.missed.length ? 'fail' : ''}">${r.coded ? 'Mission failed' : r.missed.length ? 'Mission incomplete' : 'Mission passed'}</div>
        <h2>Debrief: ${esc(s.title)}</h2>
        <p class="w3d-muted">${headline}</p>
        <div class="w3d-scoreline">
          <span class="w3d-grade ${r.grade}">${r.grade}</span>
          <div>Score<b>${r.total}</b></div>
          <div>Performance<b>${r.pct}%</b></div>
          <div>Time<b>${fmtTime(r.time)}</b></div>
          ${r.bonus ? `<div>Speed bonus<b>+${r.bonus}</b></div>` : ''}
        </div>
        ${missed}
        <h4>Clinical pearls (NCLEX-style)</h4>
        <ul>${s.debriefPearls.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <h4>Your timeline</h4>
        <ul class="w3d-timeline">${timeline || '<li>No actions taken.</li>'}</ul>
        <div class="w3d-row">
          <button class="w3d-btn" data-act="retry">↻ Retry scenario</button>
          <button class="w3d-btn secondary" data-act="menu">Choose another scenario</button>
        </div>
      </div>`);
  }

  private showPause() {
    this.paused = true;
    this.controls.enabled = false;
    this.setOverlay(`
      <div class="w3d-panel narrow">
        <h2>Paused</h2>
        <p class="w3d-muted">The patient's condition is frozen while paused.</p>
        <div class="w3d-row">
          <button class="w3d-btn" data-act="resume">Resume</button>
          <button class="w3d-btn secondary" data-act="chart">View chart</button>
          <button class="w3d-btn danger" data-act="quit">Quit to menu</button>
        </div>
      </div>`);
  }

  private showChart() {
    const s = this.engine!.scenario;
    const p = s.patient;
    this.paused = true;
    this.controls.enabled = false;
    this.menuStation = null;
    this.setOverlay(`
      <div class="w3d-panel w3d-chart">
        <h2>EHR: ${esc(p.name)}</h2>
        <table>
          <tr><td>Identifiers</td><td>${esc(p.name)} · DOB ${p.dob} · ${p.mrn}</td></tr>
          <tr><td>Diagnosis</td><td>${esc(p.diagnosis)}</td></tr>
          <tr><td>Allergies</td><td style="color:#b91c1c;font-weight:600">${esc(p.allergies)}</td></tr>
          <tr><td>History</td><td>${p.history.map(esc).join('<br>')}</td></tr>
          <tr><td>Active orders</td><td><ul style="margin:0;padding-left:18px">${p.orders.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></td></tr>
          <tr><td>Handoff</td><td>${esc(p.handoff)}</td></tr>
        </table>
        <p class="w3d-muted">Clock paused while you read the chart.</p>
        <div class="w3d-row"><button class="w3d-btn" data-act="resume">Back to patient</button></div>
      </div>`);
  }

  private openStation(station: StationId) {
    this.finishArmed = false;
    this.hideBanner();
    this.menuStation = station;
    this.controls.enabled = false;
    this.renderStationMenu(null);
  }

  private renderStationMenu(result: ActionResult | null) {
    const station = this.menuStation;
    const eng = this.engine;
    if (!station || !eng) return;
    const buttons = actionsForStation(station)
      .map((a) => {
        const done = eng.done.has(a.id) && !REPEATABLE.has(a.id);
        return `<button class="w3d-action" data-act="do" data-arg="${a.id}" ${done ? 'disabled' : ''}>${esc(a.label)}${done ? '<span class="done">✓ done</span>' : ''}</button>`;
      })
      .join('');
    const res = result
      ? `<div class="w3d-result ${result.kind}"><b>${esc(result.label)}</b>${result.points ? ` <b style="float:right">${result.points > 0 ? '+' : ''}${result.points}</b>` : ''}<br>${esc(result.feedback)}</div>`
      : '';
    this.setOverlay(
      `<div class="w3d-interact">
        <div class="w3d-interact-head">${esc(STATION_NAMES[station])}</div>
        <div class="w3d-interact-sub">Interaction menu · the patient keeps changing while you decide</div>
        <div class="w3d-actions">${buttons}</div>
        ${res}
        <button class="w3d-action back" data-act="close">Back (Esc)</button>
      </div>`,
      true,
    );
  }

  private closeMenus() {
    this.menuStation = null;
    this.paused = false;
    this.setOverlay('');
    if (this.screen === 'playing') this.controls.enabled = true;
  }

  // ---------------------------------------------------------------- input

  private unlockAudio = () => this.audio.unlock();

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this.screen !== 'playing') return;
    if (this.menuStation || this.paused) this.closeMenus();
    else this.showPause();
  };

  private onButton(act: string, arg?: string) {
    this.audio.unlock();
    const scenario = SCENARIOS.find((s) => s.id === arg);
    switch (act) {
      case 'pick':
        if (scenario) this.showBriefing(scenario);
        break;
      case 'start':
        if (this.briefingScenario) this.startScenario(this.briefingScenario);
        break;
      case 'menu':
      case 'quit':
        this.showMenu();
        break;
      case 'retry':
        if (this.engine) this.showBriefing(this.engine.scenario);
        break;
      case 'close':
      case 'resume':
        this.closeMenus();
        break;
      case 'pause':
        if (this.screen === 'playing') this.showPause();
        break;
      case 'chart':
        this.showChart();
        break;
      case 'music':
        this.musicOn = !this.musicOn;
        this.music?.setEnabled(this.musicOn && !this.audio.muted);
        this.el.musicBtn.textContent = this.musicOn ? 'MUSIC' : 'MUSIC OFF';
        this.root.querySelectorAll('[data-el=menuMusic]').forEach((b) => (b.textContent = this.musicOn ? '♪ Music: on' : '♪ Music: off'));
        break;
      case 'view':
        this.controls.mode = this.controls.mode === 'third' ? 'first' : 'third';
        break;
      case 'quality':
        this.hq = !this.hq;
        this.post.enabled = this.hq;
        this.renderer.shadowMap.enabled = this.hq;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.hq ? 1.75 : 1));
        this.el.qualityBtn.textContent = this.hq ? 'HQ' : 'LQ';
        this.resize();
        break;
      case 'labels':
        this.showLabels = !this.showLabels;
        break;
      case 'sound':
        this.audio.muted = !this.audio.muted;
        this.el.soundBtn.textContent = this.audio.muted ? 'MUTE' : 'SND';
        this.music?.setEnabled(this.musicOn && !this.audio.muted);
        break;
      case 'hint':
        this.giveHint();
        break;
      case 'use': {
        if (this.menuStation || this.paused) return;
        this.useNearest();
        break;
      }
      case 'do':
        if (arg) this.doAction(arg);
        break;
    }
  }

  private setAimFromClient(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.aim.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private pick(ndc: THREE.Vector2): { station: StationId; dist: number } | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = [...this.world.stations.values()];
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.station) o = o.parent;
      if (o) {
        const station = o.userData.station as StationId;
        return { station, dist: this.stationDist(station) };
      }
    }
    return null;
  }

  /** Horizontal distance from the player to a station; stations inside Room 304 are out of reach from the corridor. */
  private stationDist(station: StationId) {
    const box = this.world.stationBoxes.get(station)!;
    const p = this.controls.position;
    if (station !== 'door' && !inRoom(p)) return Infinity;
    const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x);
    const dz = Math.max(box.min.z - p.z, 0, p.z - box.max.z);
    return Math.hypot(dx, dz);
  }

  /** GTA-style context target: the closest station in reach, preferring what the character faces. */
  private nearest(): { station: StationId; dist: number } | null {
    const p = this.controls.position;
    const h = this.controls.heading;
    let best: { station: StationId; dist: number; score: number } | null = null;
    for (const [station, box] of this.world.stationBoxes) {
      const dist = this.stationDist(station);
      if (dist > REACH) continue;
      const c = box.getCenter(new THREE.Vector3());
      let diff = Math.atan2(c.x - p.x, c.z - p.z) - h;
      diff = Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff)));
      const score = dist + (diff / Math.PI) * 1.2;
      if (!best || score < best.score) best = { station, dist, score };
    }
    return best;
  }

  private useNearest() {
    const n = this.target ?? this.nearest();
    if (n) this.tryInteract(n.station, n.dist);
    else this.toast('info', 0, 'Nothing to use here. Walk up to equipment or the patient.');
  }

  private tryInteract(station: StationId, dist: number) {
    if (this.screen !== 'playing' || this.menuStation || this.paused) return;
    if (dist > REACH) {
      this.toast('info', 0, `Walk closer to the ${STATION_NAMES[station]}.`);
      return;
    }
    this.openStation(station);
  }

  // ---------------------------------------------------------------- gameplay

  private doAction(id: string) {
    const eng = this.engine;
    if (!eng || this.screen !== 'playing') return;
    if (id === 'finish' && eng.status === 'running' && !this.finishArmed) {
      this.finishArmed = true;
      this.renderStationMenu({
        label: 'Patient is not stable yet',
        kind: 'harmful',
        points: 0,
        feedback: 'Handing off now will count any missed priorities against you. Choose "End scenario" again to confirm.',
      });
      return;
    }
    const logBefore = eng.log.length;
    const res = eng.perform(id);
    // Surface automatic safety penalties (missed hygiene / ID check)
    for (const extra of eng.log.slice(logBefore)) {
      if (extra.actionId === '' && extra.kind === 'harmful') this.toast('harmful', extra.points, `${extra.label}: ${extra.feedback}`);
    }
    if (res.kind === 'harmful') this.audio.bad();
    else if (!res.noop && (res.kind === 'critical' || res.kind === 'good')) this.audio.good();

    if (!res.noop) {
      switch (id) {
        case 'hob_high':
          this.hobAngle = 1.05;
          this.legAngle = 0;
          break;
        case 'position_flat':
          this.hobAngle = 0;
          this.legAngle = 0;
          break;
        case 'legs_up':
          this.hobAngle = 0;
          this.legAngle = -0.28;
          break;
        case 'stop_infusion':
          this.ivRunning = false;
          if (eng.scenario.id === 'anaphylaxis') (this.world.ivBag.material as THREE.MeshStandardMaterial).color.set(0xeaf6ff);
          break;
        case 'resume_infusion':
          this.ivRunning = true;
          break;
        case 'ns_bolus':
          this.ivRunning = true;
          this.ivLabel = 'NS 0.9% 1 L BOLUS';
          break;
        case 'oral_glucose':
          this.world.patient.juice.visible = false;
          break;
      }
    }

    if (id === 'finish') {
      this.showDebrief();
      return;
    }
    if (id === 'review_chart') {
      this.showChart();
      return;
    }
    this.toast(res.kind, res.points, `${res.label}: ${res.feedback}`);
    this.renderStationMenu(res);
  }

  private giveHint() {
    const eng = this.engine;
    if (!eng || this.screen !== 'playing') return;
    const next = eng.criticalRemaining[0];
    if (!next) {
      this.toast('info', 0, 'All priority interventions are done. Document, then end the scenario at the door.');
      return;
    }
    const id = Array.isArray(next) ? next[0] : next;
    const station = ACTIONS_BY_ID[id].station;
    eng.penalize('Used a hint', -3, `Next priority involves the ${STATION_NAMES[station]}.`);
    this.toast('info', -3, `Hint: your next priority involves the ${STATION_NAMES[station]}.`);
  }

  private toast(kind: string, points: number, text: string) {
    const t = document.createElement('div');
    t.className = `w3d-toast w3d-card ${kind}`;
    t.innerHTML = `${points ? `<span class="pts">${points > 0 ? '+' : ''}${points}</span>` : ''}${esc(text)}`;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstElementChild!.remove();
    setTimeout(() => t.remove(), 9000);
  }

  private subtitle(html: string) {
    this.el.subtitle.innerHTML = html;
    this.el.subtitle.classList.toggle('on', !!html);
  }

  /** Big centered mission-style banner. */
  private banner(title: string, sub: string, cls: string, seconds = 3.5) {
    this.el.banner.className = `w3d-banner on ${cls}`;
    this.el.banner.innerHTML = `<div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div>`;
    this.bannerTimer = seconds;
  }

  private hideBanner() {
    this.el.banner.className = 'w3d-banner';
    this.bannerTimer = 0;
  }

  // ---------------------------------------------------------------- frame loop

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 80 : 62;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.clock.getDelta());
    this.t += dt;
    const eng = this.engine;

    if (this.screen === 'menu' || this.screen === 'briefing') {
      // Cinematic fly-through: corridor dolly, then an orbit around the bed
      const cycle = (this.t * 0.05) % 2;
      if (cycle < 1) {
        const k = cycle;
        this.camera.position.set(-13 + k * 18, 1.9 - k * 0.3, 6.6);
        this.camera.lookAt(-10 + k * 18, 1.3, 5.2 - k * 0.5);
      } else {
        const a = (cycle - 1) * Math.PI * 1.2 - 0.3;
        this.camera.position.set(Math.sin(a) * 3.4, 2.0, Math.cos(a) * 2.6 - 0.8);
        this.camera.lookAt(0, 0.9, -2.3);
      }
      this.player.group.visible = false;
    } else {
      const frozen = this.screen !== 'playing' || !!this.codeShownAt;
      const wasEnabled = this.controls.enabled;
      if (frozen) this.controls.enabled = false;
      this.controls.update(dt, this.camera, this.world.obstacles, this.world.bounds, this.world.camBlockers);
      if (frozen) this.controls.enabled = wasEnabled;
      const pos = this.controls.position;
      this.player.group.visible = this.controls.mode === 'third';
      this.player.group.position.set(pos.x, 0, pos.z);
      this.player.group.rotation.y = this.controls.heading;
      this.player.animate(dt, this.controls.speed);
      this.el.crosshair.style.display = this.controls.mode === 'first' ? '' : 'none';
      if (this.codeShownAt) {
        // slow dramatic pull-back like a "wasted" cam
        const k = Math.min(1, (this.t - this.codeShownAt) / 4);
        this.camera.position.y += k * 0.6;
        this.camera.lookAt(0, 0.8, -2.3);
      }
    }

    if (eng && this.screen === 'playing' && !this.paused) {
      if (!this.entered && inRoom(this.controls.position)) {
        this.entered = true;
        this.world.marker.visible = false;
        this.banner(eng.scenario.title, `Room ${eng.scenario.patient.room} · ${eng.scenario.patient.name}`, 'intro');
        this.subtitle('Assess your patient. Start with <em>hand hygiene</em> at the sink by the door.');
        this.toast('info', 0, 'The clock is running. Prioritize: airway, breathing, circulation, safety.');
      }
      const before = eng.status;
      if (this.entered) eng.tick(dt);
      if (before === 'running' && eng.status === 'stabilized') {
        this.music?.stingWin();
        this.banner('Patient stabilized', `+${eng.score} PTS · document, then hand off at the door`, 'passed', 4);
        this.subtitle('Finish your <em>documentation</em>, then end the shift at the <em>door</em>.');
        this.audio.good();
      }
      if (eng.status === 'coded' && !this.codeShownAt) {
        this.codeShownAt = this.t;
        this.menuStation = null;
        this.setOverlay('');
        this.controls.enabled = false;
        this.post.set({ gray: 1 });
        this.banner('Code Blue', 'Patient in cardiopulmonary arrest', 'wasted', 10);
        this.subtitle('');
        this.audio.bad();
      }
      if (this.codeShownAt && this.t - this.codeShownAt > 4.5) this.showDebrief();
      this.updateHud(dt);
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hideBanner();
    }

    this.updateMusic();
    this.updateNpcs(dt);
    for (const f of this.world.animated) f(this.t);
    this.updatePatientVisuals(dt);
    this.updateTarget();
    this.updateLabels();
    this.updateRadar();
    this.post.render(this.world.scene, this.camera, this.t);
  };

  /** Adaptive soundtrack: calm on the menu and in the corridor, tightening with patient severity in the room. */
  private updateMusic() {
    if (!this.music) return;
    const eng = this.engine;
    let mood: Mood = 'menu';
    if (this.screen === 'playing' && eng) {
      if (eng.status === 'coded') mood = 'code';
      else if (!this.entered || eng.status === 'stabilized' || eng.status === 'finished') mood = 'explore';
      else mood = 'tension';
      this.music.setIntensity(eng.severity);
    }
    this.music.setMood(mood);
  }

  private updateNpcs(dt: number) {
    for (const n of this.npcs) {
      if (!n.route.length) {
        n.avatar.animate(dt, 0);
        continue;
      }
      if (n.wait > 0) {
        n.wait -= dt;
        n.avatar.animate(dt, 0);
        continue;
      }
      const g = n.avatar.group;
      const target = n.route[n.idx];
      const dx = target.x - g.position.x;
      const dz = target.z - g.position.z;
      const d = Math.hypot(dx, dz);
      const speed = 1.25;
      if (d < 0.1) {
        n.idx = (n.idx + 1) % n.route.length;
        n.wait = 0.5 + Math.random() * 2.5;
        continue;
      }
      g.position.x += (dx / d) * speed * dt;
      g.position.z += (dz / d) * speed * dt;
      let diff = Math.atan2(dx, dz) - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 6);
      n.avatar.animate(dt, speed);
    }
  }

  private updateRadar() {
    if (this.screen !== 'playing') return;
    const blips: Blip[] = [];
    const eng = this.engine;
    if (!this.entered) blips.push({ x: this.world.markerPos.x, z: this.world.markerPos.z, color: '#f5c518', kind: 'marker' });
    blips.push({ x: 0, z: -2.2, color: eng && eng.severity > 0.7 ? '#ef4444' : '#f87171', kind: 'cross' });
    for (const [id, box] of this.world.stationBoxes) {
      if (id === 'patient') continue;
      const c = box.getCenter(new THREE.Vector3());
      blips.push({ x: c.x, z: c.z, color: id === 'door' ? '#f5c518' : '#60a5fa', kind: 'dot' });
    }
    for (const n of this.npcs) blips.push({ x: n.avatar.group.position.x, z: n.avatar.group.position.z, color: '#cbd5e1', kind: 'npc' });
    const p = this.controls.position;
    this.radar.draw(p.x, p.z, this.controls.yaw, this.controls.heading, blips);
  }

  private updateTarget() {
    if (this.screen !== 'playing' || this.menuStation || this.paused || this.codeShownAt) {
      this.highlight.visible = false;
      this.el.prompt?.classList.remove('on');
      this.target = null;
      return;
    }
    // Mouse hover over something in reach wins; otherwise the nearest station
    let hit: { station: StationId; dist: number } | null = null;
    const useMouse = performance.now() - this.mouseAimAt < 1500 && !matchMedia('(pointer: coarse)').matches;
    if (useMouse) {
      const h = this.pick(this.aim);
      if (h && h.dist <= REACH) hit = h;
    } else if (this.controls.mode === 'first') {
      const h = this.pick(new THREE.Vector2(0, 0));
      if (h && h.dist <= REACH) hit = h;
    }
    hit ??= this.nearest();
    this.target = hit;
    this.renderer.domElement.classList.toggle('w3d-pointing', !!hit);
    if (!hit) {
      this.highlight.visible = false;
      this.el.prompt.classList.remove('on');
      return;
    }
    this.highlight.box.copy(this.world.stationBoxes.get(hit.station)!).expandByScalar(0.03);
    this.highlight.visible = true;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.el.prompt.classList.add('on');
    this.el.prompt.innerHTML = `Press <kbd>${touch ? 'USE' : 'E'}</kbd> to use the <b>${esc(STATION_NAMES[hit.station])}</b>.`;
  }

  /** Fade station labels out as you get close so they don't cover what you are looking at. */
  private updateLabels() {
    this.world.labels.visible = this.showLabels && (this.screen !== 'playing' || inRoom(this.controls.position));
    if (!this.world.labels.visible) return;
    for (const label of this.world.labels.children as THREE.Sprite[]) {
      const d = label.position.distanceTo(this.camera.position);
      label.material.opacity = THREE.MathUtils.clamp((d - 1.6) / 1.2, 0, 1);
    }
  }

  private updateHud(dt: number) {
    const eng = this.engine!;
    const v = eng.vitals;
    const remaining = eng.criticalRemaining.length;
    const doneCount = eng.criticalTotal - remaining;
    this.el.score.textContent = `PTS ${eng.score}`;
    this.el.clock.textContent = this.entered ? fmtTime(eng.elapsed).padStart(5, '0') : '--:--';
    this.el.prioBar.style.width = `${(doneCount / eng.criticalTotal) * 100}%`;
    this.el.condBar.style.width = `${(1 - eng.severity) * 100}%`;
    this.el.condBar.parentElement!.classList.toggle('low', eng.severity > 0.7);

    // Acuity stars, like a wanted level
    const stars = !this.entered ? 0 : eng.status === 'stabilized' ? 0 : Math.max(1, Math.ceil(eng.severity * 5));
    if (stars !== this.stars) {
      this.stars = stars;
      this.el.stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < stars ? 'on' : ''}">★</i>`).join('');
      this.el.stars.classList.remove('flash');
      void this.el.stars.offsetWidth;
      this.el.stars.classList.add('flash');
    }

    let cls = 'worse';
    let label = 'Deteriorating';
    if (!this.entered) [cls, label] = ['waiting', 'Awaiting nurse'];
    else if (eng.status === 'stabilized') [cls, label] = ['stable', 'Stable'];
    else if (remaining === 0) [cls, label] = ['better', 'Improving'];
    else if (eng.severity > 0.75) [cls, label] = ['critical', 'Critical'];
    else if (eng.drift < eng.scenario.drift * 0.5) [cls, label] = ['better', 'Responding'];
    this.el.cond.className = `w3d-cond ${cls}`;
    this.el.cond.textContent = label;

    const alarms = { hr: v.hr > 120 || v.hr < 50, sp: v.spo2 < 90, bp: v.sbp < 90 || v.sbp > 170, rr: v.rr > 28 || v.rr < 10 };
    if (eng.monitorAttached) {
      this.el.vitals.classList.add('on');
      this.el.vitals.innerHTML = `
        <span class="hr ${alarms.hr ? 'alarm' : ''}">HR <b>${v.hr}</b></span>
        <span class="sp ${alarms.sp ? 'alarm' : ''}">SpO₂ <b>${v.spo2}%</b></span>
        <span class="bp ${alarms.bp ? 'alarm' : ''}">BP <b>${v.sbp}/${v.dbp}</b></span>
        <span class="rr ${alarms.rr ? 'alarm' : ''}">RR <b>${v.rr}</b></span>`;
      this.audio.alarm(dt, Object.values(alarms).some(Boolean));
    } else {
      this.el.vitals.classList.remove('on');
    }
    if (!this.codeShownAt) this.post.set({ danger: this.entered ? Math.max(0, (eng.severity - 0.6) / 0.4) : 0 });
  }

  private updatePatientVisuals(dt: number) {
    const eng = this.engine;
    const pr = this.world.patient;
    const k = 1 - Math.exp(-dt * 2.5);
    pr.backrest.rotation.x += (this.hobAngle - pr.backrest.rotation.x) * k;
    pr.footSection.rotation.x += (this.legAngle - pr.footSection.rotation.x) * k;

    const sev = eng ? eng.severity : 0.2;
    const rr = eng ? eng.vitals.rr : 14;
    pr.chest.scale.z = 0.8 + Math.sin(this.t * (rr / 60) * Math.PI * 2) * (0.03 + sev * 0.04);

    const tone = eng?.scenario.skinTone ?? 'pale';
    const amt = eng && eng.band !== 'recovered' ? Math.min(1, sev * 1.3) : Math.min(1, sev);
    pr.skin.color.copy(SKIN.base).lerp(SKIN[tone], amt * 0.85);
    pr.lips.color.copy(LIPS.base).lerp(LIPS.blue, tone === 'cyanotic' || tone === 'flushed' ? amt : amt * 0.3);
    pr.hives.visible = !!eng && eng.scenario.id === 'anaphylaxis' && sev > 0.2;

    const hasNrb = !!eng?.done.has('o2_nrb');
    pr.mask.visible = hasNrb;
    pr.cannula.visible = !hasNrb && !!eng?.done.has('o2_nc');

    this.monitor.update(dt, eng?.monitorAttached ? eng.vitals : null);
    const pump = this.world.pumpScreen;
    drawPump(pump.canvas, pump.texture, this.ivLabel || 'NS 0.9% 75 mL/hr', this.ivRunning, this.t);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keydown', this.unlockAudio);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.music?.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.monitor.texture.dispose();
    this.post.dispose();
    this.world.scene.environment?.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}

export function mountWardGame(container: HTMLElement): () => void {
  const game = new WardGame(container);
  return () => game.dispose();
}
