"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse, Expense } from "@/types/api";
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
import { formatCLP, formatDate } from "@/lib/utils";
import { Plus, Check, X, Ban } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  pending_approval: { label: "Pendiente", variant: "outline" },
  approved: { label: "Aprobado", variant: "default" },
  rejected: { label: "Rechazado", variant: "destructive" },
  voided: { label: "Anulado", variant: "secondary" },
  paid: { label: "Pagado", variant: "default" },
};

type StatusFilter = "all" | "pending_approval" | "approved" | "rejected" | "voided";

export default function GastosPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const queryParam = statusFilter === "all" ? "" : `&status=${statusFilter}`;
  const { data, isLoading } = useQuery({
    queryKey: ["expenses", statusFilter],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?page_size=50${queryParam}`),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budget-items"] });
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const voidExpense = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budget-items"] });
    },
  });

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "pending_approval", label: "Pendientes" },
    { value: "approved", label: "Aprobados" },
    { value: "rejected", label: "Rechazados" },
    { value: "voided", label: "Anulados" },
  ];

  return (
    <>
      <Header title="Gastos" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Link href="/gastos/nuevo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Gasto
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} gastos {statusFilter !== "all" ? `(${filters.find(f => f.value === statusFilter)?.label.toLowerCase()})` : "registrados"}
        </p>

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
                      <TableHead>Descripción</TableHead>
                      <TableHead>Partida</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay gastos registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {data?.items.map((expense) => {
                      const st = STATUS_LABELS[expense.status] ?? { label: expense.status, variant: "outline" as const };
                      return (
                        <TableRow key={expense.id}>
                          <TableCell className="font-mono text-sm">{formatDate(expense.expense_date)}</TableCell>
                          <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                          <TableCell className="text-sm">{expense.budget_item_name}</TableCell>
                          <TableCell className="text-sm">{expense.supplier_name ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCLP(expense.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {expense.status === "pending_approval" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => approve.mutate(expense.id)}
                                    disabled={approve.isPending}
                                    title="Aprobar"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => reject.mutate(expense.id)}
                                    disabled={reject.isPending}
                                    title="Rechazar"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {(expense.status === "approved" || expense.status === "pending_approval") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => voidExpense.mutate(expense.id)}
                                  disabled={voidExpense.isPending}
                                  title="Anular"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
