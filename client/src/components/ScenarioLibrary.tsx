import { useState, useEffect } from 'react';
import { getScenarios, deleteScenario } from '../utils/api';
import type { Scenario } from '../types';
import ScenarioCard from './ScenarioCard';

export default function ScenarioLibrary() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScenarios = async () => {
    try {
      const data = await getScenarios();
      setScenarios(data);
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScenarios(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteScenario(id);
      setScenarios(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete scenario:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Loading scenarios...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scenario Library</h2>
          <p className="text-gray-600">{scenarios.length} scenarios available</p>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Scenarios Yet</h3>
          <p className="text-gray-600">Upload a PDF to generate your first patient scenario</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map(scenario => (
            <ScenarioCard key={scenario.id} scenario={scenario} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
