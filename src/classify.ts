import { readSignals } from "./signals.ts";
import type { Signal, SignalName, Signals } from "./signals.ts";

export type Classification = "legit" | "suspicious" | "inconclusive";

export type Verdict = {
  classification: Classification;
  reason: string;
  signals: Signal[];
};

const MIN_HOURS = 24;

const SHAPE: SignalName[] = ["step_rise", "flat_top", "cliff"];

type Rule = {
  classification: Classification;
  when: (s: Signals, hours: number) => boolean;
  reason: (s: Signals, hours: number) => string;
};

const shapeCount = (s: Signals) => SHAPE.filter((name) => s[name].fired).length;

const explain = (s: Signals, names: SignalName[], onlyFired = true) =>
  names
    .filter((name) => !onlyFired || s[name].fired)
    .map((name) => s[name].explanation)
    .join(" ");

// A primeira regra que casa decide. A ordem é a política: série curta não acusa,
// máquina e queda acusam sozinhas, pico só acusa com dois traços de compra.
const RULES: Rule[] = [
  {
    classification: "inconclusive",
    when: (_, hours) => hours < MIN_HOURS,
    reason: (_, hours) =>
      `Inconclusivo: a série tem ${hours} horas. Com menos de ${MIN_HOURS} horas não dá para separar um pico orgânico de um comprado, então o classificador não acusa.`,
  },
  {
    classification: "suspicious",
    when: (s) => s.too_smooth.fired || s.exact_repetition.fired,
    reason: (s) => `Suspeito: repetição mecânica. ${explain(s, ["too_smooth", "exact_repetition"])}`,
  },
  {
    classification: "suspicious",
    when: (s) => s.drop_to_zero.fired,
    reason: (s) => `Suspeito: queda abrupta para perto de zero. ${explain(s, ["drop_to_zero"])}`,
  },
  {
    classification: "suspicious",
    when: (s) => s.spike.fired && shapeCount(s) >= 2,
    reason: (s) =>
      `Suspeito: o pico tem forma de tráfego comprado, que entra de uma vez, fica parado no topo e sai de uma vez. ${explain(s, ["spike", ...SHAPE])}`,
  },
  {
    classification: "inconclusive",
    when: (s) => s.spike.fired && shapeCount(s) === 1,
    reason: (s) =>
      `Inconclusivo: o pico tem um traço de compra, mas o resto da forma é de pico orgânico. Um traço só não basta para acusar. ${explain(s, ["spike", ...SHAPE])}`,
  },
  {
    classification: "legit",
    when: (s) => s.spike.fired,
    reason: (s) =>
      `Legítimo: o pico sobe aos poucos e decai devagar, como um vídeo que estourou de verdade. ${explain(s, ["spike", ...SHAPE], false)}`,
  },
  {
    classification: "legit",
    when: () => true,
    reason: (s) => `Legítimo: nenhum sinal de repetição mecânica, pico comprado ou queda abrupta. ${explain(s, ["spike"], false)}`,
  },
];

export function classify(views: number[]): Verdict {
  const signals = readSignals(views);
  const rule = RULES.find((r) => r.when(signals, views.length))!;
  return {
    classification: rule.classification,
    reason: rule.reason(signals, views.length),
    signals: Object.values(signals),
  };
}
