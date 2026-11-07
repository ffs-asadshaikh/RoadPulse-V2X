import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceArea } from "recharts";
import {
  Car, Bus, Truck, CarTaxiFront, Pause, Play, RotateCcw, Radio, Activity, Gauge, TrendingUp, Wrench, Search, Bell,
  LayoutDashboard, Map as MapIcon, Waves, TriangleAlert, Settings, MapPin, Route as RouteIcon, ShieldCheck, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import probeCar from "@/assets/probe-car.png";
import probeTaxi from "@/assets/probe-taxi.png";
import probeBus from "@/assets/probe-bus.png";
import probeVan from "@/assets/probe-van.png";
import { mulberry32, trimmedMean, slope, priorityUtility, priorityLevel, type Level } from "@/lib/v2x";
import { simulatePass, runById, type Mix } from "@/lib/pvs";
import { FieldData } from "@/components/FieldData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoadPulse – V2X Smart Tyre Road Monitor" },
      { name: "description", content: "Watch connected cars detect potholes with smart tyres and rank city roads for repair." },
      { property: "og:title", content: "RoadPulse – V2X Smart Tyre Road Monitor" },
      { property: "og:description", content: "Interactive V2X + intelligent tyre sensing dashboard for proactive road maintenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type VType = "taxi" | "bus" | "van" | "car";
type LiveCar = { key: number; seg: string; reverse: boolean; dur: number; bump: boolean; type: VType };
type Pass = { speed: number; raw: number[]; clean: number[]; cleanR: number[]; classes: (0 | 1 | 2)[]; bump: [number, number] | null; D: number; vehicle: string };
type Segment = { id: string; name: string; x1: number; y1: number; x2: number; y2: number; run: number; growth: number; passes: Pass[] };
type Vehicle = { id: string; type: VType; model: string; km: number; reports: number; bumps: number; lastRoad: string | null };
type Tone = "good" | "watch" | "urgent" | "info";
type Event = { id: number; text: string; tone: Tone; time: string };

const BASE: Omit<Segment, "passes">[] = [
  { id: "A", name: "Al Sufouh Rd (D94)", x1: 40, y1: 60, x2: 560, y2: 60, run: 6, growth: 0.002 },
  { id: "B", name: "Al Bourooj St South", x1: 40, y1: 180, x2: 560, y2: 180, run: 2, growth: 0.03 },
  { id: "C", name: "Al Bourooj Roundabout", x1: 40, y1: 300, x2: 560, y2: 300, run: 7, growth: 0.012 },
  { id: "D", name: "Al Bourooj St North", x1: 120, y1: 30, x2: 120, y2: 330, run: 1, growth: 0.005 },
  { id: "E", name: "Al Ma'refa St", x1: 300, y1: 30, x2: 300, y2: 330, run: 5, growth: 0.02 },
  { id: "F", name: "Al Falak St Central", x1: 480, y1: 30, x2: 480, y2: 330, run: 3, growth: 0.001 },
];
const FLEET: Vehicle[] = [
  { id: "Probe-01", type: "taxi", model: "Taxi · Smart tyre kit", km: 24580, reports: 0, bumps: 0, lastRoad: null },
  { id: "Probe-02", type: "bus", model: "City bus · Smart tyre kit", km: 61200, reports: 0, bumps: 0, lastRoad: null },
  { id: "Probe-03", type: "van", model: "Delivery van · Smart tyre kit", km: 38940, reports: 0, bumps: 0, lastRoad: null },
  { id: "Probe-04", type: "car", model: "Private car · Smart tyre kit", km: 12110, reports: 0, bumps: 0, lastRoad: null },
];

const VTYPE: Record<VType, { label: string; img: string; icon: typeof Car; len: number; fill: string; text: string; speed: [number, number] }> = {
  taxi: { fill: "fill-v-taxi", text: "text-v-taxi", label: "Taxi", img: probeTaxi, icon: CarTaxiFront, len: 20, speed: [30, 70] },
  bus: { fill: "fill-v-bus", text: "text-v-bus", label: "Bus", img: probeBus, icon: Bus, len: 34, speed: [20, 45] },
  van: { fill: "fill-v-van", text: "text-v-van", label: "Van", img: probeVan, icon: Truck, len: 26, speed: [25, 60] },
  car: { fill: "fill-v-car", text: "text-v-car", label: "Car", img: probeCar, icon: Car, len: 20, speed: [30, 70] },
};

const LEVEL_TEXT: Record<Level, string> = { good: "Healthy", watch: "Monitor", urgent: "Repair soon" };
const LEVEL_CLS: Record<Level, string> = { good: "text-good", watch: "text-watch", urgent: "text-urgent" };
const LEVEL_STROKE: Record<Level, string> = { good: "stroke-good", watch: "stroke-watch", urgent: "stroke-urgent" };
/** Cars needed before a road gets a rating, so one lucky or unlucky car can't flip it. */
const MIN_N = 4;
/** Reference "getting worse" rate: damage rising 0.1 per car counts as fully worsening. */
const BETA_REF = 0.1;
const CLASS_BG = ["bg-good", "bg-watch", "bg-urgent"] as const;
const CLASS_TEXT = ["smooth", "uneven", "rough"] as const;
const TONE_DOT: Record<Tone, string> = { good: "bg-good", watch: "bg-watch", urgent: "bg-urgent", info: "bg-muted-foreground" };

const NAV = [
  { href: "#overview", label: "Overview", icon: LayoutDashboard },
  { href: "#map", label: "Road map", icon: MapIcon },
  { href: "#sensors", label: "Sensors", icon: Waves },
  { href: "#data", label: "Real data", icon: Database },
  { href: "#alerts", label: "Alerts", icon: TriangleAlert },
  { href: "#settings", label: "Settings", icon: Settings },
];

const rand = mulberry32(42);
const freshSegments = (): Segment[] => BASE.map((s) => ({ ...s, passes: [] }));
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Index() {
  const [segments, setSegments] = useState<Segment[]>(freshSegments);
  const [fleet, setFleet] = useState<Vehicle[]>(FLEET);
  const [activeVehicle, setActiveVehicle] = useState("Probe-01");
  const [selected, setSelected] = useState("B");
  const [running, setRunning] = useState(false);
  const [tau, setTau] = useState(1.2);
  const [traffic, setTraffic] = useState(3);
  const [cars, setCars] = useState<LiveCar[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [query, setQuery] = useState("");
  const [nav, setNav] = useState("#overview");
  const timer = useRef<number | null>(null);
  const segRef = useRef(segments);
  segRef.current = segments;
  const tauRef = useRef(tau);
  tauRef.current = tau;
  const carKey = useRef(0);
  const evKey = useRef(0);

  const log = (text: string, tone: Tone) =>
    setEvents((e) => [{ id: ++evKey.current, text, tone, time: now() }, ...e].slice(0, 30));

  const drive = (id?: string) => {
    const cur = segRef.current;
    const s = id ? cur.find((x) => x.id === id) : cur[Math.floor(rand() * cur.length)];
    if (!s) return;
    const fv = FLEET[Math.floor(rand() * FLEET.length)]!;
    const v = fv.id;
    const [lo, hi] = VTYPE[fv.type].speed;
    const speed = lo + rand() * (hi - lo);
    const wear = s.growth * s.passes.length * 0.4;
    const sim = simulatePass(runById(s.run), wear, speed, rand);
    const D = sim.D;
    const bump = D > tauRef.current * 0.6;
    const pass: Pass = { speed, raw: sim.left, clean: sim.cleanL, cleanR: sim.cleanR, classes: sim.classes, bump: sim.bump, D, vehicle: v };
    setSegments((prev) => prev.map((x) => (x.id === s.id ? { ...x, passes: [...x.passes, pass].slice(-40) } : x)));
    if (sim.bump && rand() < 0.5) log(`${v} crossed a speed bump on ${s.name} – ignored, not damage`, "info");
    setFleet((f) => f.map((x) => (x.id === v ? { ...x, km: x.km + 1, reports: x.reports + 1, bumps: x.bumps + (bump ? 1 : 0), lastRoad: s.name } : x)));
    if (bump) log(`${v} felt a bump on ${s.name} at ${speed.toFixed(0)} km/h`, "watch");
    const key = ++carKey.current;
    const dur = 140 / speed;
    setCars((c) => [...c.slice(-24), { key, seg: s.id, reverse: rand() > 0.5, dur, bump, type: fv.type }]);
    window.setTimeout(() => setCars((c) => c.filter((x) => x.key !== key)), dur * 1000 + 50);
  };

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => drive(), 1000 / traffic);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [running, traffic]);

  const stats = useMemo(() => segments.map((s) => {
    const Ds = s.passes.map((p) => p.D);
    // D_s(N): rolling trimmed mean of the last 12 cars, evaluated after each car
    const rolling = Ds.map((_, i) => trimmedMean(Ds.slice(Math.max(0, i - 11), i + 1)));
    const D = rolling[rolling.length - 1] ?? 0;
    const beta = rolling.length >= MIN_N ? slope(rolling.slice(-12)) : 0; // β_s = dD_s/dN
    const N = s.passes.length;
    const U = priorityUtility(D, beta, N, tau, BETA_REF);
    const rated = N >= MIN_N;
    return { ...s, D, beta, N, U, rated, level: rated ? priorityLevel(U) : ("good" as Level) };
  }), [segments, tau]);

  // Log road status changes
  const prevLevels = useRef<Record<string, Level>>({});
  useEffect(() => {
    stats.forEach((s) => {
      if (!s.rated) return;
      const prev = prevLevels.current[s.id];
      if (prev && prev !== s.level) log(`${s.name} changed to "${LEVEL_TEXT[s.level]}"`, s.level);
      prevLevels.current[s.id] = s.level;
    });
  }, [stats]);

  const sel = stats.find((s) => s.id === selected)!;
  const last = sel.passes[sel.passes.length - 1];
  const signalData = last ? last.raw.map((r, i) => ({ t: i / 100, raw: +r.toFixed(2), clean: +(last.clean[i] ?? 0).toFixed(2), right: +(last.cleanR[i] ?? 0).toFixed(2) })) : [];
  const selRun = runById(sel.run);
  const trendData = sel.passes.map((p, i) => ({ n: i + 1, D: +p.D.toFixed(2) }));
  const q = query.trim().toLowerCase();
  const match = (t: string) => !q || t.toLowerCase().includes(q);
  const ranking = [...stats].sort((a, b) => Number(b.rated) - Number(a.rated) || b.U - a.U).filter((s) => match(s.name));
  const alerts = stats.filter((s) => s.rated && s.level !== "good").sort((a, b) => b.U - a.U);
  const totalReports = stats.reduce((a, s) => a + s.N, 0);
  const monitored = stats.filter((s) => s.rated).length;
  const networkHealth = monitored ? Math.round(100 - (stats.filter((s) => s.rated).reduce((a, s) => a + Math.min(1, s.U), 0) / monitored) * 100) : 100;
  const veh = fleet.find((v) => v.id === activeVehicle)!;
  const tyreHealth = Math.max(40, 98 - veh.bumps * 0.4);

  const reset = () => {
    setRunning(false); setSegments(freshSegments()); setFleet(FLEET); setEvents([]); setCars([]); prevLevels.current = {};
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-3 px-1">
          <div className="rounded-xl bg-primary p-2 text-primary-foreground"><Radio className="h-5 w-5" /></div>
          <div>
            <p className="font-bold leading-tight">ROADPULSE</p>
            <p className="text-[10px] tracking-widest text-muted-foreground">V2X ROAD MONITOR</p>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setNav(n.href)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${nav === n.href ? "border-primary/40 bg-sidebar-accent text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <n.icon className="h-4 w-4" /> {n.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Simulation</p>
          {running ? "Traffic running" : "Traffic paused"} · {traffic} cars/s
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roads, vehicles, alerts…"
              className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause /> : <Play />} {running ? "Pause" : "Start traffic"}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}><RotateCcw /> Reset</Button>
            <a href="#alerts" className="relative rounded-lg border bg-card p-2" aria-label="Alerts">
              <Bell className="h-4 w-4" />
              {alerts.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-urgent text-[10px] font-bold text-destructive-foreground">{alerts.length}</span>
              )}
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8">
          {/* Hero row */}
          <section id="overview" className="grid scroll-mt-20 gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl border bg-hero p-6">
              <p className="text-xs tracking-widest text-muted-foreground">ACTIVE PROBE VEHICLE</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{veh.id}</h1>
                <div className="flex gap-1">
                  {fleet.map((v) => (
                    <button key={v.id} onClick={() => setActiveVehicle(v.id)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] ${v.id === activeVehicle ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                      {VTYPE[v.type].label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{veh.model}</p>
              <div className="my-3 overflow-hidden rounded-xl bg-stage"><img key={veh.type} src={VTYPE[veh.type].img} alt={`${VTYPE[veh.type].label} probe vehicle with smart tyre sensors`} width={1024} height={640} className="mx-auto h-40 w-auto object-contain animate-in fade-in duration-500 md:h-48" /></div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {veh.lastRoad ?? "Dubai Knowledge Park"}</span>
                <span className="flex items-center gap-1.5"><Gauge className="h-4 w-4" /> {veh.km.toLocaleString()} km</span>
                <span className="flex items-center gap-1.5"><Radio className="h-4 w-4" /> {veh.reports} V2X reports</span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-6">
              <p className="text-xs tracking-widest text-muted-foreground">CITY ROAD HEALTH</p>
              <Ring value={networkHealth} />
              <div className="grid w-full max-w-xs grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-muted p-2"><p className="font-bold">{tyreHealth.toFixed(0)}%</p><p className="text-[11px] text-muted-foreground">{veh.id} tyre health</p></div>
                <div className="rounded-lg bg-muted p-2"><p className="font-bold">{veh.bumps}</p><p className="text-[11px] text-muted-foreground">Bumps it felt</p></div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">Live overview of {BASE.length} city roads</h2>
            <span className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${alerts.some((a) => a.level === "urgent") ? "border-urgent/40 text-urgent" : "border-primary/40 text-primary"}`}>
              <span className={`h-2 w-2 rounded-full ${alerts.some((a) => a.level === "urgent") ? "bg-urgent" : "bg-primary"}`} />
              {alerts.some((a) => a.level === "urgent") ? "REPAIRS NEEDED" : "NETWORK OK"}
            </span>
          </div>

          {/* KPI row */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<ShieldCheck />} label="Roads monitored" value={`${monitored}/${BASE.length}`} hint="Roads with car reports" />
            <Kpi icon={<TriangleAlert />} label="Active alerts" value={String(alerts.length)} hint={alerts[0] ? alerts[0].name : "No damage flagged"} />
            <Kpi icon={<Radio />} label="V2X reports" value={String(totalReports)} hint="Tyre readings received" />
            <Kpi icon={<Car />} label="Vehicles on road" value={String(cars.length)} hint={(Object.keys(VTYPE) as VType[]).map((t) => `${cars.filter((c) => c.type === t).length} ${VTYPE[t].label.toLowerCase()}`).join(" · ")} />
          </section>

          {/* Map + detail */}
          <section id="map" className="grid scroll-mt-20 gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">City road network</h2>
                <span className="text-xs text-muted-foreground">Click a road to inspect it</span>
              </div>
              <ol className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
                <li className="rounded-lg bg-muted px-3 py-2"><b className="text-primary">1. Cars drive</b><br />Smart tyres feel the road surface.</li>
                <li className="rounded-lg bg-muted px-3 py-2"><b className="text-urgent">2. Bumps reported</b><br />A car turns red on damage and tells the city.</li>
                <li className="rounded-lg bg-muted px-3 py-2"><b className="text-watch">3. Road rated</b><br />Many reports set the road's colour.</li>
              </ol>
              <svg viewBox="0 0 600 360" className="w-full">
                {stats.map((s) => (
                  <g key={s.id} onClick={() => setSelected(s.id)} className="cursor-pointer">
                    <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="stroke-road" strokeWidth={26} strokeLinecap="round" />
                    {selected === s.id && (
                      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="stroke-foreground" strokeOpacity={0.3} strokeWidth={30} strokeLinecap="round" />
                    )}
                    <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                      className={`${s.rated ? LEVEL_STROKE[s.level] : "stroke-muted-foreground"} transition-all`}
                      strokeWidth={6} strokeLinecap="round" strokeOpacity={s.rated ? (match(s.name) ? 0.9 : 0.2) : 0.35}
                      strokeDasharray={s.rated ? undefined : "6 8"} />
                  </g>
                ))}
                {stats.map((s) => {
                  const vertical = s.x1 === s.x2;
                  const lx = vertical ? s.x1 : 210;
                  const ly = vertical ? 240 : s.y1;
                  const w = s.name.length * 7 + 16;
                  const flagged = s.rated && s.level !== "good";
                  return (
                    <g key={`l-${s.id}`} onClick={() => setSelected(s.id)} className="cursor-pointer">
                      <rect x={lx - w / 2} y={ly - 10} width={w} height={20} rx={10} className="fill-card stroke-border" />
                      <text x={lx} y={ly + 4} textAnchor="middle" className="fill-foreground text-[11px] font-medium">{s.name}</text>
                      {flagged && (
                        <g transform={`translate(${vertical ? s.x1 : 390}, ${vertical ? 120 : s.y1})`}>
                          <path d="M0,-11 L11,8 L-11,8 Z" className={s.level === "urgent" ? "fill-urgent" : "fill-watch"} />
                          <text y={6} textAnchor="middle" className="fill-background text-[12px] font-bold">!</text>
                        </g>
                      )}
                    </g>
                  );
                })}
                {cars.map((c) => {
                  const s = stats.find((x) => x.id === c.seg);
                  if (!s) return null;
                  const path = c.reverse ? `M${s.x2},${s.y2} L${s.x1},${s.y1}` : `M${s.x1},${s.y1} L${s.x2},${s.y2}`;
                  return (
                    <g key={c.key} className="pointer-events-none">
                      <animateMotion ref={(el) => { const a = el as unknown as SVGAnimationElement | null; if (a && !a.dataset["started"]) { a.dataset["started"] = "1"; a.beginElement(); } }} begin="indefinite" dur={`${c.dur}s`} path={path} rotate="auto" fill="freeze" />
                      {(() => {
                        const L = VTYPE[c.type].len, h = c.type === "bus" ? 14 : 12;
                        const body = c.bump ? "fill-urgent" : VTYPE[c.type].fill;
                        return (<>
                          {[-L / 2 + 4, L / 2 - 4].flatMap((x) => [-h / 2, h / 2].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={2} className="fill-background stroke-foreground" strokeWidth={0.8} />))}
                          <rect x={-L / 2} y={-h / 2} width={L} height={h} rx={c.type === "bus" ? 2.5 : 4} className={`${body} stroke-background`} strokeWidth={1} />
                          <rect x={L / 2 - 7} y={-h / 2 + 2} width={4} height={h - 4} rx={1} className="fill-background/60" />
                          {c.type === "taxi" && <rect x={-3} y={-2} width={6} height={4} rx={1} className="fill-background" />}
                          {c.type === "bus" && [-10, -4, 2].map((x) => <rect key={x} x={x} y={-h / 2 + 2} width={4} height={h - 4} rx={0.8} className="fill-background/40" />)}
                        </>);
                      })()}
                    </g>
                  );
                })}
              </svg>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {(Object.keys(VTYPE) as VType[]).map((t) => { const I = VTYPE[t].icon; return <span key={t} className={`flex items-center gap-1 ${VTYPE[t].text}`}><I className="h-3.5 w-3.5" /> {VTYPE[t].label}</span>; })}
                <span><span className="text-urgent">■</span> Vehicle hitting damage</span>
                <span><span className="text-watch">▲</span> Damage spotted</span>
                <span className="text-good">━ Healthy</span><span className="text-watch">━ Monitor</span>
                <span className="text-urgent">━ Repair soon</span><span>┄ No cars yet</span>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs tracking-widest text-muted-foreground">SELECTED ROAD</p>
                    <h2 className="text-xl font-bold">{sel.name}</h2>
                  </div>
                  <span className={`rounded-full bg-muted px-3 py-1 text-xs font-semibold ${LEVEL_CLS[sel.level]}`}>
                    {sel.rated ? LEVEL_TEXT[sel.level] : sel.N ? `Collecting ${sel.N}/${MIN_N}` : "Waiting for cars"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric icon={<Car className="h-4 w-4" />} label="Cars reported" value={String(sel.N)} hint="N" />
                  <Metric icon={<Activity className="h-4 w-4" />} label="Damage level" value={sel.D.toFixed(2)} hint="Dₛ trimmed avg" />
                  <Metric icon={<TrendingUp className="h-4 w-4" />} label="Getting worse?" value={sel.beta > 0.02 ? "Yes ↑" : sel.beta < -0.02 ? "Improving ↓" : "Stable"} hint={`βₛ = ${sel.beta.toFixed(3)}`} />
                  <Metric icon={<Gauge className="h-4 w-4" />} label="Priority score" value={`${Math.round(Math.min(1, sel.U) * 100)}%`} hint="Uₛ" />
                </div>
                <div className="mt-3 rounded-lg bg-muted p-3">
                  <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Surface profile from real drive</span><a href="#data" className="font-semibold text-primary">PVS {sel.run}</a></div>
                  <MixBar mix={selRun.left} />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{selRun.left.good.toFixed(0)}% smooth · {selRun.left.regular.toFixed(0)}% uneven · {selRun.left.bad.toFixed(0)}% rough · speed bumps on {selRun.bumpPct.toFixed(1)}% of the drive</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full transition-all ${sel.level === "urgent" ? "bg-urgent" : sel.level === "watch" ? "bg-watch" : "bg-good"}`}
                    style={{ width: `${Math.min(100, sel.U * 100)}%` }} />
                </div>
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => drive(selected)}><Car /> Send one car down {sel.name}</Button>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4 text-accent" /> Repair queue</h2>
                <ol className="space-y-1">
                  {ranking.map((s, i) => (
                    <li key={s.id}>
                      <button onClick={() => setSelected(s.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted ${selected === s.id ? "bg-muted" : ""}`}>
                        <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                        <span className="flex-1 text-sm">{s.name}</span>
                        <span className={`font-mono text-sm ${LEVEL_CLS[s.level]}`}>{s.rated ? `${Math.round(Math.min(1, s.U) * 100)}%` : "—"}</span>
                      </button>
                    </li>
                  ))}
                  {!ranking.length && <li className="px-3 py-2 text-sm text-muted-foreground">No roads match "{query}".</li>}
                </ol>
              </div>
            </div>
          </section>

          {/* Alerts + activity */}
          <section id="alerts" className="grid scroll-mt-20 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Alerts</h2>
                {alerts.length > 0 && <span className="rounded-md bg-urgent/15 px-2 py-0.5 text-xs font-semibold text-urgent">{alerts.length} active</span>}
              </div>
              <div className="space-y-2">
                {alerts.filter((a) => match(a.name)).map((a) => (
                  <button key={a.id} onClick={() => { setSelected(a.id); document.getElementById("map")?.scrollIntoView({ behavior: "smooth" }); }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${a.level === "urgent" ? "border-urgent/40 bg-alert" : "border-watch/40 bg-warn"}`}>
                    <span className={`rounded-lg bg-muted p-2 ${LEVEL_CLS[a.level]}`}><TriangleAlert className="h-4 w-4" /></span>
                    <span>
                      <span className="block font-semibold">{a.level === "urgent" ? "Road damage – repair soon" : "Damage developing"}</span>
                      <span className="text-sm text-muted-foreground">{a.name} · priority {Math.round(Math.min(1, a.U) * 100)}% · {a.N} car reports</span>
                    </span>
                  </button>
                ))}
                {!alerts.length && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No alerts yet. Start traffic and roads with damage will appear here.</p>}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Recent activity</h2>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {events.filter((e) => match(e.text)).map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[e.tone]}`} />
                    <span><span className="block text-sm">{e.text}</span><span className="text-xs text-muted-foreground">Today, {e.time}</span></span>
                  </li>
                ))}
                {!events.length && <li className="text-sm text-muted-foreground">Bumps and road status changes will be logged here.</li>}
              </ul>
            </div>
          </section>

          {/* Sensors */}
          <section id="sensors" className="grid scroll-mt-20 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4">
              <h2 className="font-semibold">What the tyre felt · {sel.name}</h2>
              <p className="mb-2 text-xs text-muted-foreground">
                {last ? `${last.vehicle} at ${last.speed.toFixed(0)} km/h · grey = raw left wheel · green = left cleaned · blue = right cleaned` : "Send a car to see its vibration signal."}
              </p>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={signalData}>
                    <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={10} unit="s" />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                    <Line dataKey="raw" stroke="var(--chart-3)" dot={false} strokeWidth={1} isAnimationActive={false} />
                    <Line dataKey="clean" name="left" stroke="var(--chart-1)" dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line dataKey="right" stroke="var(--v-bus)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                    {last?.bump && <ReferenceArea x1={last.bump[0] / 100} x2={last.bump[1] / 100} fill="var(--watch)" fillOpacity={0.15} label={{ value: "speed bump · ignored", fontSize: 10, fill: "var(--muted-foreground)", position: "insideTop" }} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {last && (
                <div className="mt-2">
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                    {last.classes.map((c, i) => <div key={i} className={`flex-1 ${CLASS_BG[c]}`} />)}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Road under the tyre: {last.classes.map((c) => CLASS_TEXT[c]).join(" → ")}</p>
                </div>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <h2 className="font-semibold">Damage per car over time · {sel.name}</h2>
              <p className="mb-2 text-xs text-muted-foreground">Each point = one car, adjusted for its speed</p>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={trendData}>
                    <XAxis dataKey="n" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                    <Line name="Damage" dataKey="D" stroke="var(--chart-2)" strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <FieldData roads={BASE.map((b) => ({ name: b.name, run: b.run }))} selectedRun={sel.run} />

          {/* Settings */}
          <section id="settings" className="grid scroll-mt-20 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4">
              <h2 className="mb-4 font-semibold">Settings</h2>
              <label className="mb-1 flex justify-between text-sm"><span>Traffic (cars / second)</span><span className="font-mono text-primary">{traffic}</span></label>
              <Slider min={1} max={10} step={1} value={[traffic]} onValueChange={(v) => setTraffic(v[0] ?? 1)} />
              <label className="mb-1 mt-5 flex justify-between text-sm"><span>Critical damage threshold (τ)</span><span className="font-mono text-primary">{tau.toFixed(1)}</span></label>
              <Slider min={0.5} max={3} step={0.1} value={[tau]} onValueChange={(v) => setTau(v[0] ?? 1.2)} />
              <p className="mt-2 text-xs text-muted-foreground">Lower = stricter: roads get flagged for repair sooner.</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground"><RouteIcon className="h-4 w-4 text-primary" /> How the score works</h2>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Clean the tyre vibration signal (remove noise).</li>
                <li>Adjust for speed: Dᵢ = peak × (40 / v)^0.5</li>
                <li>Average the last 12 cars, ignoring the top/bottom 15%.</li>
                <li>Uₛ = 0.50·(Dₛ/τ) + 0.35·(βₛ/β_ref) + 0.15·min(1, N/12)</li>
              </ol>
              <p className="mt-3 text-xs">Each road's mix of smooth, uneven and rough surface and its speed bumps come from a real recorded drive (PVS datasets, accelerometers on both front wheels at 100 Hz). Speed bumps are known map features, so they are left out of the damage score.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const cls = value >= 70 ? "stroke-good" : value >= 45 ? "stroke-watch" : "stroke-urgent";
  return (
    <div className="relative my-4 h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx={60} cy={60} r={r} className="fill-none stroke-muted" strokeWidth={10} />
        <circle cx={60} cy={60} r={r} className={`fill-none ${cls} transition-all duration-700`} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><p className="text-3xl font-bold">{value}%</p><p className="text-[10px] tracking-widest text-muted-foreground">HEALTH</p></div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-widest text-muted-foreground">{label.toUpperCase()}</p>
        <span className="rounded-lg bg-muted p-1.5 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
      <div className="font-mono text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MixBar({ mix }: { mix: Mix }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full">
      <div className="bg-good" style={{ width: `${mix.good}%` }} />
      <div className="bg-watch" style={{ width: `${mix.regular}%` }} />
      <div className="bg-urgent" style={{ width: `${mix.bad}%` }} />
    </div>
  );
}
