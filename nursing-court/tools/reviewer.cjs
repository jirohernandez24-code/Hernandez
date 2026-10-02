// DOCX reviewer: every question with its answer and rationale directly under it,
// plus the coverage matrix and source notes. Usage: NODE_PATH=<modules> node tools/reviewer.cjs
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, Footer, PageNumber, LevelFormat, PageBreak,
} = require("docx");

const root = path.resolve(__dirname, "..");
const bank = JSON.parse(fs.readFileSync(path.join(root, "build", "bank.json"), "utf8"));
const ORDER = [10, 9, 8, 12, 14, 11];
const INK = "111827";
const GREEN = "166534";
const AMBER_BG = "FEF3C7";
const BLUE_BG = "E0F2FE";
const FONT = "Arial";

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 21, bold: o.bold, italics: o.italics, color: o.color || INK });
const para = (children, o = {}) =>
  new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { before: o.before || 0, after: o.after ?? 60 }, indent: o.indent, shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined, keepNext: o.keepNext, border: o.border });

function questionBlock(q, n) {
  const out = [];
  const kind = q.type === "mcq" ? (q.situational ? "Situational MCQ" : "MCQ") : "Identification";
  out.push(para([run(`${n}. `, { bold: true }), run(`[${q.id} · ${kind}] `, { size: 17, color: "6B7280" }), run(q.stem)], { before: 120, keepNext: true }));
  if (q.type === "mcq") {
    q.options.forEach((o, i) => out.push(para(run(`${"ABCD"[i]}. ${o}`), { indent: { left: 360 }, after: 20, keepNext: true })));
    out.push(para([run("Answer: ", { bold: true, color: GREEN }), run(`${"ABCD"[q.answer]}. ${q.options[q.answer]}`, { bold: true, color: GREEN })], { indent: { left: 360 }, before: 40 }));
  } else {
    const also = q.aliases && q.aliases.length ? `   (also accepted: ${q.aliases.join(", ")})` : "";
    out.push(para([run("Answer: ", { bold: true, color: GREEN }), run(q.answer, { bold: true, color: GREEN }), run(also, { size: 17, color: "4B5563" })], { indent: { left: 360 } }));
  }
  out.push(para([run("Why: ", { bold: true }), run(q.rationale)], { indent: { left: 360 } }));
  if (q.type === "mcq") {
    Object.entries(q.whyNot).forEach(([i, w]) =>
      out.push(para([run(`Why not ${"ABCD"[Number(i)]}: `, { bold: true, size: 18, color: "4B5563" }), run(w, { size: 18, color: "4B5563" })], { indent: { left: 360 }, after: 20 }))
    );
  }
  if (q.mnemonic) out.push(para([run("Memory hook: ", { bold: true, size: 19 }), run(q.mnemonic, { size: 19 })], { indent: { left: 360 } }));
  if (q.note) out.push(para(run("⚠ " + q.note, { italics: true, size: 19 }), { indent: { left: 360 }, shade: AMBER_BG }));
  return out;
}

const children = [];
children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [run("Nursing Court Reviewer", { size: 52, bold: true })] }));
children.push(para(run("NCM 119-A · Nursing Leadership, Management and Professional Adjustment", { size: 24 }), { after: 120 }));
children.push(para(run(`${bank.questions.length} questions across ${bank.units.length} units. The answer sits right under each item so you can cover it, try, then check. Items marked ⚠ have a source note to verify with your professor.`)));
children.push(para(run("Order follows the game's case files: Unit 10, 9, 8, 12, 14, then bonus Unit 11.")));
const totals = bank.units.map((u) => {
  const qs = bank.questions.filter((q) => q.unit === u.unit);
  return { u, n: qs.length, mcq: qs.filter((q) => q.type === "mcq").length, id: qs.filter((q) => q.type === "id").length };
});

