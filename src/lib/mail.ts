import "server-only";

// Email through Resend (https://resend.com), for messages the app sends itself,
// such as the welcome to a new reader. Sign-in codes are sent by Supabase Auth;
// see "Email" in README.md for pointing Supabase at the same Resend account.
//
// RESEND_API_KEY and MAIL_FROM are server secrets (never NEXT_PUBLIC_). Without
// them nothing is sent and callers get "skipped", so the app works without email.

export type MailResult = "sent" | "skipped" | "failed";

export type Mail = { to: string; subject: string; text: string; html: string };

const RESEND_URL = "https://api.resend.com/emails";

export async function sendMail(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return "skipped";
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type WelcomeText = {
  subject: string;
  greeting: string;
  greetingNoName: string;
  body: string;
  button: string;
  footer: string;
};

/** The welcome to a reader the owner added: the app's name, the sign-in link, and how signing in works. */
export function welcomeMail({
  to,
  name,
  loginUrl,
  appName,
  dir,
  text,
}: {
  to: string;
  name: string | null;
  loginUrl: string;
  appName: string;
  dir: "rtl" | "ltr";
  text: WelcomeText;
}): Mail {
  const fill = (template: string) => template.replaceAll("{app}", appName).replaceAll("{name}", name ?? "");
  const greeting = name ? fill(text.greeting) : fill(text.greetingNoName);
  const subject = fill(text.subject);
  const body = fill(text.body);
  const footer = fill(text.footer);
  const button = fill(text.button);

  const plain = [greeting, "", body, "", `${button}: ${loginUrl}`, "", footer].join("\n");
  const html = `<!doctype html><html dir="${dir}"><body style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#1f1b16;background:#f7f4ee;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e0d5;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px;color:#0e5752">${escapeHtml(appName)}</h1>
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0e5752;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:999px">${escapeHtml(button)}</a></p>
<p style="color:#6b6258;font-size:13px">${escapeHtml(footer)}</p>
</div></body></html>`;
  return { to, subject, text: plain, html };
}
