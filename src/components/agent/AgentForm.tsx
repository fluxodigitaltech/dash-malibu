import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
    Loader2, 
    Save, 
    XCircle, 
    Code, 
    CheckCircle2, 
    User, 
    Globe, 
    MessageSquare, 
    ExternalLink, 
    Terminal,
    Info
} from 'lucide-react';
import { AgentData } from '@/integrations/sheety/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

const agentFormSchema = z.object({
  agentName: z.string().min(1, { message: 'O nome do agente é obrigatório.' }),
  personaPresentation: z.string().min(1, { message: 'A apresentação da persona é obrigatória.' }),
  personaTimezone: z.string().min(1, { message: 'O fuso horário é obrigatório.' }),
  personaTone: z.string().min(1, { message: 'O tom da persona é obrigatório.' }),
  personaForbidden: z.string().optional(),
  templatesGreetingMorning: z.string().min(1, { message: 'A saudação de manhã é obrigatória.' }),
  templatesGreetingAfternoon: z.string().min(1, { message: 'A saudação de tarde é obrigatória.' }),
  templatesGreetingNight: z.string().min(1, { message: 'A saudação de noite é obrigatória.' }),
  templatesAskNameMale: z.string().min(1, { message: 'A pergunta de nome (masculino) é obrigatória.' }),
  templatesAskNameFemale: z.string().min(1, { message: 'A pergunta de nome (feminino) é obrigatória.' }),
  templatesAskNameNeutral: z.string().min(1, { message: 'A pergunta de nome (neutro) é obrigatória.' }),
  ruleRequireNameBeforeContinue: z.boolean().default(true),
  ruleAlwaysCallTool: z.boolean().default(true),
  ruleAlwaysCallMemory: z.boolean().default(true),
  ruleNeverUseQuotes: z.boolean().default(true),
  endpointCrm: z.string().url({ message: 'URL do CRM inválida.' }).or(z.literal('')).optional(),
  endpointWaFranquia: z.string().url({ message: 'URL do WhatsApp da Franquia inválida.' }).or(z.literal('')).optional(),
  metaRules: z.string().optional(),
  contentBlocks: z.string().optional(),
  bordaoMale: z.string().optional(),
  bordaoFemale: z.string().optional(),
  bordaoRegionalSouth: z.string().optional(),
  bordaoInterior: z.string().optional(),
  bordaoCentralNeutral: z.string().optional(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

interface AgentFormProps {
  initialData?: AgentData;
  onSubmit: (data: AgentFormValues) => void;
  onCancel: () => void;
  loading: boolean;
  onFormChange: (isDirty: boolean) => void;
}

const timezones = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/New_York', label: 'New York (GMT-4)' },
  { value: 'Europe/London', label: 'London (GMT+1)' },
];

const tones = [
  { value: 'descontraido_curto', label: '💥 Descontraído e Direto' },
  { value: 'formal', label: '👔 Executivo Formal' },
  { value: 'amigavel', label: '🌟 Amigável e Caloroso' },
];

const FormSection = ({ title, icon: Icon, children }: any) => (
    <div className="space-y-6 pt-6 first:pt-0">
        <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/5 text-primary">
                <Icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">{title}</h3>
            <div className="h-px bg-white/5 flex-1 ml-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children}
        </div>
    </div>
);

const AgentForm: React.FC<AgentFormProps> = ({ initialData, onSubmit, onCancel, loading, onFormChange }) => {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      agentName: initialData?.agentName || '',
      personaPresentation: initialData?.personaPresentation || '',
      personaTimezone: initialData?.personaTimezone || 'America/Sao_Paulo',
      personaTone: initialData?.personaTone || 'descontraido_curto',
      personaForbidden: initialData?.personaForbidden || "orientacao_clinica",
      templatesGreetingMorning: initialData?.templatesGreetingMorning || '',
      templatesGreetingAfternoon: initialData?.templatesGreetingAfternoon || '',
      templatesGreetingNight: initialData?.templatesGreetingNight || '',
      templatesAskNameMale: initialData?.templatesAskNameMale || '',
      templatesAskNameFemale: initialData?.templatesAskNameFemale || '',
      templatesAskNameNeutral: initialData?.templatesAskNameNeutral || '',
      ruleRequireNameBeforeContinue: initialData?.ruleRequireNameBeforeContinue ?? true,
      ruleAlwaysCallTool: initialData?.ruleAlwaysCallTool ?? true,
      ruleAlwaysCallMemory: initialData?.ruleAlwaysCallMemory ?? true,
      ruleNeverUseQuotes: initialData?.ruleNeverUseQuotes ?? true,
      endpointCrm: initialData?.endpointCrm || '',
      endpointWaFranquia: initialData?.endpointWaFranquia || '',
      metaRules: initialData?.metaRules || '',
      contentBlocks: initialData?.contentBlocks || '',
      bordaoMale: initialData?.bordaoMale || '',
      bordaoFemale: initialData?.bordaoFemale || '',
      bordaoRegionalSouth: initialData?.bordaoRegionalSouth || '',
      bordaoInterior: initialData?.bordaoInterior || '',
      bordaoCentralNeutral: initialData?.bordaoCentralNeutral || '',
    },
  });

  useEffect(() => { if (initialData) form.reset(initialData); }, [initialData, form]);
  useEffect(() => { onFormChange(form.formState.isDirty); }, [form.formState.isDirty, onFormChange]);

  const handleFormatJson = () => {
    const content = form.getValues('contentBlocks');
    if (!content) return;
    try {
      const formatted = JSON.stringify(JSON.parse(content), null, 2);
      form.setValue('contentBlocks', formatted, { shouldValidate: true });
      showSuccess('JSON Estruturado com sucesso!');
    } catch (e) { showError('Formato JSON inválido detectado'); }
  };

  const handleValidateJson = () => {
    try { JSON.parse(form.getValues('contentBlocks') || ''); showSuccess('Sintaxe Válida!'); }
    catch (e) { showError('Erro na sintaxe JSON'); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
        
        <FormSection title="Identidade do Agente" icon={User}>
            <FormField control={form.control} name="agentName" render={({ field }) => (
                <FormItem className="col-span-1 lg:col-span-1">
                    <FormLabel className="text-white font-bold ml-4">Nome Social da IA</FormLabel>
                    <FormControl><Input {...field} disabled={loading} className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 font-bold px-6 text-white" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="personaTimezone" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-white font-bold ml-4">Localização Temporal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 font-bold px-6 text-white"><SelectValue placeholder="Selecione o Fuso" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-[#11111a] border-white/5 rounded-2xl">{timezones.map(tz => <SelectItem key={tz.value} value={tz.value} className="hover:bg-primary/10 rounded-xl m-1">{tz.label}</SelectItem>)}</SelectContent>
                    </Select>
                </FormItem>
            )} />
            <FormField control={form.control} name="personaTone" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-white font-bold ml-4">Tom de Voz (Nuance)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 font-bold px-6 text-white"><SelectValue placeholder="Selecione o Tom" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-[#11111a] border-white/5 rounded-2xl">{tones.map(t => <SelectItem key={t.value} value={t.value} className="hover:bg-primary/10 rounded-xl m-1">{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                </FormItem>
            )} />
            <FormField control={form.control} name="personaPresentation" render={({ field }) => (
                <FormItem className="col-span-full">
                    <FormLabel className="text-white font-bold ml-4">Apresentação Estruturada (Bio)</FormLabel>
                    <FormControl><Textarea {...field} disabled={loading} rows={3} className="rounded-3xl bg-[#0e0d15]/50 border-white/5 font-medium px-6 py-4 text-white/70" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </FormSection>

        <FormSection title="Saudações Temporais" icon={Globe}>
            <FormField control={form.control} name="templatesGreetingMorning" render={({ field }) => (
                <FormItem><FormLabel className="text-white font-bold ml-4 text-[11px] uppercase opacity-50">Bom dia</FormLabel>
                <FormControl><Input {...field} disabled={loading} className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 px-6 font-medium" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="templatesGreetingAfternoon" render={({ field }) => (
                <FormItem><FormLabel className="text-white font-bold ml-4 text-[11px] uppercase opacity-50">Boa tarde</FormLabel>
                <FormControl><Input {...field} disabled={loading} className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 px-6 font-medium" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="templatesGreetingNight" render={({ field }) => (
                <FormItem><FormLabel className="text-white font-bold ml-4 text-[11px] uppercase opacity-50">Boa noite</FormLabel>
                <FormControl><Input {...field} disabled={loading} className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 px-6 font-medium" /></FormControl></FormItem>
            )} />
        </FormSection>

        <FormSection title="Endpoints & Integração" icon={ExternalLink}>
            <FormField control={form.control} name="endpointCrm" render={({ field }) => (
                <FormItem className="lg:col-span-2"><FormLabel className="text-white font-bold ml-4">URL do CRM Malibu</FormLabel>
                <FormControl><Input {...field} disabled={loading} className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 px-6 font-mono text-xs text-primary/80" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="endpointWaFranquia" render={({ field }) => (
                <FormItem><FormLabel className="text-white font-bold ml-4">API Franquia</FormLabel>
                <FormControl><Input {...field} disabled={loading} className="h-12 rounded-2xl bg-[#0e0d15]/50 border-white/5 px-6 font-mono text-xs text-primary/80" /></FormControl></FormItem>
            )} />
        </FormSection>

        <div className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/20 text-primary glow-border">
                        <Terminal className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Base de Conhecimento (JSON)</h3>
                        <p className="text-[10px] text-muted-foreground/50 font-black uppercase tracking-widest mt-1">Sistemas de blocos e regras neurais complexas.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={handleFormatJson} className="rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest">
                        <Code className="mr-2 h-4 w-4" /> Formatar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleValidateJson} className="rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" /> Validar
                    </Button>
                </div>
            </div>
            
            <FormField control={form.control} name="contentBlocks" render={({ field }) => (
                <FormItem>
                    <FormControl>
                        <div className="relative group">
                            <div className="absolute inset-0 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Textarea 
                                {...field} 
                                disabled={loading} 
                                rows={20} 
                                className="rounded-[2rem] bg-[#0e0d15]/80 border-white/10 font-mono text-sm px-8 py-6 text-green-400/80 custom-scrollbar relative z-10 focus:border-primary/50 transition-all placeholder:text-white/5" 
                                placeholder="{ 'regras': [...] }"
                            />
                            <div className="absolute bottom-6 right-8 text-white/20 select-none flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Apenas JSON Válido</span>
                            </div>
                        </div>
                    </FormControl>
                </FormItem>
            )} />
        </div>

        <div className="flex justify-end gap-6 pt-10 border-t border-white/5">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="h-14 px-10 rounded-2xl text-white/40 hover:text-white font-black uppercase tracking-widest text-xs">
            <XCircle className="mr-3 h-5 w-5" /> Descartar Alterações
          </Button>
          <Button type="submit" disabled={loading} className="h-14 px-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs premium-shadow hover:scale-105 active:scale-95 transition-all">
            {loading ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : <Save className="mr-3 h-5 w-5" />} Sincronizar Cérebro Agent
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AgentForm;