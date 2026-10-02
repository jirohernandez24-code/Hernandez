/* ================= SUPPLY ICONS (inline SVG, 40x40) ================= */
const ICONS = {
  gloves: '<path d="M12 36V20l-3-7a2 2 0 0 1 3.6-1.6L15 16V7a2 2 0 0 1 4 0v8V5a2 2 0 0 1 4 0v10V7a2 2 0 0 1 4 0v10-6a2 2 0 0 1 4 0v14c0 6-3 11-8 11z" fill="#8a63e0" stroke="#4d2fa0" stroke-width="1.5" stroke-linejoin="round"/>',
  syringe: '<rect x="13" y="6" width="12" height="24" rx="2" fill="#f4f8fb" stroke="#566" stroke-width="1.5"/><path d="M16 12h4M16 17h4M16 22h4" stroke="#7a8b8a" stroke-width="1.2"/><rect x="15" y="2" width="8" height="4" fill="#7a4fd6"/><path d="M19 30v6" stroke="#566" stroke-width="3" stroke-linecap="round"/><rect x="10" y="5" width="18" height="2" rx="1" fill="#566"/>',
  ph: '<rect x="15" y="3" width="10" height="34" rx="2" fill="#fff" stroke="#566" stroke-width="1.5"/><rect x="16.5" y="6" width="7" height="5" fill="#e0464b"/><rect x="16.5" y="12" width="7" height="5" fill="#f08a3a"/><rect x="16.5" y="18" width="7" height="5" fill="#e9c83a"/><rect x="16.5" y="24" width="7" height="5" fill="#7cbf5a"/><rect x="16.5" y="30" width="7" height="5" fill="#3a8fbf"/>',
  emesis: '<path d="M5 20c0-7 8-10 14-7 3 1.5 6 1.5 9 0 5-2 9 2 8 7-1 7-8 9-15 8-8-1-16-1-16-8z" fill="#c9d6dc" stroke="#55707a" stroke-width="1.5"/><path d="M9 20c0-4 5-6 10-4 3 1 6 1 9 0 3-1 5 1 5 4" fill="none" stroke="#8aa2ab" stroke-width="1.2"/>',
  measure: '<path d="M9 8h22l-2 28H11z" fill="#eef6f8" stroke="#55707a" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 14h6M12 20h8M12 26h6M12 32h8" stroke="#3a8fbf" stroke-width="1.3"/><path d="M31 11h4v6h-3" fill="none" stroke="#55707a" stroke-width="1.5"/>',
  water: '<path d="M10 7h20l-2 29H12z" fill="#eef6f8" stroke="#55707a" stroke-width="1.5" stroke-linejoin="round"/><path d="M11.4 17h17.2l-1.5 19H12.9z" fill="#8fd0ef"/><path d="M15 21q2 2 0 4" stroke="#fff" stroke-width="1.5" fill="none"/>',
  steth: '<path d="M12 5v10a8 8 0 0 0 16 0V5" fill="none" stroke="#2c3b3a" stroke-width="2.4" stroke-linecap="round"/><path d="M20 23v6a5 5 0 0 0 10 0v-2" fill="none" stroke="#2c3b3a" stroke-width="2.4"/><circle cx="30" cy="25" r="5" fill="#b8c4c3" stroke="#2c3b3a" stroke-width="2"/><circle cx="12" cy="5" r="2" fill="#2c3b3a"/><circle cx="28" cy="5" r="2" fill="#2c3b3a"/>',
  alcohol: '<rect x="7" y="9" width="26" height="22" rx="3" fill="#fff" stroke="#55707a" stroke-width="1.5"/><path d="M7 14h26" stroke="#3a8fbf" stroke-width="2"/><text x="20" y="27" text-anchor="middle" font-family="monospace" font-size="9" font-weight="700" fill="#1d3f9c">70%</text>',
  formula: '<rect x="11" y="8" width="18" height="28" rx="4" fill="#fff" stroke="#55707a" stroke-width="1.5"/><rect x="14" y="3" width="12" height="6" rx="1.5" fill="#7a4fd6"/><rect x="11" y="16" width="18" height="11" fill="COL"/><path d="M14 31h12" stroke="#bbb" stroke-width="1.5"/>',
  pump: '<rect x="6" y="6" width="28" height="28" rx="4" fill="#e9eef0" stroke="#55707a" stroke-width="1.5"/><rect x="10" y="10" width="20" height="10" rx="1" fill="#183b3c"/><text x="20" y="18" text-anchor="middle" font-family="monospace" font-size="7" fill="#7ef0b0">60</text><circle cx="14" cy="27" r="3" fill="#7a4fd6"/><circle cx="26" cy="27" r="3" fill="#2fae6c"/>',
  foley: '<path d="M8 32c8 0 6-10 14-10s8-12 0-14-10 6-4 8" fill="none" stroke="#e2a24a" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#f5d38c" stroke="#e2a24a" stroke-width="1.5"/>',
  iv: '<path d="M6 34L26 14" stroke="#9aa" stroke-width="2.5"/><rect x="24" y="6" width="9" height="12" rx="2" transform="rotate(45 28 12)" fill="#e9c83a" stroke="#a88b1e" stroke-width="1.2"/>',
  tourniquet: '<rect x="3" y="16" width="34" height="8" rx="4" fill="#5b8fd6" stroke="#2f5f9e" stroke-width="1.5"/><rect x="16" y="13" width="8" height="14" rx="2" fill="#2f5f9e"/>',
  gown: '<path d="M13 5l7 4 7-4 9 7-5 6-3-2v20H12V16l-3 2-5-6z" fill="#7fb2e6" stroke="#2f5f9e" stroke-width="1.5" stroke-linejoin="round"/>',
  lube: '<path d="M8 12h18l6 8-6 8H8z" fill="#d9f0f5" stroke="#55707a" stroke-width="1.5" stroke-linejoin="round"/><text x="17" y="23" text-anchor="middle" font-family="monospace" font-size="7" fill="#3a6f7a">GEL</text>',
  ophth: '<path d="M6 16h22l6 4-6 4H6z" fill="#fff" stroke="#55707a" stroke-width="1.5"/><rect x="6" y="16" width="8" height="8" fill="#e0464b"/>',
  insulin: '<rect x="17" y="6" width="6" height="24" rx="1.5" fill="#f4f8fb" stroke="#566" stroke-width="1.3"/><rect x="17.5" y="2" width="5" height="4" fill="#f08a3a"/><path d="M20 30v7" stroke="#566" stroke-width="1.2"/>',
};
const FORMULA_COL = { std: "#3a8fbf", lf: "#2fae6c", milk: "#f0c050", dm: "#e07a5f", pep: "#9b6bd8" };
function iconSvg(name, size = 40, color) {
  let body = ICONS[name] || ICONS.formula;
  if (name === "formula") body = body.replace("COL", color || "#3a8fbf");
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
}
