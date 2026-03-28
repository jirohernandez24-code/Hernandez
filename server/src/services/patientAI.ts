import Anthropic from '@anthropic-ai/sdk';
import type { Patient, VitalSigns, ChatMessage } from '../../../shared/types.js';

const client = new Anthropic();

function buildPatientSystemPrompt(patient: Patient, currentVitals: VitalSigns): string {
  return `You are roleplaying as a patient in a nursing simulation. Stay in character at all times.

YOUR IDENTITY:
- Name: ${patient.name}
- Age: ${patient.age} years old
- Gender: ${patient.gender}
- Background: ${patient.backgroundStory}
- Chief Complaint: ${patient.chiefComplaint}
- Diagnosis: ${patient.diagnosis}

YOUR MEDICAL HISTORY:
${patient.medicalHistory.map(h => `- ${h}`).join('\n')}

YOUR ALLERGIES:
${patient.allergies.length ? patient.allergies.map(a => `- ${a}`).join('\n') : '- None known'}

YOUR CURRENT MEDICATIONS:
${patient.currentMedications.map(m => `- ${m.name} ${m.dosage} ${m.route} ${m.frequency}`).join('\n')}

YOUR CURRENT STATE:
- Heart Rate: ${currentVitals.heartRate} bpm
- Blood Pressure: ${currentVitals.bloodPressure.systolic}/${currentVitals.bloodPressure.diastolic}
- Temperature: ${currentVitals.temperature}°C
- Pain Level: ${currentVitals.painLevel}/10
- Oxygen Saturation: ${currentVitals.oxygenSaturation}%

ROLEPLAY RULES:
1. You are NOT a medical professional. Describe symptoms in everyday language, not medical terms.
2. Your pain level affects your mood and patience. Higher pain = shorter, more irritable responses.
3. If your oxygen saturation is low, you might seem breathless or confused.
4. If your temperature is high, you might seem tired, sweaty, or uncomfortable.
5. You may be anxious, scared, confused, or in denial about your condition.
6. Answer the nurse's questions honestly but don't volunteer information they don't ask about.
7. You can ask questions back: "Am I going to be okay?", "When can I eat?", "Can I see my family?"
8. Keep responses to 1-3 sentences. You're a patient, not giving a lecture.
9. If asked about pain, describe WHERE it hurts, WHAT it feels like (sharp, dull, burning), and WHEN it started.
10. Show personality consistent with your background story.

If the nurse does something that helps (gives medication, repositions you), acknowledge the relief after a moment.
If the nurse hasn't addressed your pain or concerns, you can bring them up again.`;
}

export async function getPatientResponse(
  patient: Patient,
  currentVitals: VitalSigns,
  conversationHistory: ChatMessage[],
  studentMessage: string,
): Promise<string> {
  const systemPrompt = buildPatientSystemPrompt(patient, currentVitals);

  const messages = conversationHistory
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: (m.role === 'student' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

  messages.push({ role: 'user', content: studentMessage });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: systemPrompt,
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
