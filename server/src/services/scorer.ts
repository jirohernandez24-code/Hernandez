import Anthropic from '@anthropic-ai/sdk';
import type { SimulationState, ScoreBreakdown } from '../../../shared/types.js';
import { getDatabase } from '../db/database.js';

const client = new Anthropic();

export async function scoreSimulation(state: SimulationState): Promise<ScoreBreakdown> {
  const { scenario, actionsPerformed, conversationHistory, elapsedTime } = state;

  const prompt = `You are a nursing education evaluator. Score this nursing simulation session.

SCENARIO:
- Patient: ${scenario.patient.name}, ${scenario.patient.age}yo ${scenario.patient.gender}
- Diagnosis: ${scenario.patient.diagnosis}
- Chief Complaint: ${scenario.patient.chiefComplaint}

EXPECTED ACTIONS:
${scenario.expectedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

NURSING GOALS:
${scenario.nursingGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

ACTIONS PERFORMED BY STUDENT:
${actionsPerformed.map(a => `- [${a.phase}] ${a.type}: ${a.description}`).join('\n') || '(No actions performed)'}

CONVERSATION SUMMARY:
${conversationHistory.filter(m => m.role !== 'system').map(m => `${m.role === 'student' ? 'Nurse' : 'Patient'}: ${m.content}`).join('\n').slice(0, 3000)}

SIMULATION DURATION: ${Math.round(elapsedTime / 60)} minutes

Score the student across 5 ADPIE dimensions (each 0-100):
1. Assessment (30% weight): Did they check vitals, ask about symptoms, review chart, identify problems?
2. Diagnosis (15% weight): Did they identify correct nursing diagnoses?
3. Planning (15% weight): Did they set appropriate goals and plan interventions?
4. Implementation (25% weight): Did they perform correct interventions, administer medications properly?
5. Evaluation (15% weight): Did they reassess after interventions, check outcomes?

Return JSON only:
{
  "assessment": number,
  "diagnosis": number,
  "planning": number,
  "implementation": number,
  "evaluation": number,
  "feedback": "2-3 sentence overall narrative feedback",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area 1", "area 2"],
  "criticalMisses": ["missed action 1"] or []
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse score response');

  const scores = JSON.parse(jsonMatch[0]);

  const weighted =
    scores.assessment * 0.30 +
    scores.diagnosis * 0.15 +
    scores.planning * 0.15 +
    scores.implementation * 0.25 +
    scores.evaluation * 0.15;

  const result: ScoreBreakdown = {
    assessment: scores.assessment,
    diagnosis: scores.diagnosis,
    planning: scores.planning,
    implementation: scores.implementation,
    evaluation: scores.evaluation,
    totalScore: Math.round(weighted),
    maxScore: 100,
    percentage: Math.round(weighted),
    feedback: scores.feedback || '',
    strengths: scores.strengths || [],
    improvements: scores.improvements || [],
    criticalMisses: scores.criticalMisses || [],
  };

  // Save score to database
  const db = getDatabase();
  db.prepare(`
    UPDATE simulation_sessions SET score = ?, feedback = ? WHERE id = ?
  `).run(result.totalScore, JSON.stringify(result), state.sessionId);

  return result;
}
