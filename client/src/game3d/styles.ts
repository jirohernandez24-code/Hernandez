export const GAME_CSS = `
.w3d { --gold: #f5c518; --money: #72c472; --teal: #2dd4bf; --panel: rgba(8, 11, 16, 0.9); --line: rgba(255,255,255,0.12); --text: #eef2f6; --muted: #9aa7b4; --danger: #e5484d;
  --display: 'Anton', Impact, 'Arial Narrow Bold', sans-serif; --ui: 'Oswald', 'Arial Narrow', system-ui, sans-serif;
  position: relative; width: 100%; height: 100%; overflow: hidden; background: #0b0d12; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--text); user-select: none; -webkit-user-select: none; }
.w3d canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
.w3d canvas.w3d-pointing { cursor: pointer; }
.w3d button { font: inherit; cursor: pointer; color: inherit; }
.w3d button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.w3d kbd { display: inline-block; min-width: 1.4em; text-align: center; background: #f5f5f5; color: #111; border-radius: 4px; padding: 0 6px; font: 700 12px/1.6 var(--ui); box-shadow: 0 2px 0 #9ca3af; }
.w3d-hud { position: absolute; inset: 0; pointer-events: none; }
.w3d-hud > * { pointer-events: auto; }
.w3d-outline { text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,.6); }

/* ---- top-right stats (clock, points, acuity stars) ---- */
.w3d-stats { position: absolute; top: 14px; right: 18px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; pointer-events: none; }
.w3d-stats > * { pointer-events: auto; }
.w3d-time, .w3d-money { font: 400 30px/1 var(--display); letter-spacing: .03em; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,.6); font-variant-numeric: tabular-nums; }
.w3d-time { color: #fff; font-size: 26px; }
.w3d-money { color: var(--money); }
.w3d-stars { font-size: 24px; letter-spacing: 2px; min-height: 30px; }
.w3d-stars i { font-style: normal; color: rgba(0,0,0,.35); -webkit-text-stroke: 1.5px rgba(255,255,255,.55); }
.w3d-stars i.on { color: #fff; -webkit-text-stroke: 1.5px #000; }
.w3d-stars.flash i.on { animation: w3dstar .4s 3; }
@keyframes w3dstar { 50% { color: var(--danger); } }
.w3d-tools { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 340px; }
.w3d-tools button { border: 1px solid var(--line); background: rgba(0,0,0,.6); border-radius: 3px; padding: 4px 8px; font: 500 12px/1.2 var(--ui); letter-spacing: .08em; }
.w3d-tools button:hover { background: rgba(0,0,0,.85); border-color: var(--gold); }

/* ---- top-left help box + notifications ---- */
.w3d-help-col { position: absolute; top: 14px; left: 14px; width: min(340px, calc(100% - 220px)); display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.w3d-help { background: rgba(0,0,0,.78); padding: 10px 14px; font-size: 14px; line-height: 1.45; border-radius: 2px; display: none; }
.w3d-help.on { display: block; animation: w3din .2s ease-out; }
.w3d-help b { color: var(--gold); font-weight: 600; }
.w3d-toasts { display: flex; flex-direction: column; gap: 6px; }
.w3d-toast { background: rgba(0,0,0,.72); padding: 8px 12px; font-size: 13px; line-height: 1.4; border-left: 3px solid var(--muted); animation: w3din .25s ease-out; border-radius: 2px; }
.w3d-toast.critical, .w3d-toast.good { border-left-color: var(--money); }
.w3d-toast.harmful { border-left-color: var(--danger); }
.w3d-toast.info { border-left-color: #5aa9ff; }
.w3d-toast .pts { float: right; font: 700 14px var(--ui); margin-left: 8px; }
.w3d-toast.harmful .pts { color: var(--danger); } .w3d-toast.good .pts, .w3d-toast.critical .pts { color: var(--money); }
@keyframes w3din { from { transform: translateX(-10px); opacity: 0; } }

/* ---- vitals ribbon ---- */
.w3d-vitals { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: none; gap: 12px; padding: 6px 14px; background: rgba(0,0,0,.78); border-radius: 2px; font-family: ui-monospace, Menlo, monospace; font-size: 13px; white-space: nowrap; pointer-events: none; }
.w3d-vitals.on { display: flex; }
.w3d-vitals span b { font-size: 17px; }
.w3d-vitals .hr b { color: #4ade80; } .w3d-vitals .sp b { color: #38bdf8; } .w3d-vitals .bp b { color: #f472b6; } .w3d-vitals .rr b { color: #facc15; }
.w3d-vitals .alarm b { color: #ff5a5f; animation: w3dpulse .8s infinite; }
@keyframes w3dpulse { 50% { opacity: .45; } }

/* ---- radar (bottom-left) ---- */
.w3d-radar-wrap { position: absolute; left: 18px; bottom: 18px; width: 190px; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.w3d-radar { width: 180px; height: 180px; display: block; filter: drop-shadow(0 4px 10px rgba(0,0,0,.5)); }
.w3d-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 180px; }
.w3d-bar { height: 8px; background: rgba(0,0,0,.65); border: 1px solid rgba(0,0,0,.9); }
.w3d-bar > div { height: 100%; transition: width .4s; }
.w3d-bar.cond > div { background: #5fbf4a; }
.w3d-bar.cond.low > div { background: var(--danger); animation: w3dpulse .8s infinite; }
.w3d-bar.prio > div { background: #4a90d9; }
.w3d-patient { background: rgba(0,0,0,.72); padding: 7px 10px; font-size: 12px; line-height: 1.4; border-radius: 2px; width: 200px; box-sizing: border-box; }
.w3d-patient b { font: 700 14px var(--ui); letter-spacing: .02em; }
.w3d-patient .allergy { color: #ff8a8d; font-weight: 700; font-size: 11px; letter-spacing: .04em; }
.w3d-cond { display: inline-block; margin-top: 4px; padding: 1px 7px; font: 700 11px var(--ui); letter-spacing: .08em; text-transform: uppercase; border-radius: 2px; }
.w3d-cond.critical { background: var(--danger); color: #fff; animation: w3dpulse 1s infinite; }
.w3d-cond.worse { background: #c2410c; color: #fff; }
.w3d-cond.better { background: #1d4ed8; color: #fff; }
.w3d-cond.stable { background: #15803d; color: #fff; }
.w3d-cond.waiting { background: #3f3f46; color: #e4e4e7; }

/* ---- mission subtitle ---- */
.w3d-subtitle { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); width: min(720px, calc(100% - 440px)); text-align: center; font: 500 19px/1.35 var(--ui); color: #fff; text-shadow: 0 0 4px #000, 0 2px 3px #000, 0 0 10px rgba(0,0,0,.8); opacity: 0; transition: opacity .3s; pointer-events: none; }
.w3d-subtitle.on { opacity: 1; }
.w3d-subtitle em { font-style: normal; color: var(--gold); }

/* ---- big banners ---- */
.w3d-banner { position: absolute; left: 0; right: 0; top: 34%; text-align: center; pointer-events: none; opacity: 0; z-index: 4; }
.w3d-banner.on { opacity: 1; animation: w3dbanner .5s cubic-bezier(.2,.9,.3,1.3); }
.w3d-banner .t { font: 400 clamp(40px, 8vw, 88px)/1 var(--display); text-transform: uppercase; letter-spacing: .02em; text-shadow: -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 6px 18px rgba(0,0,0,.7); }
.w3d-banner .s { margin-top: 8px; font: 500 clamp(15px, 2.2vw, 22px) var(--ui); letter-spacing: .06em; text-transform: uppercase; color: #fff; text-shadow: 0 0 4px #000, 0 2px 4px #000; }
.w3d-banner.intro .t { color: #fff; }
.w3d-banner.intro { background: linear-gradient(90deg, transparent, rgba(0,0,0,.55) 30%, rgba(0,0,0,.55) 70%, transparent); padding: 18px 0; }
.w3d-banner.passed .t { color: var(--gold); }
.w3d-banner.wasted .t { color: #d7263d; font-size: clamp(54px, 11vw, 120px); }
@keyframes w3dbanner { from { transform: scale(1.4); opacity: 0; } }

.w3d-crosshair { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px rgba(0,0,0,.6); pointer-events: none; }

/* ---- touch controls ---- */
.w3d-joystick { position: absolute; left: 22px; bottom: 24px; width: 124px; height: 124px; border-radius: 50%; background: rgba(0,0,0,.28); border: 2px solid rgba(255,255,255,.45); display: none; touch-action: none; }
.w3d-joystick > div { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; background: rgba(255,255,255,.8); pointer-events: none; }
.w3d-use, .w3d-run { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,.6); display: none; font: 700 15px var(--ui); letter-spacing: .06em; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
.w3d-use { right: 22px; bottom: 40px; width: 84px; height: 84px; background: rgba(245,197,24,.92); color: #111 !important; }
.w3d-run { right: 118px; bottom: 30px; width: 58px; height: 58px; background: rgba(0,0,0,.55); }
@media (pointer: coarse) {
  .w3d-joystick, .w3d-use, .w3d-run { display: block; }
  .w3d-radar-wrap { top: 12px; bottom: auto; left: 12px; width: 112px; }
  .w3d-radar { width: 108px; height: 108px; }
  .w3d-bars { width: 108px; }
  .w3d-patient { display: none; }
  .w3d-help-col { top: 150px; left: 12px; width: calc(100% - 24px); max-width: 360px; }
  .w3d-subtitle { bottom: 160px; width: calc(100% - 32px); font-size: 16px; }
  .w3d-vitals { top: auto; bottom: 132px; font-size: 11px; gap: 8px; }
  .w3d-vitals span b { font-size: 13px; }
  .w3d-time { font-size: 20px; } .w3d-money { font-size: 22px; } .w3d-stars { font-size: 18px; min-height: 22px; }
  .w3d-tools { max-width: 170px; }
}

/* ---- overlays / panels ---- */
.w3d-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(4,6,10,.55); z-index: 5; }
.w3d-overlay.clear { background: transparent; pointer-events: none; justify-content: flex-start; align-items: flex-start; padding-top: 14px; }
.w3d:has(.w3d-interact) .w3d-help-col { display: none; }
.w3d-overlay.clear > * { pointer-events: auto; }
.w3d-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; box-shadow: 0 20px 60px rgba(0,0,0,.5); width: min(720px, 100%); max-height: 100%; overflow: auto; padding: 22px 24px; box-sizing: border-box; }
.w3d-panel.narrow { width: min(460px, 100%); }
.w3d-panel h2 { margin: 0 0 6px; font: 700 22px var(--ui); letter-spacing: .02em; text-transform: uppercase; text-wrap: balance; }
.w3d-panel h4, .w3d-menu h4 { margin: 18px 0 8px; font: 500 12px var(--ui); letter-spacing: .16em; text-transform: uppercase; color: var(--gold); }
.w3d-panel p { margin: 6px 0; line-height: 1.55; max-width: 65ch; }
.w3d-panel ul { margin: 4px 0; padding-left: 20px; line-height: 1.55; }
.w3d-muted { color: var(--muted); font-size: 14px; }
.w3d-mission-title { font: 400 clamp(34px, 6vw, 56px)/1.05 var(--display); text-transform: uppercase; color: var(--gold); margin: 6px 0 10px; text-shadow: 0 3px 0 #000; }
.w3d-mission-title.fail { color: #d7263d; }
.w3d-btn { border: 0; border-radius: 3px; padding: 11px 20px; font: 700 15px var(--ui); letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: #111 !important; }
.w3d-btn:hover { background: #ffd84a; }
.w3d-btn.secondary { background: rgba(255,255,255,.1); color: var(--text) !important; }
.w3d-btn.secondary:hover { background: rgba(255,255,255,.2); }
.w3d-btn.danger { background: var(--danger); color: #fff !important; }
.w3d-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }

/* main menu: left column over the cinematic fly-through */
.w3d-menu { position: absolute; left: 0; top: 0; bottom: 0; width: min(520px, 100%); padding: 32px 28px; box-sizing: border-box; overflow: auto; background: linear-gradient(90deg, rgba(4,6,10,.92) 70%, rgba(4,6,10,0)); }
.w3d-overlay:has(.w3d-menu) { background: transparent; }
.w3d-logo { font: 400 clamp(52px, 10vw, 84px)/.95 var(--display); letter-spacing: .01em; color: #fff; text-shadow: 0 4px 0 #000; }
.w3d-logo span { color: var(--gold); }
.w3d-logo-sub { font: 500 14px var(--ui); letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
.w3d-scenarios { display: flex; flex-direction: column; gap: 8px; }
.w3d-scn { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; text-align: left; border: 1px solid var(--line); background: rgba(255,255,255,.04); border-radius: 3px; padding: 12px 14px; transition: background .15s, border-color .15s, transform .15s; }
.w3d-scn:hover { background: rgba(245,197,24,.12); border-color: var(--gold); transform: translateX(4px); }
.w3d-scn-num { font: 400 28px var(--display); color: var(--gold); }
.w3d-scn-body b { display: block; font: 700 17px var(--ui); letter-spacing: .03em; text-transform: uppercase; }
.w3d-scn-body span { font-size: 13px; color: var(--muted); }
.w3d-tag { display: inline-block; font: 700 11px var(--ui); letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: 2px; }
.w3d-tag.Beginner { background: #14532d; color: #bbf7d0; } .w3d-tag.Intermediate { background: #713f12; color: #fde68a; } .w3d-tag.Advanced { background: #7f1d1d; color: #fecaca; }
.w3d-controls { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: 14px; align-items: center; }

/* interaction menu (GTA style list) */
.w3d-interact { width: min(380px, calc(100vw - 32px)); background: rgba(0,0,0,.82); border-radius: 2px; overflow: hidden; margin-left: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.5); max-height: calc(100% - 20px); overflow-y: auto; }
.w3d-interact-head { background: linear-gradient(90deg, #0f766e, #115e59); padding: 16px 16px 12px; font: 400 26px/1 var(--display); text-transform: uppercase; letter-spacing: .02em; }
.w3d-interact-sub { background: #000; padding: 6px 16px; font: 500 11px var(--ui); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.w3d-actions { display: flex; flex-direction: column; }
.w3d-action { text-align: left; border: 0; border-bottom: 1px solid rgba(255,255,255,.06); background: transparent; padding: 11px 16px; font-size: 14px; }
.w3d-action:hover:not(:disabled), .w3d-action:focus-visible { background: #f1f5f9; color: #111 !important; outline: none; }
.w3d-action:disabled { opacity: .45; cursor: default; }
.w3d-action .done { float: right; color: var(--money); font: 700 12px var(--ui); letter-spacing: .08em; }
.w3d-action.back { color: var(--muted); font: 500 13px var(--ui); letter-spacing: .1em; text-transform: uppercase; }
.w3d-result { margin: 0; padding: 12px 16px; font-size: 14px; line-height: 1.5; border-left: 4px solid var(--muted); background: rgba(255,255,255,.06); }
.w3d-result.good, .w3d-result.critical { border-left-color: var(--money); }
.w3d-result.harmful { border-left-color: var(--danger); background: rgba(229,72,77,.12); }
.w3d-result.info { border-left-color: #5aa9ff; }

.w3d-chart table { width: 100%; border-collapse: collapse; font-size: 14px; }
.w3d-chart td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.w3d-chart td:first-child { color: var(--muted); width: 110px; font: 500 12px var(--ui); letter-spacing: .08em; text-transform: uppercase; }
.w3d-grade { font: 400 72px/1 var(--display); }
.w3d-grade.A, .w3d-grade.B { color: var(--money); } .w3d-grade.C { color: var(--gold); } .w3d-grade.D, .w3d-grade.F { color: var(--danger); }
.w3d-scoreline { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-top: 12px; }
.w3d-scoreline div { font: 500 12px var(--ui); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.w3d-scoreline div b { display: block; font: 400 26px var(--display); letter-spacing: .02em; color: var(--text); font-variant-numeric: tabular-nums; }
.w3d-timeline { list-style: none; padding: 0 !important; margin: 0; }
.w3d-timeline li { padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.w3d-timeline .t { color: var(--muted); font-family: ui-monospace, monospace; font-size: 12px; margin-right: 6px; }
.w3d-timeline .p { float: right; font: 700 14px var(--ui); }
.w3d-timeline .p.pos { color: var(--money); } .w3d-timeline .p.neg { color: var(--danger); }
.w3d-timeline .why { color: var(--muted); font-size: 13px; margin-top: 3px; line-height: 1.45; }
.w3d-missed { background: rgba(229,72,77,.12); border-left: 4px solid var(--danger); padding: 10px 14px; color: #ffb4b6; }

@media (max-width: 600px) {
  .w3d-help-col { width: calc(100% - 24px); }
  .w3d-panel { padding: 16px; }
  .w3d-menu { padding: 22px 16px; background: rgba(4,6,10,.9); }
  .w3d-overlay.clear { padding: 12px; align-items: flex-end; }
  .w3d-interact { margin-left: 0; width: 100%; max-height: 62%; }
}
@media (prefers-reduced-motion: reduce) {
  .w3d *, .w3d *::before { animation: none !important; transition: none !important; }
}
`;
