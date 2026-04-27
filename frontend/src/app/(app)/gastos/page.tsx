"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Document as ExpenseDocument, PaginatedResponse, Expense, ApprovalStep, FiscalYear } from "@/types/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCLP, formatDate } from "@/lib/utils";
import { Ban, ChevronRight, Download, Eye, Package, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";

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

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  pending_review: { label: "En revision", variant: "outline" },
  pending_approval: { label: "Pendiente aprobacion", variant: "outline" },
  pending_directorio: { label: "Pendiente directorio", variant: "outline" },
  approved: { label: "Aprobado", variant: "default" },
  rejected: { label: "Rechazado", variant: "destructive" },
  voided: { label: "Anulado", variant: "secondary" },
  paid: { label: "Pagado", variant: "default" },
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-200 text-gray-700",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-400",
};

type StatusFilter = "all" | "pending_review" | "pending_approval" | "pending_directorio" | "approved" | "rejected" | "voided";

function ApprovalFlow({ steps }: { steps: ApprovalStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <TooltipProvider key={step.id}>
          <Tooltip>
            <TooltipTrigger render={<div className="flex items-center gap-1" />}>
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${STEP_STATUS_COLORS[step.status] || "bg-gray-200"}`}
                >
                  {step.step_order}
                </span>
                {i < steps.length - 1 && (
                  <span className="text-gray-300 text-xs">→</span>
                )}
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{step.label}</p>
              <p className="text-xs capitalize">{step.status === "pending" ? "Pendiente" : step.status === "approved" ? "Aprobado" : step.status === "rejected" ? "Rechazado" : "Omitido"}</p>
              {step.acted_by_name && (
                <p className="text-xs text-muted-foreground">Por: {step.acted_by_name}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function formatDocumentDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function GastosPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [documentExpense, setDocumentExpense] = useState<Expense | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const documentExpenseId = documentExpense?.id;

  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });

  const currentFY = fiscalYears?.[0];

  const queryParam = statusFilter === "all" ? "" : `&status=${statusFilter}`;
  const { data, isLoading } = useQuery({
    queryKey: ["expenses", statusFilter],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?page_size=50${queryParam}`),
  });

  const documents = useQuery({
    queryKey: ["expense-documents", documentExpenseId],
    queryFn: async () => {
      if (!documentExpenseId) return [];
      return api.get<ExpenseDocument[]>(`/expenses/${documentExpenseId}/documents`);
    },
    enabled: Boolean(documentExpenseId),
  });

  const advance = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/advance`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budget-items"] });
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const voidExpense = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budget-items"] });
    },
  });

  const uploadDocument = useMutation({
    mutationFn: ({ expenseId, file }: { expenseId: string; file: File }) =>
      api.upload<ExpenseDocument>(`/expenses/${expenseId}/documents`, file),
    onSuccess: (_document, variables) => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["expense-documents", variables.expenseId] });
    },
    onError: (error) => {
      setUploadError(getErrorMessage(error, "No se pudo subir el documento."));
    },
  });

  const deleteDocument = useMutation({
    mutationFn: (documentId: string) => api.delete<void>(`/documents/${documentId}`),
    onSuccess: () => {
      if (documentExpenseId) {
        queryClient.invalidateQueries({ queryKey: ["expense-documents", documentExpenseId] });
      }
    },
  });

  const handleDocumentDialogOpenChange = (open: boolean): void => {
    if (!open) {
      setDocumentExpense(null);
      setUploadError(null);
      setDownloadError(null);
    }
  };

  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !documentExpense) return;
    uploadDocument.mutate({ expenseId: documentExpense.id, file });
  };

  const handleDownloadDocument = async (attachedDocument: ExpenseDocument): Promise<void> => {
    setDownloadError(null);
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_URL}/documents/${attachedDocument.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail ?? "No se pudo descargar el documento.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = attachedDocument.original_filename;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadDocument = useMutation({
    mutationFn: handleDownloadDocument,
    onError: (error) => {
      setDownloadError(getErrorMessage(error, "No se pudo descargar el documento."));
    },
  });

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "pending_review", label: "En revision" },
    { value: "pending_approval", label: "Pendientes" },
    { value: "pending_directorio", label: "Directorio" },
    { value: "approved", label: "Aprobados" },
    { value: "rejected", label: "Rechazados" },
    { value: "voided", label: "Anulados" },
  ];

  const isPending = (status: string) =>
    status === "pending_review" || status === "pending_approval" || status === "pending_directorio";

  const handleExportExpenses = async (): Promise<void> => {
    if (!currentFY) return;

    const statusParam = statusFilter === "all" ? "" : `&status=${encodeURIComponent(statusFilter)}`;

    setIsExporting(true);
    try {
      await downloadExcel(`/exports/expenses?fiscal_year_id=${currentFY.id}${statusParam}`, `gastos-${currentFY.year}.xlsx`);
    } catch {
      alert("No se pudieron exportar los gastos a Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Header title="Gastos" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 flex-wrap">
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExpenses}
              disabled={!currentFY || isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar Excel"}
            </Button>
            <Link href="/gastos/nuevo">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Gasto
              </Button>
            </Link>
          </div>
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
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Partida</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Inventario</TableHead>
                      <TableHead>Flujo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                          <TableCell>
                            {expense.inventory_assets.length > 0 ? (
                              <Badge variant="outline" className="gap-1">
                                <Package className="h-3 w-3" />
                                {expense.inventory_assets.length}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ApprovalFlow steps={expense.approval_steps} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setDetailExpense(expense)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setDocumentExpense(expense)}
                                title="Documentos"
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                              {isPending(expense.status) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => advance.mutate(expense.id)}
                                    disabled={advance.isPending}
                                    title="Aprobar paso actual"
                                  >
                                    <ChevronRight className="h-4 w-4" />
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
                              {(expense.status === "approved" || isPending(expense.status)) && (
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

      <Dialog open={!!documentExpense} onOpenChange={handleDocumentDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Documentos del gasto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {documentExpense && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="truncate text-sm font-medium">{documentExpense.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(documentExpense.expense_date)} - {formatCLP(documentExpense.amount)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Adjuntos</p>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={handleUploadChange}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!documentExpense || uploadDocument.isPending}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploadDocument.isPending ? "Subiendo..." : "Subir archivo"}
                </Button>
              </div>
            </div>

            {(uploadError || downloadError || documents.isError) && (
              <p className="text-sm text-red-600">
                {uploadError ?? downloadError ?? "No se pudieron cargar los documentos."}
              </p>
            )}

            {documents.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando documentos...</p>
            ) : documents.data?.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay documentos adjuntos.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.data?.map((attachedDocument) => (
                  <div
                    key={attachedDocument.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{attachedDocument.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachedDocument.file_size)} - {formatDocumentDate(attachedDocument.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => downloadDocument.mutate(attachedDocument)}
                        disabled={downloadDocument.isPending}
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteDocument.mutate(attachedDocument.id)}
                        disabled={deleteDocument.isPending}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailExpense} onOpenChange={() => setDetailExpense(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del Gasto</DialogTitle>
          </DialogHeader>
          {detailExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Descripcion</p>
                  <p className="font-medium">{detailExpense.description}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monto</p>
                  <p className="font-medium font-mono">{formatCLP(detailExpense.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Partida</p>
                  <p className="font-medium">{detailExpense.budget_item_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">{formatDate(detailExpense.expense_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Proveedor</p>
                  <p className="font-medium">{detailExpense.supplier_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Solicitado por</p>
                  <p className="font-medium">{detailExpense.requested_by_name || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Flujo de aprobacion</p>
                <div className="space-y-2">
                  {detailExpense.approval_steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center justify-between p-2 rounded-md text-sm ${STEP_STATUS_COLORS[step.status] || "bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Paso {step.step_order}:</span>
                        <span>{step.label}</span>
                      </div>
                      <div className="text-right text-xs">
                        {step.status === "pending" && "Pendiente"}
                        {step.status === "approved" && (
                          <span>{step.acted_by_name}{step.acted_at ? ` — ${formatDate(step.acted_at)}` : ""}</span>
                        )}
                        {step.status === "rejected" && (
                          <span className="text-red-700">Rechazado{step.acted_by_name ? ` por ${step.acted_by_name}` : ""}</span>
                        )}
                        {step.status === "skipped" && "Omitido"}
                      </div>
                    </div>
                  ))}
                  {detailExpense.approval_steps.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin flujo de aprobacion (gasto anterior al sistema multi-paso)</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Bienes vinculados</p>
                {detailExpense.inventory_assets.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Este gasto no tiene bienes de inventario asociados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detailExpense.inventory_assets.map((asset) => (
                      <div key={asset.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.category}
                            {asset.serial_number ? ` - Serie ${asset.serial_number}` : ""}
                          </p>
                        </div>
                        <Badge variant={asset.is_active ? "default" : "secondary"}>
                          {asset.current_condition}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detailExpense.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{detailExpense.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
