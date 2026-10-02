# NGT Feeding Ward

A browser game for **Skills Enhancement #7: Nasogastric Tube (NGT) Feeding** from the Level 4 Skills Enhancement Checklist. You play a student nurse in a ward: walk to the chart, supply cart, sink, bed, waste bins and computer, then do the feeding at the bedside.

Open `dist/play.html` in any browser to play. No install needed.

## What you do

| Checklist phase | In the game |
| --- | --- |
| Assessment | Read the doctor's order, feeding record, MAR and allergies; confirm the feeding plan; assess the client for malnutrition and dehydration |
| Planning | Gather equipment at the cart, raise the head of bed (30° or more), introduce yourself and check two identifiers, explain, hand hygiene, close the curtain |
| Implementation | Gloves, unplug, aspirate, read the pH strip, measure and re-instill residual, check formula expiry, temperature and alcohol swab, clamp, remove the plunger, pour, adjust syringe height, pause for cramps, flush 50 to 100 mL water, clamp before it runs dry, plug, secure to gown, dispose, remove gloves, hand hygiene |
| Evaluation | Tolerance, bowel sounds, fullness, weight, elimination, skin turgor, urine |
| Documentation | Nurse's notes: feeding, water, duration, assessment, I&O, report |

Four clients: a routine feeding; a recent medication plus lactose intolerance and an expired can; a high residual that must be held; and a pH of 7 after re-insertion.

**Practice** mode shows Clinical Instructor tips and stops unsafe steps with a rationale. **Return demo** hides the checklist and ends the run on a critical error.

Scoring follows the checklist rubric: Patient Assessment 20%, Nursing Care Performance 30%, Records Management 30%, Timeliness 20%, each rated 5 (Exemplary) to 3 (Very Poor).

Controls: WASD or arrow keys to walk, E or Space to use, H for a hint, M for sound. On phones, use the on-screen stick, or tap the floor or an object.

## Build and test

```sh
node tools/build.mjs                                  # src/ -> dist/index.html (fragment) + dist/play.html
NODE_PATH=$(npm root -g) node tools/playtest.mjs      # plays all four clients headlessly with Playwright
```

Sources are in `src/`: `data.js` (clients, supplies, checklist), `world.js` (ward and nurse), `bedside.js` (close-up procedure), `ui.js` (stations, scoring, screens).
