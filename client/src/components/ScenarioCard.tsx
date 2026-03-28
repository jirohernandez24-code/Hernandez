import { useNavigate } from 'react-router-dom';
import type { Scenario } from '../types';

const difficultyColors = {
  easy: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function ScenarioCard({ scenario, onDelete }: { scenario: Scenario; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const p = scenario.patient;

  return (
    <div className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-lg leading-tight">{scenario.title}</h3>
        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${difficultyColors[scenario.difficulty]}`}>
          {scenario.difficulty}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{scenario.description}</p>

      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-sm font-medium text-gray-900">{p.name}, {p.age}yo {p.gender}</p>
        <p className="text-xs text-gray-500 mt-1">Chief complaint: {p.chiefComplaint}</p>
        <p className="text-xs text-gray-500">Diagnosis: {p.diagnosis}</p>
      </div>

      <div className="flex gap-2 text-xs mb-4">
        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
          {scenario.labResults.length} labs
        </span>
        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
          {p.currentMedications.length} meds
        </span>
        <span className="bg-teal-50 text-teal-700 px-2 py-1 rounded">
          {scenario.nursingGoals.length} goals
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/simulate/${scenario.id}`)}
          className="btn-primary flex-1 text-sm"
        >
          Start Simulation
        </button>
        <button
          onClick={() => onDelete(scenario.id)}
          className="btn-danger text-sm px-3"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
