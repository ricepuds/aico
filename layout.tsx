import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "면접 준비실 | 대학 면접 후기와 AI 모의면접",
  description: "충북교육청 면접 후기에서 대학·학과별 질문을 찾아보고, 나의 ChatGPT에서 모의면접을 연습하세요.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
