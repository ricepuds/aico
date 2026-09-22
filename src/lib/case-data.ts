"use client";
import { useEffect, useState } from "react";
import type { InterviewCase } from "./interview";

export interface CaseSummary extends InterviewCase { questionCount: number; dataFile: string }
const cache = new Map<string, Promise<InterviewCase[]>>();
const empty: InterviewCase[] = [];

function loadFile(file: string) {
  let pending = cache.get(file);
  if (!pending) {
    pending = fetch(`/data/${file}`).then(async response => {
      if (!response.ok) throw new Error("후기 본문을 불러오지 못했습니다.");
      const data: unknown = await response.json();
      if (!Array.isArray(data) || data.some(record => !record || typeof record.id !== "string" || typeof record.content !== "string")) throw new Error("후기 본문 형식을 확인해 주세요.");
      return data as InterviewCase[];
    }).catch(error => { cache.delete(file); throw error; });
    cache.set(file, pending);
  }
  return pending;
}

export function useCaseDetails(records: CaseSummary[]) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ records: CaseSummary[]; data: InterviewCase[]; error: string }>();
  useEffect(() => {
    if (!records.length) return;
    let active = true;
    // Bound concurrency when selecting a large collection for printing.
    const files = [...new Set(records.map(record => record.dataFile))];
    const loaded: InterviewCase[] = [];
    let cursor = 0;
    void Promise.all(Array.from({ length: Math.min(6, files.length) }, async () => {
      while (active && cursor < files.length) loaded.push(...await loadFile(files[cursor++]));
    })).then(() => {
      if (!active) return;
      const byId = new Map(loaded.map(record => [record.id, record]));
      const data = records.map(record => {
        const detail = byId.get(record.id);
        if (!detail) throw new Error("후기 본문을 찾지 못했습니다.");
        return detail;
      });
      if (active) setState({ records, data, error: "" });
    }).catch(error => { if (active) setState({ records, data: empty, error: error instanceof Error ? error.message : "자료를 불러오지 못했습니다." }); });
    return () => { active = false; };
  }, [records, attempt]);
  const current = state?.records === records ? state : undefined;
  return {
    data: current?.data ?? empty,
    loading: records.length > 0 && !current,
    error: current?.error ?? "",
    retry: () => { setState(undefined); setAttempt(value => value + 1); },
  };
}
