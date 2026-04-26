"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCLP, formatDate } from "@/lib/utils";
import { Plus, Link2, Unlink } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  alias: string;
  balance: number;
  is_active: boolean;
  created_at: string;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  bank_account_alias: string | null;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  reference: string | null;
  description: string | null;
  reconciled: boolean;
  reconciled_expense_id: string | null;
  reconciled_expense_desc: string | null;
  created_at: string;
}

interface ReconciliationSummary {
  total_transactions: number;
  reconciled: number;
  pending: number;
  reconciliation_percentage: number;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  status: string;
  supplier_name: string | null;
}

export default function BancoPage() {
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [showReconcile, setShowReconcile] = useState<BankTransaction | null>(null);
  const [reconcileFilter, setReconcileFilter] = useState<boolean | null>(false);

  const [newAccount, setNewAccount] = useState({ bank_name: "", account_number: "", account_type: "corriente", alias: "", balance: "" });
  const [newTx, setNewTx] = useState({ bank_account_id: "", transaction_date: "", amount: "", transaction_type: "debit", reference: "", description: "" });

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<BankAccount[]>("/bank/accounts"),
  });

  const accountParam = selectedAccount !== "all" ? `&bank_account_id=${selectedAccount}` : "";
  const reconciledParam = reconcileFilter === null ? "" : `&reconciled=${reconcileFilter}`;
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["bank-transactions", selectedAccount, reconcileFilter],
    queryFn: () => api.get<PaginatedResponse<BankTransaction>>(`/bank/transactions?page_size=100${accountParam}${reconciledParam}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["bank-summary", selectedAccount],
    queryFn: () => {
      const param = selectedAccount !== "all" ? `?bank_account_id=${selectedAccount}` : "";
      return api.get<ReconciliationSummary>(`/bank/reconciliation-summary${param}`);
    },
  });

  const { data: approvedExpenses } = useQuery({
    queryKey: ["approved-expenses-for-reconcile"],
    queryFn: () => api.get<PaginatedResponse<Expense>>("/expenses?status=approved&page_size=100"),
    enabled: !!showReconcile,
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: typeof newAccount) =>
      api.post("/bank/accounts", { ...data, balance: parseFloat(data.balance) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setShowNewAccount(false);
      setNewAccount({ bank_name: "", account_number: "", account_type: "corriente", alias: "", balance: "" });
    },
  });

  const createTxMutation = useMutation({
    mutationFn: (data: typeof newTx) =>
      api.post("/bank/transactions", { ...data, amount: parseFloat(data.amount) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-summary"] });
      setShowNewTx(false);
      setNewTx({ bank_account_id: "", transaction_date: "", amount: "", transaction_type: "debit", reference: "", description: "" });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: (data: { transaction_id: string; expense_id: string }) => api.post("/bank/reconcile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-summary"] });
      setShowReconcile(null);
    },
  });

  const unreconcileMutation = useMutation({
    mutationFn: (txId: string) => api.patch(`/bank/transactions/${txId}/unreconcile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-summary"] });
    },
  });

  return (
    <>
      <Header title="Conciliacion Bancaria" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total movimientos</p>
              <p className="text-2xl font-bold">{summary?.total_transactions ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Conciliados</p>
              <p className="text-2xl font-bold text-green-600">{summary?.reconciled ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold text-orange-600">{summary?.pending ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">% Conciliacion</p>
              <p className="text-2xl font-bold">{summary?.reconciliation_percentage ?? 0}%</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Movimientos</TabsTrigger>
            <TabsTrigger value="accounts">Cuentas</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Select value={selectedAccount} onValueChange={(v: string) => setSelectedAccount(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas las cuentas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las cuentas</SelectItem>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.alias}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" variant={reconcileFilter === null ? "default" : "outline"} onClick={() => setReconcileFilter(null)}>
                    Todos
                  </Button>
                  <Button size="sm" variant={reconcileFilter === false ? "default" : "outline"} onClick={() => setReconcileFilter(false)}>
                    Pendientes
                  </Button>
                  <Button size="sm" variant={reconcileFilter === true ? "default" : "outline"} onClick={() => setReconcileFilter(true)}>
                    Conciliados
                  </Button>
                </div>
              </div>
              <Button onClick={() => setShowNewTx(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Movimiento
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-muted-foreground">Cargando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Descripcion</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions?.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No hay movimientos registrados.
                          </TableCell>
                        </TableRow>
                      )}
                      {transactions?.items.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-sm">{formatDate(tx.transaction_date)}</TableCell>
                          <TableCell className="text-sm">{tx.bank_account_alias}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{tx.description || "—"}</TableCell>
                          <TableCell className="text-sm">{tx.reference || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={tx.transaction_type === "credit" ? "default" : "secondary"}>
                              {tx.transaction_type === "credit" ? "Ingreso" : "Egreso"}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${tx.transaction_type === "credit" ? "text-green-600" : "text-red-600"}`}>
                            {tx.transaction_type === "credit" ? "+" : "-"}{formatCLP(tx.amount)}
                          </TableCell>
                          <TableCell>
                            {tx.reconciled ? (
                              <Badge variant="default">Conciliado</Badge>
                            ) : (
                              <Badge variant="outline">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!tx.reconciled ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-600"
                                onClick={() => setShowReconcile(tx)}
                                title="Conciliar con gasto"
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground"
                                onClick={() => unreconcileMutation.mutate(tx.id)}
                                title="Desconciliar"
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowNewAccount(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cuenta
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts?.map((account) => (
                <Card key={account.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{account.alias}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Banco:</span> {account.bank_name}</p>
                      <p><span className="text-muted-foreground">N° Cuenta:</span> {account.account_number}</p>
                      <p><span className="text-muted-foreground">Tipo:</span> {account.account_type}</p>
                      <p className="text-lg font-bold font-mono mt-2">{formatCLP(account.balance)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!accounts || accounts.length === 0) && (
                <p className="text-muted-foreground col-span-3 text-center py-8">No hay cuentas bancarias registradas.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta Bancaria</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createAccountMutation.mutate(newAccount);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alias</Label>
                <Input value={newAccount.alias} onChange={(e) => setNewAccount({ ...newAccount, alias: e.target.value })} required />
              </div>
              <div>
                <Label>Banco</Label>
                <Input value={newAccount.bank_name} onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })} required />
              </div>
              <div>
                <Label>N° Cuenta</Label>
                <Input value={newAccount.account_number} onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })} required />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newAccount.account_type} onValueChange={(v: string) => setNewAccount({ ...newAccount, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corriente">Corriente</SelectItem>
                    <SelectItem value="ahorro">Ahorro</SelectItem>
                    <SelectItem value="vista">Vista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Saldo inicial</Label>
                <Input type="number" value={newAccount.balance} onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={createAccountMutation.isPending} className="w-full">
              Crear Cuenta
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento Bancario</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createTxMutation.mutate(newTx);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Cuenta</Label>
                <Select value={newTx.bank_account_id} onValueChange={(v: string) => setNewTx({ ...newTx, bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.alias}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={newTx.transaction_date} onChange={(e) => setNewTx({ ...newTx, transaction_date: e.target.value })} required />
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} required />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newTx.transaction_type} onValueChange={(v: string) => setNewTx({ ...newTx, transaction_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Egreso</SelectItem>
                    <SelectItem value="credit">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referencia</Label>
                <Input value={newTx.reference} onChange={(e) => setNewTx({ ...newTx, reference: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Descripcion</Label>
                <Input value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={createTxMutation.isPending} className="w-full">
              Registrar Movimiento
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showReconcile} onOpenChange={() => setShowReconcile(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conciliar Movimiento</DialogTitle>
          </DialogHeader>
          {showReconcile && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md text-sm">
                <p><span className="text-muted-foreground">Movimiento:</span> {showReconcile.description || showReconcile.reference || "Sin descripcion"}</p>
                <p><span className="text-muted-foreground">Monto:</span> {formatCLP(showReconcile.amount)}</p>
                <p><span className="text-muted-foreground">Fecha:</span> {formatDate(showReconcile.transaction_date)}</p>
              </div>
              <p className="text-sm font-medium">Seleccionar gasto aprobado:</p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {approvedExpenses?.items.map((exp) => (
                  <button
                    key={exp.id}
                    className="w-full text-left p-2 rounded-md hover:bg-muted text-sm flex justify-between items-center"
                    onClick={() => reconcileMutation.mutate({ transaction_id: showReconcile.id, expense_id: exp.id })}
                  >
                    <div>
                      <p className="font-medium">{exp.description}</p>
                      <p className="text-xs text-muted-foreground">{exp.supplier_name || "Sin proveedor"} — {formatDate(exp.expense_date)}</p>
                    </div>
                    <span className="font-mono font-medium">{formatCLP(exp.amount)}</span>
                  </button>
                ))}
                {(!approvedExpenses || approvedExpenses.items.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No hay gastos aprobados disponibles.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
