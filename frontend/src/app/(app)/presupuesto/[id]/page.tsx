"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BudgetItem, Expense, PaginatedResponse } from "@/types/api";
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
import { cn, formatCLP, formatPercent, formatDate } from "@/lib/utils";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Pendiente", variant: "outline" },
  approved: { label: "Aprobado", variant: "default" },
  rejected: { label: "Rechazado", variant: "destructive" },
  voided: { label: "Anulado", variant: "secondary" },
  draft: { label: "Borrador", variant: "secondary" },
};

function TrafficLight({ color }: { color: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 rounded-full",
        color === "green" && "bg-green-500",
        color === "yellow" && "bg-yellow-500",
        color === "red" && "bg-red-500"
      )}
    />
  );
}

export default function BudgetItemDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.id as string;
  const fyId = searchParams.get("fy");

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ["budget-item", itemId],
    queryFn: () => api.get<BudgetItem>(`/fiscal-years/${fyId}/budget-items/${itemId}`),
    enabled: !!fyId,
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", "budget-item", itemId],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?budget_item_id=${itemId}&page_size=100`),
  });

  if (itemLoading || !item) {
    return (
      <>
        <Header title="Detalle Partida" />
        <div className="p-6"><p className="text-muted-foreground">Cargando...</p></div>
      </>
    );
  }

  return (
    <>
      <Header title={`Partida #${item.number}`} />
      <div className="p-6 space-y-6">
        <Link
          href="/presupuesto"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al presupuesto
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrafficLight color={item.status_color} />
                <div>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mando: <Badge variant="outline" className="capitalize text-xs ml-1">{item.authority}</Badge>
                    {item.is_blocked && (
                      <Badge variant="destructive" className="ml-2">
                        <Lock className="h-3 w-3 mr-1" /> Bloqueada
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-2xl font-bold font-mono",
                  item.status_color === "red" && "text-red-600",
                  item.status_color === "yellow" && "text-yellow-600"
                )}>
                  {formatPercent(item.execution_percentage)}
                </p>
                <p className="text-xs text-muted-foreground">ejecutado</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Asignado</p>
                <p className="text-xl font-bold font-mono">{formatCLP(item.allocated_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ejecutado</p>
                <p className="text-xl font-bold font-mono">{formatCLP(item.executed_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponible</p>
                <p className={cn(
                  "text-xl font-bold font-mono",
                  item.available_amount < 0 && "text-red-600"
                )}>
                  {formatCLP(item.available_amount)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  item.status_color === "green" && "bg-green-500",
                  item.status_color === "yellow" && "bg-yellow-500",
                  item.status_color === "red" && "bg-red-500"
                )}
                style={{ width: `${Math.min(item.execution_percentage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Gastos asociados ({expenses?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expensesLoading ? (
              <p className="text-muted-foreground">Cargando gastos...</p>
            ) : expenses?.items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay gastos registrados en esta partida.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses?.items.map((expense) => {
                      const st = STATUS_LABELS[expense.status] ?? { label: expense.status, variant: "outline" as const };
                      return (
                        <TableRow key={expense.id}>
                          <TableCell className="font-mono text-sm">{formatDate(expense.expense_date)}</TableCell>
                          <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                          <TableCell className="text-sm">{expense.supplier_name ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCLP(expense.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={st.variant}>{st.label}</Badge>
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
