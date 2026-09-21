import { parseContent, type InterviewCase } from "@/lib/interview";
export function CaseContent({ record }: { record: InterviewCase }) {
  return <div className="case-content">{parseContent(record.content).map((section, index) => <section key={index}>
    <h3>{section.title}</h3>
    {section.blocks.map((block, i) => <p key={i} className={`dialogue dialogue-${block.type}`}>
      {block.type !== "p" && <span className="dialogue-label">{block.type === "q" ? "Q" : "A"}</span>}
      <span>{block.text}</span>
    </p>)}
  </section>)}</div>;
}
