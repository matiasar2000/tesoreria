"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { BudgetItem, FiscalYear } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatCLP, formatPercent } from "@/lib/utils";
import { Download, Lock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SOURCE_LABELS: Record<string, string> = {
  fiscal: "Subvención Fiscal",
  municipal: "Subvención Municipal",
  propio: "Fondos Propios",
  donacion: "Donación",
  general: "General",
};

const SOURCE_BADGE_CLASSES: Record<string, string> = {
  fiscal: "border-blue-200 bg-blue-50 text-blue-700",
  municipal: "border-purple-200 bg-purple-50 text-purple-700",
  propio: "border-green-200 bg-green-50 text-green-700",
  donacion: "border-orange-200 bg-orange-50 text-orange-700",
  general: "border-gray-200 bg-gray-50 text-gray-700",
};

async function downloadExcel(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_URL}${path}`, { headers });

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
    return;
  }

  if (!response.ok) {
    throw new Error("No se pudo exportar el archivo Excel.");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function TrafficLight({ color }: { color: string }) {
  return (
    <div
      className={cn(
        "h-4 w-4 rounded-full",
        color === "green" && "bg-green-500",
        color === "yellow" && "bg-yellow-500",
        color === "red" && "bg-red-500"
      )}
    />
  );
}

export default function PresupuestoPage() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });

  const currentFY = fiscalYears?.[0];

  const { data: items, isLoading } = useQuery({
    queryKey: ["budget-items", currentFY?.id],
    queryFn: () => api.get<BudgetItem[]>(`/fiscal-years/${currentFY!.id}/budget-items`),
    enabled: !!currentFY,
  });

  const totalAllocated = items?.reduce((sum, i) => sum + i.allocated_amount, 0) ?? 0;
  const totalExecuted = items?.reduce((sum, i) => sum + i.executed_amount, 0) ?? 0;

  const handleExportBudget = async (): Promise<void> => {
    if (!currentFY) return;

    setIsExporting(true);
    try {
      await downloadExcel(`/exports/budget?fiscal_year_id=${currentFY.id}`, `presupuesto-${currentFY.year}.xlsx`);
    } catch {
      alert("No se pudo exportar el presupuesto a Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Header title="Presupuesto" />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Asignado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(totalAllocated)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Ejecutado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(totalExecuted)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(totalAllocated - totalExecuted)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Partidas Presupuestarias {currentFY?.year}</CardTitle>
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportBudget}
                disabled={!currentFY || isExporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exportando..." : "Exportar Excel"}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-12">N°</TableHead>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Mando</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead className="text-right">Asignado</TableHead>
                      <TableHead className="text-right">Ejecutado</TableHead>
                      <TableHead className="text-right">Disponible</TableHead>
                      <TableHead className="text-right">% Ejec.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item) => (
                      <TableRow
                        key={item.id}
                        className={cn(item.is_blocked && "bg-red-50", "cursor-pointer hover:bg-muted/50")}
                        onClick={() => router.push(`/presupuesto/${item.id}?fy=${currentFY!.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrafficLight color={item.status_color} />
                            {item.is_blocked && <Lock className="h-3 w-3 text-red-500" />}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{item.number}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {item.authority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              SOURCE_BADGE_CLASSES[item.fund_source] ?? SOURCE_BADGE_CLASSES.general
                            )}
                          >
                            {SOURCE_LABELS[item.fund_source] ?? item.fund_source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCLP(item.allocated_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCLP(item.executed_amount)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono",
                            item.available_amount < 0 && "text-red-600 font-bold"
                          )}
                        >
                          {formatCLP(item.available_amount)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono font-medium",
                            item.status_color === "red" && "text-red-600",
                            item.status_color === "yellow" && "text-yellow-600"
                          )}
                        >
                          {formatPercent(item.execution_percentage)}
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
    </>
  );
}
