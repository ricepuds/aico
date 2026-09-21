"use client";

import { useEffect, useMemo, useState } from "react";
import { filterCases, normalize, extractQuestions, type Filters, type InterviewCase } from "@/lib/interview";
import { MockInterview } from "@/components/mock-interview";
import { CaseContent } from "@/components/case-content";
import { Modal } from "@/components/modal";

const initialFilters: Filters = { university: "", department: "", years: [], region: "", field: "", interview: "" };
const format = (number: number) => number.toLocaleString("ko-KR");
const unique = (values: string[]) => [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));
const interviewLabel = (value: string) => ({ 생기부: "생기부 기반", 제시문: "제시문 기반", 대학제공질문: "대학 제공 질문" })[value] || value;
const pageSize = 12;

export default function Home() {
  const [cases, setCases] = useState<InterviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<InterviewCase | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/data/cases.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("질문 자료를 불러오지 못했습니다.");
      const data: unknown = await response.json();
      if (!Array.isArray(data) || data.some(record => !record || ["id", "year", "uni", "dept", "content", "region", "field", "interview"].some(key => typeof record[key] !== "string"))) throw new Error("질문 자료 형식을 확인해 주세요.");
      setCases(data as InterviewCase[]);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "자료를 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const years = useMemo(() => unique(cases.map(record => record.year)).reverse(), [cases]);
  const universities = useMemo(() => unique(cases.map(record => record.uni)), [cases]);
  const university = universities.find(name => normalize(name) === normalize(filters.university)) || "";
  const departments = useMemo(() => unique(cases.filter(record => !university || record.uni === university).map(record => record.dept)), [cases, university]);
  const department = departments.find(name => normalize(name) === normalize(filters.department)) || "";
  const filtered = useMemo(() => filterCases(cases, filters), [cases, filters]);
  // Full filtered collection, never the current page or the print selection.
  const references = useMemo(() => university && department ? filtered.filter(record => record.uni === university && record.dept === department) : [], [filtered, university, department]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const printCases = cases.filter(record => selected.has(record.id));
  const questionCounts = useMemo(() => new Map(cases.map(record => [record.id, extractQuestions([record]).length])), [cases]);
  const resultUniversities = unique(filtered.map(record => record.uni)).length;
  const resultDepartments = unique(filtered.map(record => record.dept)).length;

  function change<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); }
  function toggleRecord(id: string) { setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  return <>
    <a className="skip-link" href="#results">검색 결과로 바로가기</a>
    <header className="header no-print"><div className="header-inner"><a className="brand" href="/" aria-label="면접 준비실 홈"><span className="brand-icon" aria-hidden="true">“</span><span>면접 준비실<small>대학 입학 면접 아카이브</small></span></a><nav aria-label="도움말"><button onClick={() => setHelp(true)}>이용 안내</button><a href="https://interview-cases-xi.vercel.app/" target="_blank" rel="noopener noreferrer">원본 자료실 ↗</a></nav></div></header>
    <main className="page-shell no-print">
      <section className="intro"><div><p className="eyebrow">충북교육청 면접후기 사례집</p><h1>먼저 만나는 질문,<br className="mobile-break" /> 더 단단해지는 답변.</h1><p className="intro-copy">지원하는 대학과 학과를 찾아, 실제 면접 질문으로 연습해 보세요.</p></div><div className="archive-stat"><strong>{loading ? "—" : format(cases.length)}</strong><span>선배들의 면접 후기</span></div></section>
      <section className="search-panel" aria-labelledby="search-title"><div className="section-top"><h2 id="search-title"><span className="step-number">01</span> 지원 대학 · 학과 찾기</h2><button className="text-button" onClick={() => { setFilters(initialFilters); setPage(1); }}>검색 초기화 ↺</button></div>
        <div className="search-fields"><div><label htmlFor="university">대학 이름</label><div className="input-wrap"><span aria-hidden="true">⌕</span><input id="university" list="university-options" autoComplete="off" placeholder="예: 가천대학교" value={filters.university} onChange={event => { setFilters(previous => ({ ...previous, university: event.target.value, department: "" })); setPage(1); }} /><datalist id="university-options">{universities.map(name => <option key={name} value={name} />)}</datalist></div></div>
        <div><label htmlFor="department">학과 이름</label><div className="input-wrap"><span aria-hidden="true">⌕</span><input id="department" list="department-options" autoComplete="off" placeholder="예: 컴퓨터공학전공" value={filters.department} onChange={event => change("department", event.target.value)} /><datalist id="department-options">{departments.map(name => <option key={name} value={name} />)}</datalist></div></div></div>
        <div className="year-filter"><span className="filter-label">학년도</span><button className={`chip ${!filters.years.length ? "active" : ""}`} aria-pressed={!filters.years.length} onClick={() => change("years", [])}>전체</button>{years.map(year => <button key={year} className={`chip ${filters.years.includes(year) ? "active" : ""}`} aria-pressed={filters.years.includes(year)} onClick={() => change("years", filters.years.includes(year) ? filters.years.filter(value => value !== year) : [...filters.years, year])}>{year}</button>)}</div>
        <div className="extra-filters"><label>권역<select value={filters.region} onChange={event => change("region", event.target.value)}><option value="">전체 권역</option>{unique(cases.map(record => record.region)).map(value => <option key={value}>{value}</option>)}</select></label><label>계열<select value={filters.field} onChange={event => change("field", event.target.value)}><option value="">전체 계열</option>{unique(cases.map(record => record.field)).map(value => <option key={value}>{value}</option>)}</select></label><label>자료의 면접유형<select value={filters.interview} onChange={event => change("interview", event.target.value)}><option value="">전체 유형</option>{unique(cases.map(record => record.interview)).map(value => <option key={value} value={value}>{interviewLabel(value)}</option>)}</select></label></div>
      </section>
      <div className="workspace"><section id="results" className="results" aria-labelledby="results-title" aria-busy={loading}><div className="results-heading"><h2 id="results-title"><span className="step-number">02</span> 면접 후기 <span className="result-number">{format(filtered.length)}</span></h2><span className="result-meta">{resultUniversities}개 대학 · {resultDepartments}개 학과</span></div>
        <div className="print-toolbar"><label className="select-all"><input type="checkbox" checked={filtered.length > 0 && filtered.every(record => selected.has(record.id))} disabled={!filtered.length} onChange={event => { const checked = event.target.checked; setSelected(previous => { const next = new Set(previous); filtered.forEach(record => { if (checked) next.add(record.id); else next.delete(record.id); }); return next; }); }} />검색 결과 전체 선택</label><div><button className="text-button" disabled={!selected.size} onClick={() => setSelected(new Set())}>선택 해제</button><button className="btn btn-small" disabled={!selected.size} onClick={() => window.print()}>선택 {selected.size}건 인쇄</button></div></div>
        {loading ? <div className="empty-state" role="status"><span className="loader" />면접 후기를 불러오고 있습니다.</div> : error ? <div className="empty-state" role="alert"><h3>{error}</h3><button className="btn" onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></div> : !filtered.length ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h3>조건에 맞는 후기가 없습니다.</h3><p>대학·학과 이름을 확인하거나 학년도를 ‘전체’로 바꿔 보세요.</p><button className="btn" onClick={() => { setFilters(initialFilters); setPage(1); }}>검색 초기화</button></div> : <div className="case-list">{visible.map(record => <article className={`case-card ${selected.has(record.id) ? "selected" : ""}`} key={record.id}><div className="case-select"><input type="checkbox" aria-label={`${record.uni} ${record.dept} ${record.id} 인쇄 선택`} checked={selected.has(record.id)} onChange={() => toggleRecord(record.id)} /></div><div className="case-main"><div className="case-tags"><span className="year-tag">{record.year}학년도</span><span>{record.region}</span><span>{record.field}</span></div><h3>{record.uni}</h3><p className="department-name">{record.dept}</p><p className="case-description">{record.name || record.type} · {interviewLabel(record.interview)}</p><div className="case-bottom"><span>참고 질문 <b>{questionCounts.get(record.id) ?? 0}개</b></span><button className="detail-button" onClick={() => setDetail(record)}>후기 자세히 보기 <span aria-hidden="true">↗</span></button></div></div></article>)}</div>}
        {!loading && filtered.length > 0 && <nav className="pagination" aria-label="면접 후기 페이지"><button className="btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>← 이전</button><span>{currentPage} <span className="muted">/ {pageCount}</span></span><button className="btn" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>다음 →</button></nav>}
      </section><MockInterview key={JSON.stringify(filters)} university={university} department={department} cases={references} /></div>
      <footer className="footer"><p>ⓒ 본 자료의 저작권은 <b>충북교육청 대입지원단</b>에 있습니다.<br />학교 교육 활동 목적 외 무단 복제·배포·게시를 금지합니다.</p><a href="https://interview-cases-xi.vercel.app/" target="_blank" rel="noopener noreferrer">원본 자료실 · 담당자 문의 ↗</a></footer>
    </main>
    <div className="print-area">{printCases.map(record => <article className="print-case" key={record.id}><p>충북교육청 면접후기 사례집 · {record.year}학년도</p><h1>{record.uni} · {record.dept}</h1><p>{record.type} · {record.name} · {interviewLabel(record.interview)}</p><CaseContent record={record} /><small>ⓒ 충북교육청 대입지원단 · 학교 교육 활동 목적 외 무단 복제·배포·게시 금지</small></article>)}</div>
    {detail && <Modal title={`${detail.uni} · ${detail.dept}`} onClose={() => setDetail(null)} wide><p className="modal-description">{detail.year}학년도 · {detail.name} · {interviewLabel(detail.interview)}</p><CaseContent record={detail} /><div className="modal-actions"><button className="btn btn-dark" onClick={() => toggleRecord(detail.id)}>{selected.has(detail.id) ? "인쇄 선택 해제" : "인쇄할 후기로 선택"}</button></div></Modal>}
    {help && <Modal title="면접 준비실 이용 안내" onClose={() => setHelp(false)}><ol className="help-steps"><li><b>대학과 학과를 찾아보세요.</b><p>일부 이름으로 후기를 검색할 수 있습니다. AI 모의면접은 목록에 있는 정확한 대학·학과 이름을 선택해 주세요.</p></li><li><b>연습할 면접 유형을 선택하세요.</b><p>기본·전공 심화·압박 면접 중 선택하면 면접관의 질문 깊이가 달라집니다.</p></li><li><b>복사한 프롬프트를 ChatGPT에 붙여넣으세요.</b><p>시작 버튼은 프롬프트를 복사하고 ChatGPT를 엽니다. 본인 계정으로 로그인하고 붙여넣어 전송하면 시작됩니다. 끝낼 때는 ‘면접 종료’라고 말하세요.</p></li><li><b>필요한 후기는 골라서 인쇄하세요.</b><p>후기 왼쪽의 선택 상자를 누르고 ‘선택 건 인쇄’를 사용하세요. AI 프롬프트에는 인쇄 선택과 관계없이 현재 조건에 맞는 모든 질문이 포함됩니다.</p></li></ol><p className="muted">과거 후기와 AI 피드백은 연습용 참고 자료입니다. 실제 입학 전형은 대학의 최신 모집요강을 확인해 주세요.</p></Modal>}
  </>;
}
