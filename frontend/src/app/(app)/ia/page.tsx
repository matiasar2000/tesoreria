"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Bot, FileSearch, Send, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { canUseAiAssistant } from "@/lib/permissions";
import type { AiQueryRequest, AiQueryResponse, AiSource } from "@/types/api";
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
  const router = useRouter();
  const { user, loading } = useAuth();
  const [question, setQuestion] = useState(SUGGESTED_QUESTIONS[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AiQueryResponse | null>(null);
  const isAllowed = canUseAiAssistant(user?.role);

  const query = useMutation({
    mutationFn: (payload: AiQueryRequest) => api.post<AiQueryResponse>("/ai/query", payload),
    onSuccess: (data) => {
      setLastResponse(data);
      setThreadId(data.thread_id);
    },
  });

  useEffect(() => {
    if (!loading && !isAllowed) {
      router.replace("/dashboard");
    }
  }, [isAllowed, loading, router]);

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

  if (loading || !isAllowed) {
    return null;
  }

  return (
    <>
      <Header title="Asistente IA" />
      <div className="p-6 space-y-6">
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Respuesta</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={lastResponse.status === "bloqueado" ? "destructive" : "secondary"}>
                      {lastResponse.status}
                    </Badge>
                    <Badge variant="outline">{formatConfidence(lastResponse.confidence)}</Badge>
                  </div>
                </div>
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
      </div>
    </>
  );
}
