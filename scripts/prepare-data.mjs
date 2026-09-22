import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extractQuestions } from "../src/lib/interview.ts";

const root = new URL("../public/data/", import.meta.url);
const cases = JSON.parse(await readFile(new URL("cases.json", root), "utf8"));
const groups = new Map();
for (const record of cases) {
  const key = `${record.uni}\0${record.dept}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
}
await mkdir(new URL("details/", root), { recursive: true });
const files = new Map();
for (const [key, records] of groups) {
  const body = JSON.stringify(records);
  const file = `details/${createHash("sha256").update(body).digest("hex").slice(0, 24)}.json`;
  await writeFile(new URL(file, root), body);
  files.set(key, file);
}
const index = cases.map(record => {
  const { content, ...metadata } = record;
  return { ...metadata, content: "", questionCount: extractQuestions([record]).length, dataFile: files.get(`${record.uni}\0${record.dept}`) };
});
await writeFile(new URL("index.json", root), JSON.stringify(index));
console.log(`Prepared ${index.length} summaries and ${groups.size} detail files`);
