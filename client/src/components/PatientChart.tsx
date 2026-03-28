import type { Patient, LabResult } from '../types';

interface Props {
  patient: Patient;
  labResults: LabResult[];
}

export default function PatientChart({ patient, labResults }: Props) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Patient Chart</h3>

      {/* Demographics */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-3">Demographics</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Name:</span> <span className="font-medium">{patient.name}</span></div>
          <div><span className="text-gray-500">Age:</span> <span className="font-medium">{patient.age} years</span></div>
          <div><span className="text-gray-500">Gender:</span> <span className="font-medium">{patient.gender}</span></div>
          <div><span className="text-gray-500">Weight:</span> <span className="font-medium">{patient.weight} kg</span></div>
          <div><span className="text-gray-500">Height:</span> <span className="font-medium">{patient.height} cm</span></div>
        </div>
      </section>

      {/* Chief Complaint */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-2">Chief Complaint</h4>
        <p className="text-sm text-gray-800">{patient.chiefComplaint}</p>
      </section>

      {/* Diagnosis */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-2">Nursing Diagnosis</h4>
        <p className="text-sm text-gray-800">{patient.diagnosis}</p>
      </section>

      {/* Medical History */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-2">Medical History</h4>
        <ul className="space-y-1">
          {patient.medicalHistory.map((h, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">-</span> {h}
            </li>
          ))}
        </ul>
      </section>

      {/* Allergies */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-2">Allergies</h4>
        {patient.allergies.length === 0 ? (
          <p className="text-sm text-green-600">No known allergies (NKA)</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {patient.allergies.map((a, i) => (
              <span key={i} className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">{a}</span>
            ))}
          </div>
        )}
      </section>

      {/* Current Medications */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-3">Current Medications</h4>
        <div className="space-y-2">
          {patient.currentMedications.map((med, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">{med.name}</p>
              <p className="text-xs text-gray-500">
                {med.dosage} | {med.route} | {med.frequency}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{med.purpose}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lab Results */}
      <section className="bg-white rounded-xl border p-4 mb-4">
        <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-3">Lab Results</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="pb-2">Test</th>
              <th className="pb-2">Value</th>
              <th className="pb-2">Normal Range</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {labResults.map((lab, i) => (
              <tr key={i} className={`border-t ${lab.isAbnormal ? 'bg-red-50' : ''}`}>
                <td className="py-2 font-medium">{lab.name}</td>
                <td className={`py-2 ${lab.isAbnormal ? 'text-red-600 font-bold' : ''}`}>
                  {lab.value} {lab.unit}
                </td>
                <td className="py-2 text-gray-500">{lab.normalRange}</td>
                <td className="py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    lab.isAbnormal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {lab.isAbnormal ? 'Abnormal' : 'Normal'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Background Story */}
      <section className="bg-blue-50 rounded-xl border border-blue-200 p-4">
        <h4 className="font-bold text-sm text-blue-700 uppercase tracking-wider mb-2">Patient Background</h4>
        <p className="text-sm text-blue-800 italic">{patient.backgroundStory}</p>
      </section>
    </div>
  );
}
