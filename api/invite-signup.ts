// api/invite-signup.ts
// Cadastro via convite 100% NocoDB — sem Supabase, sem verificação de email.
// Usa crypto nativo do Node.js (scrypt) para hash de senha.

import crypto from 'crypto';

const NC_TOKEN   = process.env.NOCODB_TOKEN || 'vgfnX7Pkz4Nm_ha8RhRr-rHWR6H3SxnPuBCNnKpM';
const NC_BASE    = 'https://app.nocodb.com/api/v1';
const PROJECT    = 'pbeaqdmhiy69ylu';
const PROFILES   = 'max1uldawjxho0b';
const INVITES    = 'm1ufb2xzitmifa5';

const ncHeaders  = { 'xc-token': NC_TOKEN, 'Content-Type': 'application/json' };

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

async function ncGet(table: string, where: string) {
  const url = `${NC_BASE}/db/data/noco/${PROJECT}/${table}?where=${encodeURIComponent(where)}&limit=1`;
  const r = await fetch(url, { headers: ncHeaders });
  const d = await r.json();
  return d?.list?.[0] ?? null;
}

async function ncPost(table: string, body: object) {
  const r = await fetch(`${NC_BASE}/db/data/noco/${PROJECT}/${table}`, {
    method: 'POST', headers: ncHeaders, body: JSON.stringify(body),
  });
  return r.json();
}

async function ncPatch(table: string, id: number, body: object) {
  const r = await fetch(`${NC_BASE}/db/data/noco/${PROJECT}/${table}/${id}`, {
    method: 'PATCH', headers: ncHeaders, body: JSON.stringify(body),
  });
  return r.json();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, name, invite_token } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });

  // 1. Valida convite
  const invite = await ncGet(INVITES, `(token,eq,${invite_token})`);
  if (!invite || invite.status !== 'pending') {
    return res.status(400).json({ error: 'Convite inválido ou já utilizado' });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Convite expirado' });
  }

  // 2. Verifica se já existe perfil com esse email
  const existing = await ncGet(PROFILES, `(email,eq,${email.toLowerCase()})`);

  // 3. Hash da senha e session token
  const passwordHash  = await hashPassword(password);
  const sessionToken  = crypto.randomBytes(32).toString('hex');
  const userId        = existing?.user_id || crypto.randomUUID();
  const nameParts     = (name || '').trim().split(' ');

  const profileData = {
    user_id:       userId,
    email:         email.toLowerCase(),
    first_name:    nameParts[0] || null,
    last_name:     nameParts.slice(1).join(' ') || null,
    role:          invite.role   || 'viewer',
    units:         invite.units  || 'all',
    password_hash: passwordHash,
    session_token: sessionToken,
    avatar_url:    null,
  };

  // 4. Cria ou atualiza perfil
  if (existing?.Id) {
    await ncPatch(PROFILES, existing.Id, profileData);
  } else {
    await ncPost(PROFILES, profileData);
  }

  // 5. Aceita convite
  await ncPatch(INVITES, invite.Id, {
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  });

  return res.status(200).json({
    ok: true,
    sessionToken,
    user: {
      id:    userId,
      email: email.toLowerCase(),
      name,
      role:  invite.role  || 'viewer',
      units: invite.units || 'all',
    },
  });
}
