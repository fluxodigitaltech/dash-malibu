import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  valueColor?: string;
  onClick?: () => void;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  iconColor = 'text-primary', 
  valueColor,
  onClick,
  trend
}) => {
  const isClickable = !!onClick;

  return (
    <div 
      onClick={onClick} 
      className={cn(
        "group relative overflow-hidden transition-all duration-500 rounded-2xl",
        isClickable && "cursor-pointer hover:-translate-y-1 premium-shadow"
      )}
    >
      <Card className="glass-card glow-border h-full transition-all duration-500 group-hover:bg-[#1c1c27]/80 group-hover:border-white/10">
        {/* Animated highlight */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {trend && (
              <div className={cn(
                "flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border",
                trend.isPositive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}%
              </div>
            )}
            <div className={cn(
              "p-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all duration-500",
              "group-hover:bg-white/10 group-hover:border-white/10",
              iconColor
            )}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pt-2">
          <div className={cn(
            "text-xl sm:text-2xl xl:text-3xl font-black tracking-tight text-white transition-all duration-500",
            valueColor
          )}>
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </div>
          <p className="text-xs text-muted-foreground/50 mt-2 font-medium">{description}</p>
          
          {/* Subtle bottom glow */}
          <div className="absolute -bottom-1 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </CardContent>
      </Card>
    </div>
  );
};

export default StatCard;