export const GAME_CSS = `
.w3d { position: relative; width: 100%; height: 100%; overflow: hidden; background: #0b1220; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; user-select: none; -webkit-user-select: none; }
.w3d canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
.w3d canvas.w3d-pointing { cursor: pointer; }
.w3d button { font: inherit; cursor: pointer; }
.w3d-hud { position: absolute; inset: 0; pointer-events: none; }
.w3d-hud > * { pointer-events: auto; }
.w3d-card { background: rgba(255,255,255,0.92); backdrop-filter: blur(6px); border-radius: 14px; box-shadow: 0 6px 24px rgba(15,23,42,0.18); }
.w3d-patient { position: absolute; top: 12px; left: 12px; padding: 10px 14px; max-width: min(320px, calc(100% - 24px)); font-size: 13px; line-height: 1.35; }
.w3d-patient h3 { margin: 0 0 2px; font-size: 15px; }
.w3d-patient .dx { color: #475569; }
.w3d-patient .allergy { color: #b91c1c; font-weight: 600; }
.w3d-cond { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 12px; }
.w3d-cond.critical { background: #fee2e2; color: #b91c1c; animation: w3dpulse 1s infinite; }
.w3d-cond.worse { background: #ffedd5; color: #c2410c; }
.w3d-cond.better { background: #dbeafe; color: #1d4ed8; }
.w3d-cond.stable { background: #dcfce7; color: #15803d; }
@keyframes w3dpulse { 50% { opacity: .55; } }
.w3d-top-right { position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.w3d-score { padding: 8px 14px; text-align: right; font-size: 12px; color: #475569; }
.w3d-score b { display: block; font-size: 22px; color: #0f172a; }
.w3d-progress { height: 6px; background: #e2e8f0; border-radius: 99px; margin-top: 4px; overflow: hidden; width: 140px; }
.w3d-progress > div { height: 100%; background: linear-gradient(90deg, #0d9488, #22c55e); transition: width .4s; }
.w3d-tools { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.w3d-tools button { border: 0; background: rgba(255,255,255,0.92); border-radius: 10px; padding: 7px 10px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.w3d-tools button:hover { background: #fff; }
.w3d-vitals { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: none; gap: 10px; padding: 6px 12px; background: rgba(5,8,12,0.85); border-radius: 12px; font-family: ui-monospace, monospace; font-size: 13px; color: #e2e8f0; white-space: nowrap; }
.w3d-vitals.on { display: flex; }
.w3d-vitals span b { font-size: 16px; }
.w3d-vitals .hr b { color: #4ade80; } .w3d-vitals .sp b { color: #38bdf8; } .w3d-vitals .bp b { color: #f472b6; } .w3d-vitals .rr b { color: #facc15; }
.w3d-vitals .alarm b { color: #f87171; animation: w3dpulse .8s infinite; }
.w3d-crosshair { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: rgba(255,255,255,.9); box-shadow: 0 0 0 2px rgba(15,23,42,.5); pointer-events: none; }
.w3d-prompt { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); padding: 10px 18px; font-size: 14px; font-weight: 600; white-space: nowrap; opacity: 0; transition: opacity .15s; pointer-events: none; }
.w3d-prompt.on { opacity: 1; }
.w3d-prompt kbd { background: #0f172a; color: #fff; border-radius: 6px; padding: 1px 7px; margin-right: 6px; font-family: inherit; }
.w3d-prompt.far { color: #64748b; }
.w3d-toasts { position: absolute; left: 12px; bottom: 14px; width: min(360px, calc(100% - 24px)); display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.w3d-toast { padding: 8px 12px; font-size: 13px; line-height: 1.35; border-left: 5px solid #64748b; animation: w3din .25s ease-out; }
.w3d-toast.critical, .w3d-toast.good { border-left-color: #16a34a; }
.w3d-toast.harmful { border-left-color: #dc2626; }
.w3d-toast.info { border-left-color: #2563eb; }
.w3d-toast .pts { float: right; font-weight: 700; margin-left: 8px; }
.w3d-toast.harmful .pts { color: #dc2626; } .w3d-toast.good .pts, .w3d-toast.critical .pts { color: #16a34a; }
@keyframes w3din { from { transform: translateY(8px); opacity: 0; } }
.w3d-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at center, transparent 45%, rgba(220,38,38,.55) 100%); opacity: 0; transition: opacity .6s; }
.w3d-joystick { position: absolute; left: 22px; bottom: 90px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.5); display: none; touch-action: none; }
.w3d-joystick > div { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(255,255,255,.75); pointer-events: none; }
.w3d-use { position: absolute; right: 22px; bottom: 110px; width: 84px; height: 84px; border-radius: 50%; border: 0; background: rgba(13,148,136,.9); color: #fff; font-weight: 700; font-size: 15px; display: none; box-shadow: 0 4px 14px rgba(0,0,0,.3); }
@media (pointer: coarse) { .w3d-joystick, .w3d-use { display: block; } .w3d-toasts { bottom: 220px; } .w3d-prompt { bottom: 12px; } }
.w3d-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,.55); z-index: 5; }
.w3d-overlay.clear { background: transparent; pointer-events: none; }
.w3d-overlay.clear > .w3d-panel { pointer-events: auto; }
.w3d-panel { background: #fff; border-radius: 18px; box-shadow: 0 20px 60px rgba(0,0,0,.35); width: min(720px, 100%); max-height: 100%; overflow: auto; padding: 22px; }
.w3d-panel.narrow { width: min(460px, 100%); }
.w3d-panel h1 { margin: 0; font-size: 28px; }
.w3d-panel h2 { margin: 0 0 4px; font-size: 20px; }
.w3d-panel h4 { margin: 16px 0 6px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
.w3d-panel p { margin: 6px 0; line-height: 1.5; }
.w3d-panel ul { margin: 4px 0; padding-left: 20px; line-height: 1.5; }
.w3d-muted { color: #64748b; font-size: 14px; }
.w3d-btn { border: 0; border-radius: 12px; padding: 11px 18px; font-weight: 600; background: #0d9488; color: #fff; }
.w3d-btn:hover { background: #0f766e; }
.w3d-btn.secondary { background: #e2e8f0; color: #0f172a; }
.w3d-btn.secondary:hover { background: #cbd5e1; }
.w3d-btn.danger { background: #dc2626; }
.w3d-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.w3d-scenarios { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-top: 16px; }
.w3d-scn { text-align: left; border: 2px solid #e2e8f0; background: #f8fafc; border-radius: 14px; padding: 14px; transition: border-color .15s, transform .15s; }
.w3d-scn:hover { border-color: #0d9488; transform: translateY(-2px); }
.w3d-scn b { display: block; font-size: 16px; margin: 6px 0 4px; }
.w3d-scn span { font-size: 13px; color: #475569; }
.w3d-tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.w3d-tag.Beginner { background: #dcfce7; color: #166534; } .w3d-tag.Intermediate { background: #fef9c3; color: #854d0e; } .w3d-tag.Advanced { background: #fee2e2; color: #991b1b; }
.w3d-controls { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 14px; margin-top: 6px; }
.w3d-controls kbd { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 1px 6px; font-family: inherit; font-size: 12px; }
.w3d-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.w3d-action { text-align: left; border: 1.5px solid #cbd5e1; background: #fff; border-radius: 12px; padding: 11px 14px; font-size: 15px; }
.w3d-action:hover:not(:disabled) { border-color: #0d9488; background: #f0fdfa; }
.w3d-action:disabled { opacity: .55; cursor: default; }
.w3d-action .done { float: right; color: #16a34a; font-weight: 700; }
.w3d-result { margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: #f1f5f9; font-size: 14px; line-height: 1.5; border-left: 5px solid #64748b; }
.w3d-result.good, .w3d-result.critical { background: #f0fdf4; border-left-color: #16a34a; }
.w3d-result.harmful { background: #fef2f2; border-left-color: #dc2626; }
.w3d-result.info { background: #eff6ff; border-left-color: #2563eb; }
.w3d-chart table { width: 100%; border-collapse: collapse; font-size: 14px; }
.w3d-chart td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.w3d-chart td:first-child { color: #64748b; width: 110px; }
.w3d-grade { font-size: 64px; font-weight: 800; line-height: 1; }
.w3d-grade.A, .w3d-grade.B { color: #16a34a; } .w3d-grade.C { color: #ca8a04; } .w3d-grade.D, .w3d-grade.F { color: #dc2626; }
.w3d-stats { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.w3d-stats div { font-size: 13px; color: #64748b; } .w3d-stats div b { display: block; font-size: 22px; color: #0f172a; }
.w3d-timeline { list-style: none; padding: 0 !important; margin: 0; }
.w3d-timeline li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
.w3d-timeline .t { color: #64748b; font-family: ui-monospace, monospace; font-size: 12px; margin-right: 6px; }
.w3d-timeline .p { float: right; font-weight: 700; }
.w3d-timeline .p.pos { color: #16a34a; } .w3d-timeline .p.neg { color: #dc2626; }
.w3d-timeline .why { color: #475569; font-size: 13px; margin-top: 2px; }
.w3d-missed { background: #fef2f2; border-radius: 12px; padding: 10px 14px; color: #991b1b; }
.w3d-code { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(185,28,28,.8); color: #fff; font-size: clamp(32px, 8vw, 72px); font-weight: 900; letter-spacing: .08em; z-index: 6; animation: w3dpulse .6s infinite; }
@media (max-width: 600px) {
  .w3d-patient { max-width: calc(100% - 140px); padding: 8px 10px; font-size: 12px; }
  .w3d-patient .dx { display: none; }
  .w3d-patient h3 { font-size: 14px; }
  .w3d-score { padding: 6px 10px; }
  .w3d-score b { font-size: 18px; }
  .w3d-progress { width: 96px; }
  .w3d-tools { max-width: 110px; }
  .w3d-txt { display: none; }
  .w3d-vitals { top: auto; bottom: 60px; font-size: 11px; gap: 6px; }
  .w3d-vitals span b { font-size: 13px; }
  .w3d-panel { padding: 16px; }
  .w3d-panel h1 { font-size: 22px; }
}
`;
