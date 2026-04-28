import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client'; // avatar Storage only
import { profiles } from '@/integrations/nocodb/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Camera, Save } from 'lucide-react';

interface ProfileData {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

const Settings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    avatar_url: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await profiles.getByUserId(user.id);
      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          avatar_url: data.avatar_url,
        });
      } else {
        setProfile({
          first_name: user.user_metadata?.name || '',
          last_name: '',
          avatar_url: null,
        });
      }
    } catch (err) {
      console.warn('[Settings] Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      showError('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    const toastId = showLoading('Fazendo upload da imagem...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Fazer upload do arquivo
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública da imagem
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Atualizar avatar_url no NocoDB — preservar role atual
      const existing = await profiles.getByUserId(user.id);
      await profiles.upsert({
        user_id: user.id,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        avatar_url: publicUrl,
        role: existing?.role || 'viewer',
        email: user.email || null,
      });

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      showSuccess('Avatar atualizado com sucesso!');

    } catch (error) {
      // console.error('Erro ao fazer upload:', error); // Removed console.error
      showError('Erro ao fazer upload da imagem');
    } finally {
      dismissToast(toastId.toString());
      setUploading(false);
      event.target.value = ''; // Reset input
    }
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    const toastId = showLoading('Salvando perfil...');

    try {
      // Preservar role ao salvar perfil
      const existing = await profiles.getByUserId(user.id);
      await profiles.upsert({
        user_id: user.id,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        avatar_url: profile.avatar_url,
        role: existing?.role || 'viewer',
        email: user.email || null,
      });

      showSuccess('Perfil atualizado com sucesso!');
    } catch (error) {
      // console.error('Erro ao salvar perfil:', error); // Removed console.error
      showError('Erro ao salvar perfil');
    } finally {
      dismissToast(toastId.toString());
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const getInitials = () => {
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl bg-malibu-white rounded-xl shadow-lg p-8 mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-malibu-light-gray rounded w-1/3 mb-6"></div>
          <div className="flex items-center space-x-4 mb-6">
            <div className="rounded-full bg-malibu-light-gray h-24 w-24"></div>
            <div className="space-y-2">
              <div className="h-4 bg-malibu-light-gray rounded w-32"></div>
              <div className="h-4 bg-malibu-light-gray rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-malibu-light-gray rounded w-full"></div>
            <div className="h-4 bg-malibu-light-gray rounded w-3/4"></div>
            <div className="h-10 bg-malibu-light-gray rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl glass-card glow-border rounded-[2.5rem] p-8 lg:p-12 mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="px-0 pt-0">
        <h2 className="text-3xl font-black text-white tracking-tighter mb-8 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20 text-primary">
             <Save className="h-5 w-5" />
          </div>
          Configurações do Perfil
        </h2>
      </div>

      <div className="px-0">
        <form onSubmit={handleSaveProfile} className="space-y-10">
          {/* Seção Avatar */}
          <div className="flex flex-col sm:flex-row items-center gap-8 p-6 rounded-3xl bg-white/5 border border-white/5">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Avatar className="h-32 w-32 border-4 border-[#0e0d15] premium-shadow relative z-10 transition-transform group-hover:scale-105 duration-500">
                <AvatarImage
                  src={profile.avatar_url || ''}
                  alt={profile.first_name || 'Usuário'}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary text-white text-3xl font-black">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 bg-primary text-white p-3 rounded-2xl cursor-pointer hover:bg-primary/90 transition-all z-20 shadow-xl border-4 border-[#0e0d15]">
                <Camera className="h-5 w-5" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-black text-white tracking-tight -mb-1">Foto do Perfil</h3>
              <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest mt-2">
                {uploading ? 'Processando Upload...' : 'Dimensões recomendadas: 400x400px'}
              </p>
            </div>
          </div>

          {/* Seção Informações Pessoais */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
               <div className="h-px flex-1 bg-white/5" />
               <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Identidade Neural</h3>
               <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Nome</Label>
                <Input
                  id="first_name"
                  value={profile.first_name || ''}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Seu nome"
                  className="h-14 rounded-2xl bg-white/[0.05] border-white/10 text-white placeholder:text-white/20 px-6 focus:border-primary/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Sobrenome</Label>
                <Input
                  id="last_name"
                  value={profile.last_name || ''}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Seu sobrenome"
                  className="h-14 rounded-2xl bg-white/[0.05] border-white/10 text-white placeholder:text-white/20 px-6 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">🔒 Email Corporativo</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="h-14 rounded-2xl bg-white/[0.02] border-white/5 text-muted-foreground/40 px-6 cursor-not-allowed"
              />
              <p className="text-[9px] text-muted-foreground/30 font-medium ml-1">Identificador exclusivo não mutável após ativação.</p>
            </div>
          </div>

          {/* Botão de Salvar */}
          <Button
            type="submit"
            disabled={saving}
            className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl text-sm tracking-wide shadow-[0_0_30px_rgba(242,140,29,0.2)] hover:shadow-[0_0_50px_rgba(242,140,29,0.4)] transition-all duration-500 active:scale-[0.98]"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-3" />
                Sincronizando Alterações...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-3" />
                Finalizar Configuração
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Settings;