for (const num of ORDER) {
  const u = bank.units.find((x) => x.unit === num);
  if (!u) continue;
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(`Unit ${u.unit}: ${u.title}`, { size: 36, bold: true })] }));
  if (u.note) children.push(para(run("⚠ " + u.note, { italics: true }), { shade: AMBER_BG, after: 120 }));
  let n = 0;
  for (const t of bank.topics.filter((x) => x.unit === num)) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 80 }, keepNext: true, children: [run(t.title, { size: 28, bold: true })] }));
    children.push(para(run(t.section, { size: 17, color: "6B7280" }), { keepNext: true }));
    children.push(para([run("Concept summary: ", { bold: true }), run(t.summary)], { shade: BLUE_BG, after: 80 }));
    if (t.mnemonic) children.push(para([run("Memory hook: ", { bold: true }), run(t.mnemonic)], { shade: BLUE_BG }));
    for (const q of bank.questions.filter((x) => x.topic === t.id)) children.push(...questionBlock(q, ++n));
  }
}

// Appendix A: coverage matrix
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run("Appendix A. Coverage matrix", { size: 36, bold: true })] }));
children.push(para(run("Every topic from the content inventory maps to at least one identification item and at least one multiple-choice item.")));
const W = [900, 3300, 800, 800, 3226]; // sums to 9026 (A4 width minus 0.8in margins)
const cell = (text, w, o = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [run(text, { size: o.size || 17, bold: o.bold })] })],
  });
const head = new TableRow({ tableHeader: true, children: ["Unit", "Topic", "ID", "MCQ", "Question IDs"].map((h, i) => cell(h, W[i], { bold: true, fill: "E5E7EB", size: 18 })) });
const rows = [head];
for (const num of ORDER) {
  for (const t of bank.topics.filter((x) => x.unit === num)) {
    const qs = bank.questions.filter((q) => q.topic === t.id);
    const ids = qs.filter((q) => q.type === "id");
    const mcq = qs.filter((q) => q.type === "mcq");
    const ok = ids.length > 0 && mcq.length > 0;
    rows.push(new TableRow({ children: [cell(String(num), W[0]), cell((ok ? "✓ " : "✗ ") + t.title, W[1]), cell(String(ids.length), W[2]), cell(String(mcq.length), W[3]), cell(`${qs[0].id} to ${qs[qs.length - 1].id}`, W[4])] }));
  }
}
children.push(new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: W, rows }));
children.push(para(run(""), { after: 120 }));
const T = [2600, 1600, 1600, 1600, 1626];
const trow = (cells, o = {}) => new TableRow({ children: cells.map((c, i) => cell(c, T[i], o)) });
const all = bank.questions;
children.push(
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: T,
    rows: [
      trow(["Unit", "Total", "MCQ", "Identification", "Situational MCQ"], { bold: true, fill: "E5E7EB", size: 18 }),
      ...ORDER.map((num) => {
        const t = totals.find((x) => x.u.unit === num);
        const sit = all.filter((q) => q.unit === num && q.situational).length;
        return trow([`Unit ${num}: ${t.u.title}`, String(t.n), String(t.mcq), String(t.id), String(sit)]);
      }),
      trow(["All units", String(all.length), String(all.filter((q) => q.type === "mcq").length), String(all.filter((q) => q.type === "id").length), String(all.filter((q) => q.situational).length)], { bold: true }),
    ],
  })
);

// Appendix B: source notes
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run("Appendix B. Source notes to verify", { size: 36, bold: true })] }));
children.push(para(run("The modules are transcribed notes. Where the wording looked off, the answer key follows the module's meaning, and the item is listed here.")));
for (const u of bank.units.filter((x) => x.note)) children.push(para([run(`Unit ${u.unit}: `, { bold: true }), run(u.note)], { numbering: undefined, shade: AMBER_BG }));
for (const q of all.filter((x) => x.note)) {
  const t = bank.topics.find((x) => x.id === q.topic);
  children.push(new Paragraph({ numbering: { reference: "notes", level: 0 }, spacing: { after: 60 }, children: [run(`${q.id} (${t.title}): `, { bold: true }), run(q.note.replace(/^Source note:\s*/, ""))] }));
}

const doc = new Document({
  creator: "Nursing Court",
  title: "Nursing Court Reviewer",
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  numbering: { config: [{ reference: "notes", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [
    {
      properties: { page: { margin: { top: 1152, bottom: 1152, left: 1152, right: 1152 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Nursing Court Reviewer · page ", PageNumber.CURRENT], font: FONT, size: 16, color: "6B7280" })] })] }) },
      children,
    },
  ],
});
Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "Nursing_Court_Reviewer.docx"), buf);
  console.log("wrote dist/Nursing_Court_Reviewer.docx", (buf.length / 1024).toFixed(0), "KB");
});
