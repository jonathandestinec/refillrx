// Server-side Resend sending helper. Used by the reminder cron; falls back to
// no-op so the app keeps working when email delivery is not configured.
type SendEmailInput = {
  toEmail: string;
  title: string;
  body: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmail({ toEmail, title, body }: SendEmailInput): Promise<{ sent: boolean; id: string | null; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { sent: false, id: null, error: "Email is not configured." };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: title,
        text: body,
      }),
    });
    const result = (await response.json().catch(() => null)) as ResendResponse | null;
    if (!response.ok) {
      return { sent: false, id: null, error: result?.message ?? `Resend returned ${response.status}.` };
    }
    return { sent: true, id: result?.id ?? null, error: null };
  } catch (error) {
    return { sent: false, id: null, error: error instanceof Error ? error.message : "Unknown email failure." };
  }
}
