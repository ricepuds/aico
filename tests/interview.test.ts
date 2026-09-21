import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterCases, parseContent, extractQuestions, buildPrompt, type InterviewCase, type Filters, type InterviewMode } from "../src/lib/interview.ts";

const data: InterviewCase[] = JSON.parse(readFileSync(new URL("../public/data/cases.json", import.meta.url), "utf8"));
const empty: Filters = { university: "", department: "", years: [], region: "", field: "", interview: "" };
const fixture = (content: string, overrides: Partial<InterviewCase> = {}): InterviewCase => ({ id: "fixture", year: "2026", volume: 1, uni: "테스트대학교", dept: "컴퓨터공학과", type: "학종", name: "인재", region: "수도권", field: "공학", interview: "생기부", content, ...overrides });

test("real data: exact Gachon selection contains seven questions, not the case count", () => {
  const selected = filterCases(data, { ...empty, university: "가천 대학교", department: "컴퓨터공학전공" });
  assert.equal(selected.length, 1);
  const questions = extractQuestions(selected);
  assert.equal(questions.length, 7);
  assert.ok(questions.some(question => question.text.includes("다익스트라")));
  const prompt = buildPrompt("가천대학교", "컴퓨터공학전공", "basic", questions);
  assert.ok(!prompt.includes("야망이 넘치는 지원자"));
  assert.ok(!prompt.includes("시내에서 피켓"));
  assert.ok(prompt.includes("2023학년도 가천대학교 컴퓨터공학전공"));
});

test("all filter dimensions are combined; whitespace and partial search are retained", () => {
  assert.equal(filterCases(data, empty).length, data.length);
  const filters = { ...empty, university: "가천", department: "컴퓨터", years: ["2023"], region: "수도권", field: "공학", interview: "생기부" };
  assert.equal(filterCases(data, filters).length, 1);
  assert.equal(filterCases(data, { ...filters, years: ["2026"] }).length, 0);
  assert.equal(filterCases(data, { ...filters, region: "충청권" }).length, 0);
  assert.equal(filterCases(data, { ...filters, interview: "제시문" }).length, 0);
});

test("parser handles multiline questions, interviewer prefixes, answers and advice boundaries", () => {
  const record = fixture("면접 절차 및 과정\n질문 준비 시간 10분\n질문 및 답변 내용\n[질문] 이 프로젝트에서\n어떤 원리를 사용했나요?\n[답변] 비공개 경험\n답변 이어지는 줄\n면접관: 그 방법을 택한 이유는?\n지원자: 비공개 이유\n후배들을 위한 조언\n[질문] 조언은 면접 질문 아님");
  assert.deepEqual(extractQuestions([record]).map(question => question.text), ["이 프로젝트에서 어떤 원리를 사용했나요?", "그 방법을 택한 이유는?"]);
  assert.ok(parseContent(record.content).some(section => section.title === "후배들을 위한 조언"));
});

test("numbered, Q/A and quoted formats work without adding answers to questions", () => {
  for (const content of ["1. 지원동기는?\n답변: 이유", "Q1. 지원동기는?\nA1. 이유", "<지원동기는?>\n[답변] 이유", "교수님 [질문] 지원동기는?\n저: 이유"]) {
    assert.deepEqual(extractQuestions([fixture(`질문 및 답변 내용\n${content}`)]).map(question => question.text), ["지원동기는?"]);
  }
});

test("deduplicate questions while preserving every distinct source", () => {
  const records = [fixture("질문 및 답변 내용\n[질문] 지원 동기는?\n[답변] A"), fixture("질문 및 답변 내용\n[질문] 지원동기는?\n[답변] B", { id: "second", year: "2025" })];
  const result = extractQuestions(records);
  assert.equal(result.length, 1);
  assert.equal(result[0].sources.length, 2);
});

test("each mode preserves the requested rules and changes follow-up intensity", () => {
  const questions = extractQuestions([fixture("질문 및 답변 내용\n[질문] 동기는?\n[답변] 이유")]);
  const phrases = { basic: "친절하지만 실제 대학 면접", deep: "전공 지식과 프로젝트의 원리", pressure: "무례하거나 공격적인 표현" };
  for (const mode of Object.keys(phrases) as InterviewMode[]) {
    const prompt = buildPrompt("테스트대학교", "컴퓨터공학과", mode, questions);
    assert.ok(prompt.includes(phrases[mode]));
    assert.ok(prompt.includes("한 번에 하나씩"));
    assert.ok(prompt.includes('"면접 종료"'));
    assert.ok(prompt.includes("더 좋은 답변 예시"));
    assert.ok(prompt.includes("첫 번째 질문 하나만"));
  }
});

test("missing selections and empty questions cannot generate an interview", () => {
  const questions = extractQuestions([fixture("질문 및 답변 내용\n[질문] 질문\n[답변] 답")]);
  assert.equal(buildPrompt("", "학과", "basic", questions), "");
  assert.equal(buildPrompt("학교", "", "basic", questions), "");
  assert.equal(buildPrompt("학교", "학과", "basic", []), "");
  assert.equal(extractQuestions([fixture("면접 절차 및 과정\n면접관 3인\n후배들을 위한 조언\n열심히 준비")]).length, 0);
});

test("questions use all matching cases beyond one page", () => {
  const records = Array.from({ length: 30 }, (_, i) => fixture(`질문 및 답변 내용\n[질문] 질문 ${i}\n[답변] 답`, { id: String(i) }));
  const questions = extractQuestions(filterCases(records, empty));
  assert.equal(questions.length, 30);
  assert.ok(buildPrompt("학교", "학과", "deep", questions).includes("30. 질문 29"));
});
