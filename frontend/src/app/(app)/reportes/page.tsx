"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ReportsSummary } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCLP } from "@/lib/utils";
import { DollarSign, TrendingUp, Users, Hash } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

const PIE_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#eab308", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899", "#14b8a6", "#64748b",
];

const STATUS_COLORS: Record<string, string> = {
  approved: "#22c55e",
  pending_review: "#eab308",
  pending_approval: "#f97316",
  pending_directorio: "#8b5cf6",
  rejected: "#ef4444",
  voided: "#94a3b8",
  draft: "#64748b",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clpFormatter(value: any) {
  return [formatCLP(Number(value)), "Monto"];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clpFormatterSingle(value: any) {
  return [formatCLP(Number(value))];
}

export default function ReportesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportsSummary>("/reports/summary"),
  });

  if (isLoading || !data) {
    return (
      <>
        <Header title="Reportes" />
        <div className="p-6">
          <p className="text-muted-foreground">Cargando reportes...</p>
        </div>
      </>
    );
  }

  const topExecution = [...data.budget_execution]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 15);

  const budgetComparison = data.budget_execution.map((item) => ({
    name: `${item.item_number}`,
    asignado: item.allocated,
    ejecutado: item.executed,
  }));

  return (
    <>
      <Header title="Reportes" />
      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ejecución General
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.execution_percentage}%</p>
              <p className="text-xs text-muted-foreground">
                {formatCLP(data.total_executed)} de {formatCLP(data.total_budget)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Disponible
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCLP(data.total_available)}</p>
              <p className="text-xs text-muted-foreground">
                {(100 - data.execution_percentage).toFixed(1)}% restante
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Gastos Aprobados
              </CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.total_expenses_count}</p>
              <p className="text-xs text-muted-foreground">
                Promedio: {formatCLP(data.avg_expense_amount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compañías con Gastos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.company_expenses.length}</p>
              <p className="text-xs text-muted-foreground">
                de las compañías registradas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendencia Mensual de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly_expenses} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month_name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCLP(v)} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={clpFormatter}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Budget execution bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ejecución por Partida (Top 15)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topExecution} layout="vertical" margin={{ left: 160, right: 20 }}>
                    <XAxis type="number" domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      type="category"
                      dataKey="item_name"
                      width={150}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Ejecución"]}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                      {topExecution.map((item, i) => (
                        <Cell key={i} fill={COLOR_MAP[item.status_color]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Company pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución por Compañía</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[450px]">
                {data.company_expenses.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.company_expenses}
                        dataKey="total"
                        nameKey="company_name"
                        cx="50%"
                        cy="45%"
                        outerRadius={130}
                        label={({ name, percent }: any) =>
                          `${name}: ${(percent * 100).toFixed(1)}%`
                        }
                        labelLine={{ stroke: "#94a3b8" }}
                      >
                        {data.company_expenses.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={clpFormatter} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Sin datos de compañías
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Presupuesto Asignado vs Ejecutado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetComparison} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} label={{ value: "N° Partida", position: "insideBottom", offset: -5 }} />
                  <YAxis tickFormatter={(v) => formatCLP(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={clpFormatterSingle} />
                  <Legend />
                  <Bar dataKey="asignado" fill="#93c5fd" name="Asignado" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="ejecutado" fill="#3b82f6" name="Ejecutado" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top suppliers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Proveedores</CardTitle>
            </CardHeader>
            <CardContent>
              {data.top_suppliers.length > 0 ? (
                <div className="space-y-3">
                  {data.top_suppliers.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-5 text-right">{i + 1}.</span>
                        <span className="font-medium truncate max-w-[200px]">{s.supplier_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-medium">{formatCLP(s.total)}</span>
                        <span className="text-muted-foreground ml-2">({s.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Sin datos de proveedores</p>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gastos por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {data.status_breakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.status_breakdown} margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (name === "total") return [formatCLP(Number(value)), "Monto"];
                          return [value, "Cantidad"];
                        }}
                      />
                      <Bar dataKey="count" name="Cantidad" radius={[4, 4, 0, 0]}>
                        {data.status_breakdown.map((item, i) => (
                          <Cell key={i} fill={STATUS_COLORS[item.status] || "#64748b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
