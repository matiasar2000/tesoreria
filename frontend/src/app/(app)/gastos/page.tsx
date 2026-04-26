"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse, Expense } from "@/types/api";
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
import { formatCLP, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  pending_approval: { label: "Pendiente", variant: "outline" },
  approved: { label: "Aprobado", variant: "default" },
  rejected: { label: "Rechazado", variant: "destructive" },
  paid: { label: "Pagado", variant: "default" },
};

export default function GastosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get<PaginatedResponse<Expense>>("/expenses?page_size=50"),
  });

  return (
    <>
      <Header title="Gastos" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} gastos registrados
          </p>
          <Link href="/gastos/nuevo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Gasto
            </Button>
          </Link>
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
                      <TableHead>Descripción</TableHead>
                      <TableHead>Partida</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
