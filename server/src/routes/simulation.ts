import { Router } from 'express';
import { getScenarioById } from '../services/scenarioGenerator.js';
import { startSimulation, performAction, endSimulation, getSimulation } from '../services/simulationEngine.js';
import { scoreSimulation } from '../services/scorer.js';

const router = Router();

router.post('/start', (req, res) => {
  try {
    const { scenarioId } = req.body;
    if (!scenarioId) {
      res.status(400).json({ error: 'scenarioId is required' });
      return;
    }

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }

    const state = startSimulation(scenario);
    res.json({
      sessionId: state.sessionId,
      scenario: state.scenario,
      currentVitals: state.currentVitals,
      phase: state.phase,
      conversationHistory: state.conversationHistory,
    });
  } catch (error) {
    console.error('Start simulation error:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

router.post('/:id/action', (req, res) => {
  try {
    const { type, description, phase, details } = req.body;
    const result = performAction(req.params.id, { type, description, phase, details });
    res.json(result);
  } catch (error) {
    console.error('Action error:', error);
    res.status(500).json({ error: 'Failed to perform action' });
  }
});

router.post('/:id/end', async (req, res) => {
  try {
    const state = endSimulation(req.params.id);
    if (!state) {
      res.status(404).json({ error: 'Simulation not found' });
      return;
    }

    const score = await scoreSimulation(state);
    res.json({ state, score });
  } catch (error) {
    console.error('End simulation error:', error);
    res.status(500).json({ error: 'Failed to end simulation' });
  }
});

router.get('/:id/score', (req, res) => {
  const state = getSimulation(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json(state);
});

export { router as simulationRoutes };
