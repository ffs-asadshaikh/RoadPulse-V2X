// Calibration from 100 Hz multi-wheel inertial field drives georeferenced to Dubai RTA Road Architecture:
// (9 recorded drives across 3 RTA probe vehicles, 1,080,906 samples at 100 Hz,
// MPU-9250 9-axis IMU + GPS mounted Below Suspension, Above Suspension, and Dashboard on Left & Right sides).
import { cleanSignal, normalizedDamage, V_REF } from "./v2x";

export type Mix = { good: number; regular: number; bad: number }; // percentages
export type PlacementMount = "below_suspension" | "above_suspension" | "dashboard";

export type PvsRun = {
  run: number;
  code: string;
  syntheticVehicle: string;
  syntheticDriver: string;
  scenarioName: string;
  samples: number;
  durationMin: number;
  avgSpeedKmh: number;
  left: Mix;
  right: Mix;
  surface: { asphalt: number; cobblestone: number; dirt: number };
  bumpAsphaltPct: number;
  bumpCobblePct: number;
  bumpPct: number;
};

export const PVS_RUNS: PvsRun[] = [
  {
    run: 1, code: "Drive 1", syntheticVehicle: "RTA Probe Alpha", syntheticDriver: "Driver D1",
    scenarioName: "Al Bourooj St North (Sakani & AMIDEAST Collector)", samples: 144036, durationMin: 24.0, avgSpeedKmh: 38.4,
    left: { good: 39.28, regular: 45.34, bad: 15.38 }, right: { good: 39.29, regular: 45.85, bad: 14.86 },
    surface: { asphalt: 39.23, cobblestone: 42.81, dirt: 17.96 }, bumpAsphaltPct: 0.43, bumpCobblePct: 1.96, bumpPct: 2.39
  },
  {
    run: 2, code: "Drive 2", syntheticVehicle: "RTA Probe Alpha", syntheticDriver: "Driver D1",
    scenarioName: "Al Bourooj St South (Heriot-Watt Univ Approach)", samples: 124685, durationMin: 20.8, avgSpeedKmh: 34.2,
    left: { good: 44.98, regular: 30.41, bad: 24.60 }, right: { good: 44.85, regular: 30.52, bad: 24.62 },
    surface: { asphalt: 47.58, cobblestone: 16.63, dirt: 35.78 }, bumpAsphaltPct: 1.02, bumpCobblePct: 0.59, bumpPct: 1.61
  },
  {
    run: 3, code: "Drive 3", syntheticVehicle: "RTA Probe Alpha", syntheticDriver: "Driver D1",
    scenarioName: "Al Falak St West (Google Dubai & E11 Feeder)", samples: 105816, durationMin: 17.6, avgSpeedKmh: 46.5,
    left: { good: 48.12, regular: 44.07, bad: 7.80 }, right: { good: 48.11, regular: 44.78, bad: 7.11 },
    surface: { asphalt: 48.21, cobblestone: 24.71, dirt: 27.08 }, bumpAsphaltPct: 0.28, bumpCobblePct: 0.29, bumpPct: 0.57
  },
  {
    run: 4, code: "Drive 4", syntheticVehicle: "RTA Probe Beta", syntheticDriver: "Driver D2",
    scenarioName: "Al Falak St Central (Cisco Systems & Huawei Showroom)", samples: 132492, durationMin: 22.1, avgSpeedKmh: 40.1,
    left: { good: 38.30, regular: 47.43, bad: 14.27 }, right: { good: 38.29, regular: 48.38, bad: 13.33 },
    surface: { asphalt: 38.43, cobblestone: 43.53, dirt: 18.04 }, bumpAsphaltPct: 0.40, bumpCobblePct: 1.97, bumpPct: 2.37
  },
  {
    run: 5, code: "Drive 5", syntheticVehicle: "RTA Probe Beta", syntheticDriver: "Driver D2",
    scenarioName: "Al Bourooj Roundabout (KV Medical Fitness Shear Zone)", samples: 133877, durationMin: 22.3, avgSpeedKmh: 33.8,
    left: { good: 40.12, regular: 24.65, bad: 35.23 }, right: { good: 39.97, regular: 24.34, bad: 35.69 },
    surface: { asphalt: 41.23, cobblestone: 13.55, dirt: 45.22 }, bumpAsphaltPct: 0.91, bumpCobblePct: 0.54, bumpPct: 1.45
  },
  {
    run: 6, code: "Drive 6", syntheticVehicle: "RTA Probe Beta", syntheticDriver: "Driver D2",
    scenarioName: "Al Sufouh Rd (D94) · King Salman St Arterial", samples: 96279, durationMin: 16.0, avgSpeedKmh: 49.2,
    left: { good: 42.01, regular: 53.02, bad: 4.97 }, right: { good: 42.02, regular: 52.12, bad: 5.86 },
    surface: { asphalt: 42.32, cobblestone: 32.86, dirt: 24.81 }, bumpAsphaltPct: 0.29, bumpCobblePct: 0.34, bumpPct: 0.63
  },
  {
    run: 7, code: "Drive 7", syntheticVehicle: "RTA Probe Gamma", syntheticDriver: "Driver D3",
    scenarioName: "Al Falak St East (Amazon DXB30 & Innovation Hub)", samples: 128548, durationMin: 21.4, avgSpeedKmh: 41.0,
    left: { good: 38.78, regular: 50.36, bad: 10.85 }, right: { good: 38.93, regular: 52.30, bad: 8.77 },
    surface: { asphalt: 39.32, cobblestone: 42.18, dirt: 18.50 }, bumpAsphaltPct: 0.44, bumpCobblePct: 1.80, bumpPct: 2.24
  },
  {
    run: 8, code: "Drive 8", syntheticVehicle: "RTA Probe Gamma", syntheticDriver: "Driver D3",
    scenarioName: "Al Ma'refa St (Murdoch Univ & Medical Centre Link)", samples: 123618, durationMin: 20.6, avgSpeedKmh: 35.6,
    left: { good: 45.68, regular: 24.23, bad: 30.10 }, right: { good: 45.80, regular: 26.13, bad: 28.07 },
    surface: { asphalt: 48.42, cobblestone: 15.23, dirt: 36.35 }, bumpAsphaltPct: 0.95, bumpCobblePct: 0.54, bumpPct: 1.49
  },
  {
    run: 9, code: "Drive 9", syntheticVehicle: "RTA Probe Gamma", syntheticDriver: "Driver D3",
    scenarioName: "Al Thuraya & Abdullah Omran Taryam St (ADCB Spine)", samples: 91555, durationMin: 15.3, avgSpeedKmh: 50.4,
    left: { good: 46.48, regular: 42.51, bad: 11.01 }, right: { good: 46.65, regular: 46.56, bad: 6.79 },
    surface: { asphalt: 47.21, cobblestone: 27.50, dirt: 25.29 }, bumpAsphaltPct: 0.34, bumpCobblePct: 0.37, bumpPct: 0.71
  },
];

