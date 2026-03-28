const BASE_URL = '/api';

export async function uploadPDF(file: File): Promise<{
  filename: string;
  numPages: number;
  textLength: number;
  chunks: string[];
  preview: string;
}> {
  const formData = new FormData();
  formData.append('pdf', file);
  const res = await fetch(`${BASE_URL}/pdf/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Failed to upload PDF');
  return res.json();
}

export async function generateScenario(pdfContent: string[], difficulty?: string, sourcePdf?: string) {
  const res = await fetch(`${BASE_URL}/scenarios/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfContent, difficulty, sourcePdf }),
  });
  if (!res.ok) throw new Error('Failed to generate scenario');
  return res.json();
}

export async function getScenarios() {
  const res = await fetch(`${BASE_URL}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
}

export async function getScenario(id: string) {
  const res = await fetch(`${BASE_URL}/scenarios/${id}`);
  if (!res.ok) throw new Error('Failed to fetch scenario');
  return res.json();
}

export async function deleteScenario(id: string) {
  const res = await fetch(`${BASE_URL}/scenarios/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete scenario');
  return res.json();
}

export async function startSimulation(scenarioId: string) {
  const res = await fetch(`${BASE_URL}/simulation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId }),
  });
  if (!res.ok) throw new Error('Failed to start simulation');
  return res.json();
}

export async function performAction(sessionId: string, action: { type: string; description: string; phase: string; details?: Record<string, string> }) {
  const res = await fetch(`${BASE_URL}/simulation/${sessionId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error('Failed to perform action');
  return res.json();
}

export async function endSimulation(sessionId: string) {
  const res = await fetch(`${BASE_URL}/simulation/${sessionId}/end`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to end simulation');
  return res.json();
}
