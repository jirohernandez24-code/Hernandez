import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, Patient, VitalSigns, LabResult, Medication } from '../../../shared/types.js';
import { getDatabase } from '../db/database.js';

const client = new Anthropic();

const SCENARIO_GENERATION_PROMPT = `You are a nursing education expert. Based on the following medical/nursing content extracted from a PDF, generate a realistic patient scenario for nursing simulation training.

The scenario should include:
1. A realistic patient with demographics, background story, and personality
2. A specific medical condition with appropriate symptoms
3. Baseline vital signs (some may be abnormal based on the condition)
4. Current medications
5. Lab results (some may be abnormal)
6. Nursing goals and expected nursing interventions
7. A difficulty level based on case complexity

Return your response as a JSON object with this exact structure:
{
  "title": "Brief scenario title",
  "description": "2-3 sentence scenario overview",
  "difficulty": "easy|moderate|hard|critical",
  "patient": {
    "name": "Full Name",
    "age": number,
    "gender": "Male|Female",
    "weight": number (kg),
    "height": number (cm),
    "chiefComplaint": "Main reason for visit",
    "medicalHistory": ["list", "of", "conditions"],
    "allergies": ["list of allergies or empty array"],
    "currentMedications": [
      {"name": "Drug Name", "dosage": "amount", "route": "oral|IV|IM|subcutaneous|topical|inhalation|sublingual|rectal", "frequency": "how often", "purpose": "why prescribed"}
    ],
    "diagnosis": "Primary nursing diagnosis",
    "backgroundStory": "2-3 sentences about who this patient is as a person - their job, family, concerns. This makes the simulation feel real."
  },
  "baselineVitals": {
    "heartRate": number (60-100 normal),
    "bloodPressure": {"systolic": number, "diastolic": number},
    "respiratoryRate": number (12-20 normal),
    "temperature": number (36.1-37.2 C normal),
    "oxygenSaturation": number (95-100% normal),
    "painLevel": number (0-10)
  },
  "labResults": [
    {"name": "Test Name", "value": "result", "unit": "unit", "normalRange": "range", "isAbnormal": boolean}
  ],
  "nursingGoals": ["Goal 1", "Goal 2"],
  "expectedActions": [
    "Check vital signs",
    "Assess pain level",
    "Review allergies before medication administration",
    "etc."
  ]
}

Make the vital signs and lab results consistent with the diagnosis. Make some values abnormal to reflect the patient's condition. The patient's personality and background should influence how they would describe symptoms (e.g., a stoic farmer vs. an anxious teacher).

IMPORTANT: Return ONLY the JSON object, no other text.`;

export async function generateScenario(pdfContent: string, difficulty?: string): Promise<Scenario> {
  const prompt = difficulty
    ? `${SCENARIO_GENERATION_PROMPT}\n\nTarget difficulty: ${difficulty}\n\nPDF Content:\n${pdfContent}`
    : `${SCENARIO_GENERATION_PROMPT}\n\nPDF Content:\n${pdfContent}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse scenario from AI response');
  }

  const scenarioData = JSON.parse(jsonMatch[0]);
  const id = uuidv4();

  const scenario: Scenario = {
    id,
    title: scenarioData.title,
    description: scenarioData.description,
    patient: scenarioData.patient as Patient,
    baselineVitals: scenarioData.baselineVitals as VitalSigns,
    labResults: scenarioData.labResults as LabResult[],
    nursingGoals: scenarioData.nursingGoals,
    difficulty: scenarioData.difficulty || 'moderate',
    expectedActions: scenarioData.expectedActions,
  };

  return scenario;
}

export function saveScenario(scenario: Scenario, sourcePdf?: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO scenarios (id, title, description, patient_data, vital_signs, medications, lab_results, nursing_goals, expected_actions, difficulty, source_pdf)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    scenario.id,
    scenario.title,
    scenario.description,
    JSON.stringify(scenario.patient),
    JSON.stringify(scenario.baselineVitals),
    JSON.stringify(scenario.patient.currentMedications),
    JSON.stringify(scenario.labResults),
    JSON.stringify(scenario.nursingGoals),
    JSON.stringify(scenario.expectedActions),
    scenario.difficulty,
    sourcePdf || null,
  );
}

export function getScenarios(): Scenario[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM scenarios ORDER BY created_at DESC').all() as Array<Record<string, string>>;

  return rows.map(rowToScenario);
}

export function getScenarioById(id: string): Scenario | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id) as Record<string, string> | undefined;
  if (!row) return null;
  return rowToScenario(row);
}

export function deleteScenario(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
  return result.changes > 0;
}

function rowToScenario(row: Record<string, string>): Scenario {
  const patient = JSON.parse(row.patient_data) as Patient;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    patient,
    baselineVitals: JSON.parse(row.vital_signs) as VitalSigns,
    labResults: JSON.parse(row.lab_results || '[]') as LabResult[],
    nursingGoals: JSON.parse(row.nursing_goals || '[]') as string[],
    difficulty: row.difficulty as Scenario['difficulty'],
    expectedActions: JSON.parse(row.expected_actions || '[]') as string[],
    sourcePdf: row.source_pdf,
    createdAt: row.created_at,
  };
}
