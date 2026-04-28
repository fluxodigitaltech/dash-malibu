-- ============================================================
-- GESTÃO DE USUÁRIOS E CONVITES — Malibu BI
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar coluna 'role' na tabela profiles (se não existir)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';

-- Garantir que role só aceita valores válidos
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'viewer'));

-- 2. Tabela de convites
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT invites_role_check CHECK (role IN ('admin', 'manager', 'viewer')),
  CONSTRAINT invites_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- Índices
CREATE INDEX IF NOT EXISTS invites_email_idx ON public.invites (email);
CREATE INDEX IF NOT EXISTS invites_token_idx ON public.invites (token);
CREATE INDEX IF NOT EXISTS invites_status_idx ON public.invites (status);

-- 3. RLS para invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todos os convites
CREATE POLICY "Admins can view all invites"
  ON public.invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins podem criar convites
CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins podem atualizar convites (revogar, etc.)
CREATE POLICY "Admins can update invites"
  ON public.invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins podem deletar convites
CREATE POLICY "Admins can delete invites"
  ON public.invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 4. RLS para profiles — permitir que admins vejam todos os perfis
-- Primeiro dropar policies antigas se existirem
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Usuários podem atualizar seu próprio perfil (exceto role)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins podem atualizar qualquer perfil (incluindo role)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Permitir insert de perfil próprio (signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Definir o primeiro usuário como admin (ajuste o email conforme necessário)
-- UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@malibuacademia.com.br' LIMIT 1);

-- 6. Função para aceitar convite (associa role ao perfil quando o usuário se cadastra)
CREATE OR REPLACE FUNCTION public.accept_invite_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Verificar se existe convite pendente para este email
  SELECT * INTO invite_record
  FROM public.invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Criar perfil com a role do convite
    INSERT INTO public.profiles (id, first_name, last_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      '',
      invite_record.role
    )
    ON CONFLICT (id) DO UPDATE SET role = invite_record.role;

    -- Marcar convite como aceito
    UPDATE public.invites
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = invite_record.id;
  ELSE
    -- Criar perfil padrão (viewer)
    INSERT INTO public.profiles (id, first_name, last_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      '',
      'viewer'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: executar quando novo usuário é criado no auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_invite_on_signup();
