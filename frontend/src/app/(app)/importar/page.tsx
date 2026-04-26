"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { FiscalYear } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";

interface ImportResult {
  rows_processed: number;
  rows_error: number;
  errors: string[];
}

export default function ImportarPage() {
  const queryClient = useQueryClient();
  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });
  const currentFY = fiscalYears?.[0];

  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [budgetResult, setBudgetResult] = useState<ImportResult | null>(null);
  const [expenseResult, setExpenseResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleImport = async (type: "budget" | "expenses", file: File) => {
    if (!currentFY) return;
    setLoading(type);
    setError("");
    try {
      const result = await api.upload<ImportResult>(`/import/${type}/${currentFY.id}`, file);
      if (type === "budget") setBudgetResult(result);
      else setExpenseResult(result);
      queryClient.invalidateQueries({ queryKey: ["budget-items"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Header title="Importar Datos" />
      <div className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Presupuesto desde Excel
            </CardTitle>
            <CardDescription>
              Formato: columnas N° | Nombre | Mando | Monto Asignado. Primera fila es encabezado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Archivo Excel (.xlsx)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBudgetFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={() => budgetFile && handleImport("budget", budgetFile)}
              disabled={!budgetFile || loading === "budget"}
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading === "budget" ? "Importando..." : "Importar Presupuesto"}
            </Button>
            {budgetResult && <ResultDisplay result={budgetResult} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Gastos desde Excel
            </CardTitle>
            <CardDescription>
              Formato: columnas N° Partida | Monto | Descripción | Fecha | Proveedor. Primera fila es encabezado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Archivo Excel (.xlsx)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setExpenseFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={() => expenseFile && handleImport("expenses", expenseFile)}
              disabled={!expenseFile || loading === "expenses"}
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading === "expenses" ? "Importando..." : "Importar Gastos"}
            </Button>
            {expenseResult && <ResultDisplay result={expenseResult} />}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </>
  );
}

function ResultDisplay({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-md border p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span>{result.rows_processed} filas procesadas correctamente</span>
      </div>
      {result.rows_error > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            <span>{result.rows_error} filas con error</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
            {result.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
