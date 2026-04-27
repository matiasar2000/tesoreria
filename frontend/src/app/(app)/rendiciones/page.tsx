"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { FiscalYear, Company } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCLP, formatDate } from "@/lib/utils";
import { Plus, Send, Check, X, Eye } from "lucide-react";

interface RenditionItem {
  id: string;
  expense_id: string;
  expense_description: string | null;
  expense_amount: number | null;
  expense_date: string | null;
  expense_supplier: string | null;
}

interface Rendition {
  id: string;
  fiscal_year_id: string;
  company_id: string;
  company_name: string | null;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: string;
  notes: string | null;
  submitted_by_name: string | null;
  approved_by_name: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  items: RenditionItem[];
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  submitted: { label: "Enviada", variant: "outline" },
  approved: { label: "Aprobada", variant: "default" },
  rejected: { label: "Rechazada", variant: "destructive" },
};

export default function RendicionesPage() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Rendition | null>(null);
  const [newRendition, setNewRendition] = useState({ fiscal_year_id: "", company_id: "", period_start: "", period_end: "", notes: "" });

  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.get<Company[]>("/companies"),
  });

  const { data: renditions, isLoading } = useQuery({
    queryKey: ["renditions"],
    queryFn: () => api.get<Rendition[]>("/renditions"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newRendition) => api.post("/renditions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["renditions"] });
      setShowNew(false);
      setNewRendition({ fiscal_year_id: "", company_id: "", period_start: "", period_end: "", notes: "" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/renditions/${id}/submit`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["renditions"] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/renditions/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["renditions"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/renditions/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["renditions"] }),
  });

  return (
    <>
      <Header title="Rendiciones" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {renditions?.length ?? 0} rendiciones registradas
          </p>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Rendicion
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
                    <TableHead>Compañia</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead>Gastos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!renditions || renditions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay rendiciones registradas.
                      </TableCell>
                    </TableRow>
                  )}
                  {renditions?.map((r) => {
                    const st = STATUS_MAP[r.status] ?? { label: r.status, variant: "outline" as const };
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.company_name}</TableCell>
                        <TableCell className="text-sm">{formatDate(r.period_start)} — {formatDate(r.period_end)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCLP(r.total_amount)}</TableCell>
                        <TableCell className="text-sm">{r.items.length} gastos</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetail(r)} title="Ver detalle">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {r.status === "draft" && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => submitMutation.mutate(r.id)} title="Enviar">
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {r.status === "submitted" && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => approveMutation.mutate(r.id)} title="Aprobar">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => rejectMutation.mutate(r.id)} title="Rechazar">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Rendicion</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(newRendition);
            }}
          >
            <div>
              <Label>Año Fiscal</Label>
              <Select value={newRendition.fiscal_year_id} onValueChange={(value) => setNewRendition({ ...newRendition, fiscal_year_id: value ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {fiscalYears?.map((fy) => (
                    <SelectItem key={fy.id} value={fy.id}>{fy.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Compañia</Label>
              <Select value={newRendition.company_id} onValueChange={(value) => setNewRendition({ ...newRendition, company_id: value ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inicio periodo</Label>
                <Input type="date" value={newRendition.period_start} onChange={(e) => setNewRendition({ ...newRendition, period_start: e.target.value })} required />
              </div>
              <div>
                <Label>Fin periodo</Label>
                <Input type="date" value={newRendition.period_end} onChange={(e) => setNewRendition({ ...newRendition, period_end: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={newRendition.notes} onChange={(e) => setNewRendition({ ...newRendition, notes: e.target.value })} />
            </div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              Crear Rendicion
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Rendicion — {detail?.company_name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Periodo</p>
                  <p className="font-medium">{formatDate(detail.period_start)} — {formatDate(detail.period_end)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monto Total</p>
                  <p className="font-medium font-mono">{formatCLP(detail.total_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge variant={STATUS_MAP[detail.status]?.variant ?? "outline"}>
                    {STATUS_MAP[detail.status]?.label ?? detail.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Gastos incluidos ({detail.items.length})</p>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripcion</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.expense_date ? formatDate(item.expense_date) : "—"}</TableCell>
                          <TableCell className="text-sm">{item.expense_description || "—"}</TableCell>
                          <TableCell className="text-sm">{item.expense_supplier || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{item.expense_amount ? formatCLP(item.expense_amount) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {detail.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm">{detail.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
