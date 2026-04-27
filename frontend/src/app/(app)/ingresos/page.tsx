/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Company, FiscalYear, Income } from "@/types/api";
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
import { Textarea } from "@/components/ui/textarea";
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
import { formatCLP, formatDate } from "@/lib/utils";
import { CircleDollarSign, Plus, Trash2 } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  subvencion_fiscal: "Subvención Fiscal",
  subvencion_municipal: "Subvención Municipal",
  donacion: "Donación",
  cuota_voluntarios: "Cuota Voluntarios",
  rifa: "Rifa/Beneficio",
  beneficio: "Beneficio",
  aporte_compania: "Aporte Compañía",
  otro: "Otro",
};

const SOURCE_TYPES = Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const SOURCE_COLORS = [
  "#16a34a",
  "#2563eb",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#64748b",
];

interface IncomeSourceSummary {
  source_type: string;
  label: string;
  total: number;
  count: number;
}

interface IncomeMonthSummary {
  month: number;
  month_name: string;
  total: number;
}

interface IncomeSummary {
  total_income: number;
  by_source: IncomeSourceSummary[];
  by_month: IncomeMonthSummary[];
}

interface IncomeFormState {
  source_type: string;
  source_detail: string;
  amount: string;
  income_date: string;
  reference: string;
  company_id: string;
  notes: string;
}

interface CreateIncomePayload {
  fiscal_year_id: string;
  source_type: string;
  amount: number;
  income_date: string;
  source_detail: string | null;
  reference: string | null;
  company_id: string | null;
  notes: string | null;
}

type SourceFilter = "all" | string;

function getInitialForm(): IncomeFormState {
  return {
    source_type: "subvencion_fiscal",
    source_detail: "",
    amount: "",
    income_date: new Date().toISOString().split("T")[0],
    reference: "",
    company_id: "none",
    notes: "",
  };
}

export default function IngresosPage() {
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showNewIncome, setShowNewIncome] = useState(false);
  const [form, setForm] = useState<IncomeFormState>(getInitialForm);
  const [error, setError] = useState("");

  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.get<Company[]>("/companies"),
  });

  const currentFY = fiscalYears?.[0];
  const sourceParam = sourceFilter === "all" ? "" : `&source_type=${encodeURIComponent(sourceFilter)}`;

  const { data: incomes, isLoading } = useQuery({
    queryKey: ["incomes", currentFY?.id, sourceFilter],
    queryFn: () => api.get<Income[]>(`/incomes?fiscal_year_id=${currentFY!.id}${sourceParam}`),
    enabled: !!currentFY,
  });

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["income-summary", currentFY?.id],
    queryFn: () => api.get<IncomeSummary>(`/incomes/summary?fiscal_year_id=${currentFY!.id}`),
    enabled: !!currentFY,
  });

  const createIncome = useMutation({
    mutationFn: (payload: CreateIncomePayload) => api.post<Income>("/incomes", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["income-summary"] });
      setShowNewIncome(false);
      setForm(getInitialForm());
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteIncome = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/incomes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["income-summary"] });
    },
  });

  const sourceSummary = summary?.by_source ?? [];
  const chartData = sourceSummary.map((item) => {
    const sourceIndex = SOURCE_TYPES.findIndex((source) => source.value === item.source_type);
    return {
      ...item,
      color: SOURCE_COLORS[sourceIndex >= 0 ? sourceIndex % SOURCE_COLORS.length : SOURCE_COLORS.length - 1],
    };
  });
  const totalOperations = sourceSummary.reduce((total, item) => total + item.count, 0);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError("");

    if (!currentFY) {
      setError("No hay año fiscal disponible para registrar ingresos.");
      return;
    }

    const amount = Number.parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    createIncome.mutate({
      fiscal_year_id: currentFY.id,
      source_type: form.source_type,
      amount,
      income_date: form.income_date,
      source_detail: form.source_detail || null,
      reference: form.reference || null,
      company_id: form.company_id === "none" ? null : form.company_id,
      notes: form.notes || null,
    });
  };

  const handleDialogOpenChange = (open: boolean): void => {
    setShowNewIncome(open);
    if (!open) {
      setForm(getInitialForm());
      setError("");
    }
  };

  const handleDelete = (income: Income): void => {
    if (window.confirm(`Eliminar ingreso ${formatCLP(income.amount)} de ${income.source_type_label}?`)) {
      deleteIncome.mutate(income.id);
    }
  };

  return (
    <>
      <Header title="Control de Ingresos" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todas las fuentes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fuentes</SelectItem>
                {SOURCE_TYPES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {incomes?.length ?? 0} ingresos registrados
            </p>
          </div>

          <Button onClick={() => setShowNewIncome(true)} disabled={!currentFY}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ingreso
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total ingresos</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(summary?.total_income ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{totalOperations} operaciones</p>
            </CardContent>
          </Card>

          {sourceSummary.map((source) => (
            <Card key={source.source_type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{source.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCLP(source.total)}</p>
                <p className="text-xs text-muted-foreground">{source.count} operaciones</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingresos por fuente</CardTitle>
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <p className="text-muted-foreground">Cargando resumen...</p>
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay ingresos para graficar.</p>
              ) : (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 150, right: 24 }}>
                      <XAxis type="number" tickFormatter={(value) => formatCLP(Number(value))} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={145}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [formatCLP(Number(value)), "Total"]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {chartData.map((item) => (
                          <Cell key={item.source_type} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen mensual</CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.by_month.length ? (
                <div className="space-y-3">
                  {summary.by_month.map((month) => (
                    <div key={month.month} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{month.month_name}</span>
                      <span className="font-mono font-medium">{formatCLP(month.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin ingresos mensuales registrados.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Compañía</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!incomes || incomes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay ingresos registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {incomes?.map((income) => (
                      <TableRow key={income.id}>
                        <TableCell className="font-mono text-sm">{formatDate(income.income_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{income.source_type_label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">{income.source_detail || "-"}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-green-600">
                          {formatCLP(income.amount)}
                        </TableCell>
                        <TableCell className="text-sm">{income.company_name || "-"}</TableCell>
                        <TableCell className="text-sm">{income.reference || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(income)}
                            disabled={deleteIncome.isPending}
                            title="Eliminar ingreso"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNewIncome} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Ingreso</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Fuente</Label>
                <Select value={form.source_type} onValueChange={(v: any) => setForm({ ...form, source_type: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Monto</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.income_date}
                  onChange={(event) => setForm({ ...form, income_date: event.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Compañía</Label>
                <Select value={form.company_id} onValueChange={(v: any) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin compañía" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin compañía</SelectItem>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.number} - {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Referencia</Label>
                <Input
                  value={form.reference}
                  onChange={(event) => setForm({ ...form, reference: event.target.value })}
                  placeholder="N° comprobante, transferencia..."
                />
              </div>

              <div>
                <Label>Detalle</Label>
                <Input
                  value={form.source_detail}
                  onChange={(event) => setForm({ ...form, source_detail: event.target.value })}
                  placeholder="Origen o descripción breve"
                />
              </div>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createIncome.isPending || !currentFY}>
                {createIncome.isPending ? "Registrando..." : "Registrar Ingreso"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