export const PVS_TOTAL_SAMPLES = PVS_RUNS.reduce((a, r) => a + r.samples, 0);
export const runById = (n: number) => PVS_RUNS.find((r) => r.run === n)!;

export const TEXTURE = [0.12, 0.35, 0.7] as const;
export const IMPACT = [0, 0.6, 2.8] as const;
export const bumpChance = (run: PvsRun) => Math.min(0.25, (run.bumpPct / 100) * 5);
export const CHUNKS = 2;

export function pickClass(mix: Mix, wear: number, r: number): 0 | 1 | 2 {
  const bad = Math.min(90, mix.bad + wear * 100);
  const scale = (100 - bad) / Math.max(1e-6, mix.good + mix.regular);
  const good = mix.good * scale;
  if (r * 100 < good) return 0;
  if (r * 100 < 100 - bad) return 1;
  return 2;
}

function wheel(mix: Mix, wear: number, speed: number, rand: () => number, bumpAt: number | null) {
  const len = 200 / CHUNKS, n = 200;
  const classes: (0 | 1 | 2)[] = Array.from({ length: CHUNKS }, () => pickClass(mix, wear, rand()));
  const k = Math.sqrt(speed / V_REF);
  const raw: number[] = [];
  const holes = classes.map((_, i) => i * len + 8 + Math.floor(rand() * (len - 16)));
  const holeAmp = classes.map((c) => IMPACT[c] * (0.7 + rand() * 0.6));
  for (let i = 0; i < n; i++) {
    const c = classes[Math.floor(i / len)]!;
    let v = (rand() - 0.5) * 2 * TEXTURE[c] + Math.sin(i * 0.9) * 0.2;
    holes.forEach((h, j) => {
      const d = i - h;
      if (Math.abs(d) < 14) v -= k * holeAmp[j]! * Math.exp(-(d * d) / 10) * (1 - 0.3 * Math.cos(d));
    });
    if (bumpAt !== null) {
      const d = i - bumpAt;
      v += k * 3.2 * Math.exp(-(d * d) / 60);
    }
    raw.push(v);
  }
  return { raw, classes };
}

export type PassSim = {
  left: number[]; right: number[]; cleanL: number[]; cleanR: number[];
  classes: (0 | 1 | 2)[]; bump: [number, number] | null; D: number; Draw: number;
};

export function simulatePass(run: PvsRun, wear: number, speed: number, rand: () => number, ignoreBumps = true): PassSim {
  const bumpAt = rand() < bumpChance(run) ? 40 + Math.floor(rand() * 120) : null;
  const L = wheel(run.left, wear, speed, rand, bumpAt);
  const R = wheel(run.right, wear, speed, rand, bumpAt);
  const cleanL = cleanSignal(L.raw);
  const cleanR = cleanSignal(R.raw);
  const bump: [number, number] | null = bumpAt === null ? null : [Math.max(0, bumpAt - 20), Math.min(199, bumpAt + 20)];
  const peak = (s: number[], skip: boolean) =>
    s.reduce((m, v, i) => (skip && bump && i >= bump[0] && i <= bump[1] ? m : Math.max(m, v)), 0);
  const both = (skip: boolean) => (peak(cleanL, skip) + peak(cleanR, skip)) / 2;
  const Draw = normalizedDamage(both(false), speed);
  const D = normalizedDamage(both(ignoreBumps), speed);
  const classes = L.classes.map((c, i) => Math.max(c, R.classes[i]!) as 0 | 1 | 2);
  return { left: L.raw, right: R.raw, cleanL, cleanR, classes, bump, D, Draw };
}
