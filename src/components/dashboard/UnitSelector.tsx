import React from 'react';
import { Building2, Users, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UnitSelectorProps {
  currentUnit: string;
  unitOptions: string[];          // unit names exactly as they come from the sync
  onSelectUnit: (unit: string) => void;
  allowNetwork?: boolean;         // se false, esconde a opção "Rede Malibu (Total)"
}

const UnitSelector: React.FC<UnitSelectorProps> = ({
  currentUnit,
  unitOptions,
  onSelectUnit,
  allowNetwork = true,
}) => {
  const displayName = currentUnit === 'all' ? 'Rede Malibu (Total)' : currentUnit;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-14 px-8 rounded-3xl bg-white/5 hover:bg-white/10 text-white font-black border border-white/5 hover:border-white/10 transition-all flex items-center gap-3 premium-shadow group"
        >
          <div className="p-1.5 rounded-lg bg-primary/20 text-primary group-hover:scale-110 transition-transform">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="tracking-tight text-lg">{displayName}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground/50 ml-2 group-hover:text-white transition-colors" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-72 bg-[#11111a] border-white/5 p-3 rounded-3xl premium-shadow"
        align="start"
      >
        <DropdownMenuLabel className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
          Selecionar Unidade
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5 mx-2" />

        <div className="space-y-1 mt-2">
          {/* "All" option — só aparece se o usuário tem acesso à rede completa */}
          {allowNetwork && (
            <DropdownMenuItem
              onClick={() => onSelectUnit('all')}
              className={cn(
                "flex items-center gap-3 h-12 rounded-2xl cursor-pointer transition-all",
                currentUnit === 'all'
                  ? "bg-primary/20 text-primary font-bold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className={cn("p-2 rounded-lg bg-white/5", currentUnit === 'all' && "bg-primary/20")}>
                <Users className="h-4 w-4" />
              </div>
              <span className="text-sm">Rede Malibu (Total)</span>
            </DropdownMenuItem>
          )}

          {/* Dynamic unit list — always reflects current UNIT_CONFIGS */}
          {unitOptions.sort().map((unit) => (
            <DropdownMenuItem
              key={unit}
              onClick={() => onSelectUnit(unit)}
              className={cn(
                "flex items-center gap-3 h-12 rounded-2xl cursor-pointer transition-all",
                currentUnit === unit
                  ? "bg-primary/20 text-primary font-bold border border-primary/20"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className={cn("p-2 rounded-lg bg-white/5", currentUnit === unit && "bg-primary/20")}>
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-sm truncate">{unit}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UnitSelector;
