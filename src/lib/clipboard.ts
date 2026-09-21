// Browser-only. No prompt is sent over the network or placed in a URL.
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the legacy path below. */ }
  }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("aria-label", "복사할 모의면접 프롬프트");
  field.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
  // A textarea outside a modal dialog is inert, so append inside the active dialog.
  (document.querySelector("dialog[open]") ?? document.body).appendChild(field);
  try {
    field.focus(); field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
  } finally { field.remove(); active?.focus(); }
}
