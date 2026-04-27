"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { FiscalYear, BudgetItem } from "@/types/api";
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
import { formatCLP } from "@/lib/utils";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

interface CloseSummary {
  fiscal_year_id: string;
  year: number;
  status: string;
  total_allocated: number;
  total_executed: number;
  total_available: number;
  execution_percentage: number;
  pending_expenses: number;
  pending_renditions: number;
  can_close: boolean;
  budget_items: BudgetItem[];
}

export default function CierrePage() {
  const queryClient = useQueryClient();
  const [selectedFY, setSelectedFY] = useState<string>("");
  const [confirmClose, setConfirmClose] = useState(false);

  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["close-summary", selectedFY],
    queryFn: () => api.get<CloseSummary>(`/fiscal-close/${selectedFY}/summary`),
    enabled: !!selectedFY,
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/fiscal-close/${selectedFY}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["close-summary"] });
      queryClient.invalidateQueries({ queryKey: ["fiscal-years"] });
      setConfirmClose(false);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.post(`/fiscal-close/${selectedFY}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["close-summary"] });
      queryClient.invalidateQueries({ queryKey: ["fiscal-years"] });
    },
  });

  return (
    <>
      <Header title="Cierre Contable" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Select value={selectedFY} onValueChange={(v) => setSelectedFY(v ?? "")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar año fiscal" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears?.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>{fy.year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {summary && (
            <Badge variant={summary.status === "closed" ? "destructive" : "default"} className="text-sm">
              {summary.status === "closed" ? "Cerrado" : summary.status === "active" ? "Activo" : "Borrador"}
            </Badge>
          )}
        </div>

        {!selectedFY && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Selecciona un año fiscal para ver el resumen de cierre.
            </CardContent>
          </Card>
        )}

        {isLoading && selectedFY && (
          <p className="text-muted-foreground">Cargando...</p>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                  <p className="text-xl font-bold font-mono">{formatCLP(summary.total_allocated)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Ejecutado</p>
                  <p className="text-xl font-bold font-mono">{formatCLP(summary.total_executed)}</p>
                  <p className="text-xs text-muted-foreground">{summary.execution_percentage}% ejecutado</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Disponible</p>
                  <p className="text-xl font-bold font-mono text-green-600">{formatCLP(summary.total_available)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Gastos Pendientes</p>
                  <p className={`text-xl font-bold ${summary.pending_expenses > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {summary.pending_expenses}
                  </p>
                  {summary.pending_expenses > 0 && (
                    <p className="text-xs text-orange-600">Deben resolverse antes de cerrar</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {summary.pending_expenses > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">No se puede cerrar el año fiscal</p>
                    <p className="text-sm text-orange-700">
                      Hay {summary.pending_expenses} gastos pendientes de aprobacion y {summary.pending_renditions} rendiciones sin finalizar.
                      Deben resolverse antes de proceder al cierre.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              {summary.status !== "closed" && (
                <Button
                  onClick={() => setConfirmClose(true)}
                  disabled={!summary.can_close}
                  variant="destructive"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Cerrar Año Fiscal {summary.year}
                </Button>
              )}
              {summary.status === "closed" && (
                <Button
                  onClick={() => reopenMutation.mutate()}
                  variant="outline"
                  disabled={reopenMutation.isPending}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Reabrir Año Fiscal
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen por Partida</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Partida</TableHead>
                      <TableHead className="text-right">Asignado</TableHead>
                      <TableHead className="text-right">Ejecutado</TableHead>
                      <TableHead className="text-right">Disponible</TableHead>
                      <TableHead className="text-right">% Ejec.</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.budget_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.number}</TableCell>
                        <TableCell className="text-sm">{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCLP(item.allocated_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCLP(item.executed_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCLP(item.available_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{item.execution_percentage}%</TableCell>
                        <TableCell>
                          <span
                            className={`inline-block h-3 w-3 rounded-full ${
                              item.status_color === "red" ? "bg-red-500" :
                              item.status_color === "yellow" ? "bg-yellow-500" :
                              "bg-green-500"
                            }`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cierre Contable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Esta accion cerrara el año fiscal <strong>{summary?.year}</strong> y bloqueara todas las partidas presupuestarias.
              No se podran registrar nuevos gastos hasta que se reabra el año fiscal.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmClose(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                <Lock className="h-4 w-4 mr-2" />
                Confirmar Cierre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
