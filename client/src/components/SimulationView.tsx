import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimulation } from '../hooks/useSimulation';
import { getScenario } from '../utils/api';
import VitalSignsMonitor from './VitalSignsMonitor';
import PatientChat from './PatientChat';
import PatientChart from './PatientChart';
import NursingActions from './NursingActions';
import MedicationPanel from './MedicationPanel';
import ScoreBoard from './ScoreBoard';
import type { ADPIEPhase } from '../types';

const PHASES: { key: ADPIEPhase; label: string }[] = [
  { key: 'assessment', label: 'Assessment' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'planning', label: 'Planning' },
  { key: 'implementation', label: 'Implementation' },
  { key: 'evaluation', label: 'Evaluation' },
];

export default function SimulationView() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const { state, startSimulation, changePhase, endSimulation, reset } = useSimulation();
  const [activeTab, setActiveTab] = useState<'chat' | 'chart' | 'actions' | 'meds'>('chat');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scenarioId) return;
    const init = async () => {
      try {
        await getScenario(scenarioId);
        await startSimulation(scenarioId);
      } catch (err) {
        console.error('Failed to start:', err);
        navigate('/scenarios');
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => { reset(); };
  }, [scenarioId]);

  if (loading || !state.scenario || !state.currentVitals) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🏥</div>
          <p className="text-gray-600">Preparing simulation...</p>
        </div>
      </div>
    );
  }

  if (state.score) {
    return <ScoreBoard score={state.score} scenario={state.scenario} onRestart={() => navigate('/scenarios')} />;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top Bar: Phase Navigation + Timer */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex gap-1">
          {PHASES.map((p, idx) => {
            const currentIdx = PHASES.findIndex(ph => ph.key === state.phase);
            const status = idx < currentIdx ? 'completed' : idx === currentIdx ? 'active' : 'inactive';
            return (
              <button
                key={p.key}
                onClick={() => changePhase(p.key)}
                className={`phase-tab ${status}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-gray-600">{formatTime(state.elapsedTime)}</span>
          <button onClick={endSimulation} className="btn-danger text-sm">End Simulation</button>
        </div>
      </div>

      {/* Alerts Banner */}
      {state.alerts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {state.alerts.map((alert, i) => (
            <span key={i} className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
              alert.severity === 'critical' ? 'bg-red-200 text-red-800 animate-pulse' : 'bg-yellow-200 text-yellow-800'
            }`}>
              {alert.message}
            </span>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Vital Signs */}
        <div className="w-72 bg-gray-50 border-r p-4 overflow-y-auto">
          <VitalSignsMonitor vitals={state.currentVitals} alerts={state.alerts} />
        </div>

        {/* Center: Interaction Area */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="bg-white border-b px-4 flex gap-1 pt-2">
            {([
              { key: 'chat', label: 'Patient Chat' },
              { key: 'chart', label: 'Patient Chart' },
              { key: 'actions', label: 'Nursing Actions' },
              { key: 'meds', label: 'Medications' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white border border-b-0 text-medical-blue -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && <PatientChat />}
            {activeTab === 'chart' && <PatientChart patient={state.scenario.patient} labResults={state.scenario.labResults} />}
            {activeTab === 'actions' && <NursingActions />}
            {activeTab === 'meds' && <MedicationPanel patient={state.scenario.patient} />}
          </div>
        </div>
      </div>
    </div>
  );
}
