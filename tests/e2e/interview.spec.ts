import { test, expect, type Page } from "@playwright/test";

async function selectGachon(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /면접 후기 1,878/ })).toBeVisible();
  await page.getByLabel("대학 이름", { exact: true }).fill("가천대학교");
  await page.getByLabel("학과 이름", { exact: true }).fill("컴퓨터공학전공");
  await expect(page.getByTestId("question-count")).toHaveText("7");
}

test("filter → preview → real clipboard → ChatGPT tab; no AI API request", async ({ page, context }) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  context.on("request", request => { if (request.url().includes("api.openai.com")) apiCalls.push(request.url()); });
  // Verify the destination without depending on ChatGPT authentication or bot checks.
  await context.route("https://chatgpt.com/**", route => route.fulfill({ contentType: "text/html", body: "<title>ChatGPT test destination</title>" }));
  await selectGachon(page);
  await expect(page.getByRole("radio", { name: /학생부 면접/ })).toBeChecked();
  await page.getByRole("radio", { name: /제시문 면접/ }).check();
  await page.getByRole("button", { name: "프롬프트 미리보기" }).click();
  const preview = page.getByLabel("생성된 모의면접 프롬프트");
  await expect(preview).toHaveValue(/면접 유형: 제시문 면접/);
  await expect(preview).toHaveValue(/창작 연습용 제시문/);
  await expect(preview).toHaveValue(/참고할 학교생활기록부\(생기부\)가 있나요\?/);
  const expected = await preview.inputValue();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "ChatGPT로 모의면접 시작" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://chatgpt.com/");
  await expect(page.getByRole("status")).toContainText("프롬프트가 복사되었습니다.");
  await page.bringToFront();
  // Copy must succeed without a pre-granted permission; only grant the read used to verify it.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Windows clipboard normalizes line endings to CRLF.
  expect(copied.replace(/\r\n/g, "\n")).toBe(expected);
  expect(copied).not.toContain("야망이 넘치는 지원자");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("clipboard denial opens manual preview and closes the reserved tab", async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } });
    document.execCommand = () => false;
  });
  await selectGachon(page);
  await page.getByRole("button", { name: "ChatGPT로 모의면접 시작" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("자동 복사를 사용할 수 없습니다");
  await page.getByRole("button", { name: "전체 선택", exact: true }).click();
  expect(await page.getByLabel("생성된 모의면접 프롬프트").evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBeGreaterThan(500);
  await expect.poll(() => context.pages().length).toBe(1);
});

test("blocked popup still copies and offers a direct link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => { window.open = () => null; });
  await selectGachon(page);
  await page.getByRole("button", { name: "ChatGPT로 모의면접 시작" }).click();
  await expect(page.getByRole("status")).toContainText("프롬프트가 복사되었습니다");
  await expect(page.getByRole("link", { name: "ChatGPT에서 시작 ↗" })).toHaveAttribute("href", "https://chatgpt.com/");
});

test("filter changes invalidate stale selections; modes, details and printing work", async ({ page }) => {
  await selectGachon(page);
  await page.getByRole("radio", { name: /기본인성 면접/ }).check();
  await page.getByRole("button", { name: "프롬프트 미리보기" }).click();
  await expect(page.getByLabel("생성된 모의면접 프롬프트")).toHaveValue(/태도와 성찰, 의사소통을 중심으로 평가/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "후기 자세히 보기" }).click();
  await expect(page.getByRole("dialog")).toContainText("다익스트라");
  await page.getByRole("button", { name: "인쇄할 후기로 선택" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "선택 1건 인쇄" })).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-area")).toBeVisible();
  await expect(page.locator(".print-case")).toHaveCount(1);
  await expect(page.locator(".ai-card")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "2026", exact: true }).click();
  await expect(page.getByTestId("question-count")).toHaveText("0");
  await expect(page.getByRole("button", { name: "ChatGPT로 모의면접 시작" })).toBeDisabled();
  await expect(page.getByText("조건에 맞는 후기가 없습니다.", { exact: true })).toBeVisible();
  await page.getByLabel("대학 이름", { exact: true }).fill("존재하지 않는 대학");
  await expect(page.getByLabel("학과 이름", { exact: true })).toHaveValue("");
});

