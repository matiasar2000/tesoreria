"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AnnualBalance, BudgetExecution, QuarterlyBalance, ReportsSummary } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCLP, formatDate } from "@/lib/utils";
import { DollarSign, TrendingUp, Users, Hash, Download } from "lucide-react";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clpFormatter(value: any) {
  return [formatCLP(Number(value)), "Monto"];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clpFormatterSingle(value: any) {
  return [formatCLP(Number(value))];
}

function ExecutionTable({ items }: { items: BudgetExecution[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">N</TableHead>
          <TableHead>Partida</TableHead>
          <TableHead className="text-right">Asignado</TableHead>
          <TableHead className="text-right">Ejecutado</TableHead>
          <TableHead className="text-right">Disponible</TableHead>
          <TableHead className="text-right">% Ejec.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              Sin gastos aprobados para el periodo.
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.item_number}>
              <TableCell className="font-mono">{item.item_number}</TableCell>
              <TableCell className="font-medium">{item.item_name}</TableCell>
              <TableCell className="text-right font-mono">{formatCLP(item.allocated)}</TableCell>
              <TableCell className="text-right font-mono">{formatCLP(item.executed)}</TableCell>
              <TableCell className="text-right font-mono">{formatCLP(item.available)}</TableCell>
              <TableCell className="text-right font-mono">{item.percentage.toFixed(1)}%</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function ReportesPage() {
  const [selectedQuarter, setSelectedQuarter] = useState("1");

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportsSummary>("/reports/summary"),
  });

  const reportYear = data?.fiscal_year ?? new Date().getFullYear();

  const {
    data: quarterlyBalance,
    isLoading: isQuarterlyLoading,
    isError: isQuarterlyError,
  } = useQuery({
    queryKey: ["reports", "quarterly", reportYear, selectedQuarter],
    queryFn: () =>
      api.get<QuarterlyBalance>(`/reports/quarterly?year=${reportYear}&quarter=${selectedQuarter}`),
    enabled: Boolean(data),
  });

  const {
    data: annualBalance,
    isLoading: isAnnualLoading,
    isError: isAnnualError,
  } = useQuery({
    queryKey: ["reports", "annual", reportYear],
    queryFn: () => api.get<AnnualBalance>(`/reports/annual?year=${reportYear}`),
    enabled: Boolean(data),
  });

  const exportAnnual = useMutation({
    mutationFn: (year: number) =>
      downloadExcel(`/reports/annual/export?year=${year}`, `balance-anual-${year}.xlsx`),
    onError: () => {
      alert("No se pudo exportar el balance anual a Excel.");
    },
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
                      formatter={(value: unknown) => [`${Number(value).toFixed(1)}%`, "Ejecución"]}
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
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(1)}%`
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
                        formatter={(value: unknown, name: unknown) => {
                          if (name === "total") return [formatCLP(Number(value)), "Monto"];
                          return [String(value), "Cantidad"];
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

        <section className="space-y-4">
          <Tabs defaultValue="quarterly">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="quarterly">Balance Trimestral</TabsTrigger>
                <TabsTrigger value="annual">Balance Anual</TabsTrigger>
              </TabsList>
              <p className="text-sm text-muted-foreground">Ano fiscal {reportYear}</p>
            </div>

            <TabsContent value="quarterly" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Balance Trimestral</h2>
                  <p className="text-sm text-muted-foreground">
                    {quarterlyBalance
                      ? `${formatDate(quarterlyBalance.period_start)} - ${formatDate(quarterlyBalance.period_end)}`
                      : "Periodo trimestral"}
                  </p>
                </div>
                <Select value={selectedQuarter} onValueChange={(v: unknown) => setSelectedQuarter(String(v ?? "1"))}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Seleccionar trimestre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Enero / Marzo</SelectItem>
                    <SelectItem value="2">2 - Abril / Junio</SelectItem>
                    <SelectItem value="3">3 - Julio / Septiembre</SelectItem>
                    <SelectItem value="4">4 - Octubre / Diciembre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isQuarterlyLoading ? (
                <p className="text-sm text-muted-foreground">Cargando balance trimestral...</p>
              ) : isQuarterlyError || !quarterlyBalance ? (
                <p className="text-sm text-red-600">No se pudo cargar el balance trimestral.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{formatCLP(quarterlyBalance.total_income)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{formatCLP(quarterlyBalance.total_expenses)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Saldo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className={`text-2xl font-bold ${quarterlyBalance.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCLP(quarterlyBalance.balance)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Ejecucion</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{quarterlyBalance.execution_percentage.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">
                          de {formatCLP(quarterlyBalance.total_budget)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Gastos por Partida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ExecutionTable items={quarterlyBalance.expenses_by_item} />
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="annual" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Balance Anual</h2>
                  <p className="text-sm text-muted-foreground">Resumen al 31 de diciembre</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportAnnual.mutate(reportYear)}
                  disabled={!annualBalance || exportAnnual.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportAnnual.isPending ? "Exportando..." : "Exportar Excel"}
                </Button>
              </div>

              {isAnnualLoading ? (
                <p className="text-sm text-muted-foreground">Cargando balance anual...</p>
              ) : isAnnualError || !annualBalance ? (
                <p className="text-sm text-red-600">No se pudo cargar el balance anual.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Presupuesto</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{formatCLP(annualBalance.total_budget)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{formatCLP(annualBalance.total_income)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{formatCLP(annualBalance.total_expenses)}</p>
                        <p className="text-xs text-muted-foreground">
                          {annualBalance.execution_percentage.toFixed(1)}% ejecutado
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Saldo Final</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className={`text-2xl font-bold ${annualBalance.final_balance < 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCLP(annualBalance.final_balance)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Comparativo Trimestral</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Trimestre</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                              <TableHead className="text-right">Gastos</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                              <TableHead className="text-right">% Ejec.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {annualBalance.quarterly_summary.map((quarter) => (
                              <TableRow key={quarter.quarter}>
                                <TableCell className="font-medium">{quarter.quarter_label}</TableCell>
                                <TableCell className="text-right font-mono">{formatCLP(quarter.total_income)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCLP(quarter.total_expenses)}</TableCell>
                                <TableCell className="text-right font-mono">{formatCLP(quarter.balance)}</TableCell>
                                <TableCell className="text-right font-mono">{quarter.execution_percentage.toFixed(1)}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cuentas y Estados</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {annualBalance.bank_balances.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                                  Sin cuentas bancarias activas.
                                </TableCell>
                              </TableRow>
                            ) : (
                              annualBalance.bank_balances.map((account) => (
                                <TableRow key={account.account_name}>
                                  <TableCell className="font-medium">{account.account_name}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCLP(account.balance)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="rounded-md border p-3">
                            <p className="text-muted-foreground">Pendientes</p>
                            <p className="text-xl font-bold">{annualBalance.pending_expenses}</p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-muted-foreground">Aprobados</p>
                            <p className="text-xl font-bold">{annualBalance.approved_expenses}</p>
                          </div>
                          <div className="rounded-md border p-3">
                            <p className="text-muted-foreground">Anulados</p>
                            <p className="text-xl font-bold">{annualBalance.voided_expenses}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Ejecucion Anual por Partida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ExecutionTable items={annualBalance.expenses_by_item} />
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </>
  );
}
