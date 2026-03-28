import { useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import type { Patient } from '../types';

const COMMON_MEDICATIONS = [
  { name: 'Morphine Sulfate', dosage: '2-4mg', route: 'IV', purpose: 'Pain management' },
  { name: 'Acetaminophen', dosage: '500-1000mg', route: 'oral', purpose: 'Pain/fever reduction' },
  { name: 'Ibuprofen', dosage: '400mg', route: 'oral', purpose: 'Anti-inflammatory/pain' },
  { name: 'Albuterol', dosage: '2.5mg', route: 'inhalation', purpose: 'Bronchodilator' },
  { name: 'Normal Saline', dosage: '1000mL', route: 'IV', purpose: 'Fluid replacement' },
  { name: 'Ondansetron', dosage: '4mg', route: 'IV', purpose: 'Anti-nausea' },
  { name: 'Metoprolol', dosage: '25mg', route: 'oral', purpose: 'Heart rate control' },
  { name: 'Lisinopril', dosage: '10mg', route: 'oral', purpose: 'Blood pressure management' },
  { name: 'Insulin Regular', dosage: 'per sliding scale', route: 'subcutaneous', purpose: 'Blood glucose control' },
  { name: 'Heparin', dosage: '5000 units', route: 'subcutaneous', purpose: 'DVT prophylaxis' },
  { name: 'Ceftriaxone', dosage: '1g', route: 'IV', purpose: 'Antibiotic' },
  { name: 'Supplemental Oxygen', dosage: '2-4L/min', route: 'inhalation', purpose: 'Oxygen therapy' },
];

export default function MedicationPanel({ patient }: { patient: Patient }) {
  const { performAction } = useSimulation();
  const [selectedMed, setSelectedMed] = useState<typeof COMMON_MEDICATIONS[0] | null>(null);
  const [customMed, setCustomMed] = useState({ name: '', dosage: '', route: 'oral' });
  const [feedback, setFeedback] = useState<string | null>(null);

  const administerMed = async (name: string, dosage: string, route: string) => {
    // Check allergies
    const allergyMatch = patient.allergies.find(a =>
      name.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(name.toLowerCase())
    );

    if (allergyMatch) {
      setFeedback(`ALLERGY ALERT: Patient is allergic to ${allergyMatch}! Do NOT administer ${name}.`);
      setTimeout(() => setFeedback(null), 5000);
      return;
    }

    const result = await performAction({
      type: 'medication',
      description: `Administer ${name} ${dosage} via ${route}`,
      details: { medication: name, dosage, route },
    });

    if (result) {
      setFeedback(result.message);
      setSelectedMed(null);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Medication Administration</h3>

      {/* Allergy Warning */}
      {patient.allergies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-bold text-red-700">ALLERGIES:</p>
          <div className="flex gap-2 mt-1">
            {patient.allergies.map((a, i) => (
              <span key={i} className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">{a}</span>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          feedback.includes('ALLERGY') || feedback.includes('WARNING')
            ? 'bg-red-100 text-red-700 border border-red-300'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {feedback}
        </div>
      )}

      {/* Current Medications */}
      <section className="mb-6">
        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Current Orders</h4>
        <div className="space-y-2">
          {patient.currentMedications.map((med, i) => (
            <div key={i} className="bg-white border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{med.name}</p>
                <p className="text-xs text-gray-500">{med.dosage} | {med.route} | {med.frequency}</p>
              </div>
              <button
                onClick={() => administerMed(med.name, med.dosage, med.route)}
                className="btn-success text-xs"
              >
                Administer
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* PRN / Common Medications */}
      <section className="mb-6">
        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Available PRN Medications</h4>
        <div className="grid grid-cols-2 gap-2">
          {COMMON_MEDICATIONS.map((med, i) => (
            <button
              key={i}
              onClick={() => setSelectedMed(med)}
              className={`bg-white border rounded-lg p-3 text-left text-sm hover:bg-blue-50 transition-colors ${
                selectedMed?.name === med.name ? 'border-medical-blue bg-blue-50' : ''
              }`}
            >
              <p className="font-medium text-gray-900">{med.name}</p>
              <p className="text-xs text-gray-500">{med.dosage} | {med.route}</p>
              <p className="text-xs text-gray-400">{med.purpose}</p>
            </button>
          ))}
        </div>
      </section>

      {selectedMed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-bold text-sm mb-2">Confirm Administration</h4>
          <p className="text-sm mb-1"><strong>Medication:</strong> {selectedMed.name}</p>
          <p className="text-sm mb-1"><strong>Dosage:</strong> {selectedMed.dosage}</p>
          <p className="text-sm mb-1"><strong>Route:</strong> {selectedMed.route}</p>
          <p className="text-sm mb-3"><strong>Purpose:</strong> {selectedMed.purpose}</p>
          <div className="flex gap-2">
            <button
              onClick={() => administerMed(selectedMed.name, selectedMed.dosage, selectedMed.route)}
              className="btn-success text-sm"
            >
              Confirm & Administer
            </button>
            <button onClick={() => setSelectedMed(null)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Custom Medication */}
      <section className="border-t pt-4">
        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Custom Medication</h4>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input
            type="text"
            value={customMed.name}
            onChange={(e) => setCustomMed(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Drug name"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={customMed.dosage}
            onChange={(e) => setCustomMed(prev => ({ ...prev, dosage: e.target.value }))}
            placeholder="Dosage"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={customMed.route}
            onChange={(e) => setCustomMed(prev => ({ ...prev, route: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="oral">Oral</option>
            <option value="IV">IV</option>
            <option value="IM">IM</option>
            <option value="subcutaneous">Subcutaneous</option>
            <option value="topical">Topical</option>
            <option value="inhalation">Inhalation</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (customMed.name) {
              administerMed(customMed.name, customMed.dosage, customMed.route);
              setCustomMed({ name: '', dosage: '', route: 'oral' });
            }
          }}
          disabled={!customMed.name}
          className="btn-primary text-sm w-full"
        >
          Administer Custom Medication
        </button>
      </section>
    </div>
  );
}
