import { Router } from 'express';
import { generateScenario, saveScenario, getScenarios, getScenarioById, deleteScenario } from '../services/scenarioGenerator.js';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { pdfContent, difficulty } = req.body;
    if (!pdfContent) {
      res.status(400).json({ error: 'pdfContent is required' });
      return;
    }

    const contentToUse = Array.isArray(pdfContent)
      ? pdfContent.join('\n\n')
      : pdfContent;

    const scenario = await generateScenario(contentToUse.slice(0, 8000), difficulty);
    saveScenario(scenario, req.body.sourcePdf);

    res.json(scenario);
  } catch (error) {
    console.error('Scenario generation error:', error);
    res.status(500).json({ error: 'Failed to generate scenario' });
  }
});

router.get('/', (_req, res) => {
  const scenarios = getScenarios();
  res.json(scenarios);
});

router.get('/:id', (req, res) => {
  const scenario = getScenarioById(req.params.id);
  if (!scenario) {
    res.status(404).json({ error: 'Scenario not found' });
    return;
  }
  res.json(scenario);
});

router.delete('/:id', (req, res) => {
  const deleted = deleteScenario(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Scenario not found' });
    return;
  }
  res.json({ success: true });
});

export { router as scenarioRoutes };
