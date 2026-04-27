/**
 * POST /api/contact
 * Resend API 経由でメール送信（Astro Actions の代替）
 */
export async function onRequestPost({ request, env }) {
  const cors = { "Content-Type": "application/json" };

  try {
    const data = await request.json();
    const { name, email, message, company } = data;

    // ハニーポット（スパム対策）
    if (company) {
      return Response.json({ success: true }, { headers: cors });
    }

    // バリデーション
    if (!name || name.length < 3) return Response.json({ success: false, error: { name: "Name must be at least 3 characters" } }, { status: 400, headers: cors });
    if (!email || !email.includes('@')) return Response.json({ success: false, error: { email: "Invalid email address" } }, { status: 400, headers: cors });
    if (!message || message.length < 10) return Response.json({ success: false, error: { message: "Message must be at least 10 characters" } }, { status: 400, headers: cors });

    const RESEND_API_KEY = env.RESEND_API_KEY;
    const TO_EMAIL = env.RESEND_EMAIL || "info@effect.moe";
    const FROM_EMAIL = env.FROM_EMAIL || "noreply@effect.moe";

    if (!RESEND_API_KEY) {
      return Response.json({ success: false, error: { general: "Email service not configured" } }, { status: 500, headers: cors });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: `[effect.moe] New message from ${name}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
      }),
    });

    if (!res.ok) throw new Error(`Resend error: ${res.status}`);

    return Response.json({ success: true }, { headers: cors });

  } catch (e) {
    return Response.json({ success: false, error: { general: e.message } }, { status: 500, headers: cors });
  }
}
