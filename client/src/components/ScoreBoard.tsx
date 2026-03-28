import type { ScoreBreakdown, Scenario } from '../types';

interface Props {
  score: ScoreBreakdown;
  scenario: Scenario;
  onRestart: () => void;
}

function getGrade(percentage: number): { grade: string; color: string } {
  if (percentage >= 90) return { grade: 'A', color: 'text-green-600' };
  if (percentage >= 80) return { grade: 'B', color: 'text-blue-600' };
  if (percentage >= 70) return { grade: 'C', color: 'text-yellow-600' };
  if (percentage >= 60) return { grade: 'D', color: 'text-orange-600' };
  return { grade: 'F', color: 'text-red-600' };
}

const DIMENSIONS = [
  { key: 'assessment' as const, label: 'Assessment', weight: '30%', description: 'Checking vitals, asking questions, reviewing chart' },
  { key: 'diagnosis' as const, label: 'Diagnosis', weight: '15%', description: 'Identifying nursing diagnoses' },
  { key: 'planning' as const, label: 'Planning', weight: '15%', description: 'Setting goals and planning interventions' },
  { key: 'implementation' as const, label: 'Implementation', weight: '25%', description: 'Performing interventions and administering meds' },
  { key: 'evaluation' as const, label: 'Evaluation', weight: '15%', description: 'Reassessing after interventions' },
];

export default function ScoreBoard({ score, scenario, onRestart }: Props) {
  const { grade, color } = getGrade(score.percentage);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Simulation Complete</h2>
        <p className="text-gray-600">{scenario.title}</p>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-2xl shadow-lg border p-8 text-center mb-6">
        <div className={`text-7xl font-bold ${color} mb-2`}>{grade}</div>
        <div className="text-4xl font-bold text-gray-900 mb-1">{score.percentage}%</div>
        <p className="text-gray-500">Overall Score: {score.totalScore}/{score.maxScore}</p>
      </div>

      {/* ADPIE Breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">ADPIE Breakdown</h3>
        <div className="space-y-4">
          {DIMENSIONS.map(({ key, label, weight, description }) => {
            const value = score[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="font-medium text-sm">{label}</span>
                    <span className="text-xs text-gray-400 ml-2">({weight})</span>
                  </div>
                  <span className={`font-bold text-sm ${
                    value >= 80 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {value}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-1000 ${
                      value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h3 className="font-bold text-lg mb-3">Instructor Feedback</h3>
        <p className="text-gray-700 leading-relaxed">{score.feedback}</p>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <h4 className="font-bold text-green-800 mb-3">Strengths</h4>
          <ul className="space-y-2">
            {score.strengths.map((s, i) => (
              <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">+</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h4 className="font-bold text-amber-800 mb-3">Areas for Improvement</h4>
          <ul className="space-y-2">
            {score.improvements.map((s, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">!</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Critical Misses */}
      {score.criticalMisses.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5 mb-6">
          <h4 className="font-bold text-red-800 mb-3">Critical Actions Missed</h4>
          <ul className="space-y-2">
            {score.criticalMisses.map((s, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">X</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="text-center">
        <button onClick={onRestart} className="btn-primary text-lg px-8 py-3">
          Back to Scenario Library
        </button>
      </div>
    </div>
  );
}
