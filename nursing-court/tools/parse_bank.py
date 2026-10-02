"""Parse the plain-text question bank (bank/u*.txt) into bank.json.

Format (one block per question, blank-line separated):
  @unit 8 | Title | Case tagline
  # topic-id | Topic title | Source section
  > concept summary (Evidence Locker)
  M<d> | stem            multiple choice (MS<d> = situational)
  + correct :: why      - wrong :: why not
  I<d> | stem            identification
  = Answer | alias | alias
  :: rationale   ~ mnemonic   ! source note
"""
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QHEAD = re.compile(r"^(MS|M|I)(\d)\s*\|\s*(.+)$")


def parse_file(path):
    unit = None
    topics, questions = [], []
    topic = None
    q = None

    def flush():
        nonlocal q
        if q is not None:
            questions.append(q)
            q = None

    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        where = f"{path.name}:{lineno}"
        if line.startswith("@unit"):
            num, title, tagline = [p.strip() for p in line[5:].split("|")]
            unit = {"unit": int(num), "title": title, "tagline": tagline, "note": ""}
            continue
        if line.startswith("@note"):
            unit["note"] = line[5:].strip()
            continue
        if line.startswith("# "):
            flush()
            tid, title, section = [p.strip() for p in line[2:].split("|")]
            topic = {"id": tid, "unit": unit["unit"], "title": title, "section": section,
                     "summary": "", "mnemonic": ""}
            topics.append(topic)
            continue
        m = QHEAD.match(line)
        if m:
            flush()
            kind, diff, stem = m.groups()
            q = {"unit": unit["unit"], "topic": topic["id"], "type": "id" if kind == "I" else "mcq",
                 "situational": kind == "MS", "difficulty": int(diff), "stem": stem.strip(),
                 "options": [], "answer": None, "aliases": [], "rationale": "", "whyNot": {},
                 "mnemonic": "", "note": "", "sourceTag": f"Unit {unit['unit']} › {topic['section']}",
                 "_where": where}
            continue
        if q is None:
            if line.startswith(">"):
                topic["summary"] = (topic["summary"] + " " + line[1:].strip()).strip()
            elif line.startswith("~"):
                topic["mnemonic"] = line[1:].strip()
            else:
                sys.exit(f"{where}: stray line outside a question: {line}")
            continue
        if line.startswith("+") or line.startswith("-"):
            body = line[1:].strip()
            if "::" not in body:
                sys.exit(f"{where}: option missing '::' explanation")
            text, why = [p.strip() for p in body.split("::", 1)]
            q["options"].append({"text": text, "correct": line[0] == "+", "why": why})
        elif line.startswith("="):
            parts = [p.strip() for p in line[1:].split("|") if p.strip()]
            q["answer"], q["aliases"] = parts[0], parts[1:]
        elif line.startswith("::"):
            q["rationale"] = line[2:].strip()
        elif line.startswith("~"):
            q["mnemonic"] = line[1:].strip()
        elif line.startswith("!"):
            q["note"] = line[1:].strip()
        else:
            sys.exit(f"{where}: unrecognized line: {line}")
    flush()
    return unit, topics, questions


def main():
    units, topics, questions = [], [], []
    for path in sorted((ROOT / "bank").glob("u*.txt")):
        u, t, qs = parse_file(path)
        units.append(u)
        topics += t
        questions += qs

    # Validate and assign ids
    counters = {}
    errors = []
    for q in questions:
        n = counters.get(q["unit"], 0) + 1
        counters[q["unit"]] = n
        q["id"] = f"U{q['unit']}-{n:03d}"
        if q["type"] == "mcq":
            if len(q["options"]) != 4 or sum(o["correct"] for o in q["options"]) != 1:
                errors.append(f"{q['_where']}: MCQ needs 4 options with exactly 1 correct")
        else:
            if not q["answer"] or not q["rationale"]:
                errors.append(f"{q['_where']}: ID needs '=' answer and ':: rationale'")
    if errors:
        sys.exit("\n".join(errors))

    # Balance correct-answer positions A-D across all MCQs, deterministic shuffle of distractors.
    rng = random.Random(119)
    mcqs = [q for q in questions if q["type"] == "mcq"]
    slots = [i % 4 for i in range(len(mcqs))]
    rng.shuffle(slots)
    for q, slot in zip(mcqs, slots):
        correct = next(o for o in q["options"] if o["correct"])
        wrong = [o for o in q["options"] if not o["correct"]]
        rng.shuffle(wrong)
        opts = wrong[:]
        opts.insert(slot, correct)
        q["options"] = [o["text"] for o in opts]
        q["answer"] = slot
        q["rationale"] = correct["why"]
        q["whyNot"] = {str(i): o["why"] for i, o in enumerate(opts) if not o["correct"]}

    for q in questions:
        q.pop("_where", None)
        if q["type"] == "id":
            q.pop("options", None)
            q.pop("whyNot", None)

    out = {"units": units, "topics": topics, "questions": questions}
    (ROOT / "build").mkdir(exist_ok=True)
    (ROOT / "build" / "bank.json").write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")

    # Report
    print(f"{'Unit':<6}{'Total':>7}{'MCQ':>6}{'ID':>5}{'Sit':>6}")
    for u in units:
        qs = [q for q in questions if q["unit"] == u["unit"]]
        m = sum(q["type"] == "mcq" for q in qs)
        s = sum(q["situational"] for q in qs)
        print(f"{u['unit']:<6}{len(qs):>7}{m:>6}{len(qs)-m:>5}{s:>6}")
    m = len(mcqs)
    s = sum(q["situational"] for q in mcqs)
    print(f"ALL   {len(questions):>7}{m:>6}{len(questions)-m:>5}{s:>6}  situational={s/m:.0%} of MCQ, mcq share={m/len(questions):.0%}")
    pos = [0] * 4
    for q in mcqs:
        pos[q["answer"]] += 1
    print("Answer positions A-D:", pos)
    gaps = []
    for t in topics:
        qs = [q for q in questions if q["topic"] == t["id"]]
        if not any(q["type"] == "id" for q in qs) or not any(q["type"] == "mcq" for q in qs):
            gaps.append(t["id"])
        if not t["summary"]:
            gaps.append(t["id"] + " (no summary)")
    print("Coverage gaps:", gaps or "none")


if __name__ == "__main__":
    main()
