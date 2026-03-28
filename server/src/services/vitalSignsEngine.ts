import type { VitalSigns, VitalSignsAlert, NursingAction } from '../../../shared/types.js';

interface VitalDrift {
  heartRate: number;
  systolic: number;
  diastolic: number;
  respiratoryRate: number;
  temperature: number;
  oxygenSaturation: number;
  painLevel: number;
}

interface InterventionEffect {
  vital: string;
  delta: number;
  duration: number;
  startTick: number;
}

const ALERT_THRESHOLDS = {
  heartRate: { warning: [50, 110], critical: [40, 130] },
  systolic: { warning: [90, 150], critical: [80, 180] },
  diastolic: { warning: [50, 95], critical: [40, 110] },
  respiratoryRate: { warning: [10, 24], critical: [8, 30] },
  temperature: { warning: [35.5, 38.3], critical: [35.0, 39.5] },
  oxygenSaturation: { warning: [92, 101], critical: [88, 101] },
  painLevel: { warning: [0, 7], critical: [0, 9] },
};

export class VitalSignsEngine {
  private baselineVitals: VitalSigns;
  private currentVitals: VitalSigns;
  private drift: VitalDrift;
  private effects: InterventionEffect[] = [];
  private tickCount = 0;
  private condition: string;

  constructor(baseline: VitalSigns, condition: string) {
    this.baselineVitals = { ...baseline };
    this.currentVitals = { ...baseline, bloodPressure: { ...baseline.bloodPressure } };
    this.condition = condition.toLowerCase();
    this.drift = this.calculateDrift();
  }

  private calculateDrift(): VitalDrift {
    const baseDrift: VitalDrift = {
      heartRate: 0, systolic: 0, diastolic: 0,
      respiratoryRate: 0, temperature: 0,
      oxygenSaturation: 0, painLevel: 0,
    };

    if (this.condition.includes('pneumonia') || this.condition.includes('respiratory')) {
      baseDrift.respiratoryRate = 0.05;
      baseDrift.oxygenSaturation = -0.03;
      baseDrift.temperature = 0.01;
      baseDrift.heartRate = 0.1;
    } else if (this.condition.includes('heart') || this.condition.includes('cardiac')) {
      baseDrift.heartRate = 0.15;
      baseDrift.systolic = -0.1;
      baseDrift.oxygenSaturation = -0.02;
    } else if (this.condition.includes('sepsis') || this.condition.includes('infection')) {
      baseDrift.temperature = 0.02;
      baseDrift.heartRate = 0.2;
      baseDrift.systolic = -0.15;
      baseDrift.respiratoryRate = 0.08;
    } else if (this.condition.includes('diabetes') || this.condition.includes('diabetic')) {
      baseDrift.heartRate = 0.05;
      baseDrift.respiratoryRate = 0.02;
    } else if (this.condition.includes('pain') || this.condition.includes('fracture')) {
      baseDrift.heartRate = 0.08;
      baseDrift.painLevel = 0.02;
      baseDrift.systolic = 0.1;
    } else {
      baseDrift.heartRate = 0.02;
      baseDrift.painLevel = 0.01;
    }

    return baseDrift;
  }

  applyAction(action: NursingAction): void {
    const desc = action.description.toLowerCase();
    const details = action.details || {};

    if (action.type === 'medication') {
      const medName = (details.medication || desc).toLowerCase();

      if (medName.includes('morphine') || medName.includes('opioid') || medName.includes('fentanyl')) {
        this.effects.push({ vital: 'painLevel', delta: -0.5, duration: 40, startTick: this.tickCount });
        this.effects.push({ vital: 'heartRate', delta: -0.2, duration: 40, startTick: this.tickCount });
        this.effects.push({ vital: 'respiratoryRate', delta: -0.1, duration: 40, startTick: this.tickCount });
      } else if (medName.includes('antibiotic')) {
        this.effects.push({ vital: 'temperature', delta: -0.005, duration: 100, startTick: this.tickCount });
      } else if (medName.includes('antihypertensive') || medName.includes('lisinopril') || medName.includes('amlodipine')) {
        this.effects.push({ vital: 'systolic', delta: -0.3, duration: 60, startTick: this.tickCount });
        this.effects.push({ vital: 'diastolic', delta: -0.15, duration: 60, startTick: this.tickCount });
      } else if (medName.includes('oxygen') || medName.includes('o2')) {
        this.effects.push({ vital: 'oxygenSaturation', delta: 0.1, duration: 30, startTick: this.tickCount });
      } else if (medName.includes('acetaminophen') || medName.includes('ibuprofen') || medName.includes('nsaid')) {
        this.effects.push({ vital: 'painLevel', delta: -0.3, duration: 50, startTick: this.tickCount });
        this.effects.push({ vital: 'temperature', delta: -0.003, duration: 50, startTick: this.tickCount });
      } else if (medName.includes('albuterol') || medName.includes('bronchodilator')) {
        this.effects.push({ vital: 'respiratoryRate', delta: -0.1, duration: 30, startTick: this.tickCount });
        this.effects.push({ vital: 'oxygenSaturation', delta: 0.08, duration: 30, startTick: this.tickCount });
      }
    }

    if (action.type === 'intervention') {
      if (desc.includes('position') || desc.includes('elevate')) {
        this.effects.push({ vital: 'oxygenSaturation', delta: 0.03, duration: 20, startTick: this.tickCount });
        this.effects.push({ vital: 'respiratoryRate', delta: -0.05, duration: 20, startTick: this.tickCount });
      } else if (desc.includes('ice') || desc.includes('cold')) {
        this.effects.push({ vital: 'painLevel', delta: -0.1, duration: 15, startTick: this.tickCount });
      }
    }
  }

