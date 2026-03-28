import type { VitalSigns, VitalSignsAlert } from '../types';

interface Props {
  vitals: VitalSigns;
  alerts: VitalSignsAlert[];
}

const VITAL_CONFIG = [
  { key: 'heartRate' as const, label: 'Heart Rate', unit: 'bpm', icon: '💓', normal: [60, 100] },
  { key: 'bloodPressure' as const, label: 'Blood Pressure', unit: 'mmHg', icon: '🩸', normal: null },
  { key: 'respiratoryRate' as const, label: 'Resp. Rate', unit: '/min', icon: '🫁', normal: [12, 20] },
  { key: 'temperature' as const, label: 'Temperature', unit: '°C', icon: '🌡️', normal: [36.1, 37.2] },
  { key: 'oxygenSaturation' as const, label: 'SpO2', unit: '%', icon: '💨', normal: [95, 100] },
  { key: 'painLevel' as const, label: 'Pain Level', unit: '/10', icon: '😣', normal: [0, 3] },
];

function getVitalStatus(key: string, value: number): 'normal' | 'warning' | 'critical' {
  const ranges: Record<string, { warning: number[]; critical: number[] }> = {
    heartRate: { warning: [50, 110], critical: [40, 130] },
    systolic: { warning: [90, 150], critical: [80, 180] },
    respiratoryRate: { warning: [10, 24], critical: [8, 30] },
    temperature: { warning: [35.5, 38.3], critical: [35.0, 39.5] },
    oxygenSaturation: { warning: [92, 101], critical: [88, 101] },
    painLevel: { warning: [0, 7], critical: [0, 9] },
  };
  const range = ranges[key];
  if (!range) return 'normal';
  if (value < range.critical[0] || value > range.critical[1]) return 'critical';
  if (value < range.warning[0] || value > range.warning[1]) return 'warning';
  return 'normal';
}

export default function VitalSignsMonitor({ vitals }: Props) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Vital Signs</h3>
      <div className="space-y-3">
        {VITAL_CONFIG.map(({ key, label, unit, icon }) => {
          let value: number;
          let displayValue: string;

          if (key === 'bloodPressure') {
            value = vitals.bloodPressure.systolic;
            displayValue = `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`;
          } else {
            value = vitals[key] as number;
            displayValue = String(value);
          }

          const statusKey = key === 'bloodPressure' ? 'systolic' : key;
          const status = getVitalStatus(statusKey, value);

          return (
            <div key={key} className={`vital-card ${status}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                </div>
                {status !== 'normal' && (
                  <span className={`w-2 h-2 rounded-full ${status === 'critical' ? 'bg-red-500 animate-ping' : 'bg-yellow-500'}`} />
                )}
              </div>
              <div className="mt-1">
                <span className={`text-2xl font-bold ${
                  status === 'critical' ? 'text-red-600' :
                  status === 'warning' ? 'text-yellow-600' : 'text-gray-900'
                }`}>
                  {displayValue}
                </span>
                <span className="text-xs text-gray-500 ml-1">{unit}</span>
              </div>
              {key === 'painLevel' && (
                <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      value <= 3 ? 'bg-green-500' : value <= 6 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${value * 10}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
