import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatReport, generateDataset, measure } from "../src/dataset.ts";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("dataset sintético", () => {
  it("a taxa de falso positivo do README é a que o comando mede", () => {
    const m = measure(generateDataset());
    const match = readme.match(/Taxa de falso positivo: \*\*(\d+) de (\d+) séries legítimas \((\d+,\d)%\)\*\*/);
    expect(match, "README sem a linha da taxa de falso positivo").not.toBeNull();
    const [, falsePositives, legit, percent] = match!;
    expect({ falsePositives: Number(falsePositives), legit: Number(legit), percent }).toEqual({
      falsePositives: m.falsePositives,
      legit: m.legitTotal,
      percent: (m.falsePositiveRate * 100).toFixed(1).replace(".", ","),
    });
  });

  it("o README traz o relatório exato que o comando imprime", () => {
    expect(readme).toContain(formatReport(measure(generateDataset())));
  });

  it("o arquivo versionado é o que o gerador produz", () => {
    const file = JSON.parse(readFileSync(new URL("../dataset/views.json", import.meta.url), "utf8"));
    expect(file).toEqual(generateDataset());
  });

  it("a mesma semente gera a mesma série e outra semente gera outra", () => {
    const a = generateDataset(1).series[0]!.views_per_hour;
    expect(generateDataset(1).series[0]!.views_per_hour).toEqual(a);
    expect(generateDataset(2).series[0]!.views_per_hour).not.toEqual(a);
  });
});
