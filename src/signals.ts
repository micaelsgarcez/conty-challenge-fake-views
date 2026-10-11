export type Signal = {
  name: SignalName;
  value: number | null;
  threshold: number;
  fired: boolean;
  explanation: string;
};

type Reading = Omit<Signal, "name">;

type Series = {
  views: number[];
  median: number;
  peak: number;
  peakHour: number;
  spike: boolean;
};

const SPIKE_RATIO = 5;
const WINDOW = 6;

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n = (v: number) => int.format(v);
const pct = (v: number) => percent.format(v);
const round = (v: number, digits = 2) => Number(v.toFixed(digits));
const spikeRatio = (peak: number, med: number) => round(peak / Math.max(med, 1), 1);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function notApplicable(threshold: number, explanation: string): Reading {
  return { value: null, threshold, fired: false, explanation };
}

const NO_SPIKE = "Não há pico, então não se aplica.";

function spike(s: Series): Reading {
  const value = spikeRatio(s.peak, s.median);
  return {
    value,
    threshold: SPIKE_RATIO,
    fired: value >= SPIKE_RATIO,
    explanation: `O maior valor (${n(s.peak)} views na hora ${s.peakHour + 1}) é ${dec.format(value)} vezes a mediana da série (${n(s.median)} views por hora). Pico conta a partir de ${SPIKE_RATIO} vezes.`,
  };
}

function stepRise(s: Series): Reading {
  const threshold = 0.8;
  if (!s.spike) return notApplicable(threshold, NO_SPIKE);
  if (s.peakHour === 0) return { value: 0, threshold, fired: false, explanation: "A série já começa no pico, então a subida não aparece." };
  let at = 1;
  for (let t = 2; t <= s.peakHour; t++) if (s.views[t]! - s.views[t - 1]! > s.views[at]! - s.views[at - 1]!) at = t;
  const value = round(Math.min(1, (s.views[at]! - s.views[at - 1]!) / (s.peak - s.median)));
  return {
    value,
    threshold,
    fired: value >= threshold,
    explanation: `A maior alta em uma hora antes do pico (de ${n(s.views[at - 1]!)} para ${n(s.views[at]!)}, da hora ${at} para a ${at + 1}) fez ${pct(value)} do caminho da mediana até o pico. Degrau conta a partir de ${pct(threshold)}.`,
  };
}

function flatTop(s: Series): Reading {
  const threshold = 3;
  if (!s.spike) return notApplicable(threshold, NO_SPIKE);
  const floor = 0.95 * s.peak;
  let from = s.peakHour;
  let to = s.peakHour;
  while (from > 0 && s.views[from - 1]! >= floor) from--;
  while (to < s.views.length - 1 && s.views[to + 1]! >= floor) to++;
  const value = to - from + 1;
  return {
    value,
    threshold,
    fired: value >= threshold,
    explanation: `O topo ficou ${value} ${value === 1 ? "hora" : "horas seguidas"} acima de 95% do máximo (${n(floor)} views). Platô conta a partir de ${threshold} horas.`,
  };
}

function cliff(s: Series): Reading {
  const threshold = 0.6;
  if (!s.spike) return notApplicable(threshold, NO_SPIKE);
  const last = s.views.length - 1;
  if (s.peakHour === last) return { value: 0, threshold, fired: false, explanation: "A série termina no pico, então a queda não aparece." };
  let at = s.peakHour + 1;
  for (let t = at + 1; t <= last; t++) if (s.views[t - 1]! - s.views[t]! > s.views[at - 1]! - s.views[at]!) at = t;
  const value = round(Math.min(1, Math.max(0, s.views[at - 1]! - s.views[at]!) / (s.peak - s.median)));
  return {
    value,
    threshold,
    fired: value >= threshold,
    explanation: `A maior queda em uma hora depois do pico (de ${n(s.views[at - 1]!)} para ${n(s.views[at]!)}, da hora ${at} para a ${at + 1}) desfez ${pct(value)} da altura do pico. Penhasco conta a partir de ${pct(threshold)}.`,
  };
}

