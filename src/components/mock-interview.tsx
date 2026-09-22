"use client";
import { useMemo, useState } from "react";
import { buildPrompt, extractQuestions, interviewModes, type InterviewMode } from "@/lib/interview";
import { useCaseDetails, type CaseSummary } from "@/lib/case-data";
import { copyText } from "@/lib/clipboard";
import { Modal } from "./modal";

export function MockInterview({ cases, mode, onModeChange }: { cases: CaseSummary[]; mode: InterviewMode; onModeChange: (mode: InterviewMode) => void }) {
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean; link?: boolean } | null>(null);
  const details = useCaseDetails(cases);
  const questions = useMemo(() => extractQuestions(details.data), [details.data]);
  const targets = useMemo(() => [...new Set(cases.map(record => `${record.uni} · ${record.dept}`))], [cases]);
  const prompt = useMemo(() => buildPrompt(cases, mode, questions), [cases, mode, questions]);
  const ready = Boolean(prompt);

  async function copy(launch: boolean) {
    if (!prompt || busy) return;
    setBusy(true); setNotice(null);
    // Start the clipboard request while this document still has focus.
    const pendingCopy = copyText(prompt);
    // Reserve the tab during the click gesture, before clipboard's async permission check.
    // The tab only navigates to ChatGPT after successful copy and closes on failure.
    let tab: Window | null = null;
    if (launch) {
      try { tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null; } catch { /* Show manual link after copy. */ }
    }
    try {
      await pendingCopy;
      setNotice({ text: "프롬프트가 복사되었습니다. ChatGPT에 붙여넣으면 면접을 시작할 수 있습니다.", error: false, link: launch });
      if (launch && tab && !tab.closed) {
        try { tab.location.replace("https://chatgpt.com/"); }
        catch { tab.close(); }
      }
    } catch {
      tab?.close();
      setPreview(true);
      setNotice({ text: "자동 복사를 사용할 수 없습니다. 미리보기의 ‘전체 선택’을 누르고 직접 복사한 뒤 ChatGPT에 붙여넣어 주세요.", error: true });
    } finally { setBusy(false); }
  }

  function noticeView() {
    return notice && <div className={`notice ${notice.error ? "notice-error" : ""}`} role={notice.error ? "alert" : "status"}>
      {notice.text}
      {notice.link && <span className="notice-link">새 탭이 열리지 않았다면 <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT에서 시작 ↗</a></span>}
    </div>;
  }

  return <aside className="ai-card" aria-labelledby="ai-title">
    <div className="ai-topline"><span className="eyebrow">나만의 면접 연습</span><span className="ai-symbol" aria-hidden="true">✦</span></div>
    <h2 id="ai-title">AI 모의면접</h2>
    <p className="ai-intro">선배들의 실제 질문으로,<br />나의 답변을 준비하세요.</p>
    <dl className="selection-summary">
      <div><dt>선택한 후기</dt><dd data-testid="selected-case-count">{cases.length}건</dd></div>
      <div><dt>선택한 대학 · 학과</dt><dd>{targets.length ? <details className="selected-targets" open={targets.length <= 2}><summary>{targets.length}개 대학·학과</summary><ul>{targets.map(target => <li key={target}>{target}</li>)}</ul></details> : "후기 왼쪽 체크박스로 선택해 주세요"}</dd></div>
      <div className="question-total"><dt>참고할 면접 질문</dt><dd><strong data-testid="question-count">{questions.length}</strong>개</dd></div>
    </dl>
    <p className="count-note">체크한 후기 기준 · 중복 질문 제외<br />검색 조건을 바꿔도 선택은 유지됩니다.</p>
    <fieldset className="mode-options" disabled={busy}><legend>어떤 면접을 연습할까요?</legend>
      {(Object.keys(interviewModes) as InterviewMode[]).map(key => <label className={`mode-option ${mode === key ? "active" : ""}`} key={key}>
        <input type="radio" name="interview-mode" value={key} checked={mode === key} onChange={() => { onModeChange(key); setNotice(null); }} />
        <span><b>{interviewModes[key].label}</b><small>{interviewModes[key].description}</small></span>
      </label>)}
    </fieldset>
    <p className="empty-hint">ChatGPT에서 먼저 생기부 유무를 확인해요. 있으면 생기부와 사례집을 함께, 없으면 사례집으로 면접을 진행합니다.</p>
    {details.loading && <p role="status">모의면접 질문을 불러오고 있습니다.</p>}
    {details.error && <p role="alert">{details.error} <button className="btn" onClick={details.retry}>질문 다시 불러오기</button></p>}
    {!ready && !details.loading && !details.error && <p className="empty-hint">{!cases.length ? "면접 후기에 체크하면 시작할 수 있어요. 여러 대학·학과의 후기를 함께 선택할 수 있습니다." : "선택한 후기에 참고할 질문이 없습니다. 다른 후기를 선택해 주세요."}</p>}
    <button className="start-button" onClick={() => void copy(true)} disabled={!ready || busy}>{busy ? "프롬프트 복사 중…" : "ChatGPT로 모의면접 시작"}<span aria-hidden="true">↗</span></button>
    <div className="secondary-actions"><button onClick={() => setPreview(true)} disabled={!ready || busy}>프롬프트 미리보기</button><button onClick={() => void copy(false)} disabled={!ready || busy}>프롬프트 복사</button></div>
    <p className="api-note">별도의 OpenAI API를 사용하지 않습니다. 본인의 ChatGPT 계정에서 모의면접이 진행됩니다.</p>
    {!preview && noticeView()}
    <div className="how-it-works"><span><b>1</b> 프롬프트 복사</span><i aria-hidden="true">→</i><span><b>2</b> ChatGPT에 붙여넣기</span></div>
    {preview && <Modal title="프롬프트 미리보기" onClose={() => setPreview(false)} wide>
      <p className="modal-description">선택 후기 {cases.length}건 · 대학·학과 {targets.length}개 · {interviewModes[mode].label} · 질문 {questions.length}개</p>
      <label className="sr-only" htmlFor="prompt-preview">생성된 모의면접 프롬프트</label>
      <textarea id="prompt-preview" className="prompt-preview" readOnly value={prompt} />
      <p className="muted">{prompt.length.toLocaleString()}자 · 답변 내용은 포함하지 않습니다. ChatGPT에서 길이 제한이 안내되면 선택한 후기 수를 줄여 주세요.</p>
      {noticeView()}
      <div className="modal-actions"><button className="btn" onClick={() => { const field = document.getElementById("prompt-preview") as HTMLTextAreaElement; field.focus(); field.select(); }}>전체 선택</button><button className="btn" disabled={busy} onClick={() => void copy(false)}>프롬프트 복사</button><a className="btn btn-dark" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT에서 시작 ↗</a></div>
    </Modal>}
  </aside>;
}
