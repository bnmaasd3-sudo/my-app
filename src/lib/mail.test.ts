import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sendMail, welcomeMail } = await import("./mail");

const TEXT = {
  subject: "مرحبًا بك في {app}",
  greeting: "مرحبًا {name}،",
  greetingNoName: "مرحبًا،",
  body: "ادخل ببريدك هذا ويصلك رمز.",
  button: "ادخل إلى {app}",
  footer: "إن لم تتوقع هذه الرسالة فتجاهلها.",
};

describe("welcomeMail", () => {
  it("carries the app name, the sign-in link and the reader's name, escaped", () => {
    const mail = welcomeMail({
      to: "noura@example.com",
      name: "<b>نورة</b>",
      loginUrl: "https://example.com/ar/login",
      appName: "سَجيّة",
      dir: "rtl",
      text: TEXT,
    });
    expect(mail.subject).toBe("مرحبًا بك في سَجيّة");
    expect(mail.text).toContain("https://example.com/ar/login");
    expect(mail.html).toContain("&lt;b&gt;نورة&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>نورة");
    expect(mail.html).toContain('dir="rtl"');
  });

  it("greets without a name when there is none", () => {
    const mail = welcomeMail({ to: "a@b.c", name: null, loginUrl: "u", appName: "x", dir: "ltr", text: TEXT });
    expect(mail.text.startsWith("مرحبًا،")).toBe(true);
  });
});

describe("sendMail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const mail = { to: "a@b.c", subject: "s", text: "t", html: "<p>t</p>" };

  it("sends nothing and says so without the two settings", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");
    expect(await sendMail(mail)).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Resend with the key and the sender", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Sajiyya <hello@example.com>");
    expect(await sendMail(mail)).toBe("sent");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toMatchObject({ from: "Sajiyya <hello@example.com>", to: ["a@b.c"], subject: "s" });
  });

  it("reports a refusal or a network error as failed", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "x@example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 422 })));
    expect(await sendMail(mail)).toBe("failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await sendMail(mail)).toBe("failed");
  });
});