// Views reais chegam por acaso, como chamadas numa central: com média m por hora,
// o número oscila naturalmente perto de raiz de m. Robô entrega mais liso que isso.
function tooSmooth(s: Series): Reading {
  const threshold = 0.5;
  if (s.median < 1) return notApplicable(threshold, "A série está quase toda zerada, então não se aplica.");
  const typical = median(s.views.slice(1).map((v, t) => Math.abs(v - s.views[t]!)));
  const chance = Math.sqrt(s.median);
  const value = round(typical / chance);
  return {
    value,
    threshold,
    fired: value <= threshold,
    explanation: `De uma hora para a outra as views mudaram tipicamente ${n(typical)}. Com ${n(s.median)} views por hora, só o acaso já faz o número variar perto de ${n(chance)}. A variação vista é ${pct(value)} disso. Abaixo de ${pct(threshold)} parece máquina.`,
  };
}

function exactRepetition(s: Series): Reading {
  const threshold = 0.5;
  let best = { k: 0, same: 0, total: 0 };
  for (let k = 1; k <= 24 && k < s.views.length; k++) {
    let same = 0;
    let total = 0;
    for (let t = k; t < s.views.length; t++) {
      if (s.views[t]! < 10) continue;
      total++;
      if (s.views[t] === s.views[t - k]) same++;
    }
    if (total >= 12 && (best.total === 0 || same / total > best.same / best.total)) best = { k, same, total };
  }
  if (best.total === 0) return notApplicable(threshold, "Poucas horas com 10 views ou mais, então não se aplica.");
  const value = round(best.same / best.total);
  return {
    value,
    threshold,
    fired: value >= threshold,
    explanation: `${best.same} de ${best.total} horas repetem exatamente o valor de ${best.k} ${best.k === 1 ? "hora" : "horas"} antes (${pct(value)}). Repetição conta a partir de ${pct(threshold)}.`,
  };
}

function dropToZero(s: Series): Reading {
  const threshold = 0.05;
  let best: { t: number; before: number; after: number } | undefined;
  for (let t = WINDOW; t + WINDOW <= s.views.length; t++) {
    const before = mean(s.views.slice(t - WINDOW, t));
    const after = mean(s.views.slice(t, t + WINDOW));
    if (before >= 30 && (!best || after / before < best.after / best.before)) best = { t, before, after };
  }
  if (!best) return notApplicable(threshold, `Nenhum trecho de ${WINDOW} horas com média de 30 views ou mais seguido de outras ${WINDOW} horas, então não se aplica.`);
  const value = round(best.after / best.before, 3);
  return {
    value,
    threshold,
    fired: value <= threshold,
    explanation: `A partir da hora ${best.t + 1}, a média caiu de ${n(best.before)} views por hora nas ${WINDOW} horas anteriores para ${n(best.after)} nas ${WINDOW} seguintes (${pct(value)} do nível anterior). Queda conta abaixo de ${pct(threshold)}.`,
  };
}

export const SIGNALS = {
  spike,
  step_rise: stepRise,
  flat_top: flatTop,
  cliff,
  too_smooth: tooSmooth,
  exact_repetition: exactRepetition,
  drop_to_zero: dropToZero,
} satisfies Record<string, (s: Series) => Reading>;

export type SignalName = keyof typeof SIGNALS;
export type Signals = Record<SignalName, Signal>;

export function readSignals(views: number[]): Signals {
  const peak = Math.max(...views);
  const med = median(views);
  const series: Series = { views, median: med, peak, peakHour: views.indexOf(peak), spike: spikeRatio(peak, med) >= SPIKE_RATIO };
  const entries = Object.entries(SIGNALS).map(([name, read]) => [name, { name, ...read(series) }]);
  return Object.fromEntries(entries) as Signals;
}
