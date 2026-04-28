import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pactoApiClient, UNIT_CONFIGS } from '@/integrations/pacto/client';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Search, UserPlus, CreditCard, Building2, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Only units that have a valid token configured
const ACTIVE_UNITS = UNIT_CONFIGS.filter(u => u.token.length > 10);

const PactoOperations = () => {
  const [loading, setLoading]           = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('');

  // ── Cadastro de cliente ────────────────────────────────────────────────────
  const [clienteForm, setClienteForm] = useState({
    nome: '', cpf: '', email: '', celular: '',
    dataNascimento: '', sexo: 'M',
  });

  // ── Busca de débitos ───────────────────────────────────────────────────────
  const [debitosSearch, setDebitosSearch]     = useState('');
  const [debitosResult, setDebitosResult]     = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [parcelas, setParcelas]               = useState<any[]>([]);

  // Retrieve the token for the currently selected unit
  const getToken = (): string | null => {
    const cfg = ACTIVE_UNITS.find(u => u.name === selectedUnit);
    return cfg?.token ?? null;
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateCliente = async () => {
    const token = getToken();
    if (!token) { showError('Selecione uma unidade primeiro.'); return; }
    if (!clienteForm.nome || !clienteForm.cpf) { showError('Nome e CPF são obrigatórios.'); return; }

    setLoading(true);
    try {
      const body = {
        nome:            clienteForm.nome,
        cpf:             clienteForm.cpf.replace(/\D/g, ''),
        email:           clienteForm.email,
        celular:         clienteForm.celular,
        dataNascimento:  clienteForm.dataNascimento
                           ? new Date(clienteForm.dataNascimento).toISOString()
                           : undefined,
        sexo: clienteForm.sexo,
      };
      await pactoApiClient.createCliente(token, body);
      showSuccess('Cliente cadastrado com sucesso!');
      setClienteForm({ nome: '', cpf: '', email: '', celular: '', dataNascimento: '', sexo: 'M' });
    } catch (e: any) {
      showError(e.message || 'Erro ao cadastrar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCliente = async () => {
    const token = getToken();
    if (!token) { showError('Selecione uma unidade primeiro.'); return; }
    if (!debitosSearch.trim()) return;

    setLoading(true);
    setSelectedCliente(null);
    setParcelas([]);
    try {
      const res = await pactoApiClient.buscarCliente(token, debitosSearch.trim());
      setDebitosResult(res?.content ?? res ?? []);
    } catch (e: any) {
      showError(e.message || 'Erro ao buscar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = async (cliente: any) => {
    const token = getToken();
    if (!token) return;

    setSelectedCliente(cliente);
    setDebitosResult([]);
    setLoading(true);
    try {
      // situacao "EA" = Em Aberto (parcelas em atraso)
      const res = await pactoApiClient.getParcelas(token, cliente.pessoa?.codigo ?? cliente.codigo, 'EA');
      setParcelas(res?.content ?? res ?? []);
    } catch (e: any) {
      showError(e.message || 'Erro ao buscar parcelas.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedCliente(null);
    setParcelas([]);
    setDebitosResult([]);
    setDebitosSearch('');
  };

  return (
    <div className="space-y-8 p-6 lg:p-10 max-w-[1200px] mx-auto animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-primary/20 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-white">
              Operações <span className="text-primary">Pacto</span>
            </h1>
          </div>
          <p className="text-muted-foreground/50 text-sm font-medium uppercase tracking-widest">
            Gerenciamento direto via API Pacto
          </p>
        </div>

        {/* Unit selector */}
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground/50" />
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-[220px] bg-white/5 border-white/10 text-white rounded-2xl h-11">
              <SelectValue placeholder="Selecionar unidade" />
            </SelectTrigger>
            <SelectContent className="bg-[#11111a] border-white/10 rounded-2xl">
              {ACTIVE_UNITS.map(u => (
                <SelectItem key={u.name} value={u.name} className="text-white hover:bg-white/5 rounded-xl">
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loading && <Loader2 className="animate-spin h-4 w-4 text-primary" />}
        </div>
      </div>

      {/* Warning se nenhuma unidade selecionada */}
      {!selectedUnit && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">Selecione uma unidade acima para utilizar as operações.</p>
        </div>
      )}

      <Tabs defaultValue="cliente">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 rounded-2xl p-1 h-12">
          <TabsTrigger value="cliente" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-bold">
            <UserPlus className="mr-2 h-4 w-4" /> Cadastrar Cliente
          </TabsTrigger>
          <TabsTrigger value="debitos" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-bold">
            <CreditCard className="mr-2 h-4 w-4" /> Consultar Débitos
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Cadastrar Cliente ─────────────────────────────────────────── */}
        <TabsContent value="cliente">
          <Card className="glass-card glow-border rounded-3xl">
            <CardHeader>
              <CardTitle className="text-white font-black">Novo Cliente</CardTitle>
              <CardDescription className="text-muted-foreground/50 text-xs uppercase tracking-widest">
                Preencha os dados e clique em Cadastrar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Nome completo *"
                  value={clienteForm.nome}
                  onChange={e => setClienteForm({ ...clienteForm, nome: e.target.value })}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11"
                />
                <Input
                  placeholder="CPF *"
                  value={clienteForm.cpf}
                  onChange={e => setClienteForm({ ...clienteForm, cpf: e.target.value })}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11"
                />
                <Input
                  placeholder="E-mail"
                  type="email"
                  value={clienteForm.email}
                  onChange={e => setClienteForm({ ...clienteForm, email: e.target.value })}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11"
                />
                <Input
                  placeholder="Celular"
                  value={clienteForm.celular}
                  onChange={e => setClienteForm({ ...clienteForm, celular: e.target.value })}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11"
                />
                <Input
                  placeholder="Data de nascimento"
                  type="date"
                  value={clienteForm.dataNascimento}
                  onChange={e => setClienteForm({ ...clienteForm, dataNascimento: e.target.value })}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11"
                />
                <Select
                  value={clienteForm.sexo}
                  onValueChange={v => setClienteForm({ ...clienteForm, sexo: v })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#11111a] border-white/10 rounded-2xl">
                    <SelectItem value="M" className="text-white">Masculino</SelectItem>
                    <SelectItem value="F" className="text-white">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white"
                onClick={handleCreateCliente}
                disabled={loading || !selectedUnit}
              >
                {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Cadastrar Cliente
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Consultar Débitos ─────────────────────────────────────────── */}
        <TabsContent value="debitos">
          <Card className="glass-card glow-border rounded-3xl">
            <CardHeader>
              <CardTitle className="text-white font-black">Consultar Débitos</CardTitle>
              <CardDescription className="text-muted-foreground/50 text-xs uppercase tracking-widest">
                Busque pelo nome do cliente para ver parcelas em aberto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {!selectedCliente ? (
                <>
                  <div className="flex gap-3">
                    <Input
                      value={debitosSearch}
                      onChange={e => setDebitosSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchCliente()}
                      placeholder="Nome do cliente..."
                      className="bg-white/5 border-white/10 text-white rounded-xl h-11"
                    />
                    <Button
                      onClick={handleSearchCliente}
                      disabled={loading || !selectedUnit}
                      className="h-11 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shrink-0"
                    >
                      {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {debitosResult.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                        {debitosResult.length} resultado(s) encontrado(s)
                      </p>
                      {debitosResult.map((c: any) => (
                        <div
                          key={c.pessoa?.codigo ?? c.codigo}
                          onClick={() => handleSelectCliente(c)}
                          className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/20 cursor-pointer transition-all"
                        >
                          <div className="p-2 rounded-lg bg-primary/20 text-primary">
                            <UserPlus className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{c.pessoa?.nome ?? c.nome}</p>
                            <p className="text-xs text-muted-foreground/50">{c.cpf ?? ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {debitosResult.length === 0 && debitosSearch && !loading && (
                    <p className="text-center text-muted-foreground/40 text-sm py-6">Nenhum cliente encontrado.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-black text-white text-lg">{selectedCliente.pessoa?.nome ?? selectedCliente.nome}</p>
                      <p className="text-xs text-muted-foreground/50 uppercase tracking-widest">Parcelas em aberto</p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      className="text-muted-foreground/50 hover:text-white rounded-xl"
                    >
                      ← Voltar
                    </Button>
                  </div>

                  {parcelas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/5 hover:bg-transparent">
                          <TableHead className="text-muted-foreground/50 font-bold uppercase text-xs tracking-widest">Descrição</TableHead>
                          <TableHead className="text-muted-foreground/50 font-bold uppercase text-xs tracking-widest">Vencimento</TableHead>
                          <TableHead className="text-muted-foreground/50 font-bold uppercase text-xs tracking-widest text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelas.map((p: any, i: number) => (
                          <TableRow key={p.codigo ?? i} className="border-white/5 hover:bg-white/5">
                            <TableCell className="text-white font-semibold text-sm">{p.descricao ?? '—'}</TableCell>
                            <TableCell className="text-muted-foreground/60 text-sm">{p.dataVencimento ?? p.vencimento ?? '—'}</TableCell>
                            <TableCell className="text-red-400 font-bold text-sm text-right">
                              {typeof p.valor === 'number'
                                ? p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : p.valor ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground/30 font-bold uppercase text-xs tracking-widest">
                      {loading ? 'Buscando parcelas...' : 'Nenhuma parcela em aberto encontrada.'}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PactoOperations;
