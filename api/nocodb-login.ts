// api/nocodb-login.ts
// Login para usuários cadastrados via convite (NocoDB auth — sem Supabase).

import crypto from 'crypto';

const NC_TOKEN  = process.env.NOCODB_TOKEN || 'vgfnX7Pkz4Nm_ha8RhRr-rHWR6H3SxnPuBCNnKpM';
const NC_BASE   = 'https://app.nocodb.com/api/v1';
const PROJECT   = 'pbeaqdmhiy69ylu';
const PROFILES  = 'max1uldawjxho0b';
const ncHeaders = { 'xc-token': NC_TOKEN, 'Content-Type': 'application/json' };

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, stored] = hash.split(':');
  if (!salt || !stored) return false;
  return new Promise((resolve) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) resolve(false);
      else resolve(key.toString('hex') === stored);
    });
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });

  // Busca perfil pelo email
  const url = `${NC_BASE}/db/data/noco/${PROJECT}/${PROFILES}?where=${encodeURIComponent(`(email,eq,${email.toLowerCase()})`)}&limit=1`;
  const r   = await fetch(url, { headers: ncHeaders });
  const d   = await r.json();
  const profile = d?.list?.[0];

  if (!profile?.password_hash) {
    return res.status(401).json({ error: 'Usuário não encontrado ou sem senha cadastrada' });
  }

  const valid = await verifyPassword(password, profile.password_hash);
  if (!valid) return res.status(401).json({ error: 'Senha incorreta' });

  // Gera novo session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  await fetch(`${NC_BASE}/db/data/noco/${PROJECT}/${PROFILES}/${profile.Id}`, {
    method: 'PATCH',
    headers: ncHeaders,
    body: JSON.stringify({ session_token: sessionToken }),
  });

  return res.status(200).json({
    ok: true,
    sessionToken,
    user: {
      id:    profile.user_id,
      email: profile.email,
      name:  `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      role:  profile.role  || 'viewer',
      units: profile.units || 'all',
    },
  });
}
