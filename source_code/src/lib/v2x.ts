// Core V2X smart-tyre math (browser-side simplification of the Python PoC).

export const V_REF = 40; // km/h reference speed

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Raw vertical acceleration for one pass (100 Hz, 2 s). */
export function simulateRaw(severity: number, speed: number, rand: () => number, n = 200) {
  const out: number[] = [];
  const hit = Math.floor(n * (0.3 + rand() * 0.4));
  const amp = severity * Math.sqrt(speed / V_REF) * 3;
  for (let i = 0; i < n; i++) {
    const noise = (rand() - 0.5) * 1.2 + Math.sin(i * 0.9) * 0.3;
    const d = i - hit;
    const bump = amp * Math.exp(-(d * d) / 18) * Math.cos(d * 0.8);
    out.push(noise + bump);
  }
  return out;
}

/** Step 1 (simplified): smoothing filter + magnitude, removes high-freq noise. */
export function cleanSignal(raw: number[], win = 5) {
  return raw.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -win; k <= win; k++) {
      const v = raw[i + k];
      if (v !== undefined) { s += v; c++; }
    }
    return Math.abs(s / c);
  });
}

/** Step 2: speed-normalised damage index. */
export function normalizedDamage(peak: number, speed: number) {
  return peak * Math.pow(V_REF / speed, 0.5);
}

/** Step 3: 15% trimmed mean. */
export function trimmedMean(values: number[], trim = 0.15) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const k = Math.floor(s.length * trim);
  const kept = s.slice(k, s.length - k);
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}

/** Step 4a: slope of damage vs pass index (least squares). */
export function slope(values: number[]) {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return num / den;
}

/** Step 4b: Maintenance priority utility. */
export function priorityUtility(D: number, beta: number, N: number, tau: number, betaRef: number) {
  return 0.5 * (D / tau) + 0.35 * (Math.max(0, beta) / betaRef) + 0.15 * Math.min(1, N / 12);
}

export type Level = "good" | "watch" | "urgent";
export function priorityLevel(U: number): Level {
  if (U >= 0.75) return "urgent";
  if (U >= 0.45) return "watch";
  return "good";
}
