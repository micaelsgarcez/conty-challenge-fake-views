import { writeFileSync } from "node:fs";
import { formatReport, generateDataset, measure } from "./dataset.ts";

const dataset = generateDataset();
const lines = dataset.series.map((s) => `    ${JSON.stringify(s)}`);
writeFileSync(
  new URL("../dataset/views.json", import.meta.url),
  `{\n  "seed": ${dataset.seed},\n  "hours": ${dataset.hours},\n  "series": [\n${lines.join(",\n")}\n  ]\n}\n`,
);
console.log(formatReport(measure(dataset)));
