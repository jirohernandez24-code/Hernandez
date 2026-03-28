import { useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import type { ADPIEPhase } from '../types';

const ACTIONS_BY_PHASE: Record<ADPIEPhase, Array<{ type: string; description: string }>> = {
  assessment: [
    { type: 'assessment', description: 'Check vital signs' },
    { type: 'assessment', description: 'Perform head-to-toe assessment' },
    { type: 'assessment', description: 'Review patient chart and history' },
    { type: 'assessment', description: 'Assess pain level (0-10 scale)' },
    { type: 'assessment', description: 'Check IV site and lines' },
    { type: 'assessment', description: 'Assess level of consciousness' },
    { type: 'assessment', description: 'Review lab results' },
    { type: 'assessment', description: 'Auscultate lung sounds' },
    { type: 'assessment', description: 'Auscultate heart sounds' },
    { type: 'assessment', description: 'Check skin turgor and color' },
  ],
  diagnosis: [
    { type: 'documentation', description: 'Identify primary nursing diagnosis' },
    { type: 'documentation', description: 'Identify risk factors' },
    { type: 'documentation', description: 'Document abnormal findings' },
    { type: 'documentation', description: 'Prioritize patient problems' },
  ],
  planning: [
    { type: 'documentation', description: 'Set patient-centered goals' },
    { type: 'documentation', description: 'Plan interventions for primary diagnosis' },
    { type: 'documentation', description: 'Plan medication schedule' },
    { type: 'documentation', description: 'Plan patient education' },
    { type: 'communication', description: 'Discuss care plan with patient' },
  ],
  implementation: [
    { type: 'intervention', description: 'Reposition patient for comfort' },
    { type: 'intervention', description: 'Elevate head of bed' },
    { type: 'intervention', description: 'Apply oxygen therapy' },
    { type: 'intervention', description: 'Insert/flush IV line' },
    { type: 'intervention', description: 'Apply cold/warm compress' },
    { type: 'intervention', description: 'Wound care/dressing change' },
    { type: 'intervention', description: 'Assist with ambulation' },
    { type: 'communication', description: 'Provide patient education' },
    { type: 'communication', description: 'Update family members' },
    { type: 'communication', description: 'SBAR handoff to physician' },
  ],
  evaluation: [
    { type: 'assessment', description: 'Reassess vital signs' },
    { type: 'assessment', description: 'Reassess pain level' },
    { type: 'assessment', description: 'Evaluate medication effectiveness' },
    { type: 'documentation', description: 'Document patient response to interventions' },
    { type: 'documentation', description: 'Update care plan based on evaluation' },
    { type: 'communication', description: 'Report changes to healthcare team' },
  ],
};

export default function NursingActions() {
  const { state, performAction, changePhase } = useSimulation();
  const [customAction, setCustomAction] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);

  const actions = ACTIONS_BY_PHASE[state.phase] || [];

  const handleAction = async (type: string, description: string) => {
    const result = await performAction({ type, description });
    if (result) {
      setFeedback({ message: result.message, success: result.success });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleCustomAction = async () => {
    if (!customAction.trim()) return;
    await handleAction('intervention', customAction.trim());
    setCustomAction('');
  };

  const phaseLabels: Record<ADPIEPhase, string> = {
    assessment: 'What do you need to assess?',
    diagnosis: 'What are your nursing diagnoses?',
    planning: 'What is your care plan?',
    implementation: 'What interventions will you perform?',
    evaluation: 'How will you evaluate outcomes?',
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 capitalize">{state.phase} Phase</h3>
          <p className="text-sm text-gray-500">{phaseLabels[state.phase]}</p>
        </div>
        <div className="flex gap-1">
          {(['assessment', 'diagnosis', 'planning', 'implementation', 'evaluation'] as ADPIEPhase[]).map(p => (
            <button
              key={p}
              onClick={() => changePhase(p)}
              className={`w-8 h-8 rounded-full text-xs font-bold ${
                state.phase === p ? 'bg-medical-blue text-white' : 'bg-gray-200 text-gray-600'
              }`}
              title={p}
            >
              {p[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          feedback.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => handleAction(action.type, action.description)}
            className="bg-white border rounded-lg p-3 text-left text-sm hover:bg-blue-50 hover:border-medical-blue transition-colors"
          >
            <span className="text-xs uppercase font-medium text-gray-400 block mb-1">{action.type}</span>
            {action.description}
          </button>
        ))}
      </div>

      {/* Custom Action */}
      <div className="border-t pt-4">
        <label className="text-sm font-medium text-gray-700 block mb-2">Custom Action</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customAction}
            onChange={(e) => setCustomAction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomAction()}
            placeholder="Describe a nursing action..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue"
          />
          <button onClick={handleCustomAction} disabled={!customAction.trim()} className="btn-primary text-sm">
            Perform
          </button>
        </div>
      </div>

      {/* Actions Log */}
      {state.actions.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Actions Taken ({state.actions.length})</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {state.actions.map((a) => (
              <div key={a.id} className="text-xs text-gray-500 flex items-center gap-2">
                <span className="text-green-500">+</span>
                <span className="capitalize text-gray-400">[{a.phase}]</span>
                {a.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
