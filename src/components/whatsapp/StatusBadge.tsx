import { Badge } from '@/components/ui/badge';
import { Loader2, Wifi, WifiOff, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error' | string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const statusConfig = {
    connected: { label: 'Conectado', variant: 'default', icon: <Wifi className="h-3 w-3 mr-1" /> },
    connecting: { label: 'Conectando', variant: 'secondary', icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> },
    disconnected: { label: 'Desconectado', variant: 'outline', icon: <WifiOff className="h-3 w-3 mr-1" /> },
    error: { label: 'Erro', variant: 'destructive', icon: <Settings className="h-3 w-3 mr-1" /> }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;

  return (
    <Badge variant={config.variant as any} className={cn("flex items-center gap-1", className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
};