  tick(): { vitals: VitalSigns; alerts: VitalSignsAlert[] } {
    this.tickCount++;
    const noise = () => (Math.random() - 0.5) * 0.4;

    let hrDelta = this.drift.heartRate + noise();
    let sysDelta = this.drift.systolic + noise();
    let diaDelta = this.drift.diastolic + noise() * 0.5;
    let rrDelta = this.drift.respiratoryRate + noise() * 0.3;
    let tempDelta = this.drift.temperature + noise() * 0.01;
    let spo2Delta = this.drift.oxygenSaturation + noise() * 0.1;
    let painDelta = this.drift.painLevel + noise() * 0.05;

    // Apply intervention effects
    this.effects = this.effects.filter(effect => {
      const elapsed = this.tickCount - effect.startTick;
      if (elapsed > effect.duration) return false;

      const intensity = Math.min(1, elapsed / 5); // ramp up over 5 ticks
      const value = effect.delta * intensity;

      switch (effect.vital) {
        case 'heartRate': hrDelta += value; break;
        case 'systolic': sysDelta += value; break;
        case 'diastolic': diaDelta += value; break;
        case 'respiratoryRate': rrDelta += value; break;
        case 'temperature': tempDelta += value; break;
        case 'oxygenSaturation': spo2Delta += value; break;
        case 'painLevel': painDelta += value; break;
      }
      return true;
    });

    this.currentVitals.heartRate = clamp(this.currentVitals.heartRate + hrDelta, 30, 180);
    this.currentVitals.bloodPressure.systolic = clamp(this.currentVitals.bloodPressure.systolic + sysDelta, 60, 220);
    this.currentVitals.bloodPressure.diastolic = clamp(this.currentVitals.bloodPressure.diastolic + diaDelta, 30, 140);
    this.currentVitals.respiratoryRate = clamp(this.currentVitals.respiratoryRate + rrDelta, 4, 40);
    this.currentVitals.temperature = clamp(this.currentVitals.temperature + tempDelta, 34.0, 42.0);
    this.currentVitals.oxygenSaturation = clamp(this.currentVitals.oxygenSaturation + spo2Delta, 70, 100);
    this.currentVitals.painLevel = clamp(this.currentVitals.painLevel + painDelta, 0, 10);

    // Round for display
    this.currentVitals.heartRate = Math.round(this.currentVitals.heartRate);
    this.currentVitals.bloodPressure.systolic = Math.round(this.currentVitals.bloodPressure.systolic);
    this.currentVitals.bloodPressure.diastolic = Math.round(this.currentVitals.bloodPressure.diastolic);
    this.currentVitals.respiratoryRate = Math.round(this.currentVitals.respiratoryRate);
    this.currentVitals.temperature = Math.round(this.currentVitals.temperature * 10) / 10;
    this.currentVitals.oxygenSaturation = Math.round(this.currentVitals.oxygenSaturation);
    this.currentVitals.painLevel = Math.round(this.currentVitals.painLevel);

    const alerts = this.checkAlerts();

    return {
      vitals: { ...this.currentVitals, bloodPressure: { ...this.currentVitals.bloodPressure } },
      alerts,
    };
  }

  private checkAlerts(): VitalSignsAlert[] {
    const alerts: VitalSignsAlert[] = [];
    const v = this.currentVitals;

    const check = (vital: keyof VitalSigns, value: number, thresholdKey: string) => {
      const t = ALERT_THRESHOLDS[thresholdKey as keyof typeof ALERT_THRESHOLDS];
      if (!t) return;
      if (value < t.critical[0] || value > t.critical[1]) {
        alerts.push({ vital, value, severity: 'critical', message: `CRITICAL: ${vital} is ${value}` });
      } else if (value < t.warning[0] || value > t.warning[1]) {
        alerts.push({ vital, value, severity: 'warning', message: `Warning: ${vital} is ${value}` });
      }
    };

    check('heartRate', v.heartRate, 'heartRate');
    check('bloodPressure', v.bloodPressure.systolic, 'systolic');
    check('respiratoryRate', v.respiratoryRate, 'respiratoryRate');
    check('temperature', v.temperature, 'temperature');
    check('oxygenSaturation', v.oxygenSaturation, 'oxygenSaturation');
    check('painLevel', v.painLevel, 'painLevel');

    return alerts;
  }

  getCurrentVitals(): VitalSigns {
    return { ...this.currentVitals, bloodPressure: { ...this.currentVitals.bloodPressure } };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
