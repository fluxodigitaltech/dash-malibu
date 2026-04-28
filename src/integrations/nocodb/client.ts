// src/integrations/nocodb/client.ts
// NocoDB REST API client — replaces Supabase for all data (profiles, invites, dashboard_sync, agents)
// Authentication (login/signup/session) remains in Supabase.

const NOCODB_BASE_URL = 'https://app.nocodb.com/api/v1';
const NOCODB_TOKEN = import.meta.env.VITE_NOCODB_TOKEN || 'vgfnX7Pkz4Nm_ha8RhRr-rHWR6H3SxnPuBCNnKpM';
const PROJECT_ID = 'pbeaqdmhiy69ylu';

// Table IDs
export const TABLES = {
  profiles:            'max1uldawjxho0b',
  invites:             'm1ufb2xzitmifa5',
  dashboard_sync:      'mqbz9gf5j9nzw1v',
  agents:              'mkshc3p7zwgzgbx',
  whatsapp_instances:  'mg1dr5qxuhvvm9u',
  sent_messages:       'm8m6qw62z8xtvbb',
} as const;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const headers = () => ({
  'xc-token': NOCODB_TOKEN,
  'Content-Type': 'application/json',
});

const dataUrl = (tableId: string) =>
  `${NOCODB_BASE_URL}/db/data/noco/${PROJECT_ID}/${tableId}`;

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`NocoDB ${options.method || 'GET'} ${url} → HTTP ${res.status}: ${errText}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Generic table CRUD ────────────────────────────────────────────────────────

export interface ListResult<T> {
  list: T[];
  pageInfo: { totalRows: number; page: number; pageSize: number; isFirstPage: boolean; isLastPage: boolean };
}

/** List rows with optional where clause (NocoDB format: (field,eq,value)) */
export async function listRows<T>(
  tableId: string,
  params: { where?: string; sort?: string; limit?: number; offset?: number } = {}
): Promise<ListResult<T>> {
  const qs = new URLSearchParams();
  if (params.where)  qs.set('where', params.where);
  if (params.sort)   qs.set('sort', params.sort);
  if (params.limit)  qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  qs.set('limit', String(params.limit ?? 200));
  return apiFetch(`${dataUrl(tableId)}?${qs}`);
}

/** Insert a row */
export async function insertRow<T>(tableId: string, data: Partial<T>): Promise<T> {
  return apiFetch(`${dataUrl(tableId)}`, { method: 'POST', body: JSON.stringify(data) });
}

/** Update a row by NocoDB row Id */
export async function updateRow<T>(tableId: string, rowId: number, data: Partial<T>): Promise<T> {
  return apiFetch(`${dataUrl(tableId)}/${rowId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/** Delete a row by NocoDB row Id */
export async function deleteRow(tableId: string, rowId: number): Promise<void> {
  return apiFetch(`${dataUrl(tableId)}/${rowId}`, { method: 'DELETE' });
}

/** Find a single row matching a where clause — returns null if not found */
export async function findOne<T extends { Id?: number }>(
  tableId: string,
  where: string
): Promise<T | null> {
  const result = await listRows<T>(tableId, { where, limit: 1 });
  return result.list[0] ?? null;
}

// ── Typed helpers for each table ─────────────────────────────────────────────

export interface NcProfile {
  Id?: number;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  email: string | null;
  units?: string | null; // JSON: 'all' ou '["Paulínia","Araras"]'
  session_token?: string | null;
  created_at?: string;
}

export interface NcInvite {
  Id?: number;
  invite_id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  units?: string | null; // JSON: 'all' ou '["Paulínia","Araras"]'
}

export interface NcDashboardSync {
  Id?: number;
  data: string; // JSON string
  last_updated: string;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export const profiles = {
  async getByUserId(userId: string): Promise<NcProfile | null> {
    return findOne<NcProfile>(TABLES.profiles, `(user_id,eq,${userId})`);
  },

  async getByEmail(email: string): Promise<NcProfile | null> {
    return findOne<NcProfile>(TABLES.profiles, `(email,eq,${email.toLowerCase()})`);
  },

  async getBySessionToken(token: string): Promise<NcProfile | null> {
    return findOne<NcProfile>(TABLES.profiles, `(session_token,eq,${token})`);
  },

  async upsert(profile: Omit<NcProfile, 'Id'>): Promise<NcProfile> {
    const existing = await profiles.getByUserId(profile.user_id);
    if (existing?.Id) {
      return updateRow<NcProfile>(TABLES.profiles, existing.Id, profile);
    }
    return insertRow<NcProfile>(TABLES.profiles, profile);
  },

  async list(): Promise<NcProfile[]> {
    const result = await listRows<NcProfile>(TABLES.profiles, { sort: 'role', limit: 500 });
    return result.list;
  },

  async updateRole(userId: string, role: string): Promise<void> {
    const existing = await profiles.getByUserId(userId);
    if (!existing?.Id) throw new Error(`Perfil não encontrado: ${userId}`);
    await updateRow<NcProfile>(TABLES.profiles, existing.Id, { role });
  },

  async linkUserId(profileId: number, userId: string): Promise<void> {
    await updateRow<NcProfile>(TABLES.profiles, profileId, { user_id: userId });
  },
};

// ── Invites ───────────────────────────────────────────────────────────────────

/** Generate a random hex token (32 bytes) — browser-safe */
function randomToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a UUID v4 — browser-safe */
function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : randomToken().slice(0, 32)
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

export const invites = {
  async list(): Promise<NcInvite[]> {
    const result = await listRows<NcInvite>(TABLES.invites, { sort: '-created_at', limit: 500 });
    return result.list;
  },

  async getPendingByEmail(email: string): Promise<NcInvite | null> {
    return findOne<NcInvite>(
      TABLES.invites,
      `(email,eq,${email.toLowerCase()})~and(status,eq,pending)`
    );
  },

  async getByToken(token: string): Promise<NcInvite | null> {
    return findOne<NcInvite>(TABLES.invites, `(token,eq,${token})`);
  },

  async create(email: string, role: string, invitedBy: string | null, units: string = 'all'): Promise<NcInvite> {
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return insertRow<NcInvite>(TABLES.invites, {
      invite_id: uuid(),
      email: email.toLowerCase(),
      role,
      token: randomToken(),
      invited_by: invitedBy,
      status: 'pending',
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      accepted_at: null,
      units,
    });
  },

  async revoke(inviteId: number): Promise<void> {
    await updateRow(TABLES.invites, inviteId, { status: 'revoked' });
  },

  async accept(inviteId: number): Promise<void> {
    await updateRow(TABLES.invites, inviteId, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
  },
};

// ── Dashboard Sync ────────────────────────────────────────────────────────────

export const dashboardSync = {
  async getLatest(): Promise<NcDashboardSync | null> {
    const result = await listRows<NcDashboardSync>(TABLES.dashboard_sync, {
      sort: '-last_updated',
      limit: 1,
    });
    return result.list[0] ?? null;
  },

  async upsert(data: object): Promise<void> {
    const existing = await dashboardSync.getLatest();
    const payload = {
      data: JSON.stringify(data),
      last_updated: new Date().toISOString(),
    };
    if (existing?.Id) {
      await updateRow(TABLES.dashboard_sync, existing.Id, payload);
    } else {
      await insertRow(TABLES.dashboard_sync, payload);
    }
  },
};

// ── WhatsApp Instances ────────────────────────────────────────────────────────

export interface NcWhatsAppInstance {
  Id?: number;
  instance_id: string;
  user_id: string;
  instance_name: string;
  instance_url: string;
  api_key: string;
  status: string;
  created_at: string;
}

export const whatsappInstances = {
  async listByUser(userId: string): Promise<NcWhatsAppInstance[]> {
    const result = await listRows<NcWhatsAppInstance>(TABLES.whatsapp_instances, {
      where: `(user_id,eq,${userId})`,
      sort: '-created_at',
      limit: 100,
    });
    return result.list;
  },

  async create(data: Omit<NcWhatsAppInstance, 'Id' | 'instance_id' | 'created_at'>): Promise<NcWhatsAppInstance> {
    return insertRow<NcWhatsAppInstance>(TABLES.whatsapp_instances, {
      ...data,
      instance_id: uuid(),
      created_at: new Date().toISOString(),
    });
  },

  async updateStatus(instanceId: string, status: string): Promise<void> {
    const existing = await findOne<NcWhatsAppInstance>(
      TABLES.whatsapp_instances,
      `(instance_id,eq,${instanceId})`
    );
    if (existing?.Id) await updateRow(TABLES.whatsapp_instances, existing.Id, { status });
  },

  async delete(instanceId: string): Promise<void> {
    const existing = await findOne<NcWhatsAppInstance>(
      TABLES.whatsapp_instances,
      `(instance_id,eq,${instanceId})`
    );
    if (existing?.Id) await deleteRow(TABLES.whatsapp_instances, existing.Id);
  },
};

// ── Sent Messages ─────────────────────────────────────────────────────────────

export interface NcSentMessage {
  Id?: number;
  message_id: string;
  user_id: string;
  instance_name: string;
  recipient_phone: string;
  message_text: string;
  status: string;
  sent_at: string;
}

export const sentMessages = {
  async insert(data: Omit<NcSentMessage, 'Id' | 'message_id' | 'sent_at'>): Promise<NcSentMessage> {
    return insertRow<NcSentMessage>(TABLES.sent_messages, {
      ...data,
      message_id: uuid(),
      sent_at: new Date().toISOString(),
    });
  },
};
