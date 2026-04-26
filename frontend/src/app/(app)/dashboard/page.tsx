"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DashboardSummary } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCLP, formatPercent, cn, statusColor } from "@/lib/utils";
import { AlertTriangle, DollarSign, PieChart, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  if (isLoading || !data) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6">
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </>
    );
  }

  const topItems = [...data.budget_items]
    .sort((a, b) => b.execution_percentage - a.execution_percentage)
    .slice(0, 15);

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        {data.fiscal_year_status !== "approved" && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
            <AlertTriangle className="inline h-4 w-4 mr-2" />
            Presupuesto {data.fiscal_year} <strong>no aprobado</strong> por el Honorable Directorio General.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Presupuesto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(data.total_budget)}</p>
              <p className="text-xs text-muted-foreground">{formatPercent(data.execution_percentage)} ejecutado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disponible</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(data.total_available)}</p>
              <p className="text-xs text-muted-foreground">{formatPercent(100 - data.execution_percentage)} restante</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gastos del Mes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCLP(data.expenses_this_month)}</p>
              <p className="text-xs text-muted-foreground">{data.expenses_count_this_month} operaciones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Semáforo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-lg font-bold">{data.items_in_red}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="text-lg font-bold">{data.items_in_yellow}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-lg font-bold">{data.items_in_green}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{data.budget_items.length} partidas</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ejecución Presupuestaria (Top 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} layout="vertical" margin={{ left: 180, right: 20 }}>
                  <XAxis type="number" domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Ejecución"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="execution_percentage" radius={[0, 4, 4, 0]}>
                    {topItems.map((item) => (
                      <Cell key={item.id} fill={COLOR_MAP[item.status_color]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {data.recent_alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recent_alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 text-sm">
                    <div
                      className={cn(
                        "mt-1 h-2 w-2 rounded-full shrink-0",
                        alert.severity === "critical" ? "bg-red-500" : "bg-yellow-500"
                      )}
                    />
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
