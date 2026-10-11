import { classify } from "./classify.ts";
import type { Classification } from "./classify.ts";

export type Label = "legit" | "suspicious";

export type Series = { id: string; family: string; label: Label; views_per_hour: number[] };

export type Dataset = { seed: number; hours: number; series: Series[] };

const SEED = 20261011;
const HOURS = 72;
const PER_FAMILY = 40;

type Rng = {
  uniform: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  normal: () => number;
  poisson: (rate: number) => number;
};

// mulberry32: PRNG pequeno e semeado, para o dataset não depender de Math.random.
function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  const poisson = (rate: number) => {
    if (rate > 30) return Math.max(0, Math.round(rate + Math.sqrt(rate) * normal()));
    const limit = Math.exp(-rate);
    let k = 0;
    for (let p = next(); p > limit; p *= next()) k++;
    return k;
  };
  return {
    uniform: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor((max - min + 1) * next()),
    normal,
    poisson,
  };
}

const hours = (f: (h: number) => number) => Array.from({ length: HOURS }, (_, h) => f(h));

// Taxa esperada de views reais: ciclo do dia, oscilação de 8% de hora em hora e,
// por cima, a contagem com o acaso de chegadas independentes (Poisson).
function organic(r: Rng, base: number, amplitude: number, extra: (h: number) => number = () => 0) {
  const phase = r.uniform(0, 24);
  return hours((h) => {
    const daily = base * (1 + amplitude * Math.sin((2 * Math.PI * (h + phase)) / 24));
    return r.poisson((daily + extra(h)) * Math.exp(0.08 * r.normal()));
  });
}

function viral(r: Rng, base: number, riseHours: number) {
  const start = r.int(12, 36);
  const height = base * r.uniform(8, 30);
  const halfLife = r.uniform(3, 12);
  const top = start + riseHours - 1;
  return organic(r, base, r.uniform(0.1, 0.5), (h) => {
    if (h < start) return 0;
    if (h <= top) return (height * (h - start + 1)) / riseHours;
    return height * 0.5 ** ((h - top) / halfLife);
  });
}

const FAMILIES: Record<string, { label: Label; make: (r: Rng) => number[] }> = {
  organic_steady: { label: "legit", make: (r) => organic(r, r.uniform(30, 500), r.uniform(0.1, 0.3)) },
  organic_daily_cycle: { label: "legit", make: (r) => organic(r, r.uniform(30, 500), r.uniform(0.5, 0.85)) },
  organic_viral: { label: "legit", make: (r) => viral(r, r.uniform(30, 300), r.int(2, 5)) },
  organic_viral_fast: { label: "legit", make: (r) => viral(r, r.uniform(30, 300), 1) },
  bought_spike: {
    label: "suspicious",
    make: (r) => {
      const base = r.uniform(30, 300);
      const start = r.int(12, 50);
      const end = start + r.int(3, 8) - 1;
      const height = base * r.uniform(8, 30);
      const real = organic(r, base, r.uniform(0.1, 0.5));
      return real.map((v, h) => (h >= start && h <= end ? v + Math.round(height * (1 + 0.02 * r.normal())) : v));
    },
  },
  mechanical_plateau: {
    label: "suspicious",
    make: (r) => {
      const base = r.uniform(30, 150);
      const start = r.int(0, 12);
      const end = start + r.int(36, 60);
      const bot = Math.round(base * r.uniform(15, 40));
      return organic(r, base, r.uniform(0.1, 0.3)).map((v, h) => (h >= start && h < end ? v + bot : v));
    },
  },
  mechanical_loop: {
    label: "suspicious",
    make: (r) => {
      const period = [1, 2, 3, 4, 6, 8, 12, 24][r.int(0, 7)]!;
      const level = r.uniform(300, 3000);
      const pattern = Array.from({ length: period }, () => Math.round(level * r.uniform(0.5, 1.5)));
      return hours((h) => pattern[h % period]!);
    },
  },
  abrupt_drop: {
    label: "suspicious",
    make: (r) => {
      const base = r.uniform(5, 30);
      const stop = r.int(24, 48);
      const bot = base * r.uniform(40, 150);
      return organic(r, base, 0.2).map((v, h) => (h < stop ? v + Math.round(bot * Math.exp(0.1 * r.normal())) : v));
    },
  },
  bought_drip: {
    label: "suspicious",
    make: (r) => {
      const share = r.uniform(0.3, 0.8);
      return organic(r, r.uniform(30, 500), r.uniform(0.3, 0.7)).map((v) => v + r.poisson(v * share));
    },
  },
};

export function generateDataset(seed = SEED): Dataset {
  const r = createRng(seed);
  const series = Object.entries(FAMILIES).flatMap(([family, { label, make }]) =>
    Array.from({ length: PER_FAMILY }, (_, i) => ({
      id: `${family}-${String(i + 1).padStart(2, "0")}`,
      family,
      label,
      views_per_hour: make(r),
    })),
  );
  return { seed, hours: HOURS, series };
}

type Row = Record<Classification, number>;

export type Measurement = {
  seed: number;
  total: number;
  hours: number;
  byFamily: { family: string; label: Label; counts: Row }[];
  confusion: Record<Label, Row>;
  falsePositives: number;
  legitTotal: number;
  falsePositiveRate: number;
};

const emptyRow = (): Row => ({ legit: 0, suspicious: 0, inconclusive: 0 });

export function measure(dataset: Dataset): Measurement {
  const confusion: Record<Label, Row> = { legit: emptyRow(), suspicious: emptyRow() };
  const families = new Map<string, { family: string; label: Label; counts: Row }>();
  for (const s of dataset.series) {
    const { classification } = classify(s.views_per_hour);
    confusion[s.label][classification]++;
    const entry = families.get(s.family) ?? { family: s.family, label: s.label, counts: emptyRow() };
    entry.counts[classification]++;
    families.set(s.family, entry);
  }
  const legitTotal = confusion.legit.legit + confusion.legit.suspicious + confusion.legit.inconclusive;
  return {
    seed: dataset.seed,
    total: dataset.series.length,
    hours: dataset.hours,
    byFamily: [...families.values()],
    confusion,
    falsePositives: confusion.legit.suspicious,
    legitTotal,
    falsePositiveRate: confusion.legit.suspicious / legitTotal,
  };
}

const formatPercent = (rate: number) => `${(rate * 100).toFixed(1).replace(".", ",")}%`;

export function formatReport(m: Measurement): string {
  const row = (name: string, label: string, c: Row) =>
    `${name.padEnd(22)}${label.padEnd(12)}${String(c.legit).padStart(6)}${String(c.suspicious).padStart(12)}${String(c.inconclusive).padStart(14)}`;
  const header = `${"".padEnd(22)}${"rótulo".padEnd(12)}${"legit".padStart(6)}${"suspicious".padStart(12)}${"inconclusive".padStart(14)}`;
  return [
    `Dataset: ${m.total} séries de ${m.hours} horas, semente ${m.seed}`,
    "",
    header,
    ...m.byFamily.map((f) => row(f.family, f.label, f.counts)),
    "",
    "Matriz de confusão (linha: rótulo do gerador; coluna: classificação)",
    header,
    row("", "legit", m.confusion.legit),
    row("", "suspicious", m.confusion.suspicious),
    "",
    `Taxa de falso positivo: ${m.falsePositives} de ${m.legitTotal} séries legítimas (${formatPercent(m.falsePositiveRate)})`,
  ].join("\n");
}