test("pagination and select-all include the entire filtered result", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /면접 후기 1,878/ })).toBeVisible();
  await expect(page.locator(".case-card")).toHaveCount(12);
  await page.getByRole("button", { name: "다음 →" }).click();
  await expect(page.getByRole("navigation", { name: "면접 후기 페이지" })).toContainText("2");
  await page.getByLabel("대학 이름", { exact: true }).fill("가천대학교");
  await expect(page.getByRole("navigation", { name: "면접 후기 페이지" })).toContainText("1");
  await page.getByLabel("검색 결과 전체 선택").check();
  const countText = await page.locator(".result-number").innerText();
  await expect(page.getByRole("button", { name: `선택 ${countText.replaceAll(",", "")}건 인쇄` })).toBeEnabled();
});

test("mobile controls and preview fit without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await selectGachon(page);
  await expect(page.getByRole("radio")).toHaveCount(3);
  for (const name of [/학생부 면접/, /제시문 면접/, /기본인성 면접/]) {
    await expect(page.getByRole("radio", { name })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "프롬프트 미리보기" }).click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  await expect(page.getByLabel("생성된 모의면접 프롬프트")).toBeVisible();
  await expect(page.getByLabel("생성된 모의면접 프롬프트")).toHaveValue(/면접 유형: 학생부 면접/);
  await expect(page.getByLabel("생성된 모의면접 프롬프트")).toHaveValue(/생기부가 없거나 제공하지 않겠다고 하면/);
});

test("data load failure supports retry", async ({ page }) => {
  let fail = true;
  await page.route("**/data/index.json", route => fail ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  await page.goto("/");
  await expect(page.locator("#results").getByRole("alert")).toContainText("질문 자료를 불러오지 못했습니다");
  fail = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.getByRole("heading", { name: /면접 후기 1,878/ })).toBeVisible();
});

test("initial load and pagination use only the compact index", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/data/")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.locator(".case-card")).toHaveCount(12);
  await page.getByRole("button", { name: "다음 →" }).click();
  await expect(page.getByRole("navigation", { name: "면접 후기 페이지" })).toContainText("2");
  expect(requests.every(url => url.endsWith("/data/index.json"))).toBe(true);
  const index = await page.request.get("/data/index.json");
  expect((await index.body()).byteLength).toBeLessThan(600_000);
});

test("detail request failure can be retried without reloading the list", async ({ page }) => {
  let fail = true;
  await page.route("**/data/details/**", route => fail ? route.fulfill({ status: 503 }) : route.continue());
  await page.goto("/");
  await page.getByRole("button", { name: "후기 자세히 보기" }).first().click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("후기 본문을 불러오지 못했습니다");
  fail = false;
  await page.getByRole("button", { name: "본문 다시 불러오기" }).click();
  await expect(page.getByRole("dialog").locator(".case-content")).toBeVisible();
  await expect(page.locator(".case-card")).toHaveCount(12);
});

test("changing filters during loading discards stale interview questions", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/data/details/**", async route => { await gate; await route.continue(); });
  await page.goto("/");
  await expect(page.locator(".case-card")).toHaveCount(12);
  await page.getByLabel("대학 이름", { exact: true }).fill("가천대학교");
  await page.getByLabel("학과 이름", { exact: true }).fill("컴퓨터공학전공");
  await expect(page.getByRole("status")).toContainText("모의면접 질문을 불러오고 있습니다");
  await page.getByLabel("대학 이름", { exact: true }).fill("존재하지 않는 대학");
  release();
  await expect(page.getByTestId("question-count")).toHaveText("0");
  await expect(page.getByRole("button", { name: "ChatGPT로 모의면접 시작" })).toBeDisabled();
});
