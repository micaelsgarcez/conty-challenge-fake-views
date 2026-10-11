import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";

// 48 horas de tráfego real em torno de 200 views/hora, sorteadas uma vez e coladas aqui.
const BASE = [
  195, 219, 185, 208, 239, 210, 202, 223, 182, 202, 212, 183, 224, 213, 233, 199, 204, 200, 177, 182, 193, 196, 192, 170,
  185, 214, 190, 188, 179, 225, 183, 194, 219, 204, 221, 187, 200, 184, 193, 210, 217, 205, 189, 176, 193, 198, 216, 197,
];

const organicSpike = BASE.map((v, h) => {
  if (h < 16) return v;
  if (h < 18) return v + (h - 15) * 1000;
  return v + Math.round(3000 * 0.5 ** ((h - 18) / 6));
});

const boughtSpike = BASE.map((v, h) => (h >= 16 && h <= 21 ? v + 3000 : v));

const fastViral = BASE.map((v, h) => (h < 16 ? v : v + Math.round(3000 * 0.5 ** ((h - 16) / 4))));

type Signal = { name: string; value: number | null; threshold: number; fired: boolean; explanation: string };
type Result = { classification: string; reason: string; signals: Signal[] };

const app = createApp();

function classify(body: unknown) {
  return app.request("/classify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function verdict(views: number[]) {
  const res = await classify({ views_per_hour: views });
  expect(res.status).toBe(200);
  const result = (await res.json()) as Result;
  return { ...result, fired: result.signals.filter((s) => s.fired).map((s) => s.name) };
}

describe("pico orgânico contra pico comprado", () => {
  it("os dois chegam à mesma altura, mas só o comprado é suspeito", async () => {
    expect(Math.max(...organicSpike)).toBe(3177);
    expect(Math.max(...boughtSpike)).toBe(3204);

    const organic = await verdict(organicSpike);
    const bought = await verdict(boughtSpike);

    expect(organic.classification).toBe("legit");
    expect(bought.classification).toBe("suspicious");
    expect(organic.fired).toEqual(["spike"]);
    expect(bought.fired).toEqual(["spike", "step_rise", "flat_top", "cliff"]);
  });

  it("o motivo de cada um cita os números que decidiram", async () => {
    expect((await verdict(organicSpike)).reason).toBe(
      "Legítimo: o pico sobe aos poucos e decai devagar, como um vídeo que estourou de verdade. " +
        "O maior valor (3.177 views na hora 19) é 6,8 vezes a mediana da série (464 views por hora). Pico conta a partir de 5 vezes. " +
        "A maior alta em uma hora antes do pico (de 199 para 1.204, da hora 16 para a 17) fez 37% do caminho da mediana até o pico. Degrau conta a partir de 80%. " +
        "O topo ficou 1 hora acima de 95% do máximo (3.018 views). Platô conta a partir de 3 horas. " +
        "A maior queda em uma hora depois do pico (de 3.177 para 2.855, da hora 19 para a 20) desfez 12% da altura do pico. Penhasco conta a partir de 60%.",
    );
    expect((await verdict(boughtSpike)).reason).toBe(
      "Suspeito: o pico tem forma de tráfego comprado, que entra de uma vez, fica parado no topo e sai de uma vez. " +
        "O maior valor (3.204 views na hora 17) é 15,8 vezes a mediana da série (203 views por hora). Pico conta a partir de 5 vezes. " +
        "A maior alta em uma hora antes do pico (de 199 para 3.204, da hora 16 para a 17) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%. " +
        "O topo ficou 6 horas seguidas acima de 95% do máximo (3.044 views). Platô conta a partir de 3 horas. " +
        "A maior queda em uma hora depois do pico (de 3.196 para 192, da hora 22 para a 23) desfez 100% da altura do pico. Penhasco conta a partir de 60%.",
    );
  });
});

describe("casos óbvios de compra", () => {
  it("valor idêntico a toda hora é repetição mecânica", async () => {
    const r = await verdict(Array(48).fill(1500));
    expect(r.classification).toBe("suspicious");
    expect(r.fired).toEqual(["too_smooth", "exact_repetition"]);
  });

  it("um ciclo exato que se repete a cada 3 horas é repetição mecânica", async () => {
    const r = await verdict(Array.from({ length: 48 }, (_, h) => [900, 1400, 1100][h % 3]!));
    expect(r.classification).toBe("suspicious");
    expect(r.fired).toEqual(["exact_repetition"]);
  });

  it("robô constante por cima do tráfego real deixa a série lisa demais", async () => {
    const r = await verdict(BASE.map((v) => v + 8000));
    expect(r.classification).toBe("suspicious");
    expect(r.fired).toEqual(["too_smooth"]);
  });

  it("nível alto que despenca para perto de zero em uma hora é queda abrupta", async () => {
    const tail = [4, 2, 0, 3, 1, 5, 2, 0, 1, 3, 2, 4, 1, 0, 2, 3, 1, 2];
    const r = await verdict([...BASE.slice(0, 30).map((v) => v * 10), ...tail]);
    expect(r.classification).toBe("suspicious");
    expect(r.fired).toEqual(["drop_to_zero"]);
  });
});

describe("quando o classificador não acusa", () => {
  it("tráfego real sem pico é legítimo", async () => {
    const r = await verdict(BASE);
    expect(r.classification).toBe("legit");
    expect(r.fired).toEqual([]);
  });

  it("viral que estoura numa hora só mas decai aos poucos fica inconclusivo", async () => {
    const r = await verdict(fastViral);
    expect(r.classification).toBe("inconclusive");
    expect(r.fired).toEqual(["spike", "step_rise"]);
    expect(r.reason).toBe(
      "Inconclusivo: o pico tem um traço de compra, mas o resto da forma é de pico orgânico. Um traço só não basta para acusar. " +
        "O maior valor (3.204 views na hora 17) é 12,3 vezes a mediana da série (261 views por hora). Pico conta a partir de 5 vezes. " +
        "A maior alta em uma hora antes do pico (de 199 para 3.204, da hora 16 para a 17) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%.",
    );
  });

  it("série com menos de 24 horas fica inconclusiva", async () => {
    const r = await verdict([120, 130, 4000, 4000, 4000, 4000, 125, 118, 131, 122]);
    expect(r.classification).toBe("inconclusive");
    expect(r.reason).toBe(
      "Inconclusivo: a série tem 10 horas. Com menos de 24 horas não dá para separar um pico orgânico de um comprado, então o classificador não acusa.",
    );
  });
});

describe("validação da entrada", () => {
  it.each([
    { name: "corpo que não é JSON", body: "{", code: "invalid_body" },
    { name: "sem views_per_hour", body: {}, code: "views_required" },
    { name: "lista vazia", body: { views_per_hour: [] }, code: "views_required" },
    { name: "texto no lugar de lista", body: { views_per_hour: "100,200" }, code: "views_required" },
    { name: "valor negativo", body: { views_per_hour: [10, -1] }, code: "views_invalid" },
    { name: "valor quebrado", body: { views_per_hour: [10, 1.5] }, code: "views_invalid" },
    { name: "número como texto", body: { views_per_hour: ["10"] }, code: "views_invalid" },
    { name: "série com mais de 90 dias", body: { views_per_hour: Array(2161).fill(1) }, code: "series_too_long" },
  ])("$name devolve 422 $code", async ({ body, code }) => {
    const res = await classify(body);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe(code);
  });

  it("o erro diz qual posição está errada", async () => {
    const res = await classify({ views_per_hour: [10, 20, -5] });
    expect(await res.json()).toEqual({
      error: "Cada valor de views_per_hour deve ser um inteiro maior ou igual a zero. A hora 3 veio com -5.",
      code: "views_invalid",
    });
  });
});
