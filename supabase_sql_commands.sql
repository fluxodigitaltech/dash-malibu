CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL,
  persona_presentation TEXT,
  persona_timezone TEXT DEFAULT 'America/Sao_Paulo',
  persona_tone TEXT DEFAULT 'descontraido_curto',
  persona_forbidden TEXT[],
  templates_greeting_morning TEXT,
  templates_greeting_afternoon TEXT,
  templates_greeting_night TEXT,
  templates_ask_name_male TEXT,
  templates_ask_name_female TEXT,
  templates_ask_name_neutral TEXT,
  rule_require_name_before_continue BOOLEAN DEFAULT TRUE,
  rule_always_call_tool BOOLEAN DEFAULT TRUE,
  rule_always_call_memory BOOLEAN DEFAULT TRUE,
  rule_never_use_quotes BOOLEAN DEFAULT TRUE,
  endpoint_crm TEXT,
  endpoint_wa_franquia TEXT,
  meta_rules TEXT[],
  content_blocks JSONB,
  bordao_male TEXT[],
  bordao_female TEXT[],
  bordao_regional_south TEXT[],
  bordao_interior TEXT[],
  bordao_central_neutral TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar um índice para user_id para buscas mais rápidas
CREATE INDEX agents_user_id_idx ON agents (user_id);

-- Habilitar RLS (Row Level Security) para que cada usuário só possa ver/editar seu próprio agente
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent config."
  ON agents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agent config."
  ON agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent config."
  ON agents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agent config."
  ON agents FOR DELETE
  USING (auth.uid() = user_id);