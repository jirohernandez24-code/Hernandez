import * as THREE from 'three';
import { ACTIONS_BY_ID, REPEATABLE, STATION_NAMES, actionsForStation } from './actions';
import { MonitorAudio } from './audio';
import { PlayerControls } from './controls';
import { SimulationEngine, type ActionResult } from './engine';
import { SCENARIOS } from './scenarios';
import { MonitorScreen, drawPump, drawWhiteboard } from './screens';
import { GAME_CSS } from './styles';
import type { Scenario, StationId } from './types';
import { buildWorld, type World } from './world';

const REACH = 1.7;
const STYLE_ID = 'w3d-styles';

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

  private el: Record<string, HTMLElement> = {};

  constructor(private container: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = GAME_CSS;
      document.head.appendChild(style);
    }

    this.root = document.createElement('div');
    this.root.className = 'w3d';
    this.root.innerHTML = `
      <div class="w3d-vignette" data-el="vignette"></div>
      <div class="w3d-hud" data-el="hud" style="display:none">
        <div class="w3d-crosshair"></div>
        <div class="w3d-patient w3d-card" data-el="patient"></div>
        <div class="w3d-vitals" data-el="vitals"></div>
        <div class="w3d-top-right">
          <div class="w3d-score w3d-card" data-el="score"></div>
          <div class="w3d-tools">
            <button data-act="hint" title="Get a hint (−3 pts)">💡<span class="w3d-txt"> Hint</span></button>
            <button data-act="labels" title="Toggle station labels">🏷️<span class="w3d-txt"> Labels</span></button>
            <button data-act="sound" data-el="soundBtn" title="Toggle sound">🔊</button>
            <button data-act="pause" title="Pause">⏸</button>
          </div>
        </div>
        <div class="w3d-prompt w3d-card" data-el="prompt"></div>
        <div class="w3d-toasts" data-el="toasts"></div>
        <div class="w3d-joystick" data-el="joy"><div data-el="knob"></div></div>
        <button class="w3d-use" data-act="use">USE</button>
      </div>
      <div data-el="overlay"></div>
    `;
    container.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((n) => (this.el[n.dataset.el!] = n));

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.prepend(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
    this.world = buildWorld(STATION_NAMES);
    (this.world.monitorScreen.material as THREE.MeshBasicMaterial).map = this.monitor.texture;
    this.monitor.onBeat = () => {
      if (this.engine?.monitorAttached && this.screen === 'playing') this.audio.beat(this.engine.vitals.spo2);
    };
    this.highlight = new THREE.Box3Helper(new THREE.Box3(), 0xfacc15);
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
      const hit = this.pick(new THREE.Vector2(0, 0));
      if (hit) this.tryInteract(hit.station, hit.dist);
    };

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
    this.el.vignette.style.opacity = '0';
    this.controls.enabled = false;
    const cards = SCENARIOS.map(
      (s) => `<button class="w3d-scn" data-act="pick" data-arg="${s.id}">
        <span class="w3d-tag ${s.difficulty}">${s.difficulty}</span>
        <b>${esc(s.title)}</b><span>${esc(s.subtitle)}</span></button>`,
    ).join('');
    this.setOverlay(`
      <div class="w3d-panel">
        <h1>🏥 NurseSim 3D: Ward Shift</h1>
        <p class="w3d-muted">Walk into Room 304, assess your patient, and carry out the right nursing interventions in the right order before they deteriorate.</p>
        <h4>Choose a scenario</h4>
        <div class="w3d-scenarios">${cards}</div>
        <h4>Controls</h4>
        <div class="w3d-controls">
          <span><kbd>W A S D</kbd> / <kbd>↑ ↓</kbd></span><span>Walk (← → to turn)</span>
          <span><kbd>Drag</kbd></span><span>Look around (mouse or finger)</span>
          <span><kbd>Click</kbd> / <kbd>Tap</kbd></span><span>Interact with the equipment or patient you point at</span>
          <span><kbd>E</kbd> / <kbd>USE</kbd></span><span>Interact with whatever is at the center dot</span>
          <span><kbd>Esc</kbd></span><span>Close menus / pause</span>
        </div>
        <p class="w3d-muted" style="margin-top:14px">Scoring: priority (critical) interventions earn the most points. Unsafe actions lose points. Hand hygiene, two patient identifiers and the rights of medication administration always count.</p>
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
        <h2 style="margin-top:8px">Shift handoff: ${esc(s.title)}</h2>
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
        <p class="w3d-muted">Orders, the MAR and protocols are on the charting computer in the room. The clock starts when you enter.</p>
        <div class="w3d-row">
          <button class="w3d-btn" data-act="start">Enter Room ${p.room} →</button>
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
    this.controls.position.set(3.1, 1.62, 2.9);
    this.controls.yaw = 0.55;
    this.controls.pitch = -0.12;
    this.controls.enabled = true;
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
      <h3>${esc(p.name)} <span class="w3d-muted" style="font-weight:400">${p.age}${p.sex} · Rm ${p.room}</span></h3>
      <div class="dx">${esc(p.diagnosis)}</div>
      <div class="allergy">⚠ Allergies: ${esc(p.allergies)}</div>
      <div><span class="w3d-cond" data-el="cond"></span> <span class="w3d-muted" data-el="clock"></span></div>`;
    this.el.cond = this.el.patient.querySelector('[data-el=cond]')!;
    this.el.clock = this.el.patient.querySelector('[data-el=clock]')!;
    this.toast('info', 0, 'Handoff received. Start with hand hygiene, then assess your patient.');
  }

  private showDebrief() {
    const eng = this.engine!;
    if (eng.status !== 'coded') eng.status = 'finished';
    this.screen = 'debrief';
    this.menuStation = null;
    this.controls.enabled = false;
    this.el.hud.style.display = 'none';
    this.el.vignette.style.opacity = '0';
    this.root.querySelector('.w3d-code')?.remove();
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
        <h2>Debrief: ${esc(s.title)}</h2>
        <p class="w3d-muted">${headline}</p>
        <div class="w3d-stats" style="margin-top:12px">
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
        <h2>🖥️ EHR: ${esc(p.name)}</h2>
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
      `<div class="w3d-panel narrow">
        <h2>${esc(STATION_NAMES[station])}</h2>
        <p class="w3d-muted">Choose a nursing action. The patient keeps changing while you decide.</p>
        ${res}
        <div class="w3d-actions">${buttons}</div>
        <div class="w3d-row"><button class="w3d-btn secondary" data-act="close">Close (Esc)</button></div>
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
      case 'labels':
        this.world.labels.visible = !this.world.labels.visible;
        break;
      case 'sound':
        this.audio.muted = !this.audio.muted;
        this.el.soundBtn.textContent = this.audio.muted ? '🔇' : '🔊';
        break;
      case 'hint':
        this.giveHint();
        break;
      case 'use': {
        if (this.menuStation || this.paused) return;
        const hit = this.pick(new THREE.Vector2(0, 0));
        if (hit) this.tryInteract(hit.station, hit.dist);
        else this.toast('info', 0, 'Point the center dot at equipment or the patient, then press USE.');
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
        const box = this.world.stationBoxes.get(station)!;
        const p = this.controls.position;
        const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x);
        const dz = Math.max(box.min.z - p.z, 0, p.z - box.max.z);
        return { station, dist: Math.hypot(dx, dz) };
      }
    }
    return null;
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
    if (id === 'finish' && eng.status === 'running') {
      if (!confirm('The patient is not stable yet. End the scenario and hand off anyway?')) return;
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

  // ---------------------------------------------------------------- frame loop

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 85 : 70;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.clock.getDelta());
    this.t += dt;
    const eng = this.engine;

    if (this.screen === 'menu' || this.screen === 'briefing') {
      // Slow orbit around the room as a backdrop
      const a = this.t * 0.12;
      this.camera.position.set(Math.sin(a) * 3.2, 2.1, Math.cos(a) * 2.6 - 0.5);
      this.camera.lookAt(0, 0.8, -2.2);
    } else {
      this.controls.update(dt, this.camera, this.world.obstacles, this.world.bounds);
    }

    if (eng && this.screen === 'playing' && !this.paused) {
      const before = eng.status;
      eng.tick(dt);
      if (before === 'running' && eng.status === 'stabilized') {
        this.toast('good', 0, 'Patient stabilized! Document your care, then end the scenario at the door.');
        this.audio.good();
      }
      if (eng.status === 'coded' && !this.codeShownAt) {
        this.codeShownAt = this.t;
        this.menuStation = null;
        this.setOverlay('');
        this.controls.enabled = false;
        const code = document.createElement('div');
        code.className = 'w3d-code';
        code.textContent = 'CODE BLUE';
        this.root.appendChild(code);
      }
      if (this.codeShownAt && this.t - this.codeShownAt > 3) this.showDebrief();
      this.updateHud(dt);
    }

    this.updatePatientVisuals(dt);
    this.updateTarget();
    this.updateLabels();
    this.renderer.render(this.world.scene, this.camera);
  };

  private updateTarget() {
    if (this.screen !== 'playing' || this.menuStation || this.paused) {
      this.highlight.visible = false;
      this.el.prompt?.classList.remove('on');
      this.target = null;
      return;
    }
    const useMouse = performance.now() - this.mouseAimAt < 1500 && !matchMedia('(pointer: coarse)').matches;
    const hit = this.pick(useMouse ? this.aim : new THREE.Vector2(0, 0));
    this.target = hit;
    this.renderer.domElement.classList.toggle('w3d-pointing', !!hit && hit.dist <= REACH);
    if (!hit) {
      this.highlight.visible = false;
      this.el.prompt.classList.remove('on');
      return;
    }
    this.highlight.box.copy(this.world.stationBoxes.get(hit.station)!).expandByScalar(0.03);
    this.highlight.visible = true;
    const name = STATION_NAMES[hit.station];
    const touch = matchMedia('(pointer: coarse)').matches;
    this.el.prompt.classList.add('on');
    this.el.prompt.classList.toggle('far', hit.dist > REACH);
    this.el.prompt.innerHTML =
      hit.dist > REACH ? `${esc(name)}: walk closer` : `<kbd>${touch ? 'Tap' : 'Click / E'}</kbd>${esc(name)}`;
  }

  /** Fade station labels out as you get close so they don't cover what you are looking at. */
  private updateLabels() {
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
    this.el.score.innerHTML = `Score<b>${eng.score}</b>Priorities ${doneCount}/${eng.criticalTotal}
      <div class="w3d-progress"><div style="width:${(doneCount / eng.criticalTotal) * 100}%"></div></div>`;
    this.el.clock.textContent = `⏱ ${fmtTime(eng.elapsed)}`;

    let cls = 'worse';
    let label = 'Deteriorating';
    if (eng.status === 'stabilized') [cls, label] = ['stable', 'Stable'];
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
    this.el.vignette.style.opacity = String(Math.max(0, (eng.severity - 0.65) / 0.35) * 0.9);
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
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.monitor.texture.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}

export function mountWardGame(container: HTMLElement): () => void {
  const game = new WardGame(container);
  return () => game.dispose();
}
