import { memo, useState } from "react";
import { Database } from "lucide-react";
import trace from "@/lib/pvs-trace.json";
import { PVS_RUNS, PVS_TOTAL_SAMPLES } from "@/lib/pvs";

type Layer = "roughness" | "surface" | "bumps";
const T = trace as { w: number; h: number; points: number[][]; bumps: number[][] };

const ROUGH = ["fill-good", "fill-watch", "fill-urgent"];
const SURF = ["fill-v-bus", "fill-v-taxi", "fill-accent"];
const LEGEND: Record<Layer, [string, string][]> = {
  roughness: [["bg-good", "Smooth (RTA Good)"], ["bg-watch", "Uneven (Early Wear)"], ["bg-urgent", "Rough (Pothole / Distress)"]],
  surface: [["bg-v-bus", "RTA Polymer SMA Asphalt"], ["bg-v-taxi", "Interlocking Paver / Roundabout Apron"], ["bg-accent", "Sandy Shoulder / Utility Trench"]],
  bumps: [["bg-v-bus", "RTA Asphalt Speed Hump"], ["bg-v-taxi", "Raised Pedestrian Paver Crosswalk"]],
};

const DUBAI_REF_PATHS = [
  "M 28 368 L 94 286 L 165 200 L 242 108 L 332 8",
  "M 155 412 L 178 345 L 210 275 L 256 212 L 296 192",
  "M 296 192 L 322 180 L 348 194 L 354 218 L 338 238 L 310 238 L 294 216 L 296 192",
  "M 312 180 L 342 134 L 402 86 L 476 44 L 558 12 L 650 5 L 795 5 L 898 24",
  "M 342 234 L 392 274 L 438 316 L 485 355",
  "M 432 498 L 460 425 L 485 355 L 548 420 L 610 482",
  "M 485 355 L 546 314 L 612 280 L 682 256 L 755 246",
  "M 755 246 L 825 248 L 892 252 L 962 246 L 1018 218",
  "M 908 6 L 894 90 L 888 175 L 892 252 L 896 330 L 888 395 L 864 455 L 842 500",
];

const TraceMap = memo(function TraceMap({ layer }: { layer: Layer }) {
  return (
    <svg viewBox={`0 0 ${T.w} ${T.h}`} className="mx-auto h-80 w-full rounded-xl bg-[#070b09]">
      {DUBAI_REF_PATHS.map((d, i) => (
        <g key={`rd-${i}`}>
          <path d={d} stroke="#19251f" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={d} stroke="rgba(255,255,255,0.22)" strokeWidth={1.2} strokeDasharray="5 7" fill="none" />
        </g>
      ))}
      {T.points.map(([x, y, r, s], i) => (
        <circle key={i} cx={x} cy={y} r={layer === "bumps" ? 3.2 : 4.2}
          className={layer === "bumps" ? "fill-muted-foreground" : layer === "roughness" ? ROUGH[r!] : SURF[s!]}
          fillOpacity={layer === "bumps" ? 0.35 : 0.88} />
      ))}
      {layer === "bumps" && T.bumps.map(([x, y, k], i) => (
        <circle key={`b${i}`} cx={x} cy={y} r={11} className={`${k ? "fill-v-taxi" : "fill-v-bus"} stroke-background`} strokeWidth={2.5} />
      ))}
    </svg>
  );
});

export function FieldData({ roads, selectedRun }: { roads: { name: string; run: number }[]; selectedRun: number }) {
  const [layer, setLayer] = useState<Layer>("roughness");
  return (
    <section id="data" className="grid scroll-mt-20 gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4 text-primary" /> Recorded Field Drive · Dubai Road Architecture Reference</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {T.points.length.toLocaleString()} GPS-synchronized 100 Hz wheel-hub inertial windows georeferenced onto Dubai Knowledge Park &amp; Internet City road architecture (25.0988°N–25.1036°N, 55.1578°E–55.1668°E — Al Sufouh Rd D94, Al Bourooj St, Al Ma'refa St, Al Falak St &amp; Al Thuraya St).
        </p>
        <div className="mb-2 flex gap-1">
          {(["roughness", "surface", "bumps"] as Layer[]).map((l) => (
            <button key={l} onClick={() => setLayer(l)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${layer === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {l === "bumps" ? "Speed bumps" : l}
            </button>
          ))}
        </div>
        <div className="rounded-xl bg-muted/50"><TraceMap layer={layer} /></div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {LEGEND[layer].map(([c, t]) => <span key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${c}`} />{t}</span>)}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Recorded Field Drives · All 9 Dubai Road Profiles</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {PVS_TOTAL_SAMPLES.toLocaleString()} labelled tyre &amp; suspension readings at 100 Hz mapped across the 9 actual Dubai roads in the simulation.
        </p>
        <ul className="space-y-2">
          {PVS_RUNS.map((r) => {
            const used = roads.filter((x) => x.run === r.run);
            return (
              <li key={r.run} className={`rounded-lg px-2 py-1.5 ${r.run === selectedRun ? "bg-muted" : ""}`}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold">{r.code} · {r.syntheticVehicle}</span>
                  <span className="truncate pl-2 text-muted-foreground">{used.length ? used.map((u) => u.name).join(", ") : r.scenarioName}</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full">
                  <div className="bg-good" style={{ width: `${r.left.good}%` }} title={`Smooth ${r.left.good}%`} />
                  <div className="bg-watch" style={{ width: `${r.left.regular}%` }} title={`Uneven ${r.left.regular}%`} />
                  <div className="bg-urgent" style={{ width: `${r.left.bad}%` }} title={`Rough ${r.left.bad}%`} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          {LEGEND.roughness.map(([c, t]) => <span key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${c}`} />{t}</span>)}
        </div>
      </div>
    </section>
  );
}
