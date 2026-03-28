import { useEffect, useRef } from 'react';
import type { VitalSigns, VitalSignsAlert } from '../types';

interface Props {
  vitals: VitalSigns;
  alerts: VitalSignsAlert[];
}

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

const statusColors = {
  normal: { stroke: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: 'text-green-600', glow: '' },
  warning: { stroke: '#eab308', bg: 'rgba(234,179,8,0.1)', text: 'text-yellow-600', glow: 'drop-shadow(0 0 4px rgba(234,179,8,0.5))' },
  critical: { stroke: '#ef4444', bg: 'rgba(239,68,68,0.15)', text: 'text-red-600', glow: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' },
};

function CircularGauge({ value, min, max, status, label, displayValue, unit }: {
  value: number; min: number; max: number; status: 'normal' | 'warning' | 'critical';
  label: string; displayValue: string; unit: string;
}) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const dashOffset = circumference * (1 - percentage);
  const colors = statusColors[status];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90" style={{ filter: colors.glow }}>
          {/* Background track */}
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          {/* Value arc */}
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={colors.stroke} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-sm font-bold ${colors.text} leading-none`}>{displayValue}</span>
          <span className="text-[9px] text-gray-400 leading-none mt-0.5">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-gray-500 mt-1 text-center leading-tight">{label}</span>
    </div>
  );
}

function ECGLine({ heartRate, status }: { heartRate: number; status: 'normal' | 'warning' | 'critical' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<number[]>([]);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const colors = statusColors[status];

    // Initialize data
    if (dataRef.current.length === 0) {
      dataRef.current = new Array(W).fill(H / 2);
    }

    const beatsPerFrame = heartRate / (60 * 30); // at ~30fps
    let lastTime = 0;

    const draw = (time: number) => {
      const dt = time - lastTime;
      if (dt < 33) { // ~30fps
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;

      phaseRef.current += beatsPerFrame;
      if (phaseRef.current >= 1) phaseRef.current -= 1;

      // Generate ECG-like waveform point
      const p = phaseRef.current;
      let y = H / 2;
      if (p < 0.05) y = H / 2 - (p / 0.05) * 3; // P wave
      else if (p < 0.1) y = H / 2 - (1 - (p - 0.05) / 0.05) * 3;
      else if (p < 0.15) y = H / 2; // PR segment
      else if (p < 0.18) y = H / 2 + ((p - 0.15) / 0.03) * 5; // Q wave
      else if (p < 0.25) y = H / 2 - ((p - 0.18) / 0.07) * (H * 0.65); // R wave up
      else if (p < 0.3) y = H / 2 + (1 - (p - 0.25) / 0.05) * 8; // S wave
      else if (p < 0.5) y = H / 2; // ST segment
      else if (p < 0.6) {
        const t = (p - 0.5) / 0.1;
        y = H / 2 - Math.sin(t * Math.PI) * 4; // T wave
      }

      // Add noise
      y += (Math.random() - 0.5) * 0.8;

      dataRef.current.push(y);
      if (dataRef.current.length > W) dataRef.current.shift();

      // Draw
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(34,197,94,0.1)';
      ctx.lineWidth = 0.5;
      for (let gy = 0; gy < H; gy += 10) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // ECG line
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = colors.stroke;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      for (let i = 0; i < dataRef.current.length; i++) {
        if (i === 0) ctx.moveTo(i, dataRef.current[i]);
        else ctx.lineTo(i, dataRef.current[i]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [heartRate, status]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={50}
      className="w-full rounded-lg"
    />
  );
}

export default function VitalSignsMonitor({ vitals }: Props) {
  const hrStatus = getVitalStatus('heartRate', vitals.heartRate);
  const bpStatus = getVitalStatus('systolic', vitals.bloodPressure.systolic);
  const rrStatus = getVitalStatus('respiratoryRate', vitals.respiratoryRate);
  const tempStatus = getVitalStatus('temperature', vitals.temperature);
  const spo2Status = getVitalStatus('oxygenSaturation', vitals.oxygenSaturation);
  const painStatus = getVitalStatus('painLevel', vitals.painLevel);

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Vital Signs Monitor</h3>

      {/* ECG Strip */}
      <div className="bg-black rounded-xl p-2 shadow-inner">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[10px] text-green-400 font-mono">ECG Lead II</span>
          <span className={`text-xs font-mono font-bold ${statusColors[hrStatus].text}`}>
            {vitals.heartRate} BPM
          </span>
        </div>
        <ECGLine heartRate={vitals.heartRate} status={hrStatus} />
      </div>

      {/* Circular Gauges Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-3 border transition-all duration-300 ${
          hrStatus !== 'normal' ? (hrStatus === 'critical' ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-yellow-50 border-yellow-300') : 'bg-white border-gray-200'
        }`}>
          <CircularGauge
            value={vitals.heartRate} min={30} max={180} status={hrStatus}
            label="Heart Rate" displayValue={String(vitals.heartRate)} unit="bpm"
          />
        </div>

        <div className={`rounded-xl p-3 border transition-all duration-300 ${
          spo2Status !== 'normal' ? (spo2Status === 'critical' ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-yellow-50 border-yellow-300') : 'bg-white border-gray-200'
        }`}>
          <CircularGauge
            value={vitals.oxygenSaturation} min={70} max={100} status={spo2Status}
            label="SpO2" displayValue={`${vitals.oxygenSaturation}`} unit="%"
          />
        </div>

        <div className={`rounded-xl p-3 border transition-all duration-300 ${
          bpStatus !== 'normal' ? (bpStatus === 'critical' ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-yellow-50 border-yellow-300') : 'bg-white border-gray-200'
        }`}>
          <CircularGauge
            value={vitals.bloodPressure.systolic} min={60} max={220} status={bpStatus}
            label="Blood Pressure" displayValue={`${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`} unit="mmHg"
          />
        </div>

        <div className={`rounded-xl p-3 border transition-all duration-300 ${
          rrStatus !== 'normal' ? (rrStatus === 'critical' ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-yellow-50 border-yellow-300') : 'bg-white border-gray-200'
        }`}>
          <CircularGauge
            value={vitals.respiratoryRate} min={4} max={40} status={rrStatus}
            label="Resp. Rate" displayValue={String(vitals.respiratoryRate)} unit="/min"
          />
        </div>

        <div className={`rounded-xl p-3 border transition-all duration-300 ${
          tempStatus !== 'normal' ? (tempStatus === 'critical' ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-yellow-50 border-yellow-300') : 'bg-white border-gray-200'
        }`}>
          <CircularGauge
            value={vitals.temperature} min={34} max={42} status={tempStatus}
            label="Temperature" displayValue={`${vitals.temperature}`} unit="°C"
          />
        </div>

        <div className={`rounded-xl p-3 border transition-all duration-300 ${
          painStatus !== 'normal' ? (painStatus === 'critical' ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-yellow-50 border-yellow-300') : 'bg-white border-gray-200'
        }`}>
          <CircularGauge
            value={vitals.painLevel} min={0} max={10} status={painStatus}
            label="Pain Level" displayValue={String(vitals.painLevel)} unit="/10"
          />
        </div>
      </div>

      {/* Pain Bar */}
      <div className="bg-white rounded-xl border p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-gray-500 uppercase">Pain Scale</span>
          <span className={`text-xs font-bold ${
            vitals.painLevel <= 3 ? 'text-green-600' : vitals.painLevel <= 6 ? 'text-yellow-600' : 'text-red-600'
          }`}>{vitals.painLevel}/10</span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className={`h-3 flex-1 rounded-sm transition-all duration-500 ${
                i < vitals.painLevel
                  ? i < 3 ? 'bg-green-400' : i < 6 ? 'bg-yellow-400' : 'bg-red-500'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-gray-400">None</span>
          <span className="text-[8px] text-gray-400">Moderate</span>
          <span className="text-[8px] text-gray-400">Worst</span>
        </div>
      </div>
    </div>
  );
}
