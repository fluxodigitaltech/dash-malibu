// api/send-invite.ts — Envia email de convite via Resend
// Env vars necessárias no Vercel:
//   RESEND_API_KEY  — chave da API do Resend (resend.com)
//   INVITE_FROM_EMAIL — remetente verificado, ex: "Malibu BI <noreply@seudominio.com>"
//                       padrão: "Malibu BI <onboarding@resend.dev>" (funciona em dev/teste)
//   NEXT_PUBLIC_APP_URL (ou APP_URL) — URL base do app, ex: https://dash-malibu.vercel.app

const RESEND_API_KEY  = process.env.RESEND_API_KEY  || '';
const FROM_EMAIL      = process.env.INVITE_FROM_EMAIL || 'Malibu BI <onboarding@resend.dev>';
const APP_URL         = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://dash-malibu.vercel.app';

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrador',
  manager: 'Gerente',
  viewer:  'Visualizador',
};

function buildEmailHtml(email: string, role: string, signupUrl: string, inviterName: string): string {
  const roleLabel = ROLE_LABELS[role] || role;
  const roleColor = role === 'admin' ? '#f28c1d' : role === 'manager' ? '#60a5fa' : '#4ade80';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Convite — Malibu BI</title>
</head>
<body style="margin:0;padding:0;background:#0a0a10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a10;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;background:#13131f;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#f28c1d22,#f28c1d08);padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">MALIBU</span>
                  <span style="font-size:22px;font-weight:900;color:#f28c1d;letter-spacing:-0.5px;"> BI</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
              Você foi convidado!
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.6;">
              <strong style="color:rgba(255,255,255,0.8);">${inviterName}</strong> convidou você para acessar o
              painel de inteligência de dados da <strong style="color:#f28c1d;">Malibu Academias</strong>.
            </p>

            <!-- Role badge -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:${roleColor}18;border:1px solid ${roleColor}33;border-radius:10px;padding:8px 16px;">
                  <span style="font-size:11px;font-weight:800;color:${roleColor};text-transform:uppercase;letter-spacing:0.1em;">
                    Seu cargo: ${roleLabel}
                  </span>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.35);">
              Clique no botão abaixo para criar sua conta:
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f28c1d;border-radius:14px;">
                  <a href="${signupUrl}"
                     style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:900;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                    Aceitar Convite &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;">
              Ou copie e cole este link no navegador:<br/>
              <a href="${signupUrl}" style="color:#f28c1d;word-break:break-all;">${signupUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6;">
              Este convite foi enviado para <strong>${email}</strong> e expira em 7 dias.
              Se você não esperava este email, pode ignorá-lo com segurança.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) {
    // Sem chave configurada — apenas loga e retorna OK para não bloquear o fluxo
    console.warn('[send-invite] RESEND_API_KEY não configurada. Email não enviado.');
    return res.status(200).json({ ok: true, skipped: true, reason: 'RESEND_API_KEY not set' });
  }

  const { email, role, token, inviterName } = req.body ?? {};
  if (!email || !token) {
    return res.status(400).json({ error: 'email e token são obrigatórios' });
  }

  const signupUrl = `${APP_URL}/signup?invite=${token}&email=${encodeURIComponent(email)}`;
  const html = buildEmailHtml(email, role || 'viewer', signupUrl, inviterName || 'Um administrador');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Você foi convidado para o Malibu BI`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-invite] Resend error:', JSON.stringify(data));

      // Erro 422: domínio não verificado — modo teste só envia para o próprio email
      // Retorna 200 para não bloquear o fluxo de convite no frontend
      if (response.status === 422 || response.status === 403) {
        console.warn(`[send-invite] Resend domínio não verificado. Link do convite: ${signupUrl}`);
        return res.status(200).json({
          ok: false,
          skipped: true,
          reason: 'domain_not_verified',
          message: data?.message || 'Domínio não verificado no Resend',
          signupUrl,
        });
      }

      return res.status(502).json({ error: 'Falha ao enviar email', detail: data });
    }

    console.log(`[send-invite] Email enviado para ${email} (id: ${data.id})`);
    return res.status(200).json({ ok: true, id: data.id });

  } catch (err: any) {
    console.error('[send-invite] Erro:', err);
    // Não bloquear o fluxo de convite por falha de email
    return res.status(200).json({ ok: false, skipped: true, reason: err.message });
  }
}
