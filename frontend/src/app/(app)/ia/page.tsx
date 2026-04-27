"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, FileSearch, History, Send, ShieldCheck, Wrench } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AiQueryRequest, AiQueryResponse, AiRunListItem, AiRunResponse, AiSource, PaginatedResponse } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTED_QUESTIONS = [
  "Que partidas estan en rojo?",
  "Que gastos pendientes de aprobacion hay?",
  "Que movimientos bancarios no estan conciliados?",
  "Que rendiciones estan pendientes?",
];

function findingClass(severity: string): string {
  if (severity === "critical" || severity === "blocked") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (severity === "warning") {
    return "border-yellow-200 bg-yellow-50 text-yellow-900";
  }
  return "border-border bg-muted/40 text-foreground";
}

function formatConfidence(confidence: number | null): string {
  if (confidence === null) return "Sin confianza";
  return `${Math.round(confidence * 100)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sin cierre";
  return new Date(value).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function sourceHref(source: AiSource): string | null {
  if (source.entity_type === "budget_item" && source.entity_id) {
    return `/presupuesto/${source.entity_id}`;
  }
  if (source.entity_type === "fiscal_year") {
    return "/presupuesto";
  }
  if (source.entity_type === "expense") {
    return "/gastos";
  }
  if (source.entity_type === "bank_account" || source.entity_type === "bank_transaction") {
    return "/banco";
  }
  if (source.entity_type === "rendition") {
    return "/rendiciones";
  }
  if (source.entity_type === "alert") {
    return "/alertas";
  }
  return null;
}

export default function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState(SUGGESTED_QUESTIONS[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AiQueryResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ["ai-runs"],
    queryFn: () => api.get<PaginatedResponse<AiRunListItem>>("/ai/runs?page_size=10"),
  });

  const runDetail = useQuery({
    queryKey: ["ai-run", selectedRunId],
    queryFn: () => api.get<AiRunResponse>(`/ai/runs/${selectedRunId}`),
    enabled: !!selectedRunId,
  });

  const query = useMutation({
    mutationFn: (payload: AiQueryRequest) => api.post<AiQueryResponse>("/ai/query", payload),
    onSuccess: (data) => {
      setLastResponse(data);
      setThreadId(data.thread_id);
      setSelectedRunId(data.run_id);
      queryClient.invalidateQueries({ queryKey: ["ai-runs"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    query.mutate({
      question: trimmedQuestion,
      year,
      thread_id: threadId,
    });
  }

  return (
    <>
      <Header title="Asistente IA" />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Preguntar a Tesoreria
                </CardTitle>
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Solo lectura
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                  <Textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Pregunta sobre presupuesto, gastos, banco, rendiciones o alertas"
                    className="min-h-28 resize-none"
                  />
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={year}
                      onChange={(event) => setYear(Number(event.target.value))}
                      aria-label="Ano fiscal"
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={query.isPending || question.trim().length < 3}
                    >
                      <Send className="h-4 w-4" />
                      Consultar
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant={question === item ? "default" : "outline"}
                      size="sm"
                      onClick={() => setQuestion(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Trazabilidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!lastResponse ? (
                <p className="text-sm text-muted-foreground">Sin corrida IA registrada.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Estado</span>
                    <Badge variant="secondary">{lastResponse.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Intencion</span>
                    <span className="font-medium">{lastResponse.intent}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Confianza</span>
                    <span className="font-medium">{formatConfidence(lastResponse.confidence)}</span>
                  </div>
                  <div>
                    <p className="mb-2 text-muted-foreground">Tools</p>
                    <div className="space-y-2">
                      {lastResponse.tool_calls.map((tool) => (
                        <div key={`${tool.name}-${tool.result_summary}`} className="rounded-md border p-2">
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-muted-foreground">{tool.result_summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {query.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {(query.error as Error).message}
          </div>
        )}

        {query.isPending && (
          <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            Analizando datos internos...
          </div>
        )}

        {lastResponse && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Respuesta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-base leading-7">{lastResponse.answer}</p>

                {lastResponse.proposed_actions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Acciones sugeridas</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {lastResponse.proposed_actions.map((action) => (
                        <div key={action.action_type} className="rounded-md border p-3 text-sm">
                          <p className="font-medium">{action.label}</p>
                          {action.requires_human_review && (
                            <p className="mt-1 text-muted-foreground">Requiere revision humana.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Hallazgos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lastResponse.findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin hallazgos relevantes.</p>
                  ) : (
                    <div className="space-y-2">
                      {lastResponse.findings.map((finding) => (
                        <div
                          key={`${finding.code}-${finding.message}`}
                          className={cn("rounded-md border p-3 text-sm", findingClass(finding.severity))}
                        >
                          <p className="font-medium">{finding.message}</p>
                          <p className="mt-1 text-xs opacity-80">{finding.code}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5" />
                    Evidencia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lastResponse.sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin fuentes internas asociadas.</p>
                  ) : (
                    <div className="space-y-2">
                      {lastResponse.sources.map((source) => {
                        const href = sourceHref(source);
                        const content = (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">{source.label}</p>
                              <Badge variant="outline">{source.entity_type}</Badge>
                            </div>
                            {source.detail && <p className="mt-1 text-muted-foreground">{source.detail}</p>}
                          </>
                        );

                        if (!href) {
                          return (
                            <div
                              key={`${source.entity_type}-${source.entity_id ?? source.label}`}
                              className="rounded-md border p-3 text-sm"
                            >
                              {content}
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={`${source.entity_type}-${source.entity_id ?? source.label}`}
                            href={href}
                            className="block rounded-md border p-3 text-sm transition-colors hover:border-primary hover:bg-muted/40"
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de corridas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando historial...</p>
              ) : !history.data || history.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay corridas IA registradas.</p>
              ) : (
                <div className="space-y-2">
                  {history.data.items.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-muted/40",
                        selectedRunId === run.id && "border-primary bg-muted/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{run.question ?? "Consulta sin pregunta registrada"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(run.created_at)} · #{shortId(run.id)}
                          </p>
                        </div>
                        <Badge variant={run.status === "bloqueado" ? "destructive" : "secondary"}>{run.status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{run.intent}</span>
                        <span>{formatConfidence(run.confidence)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle auditable</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedRunId ? (
                <p className="text-sm text-muted-foreground">Selecciona una corrida del historial.</p>
              ) : runDetail.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando detalle...</p>
              ) : !runDetail.data ? (
                <p className="text-sm text-muted-foreground">No se pudo cargar la corrida seleccionada.</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Estado</p>
                      <p className="mt-1 font-medium">{runDetail.data.status}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Intencion</p>
                      <p className="mt-1 font-medium">{runDetail.data.intent}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Confianza</p>
                      <p className="mt-1 font-medium">{formatConfidence(runDetail.data.confidence)}</p>
                    </div>
                  </div>

                  {runDetail.data.final_response && (
                    <div className="rounded-md border p-3">
                      <p className="mb-2 font-medium">Respuesta final</p>
                      <p className="text-muted-foreground">{runDetail.data.final_response}</p>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <AuditBlock title="Payload" value={runDetail.data.input_payload} />
                    <AuditBlock title="Usuario y permisos" value={runDetail.data.user_context} />
                    <AuditBlock title="Tools" value={runDetail.data.tool_calls} />
                    <AuditBlock title="Hallazgos" value={runDetail.data.findings} />
                    <AuditBlock title="Politicas" value={runDetail.data.policy_context} />
                    <AuditBlock title="Traza" value={runDetail.data.audit_trace} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function AuditBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 font-medium">{title}</p>
      <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
