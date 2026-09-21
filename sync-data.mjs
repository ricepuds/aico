import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = fileURLToPath(new URL("../public/data/", import.meta.url));
const source = "https://interview-cases-xi.vercel.app/api/cases";
const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`질문 데이터 다운로드 실패: HTTP ${response.status}`);
const records = await response.json();
const required = ["id", "year", "uni", "dept", "type", "name", "region", "field", "interview", "content"];
if (!Array.isArray(records) || !records.length || records.some(record =>
  !record || required.some(key => typeof record[key] !== "string") || !Number.isInteger(record.volume)
)) throw new Error("질문 데이터 형식이 올바르지 않아 기존 파일을 유지합니다.");
if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("중복 후기 ID가 있습니다.");
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, "cases.json.tmp"), JSON.stringify(records), "utf8");
await rename(path.join(directory, "cases.json.tmp"), path.join(directory, "cases.json"));
await writeFile(path.join(directory, "source.json"), JSON.stringify({
  source, fetchedAt: new Date().toISOString(), count: records.length,
  copyright: "본 자료의 저작권은 충북교육청 대입지원단에 있습니다. 학교 교육 활동 목적 외 무단 복제·배포·게시를 금지합니다."
}, null, 2), "utf8");
console.log(`${records.length}건 저장 완료`);
