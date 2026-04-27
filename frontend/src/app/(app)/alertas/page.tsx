"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Alert } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bell, BellOff, CheckCheck } from "lucide-react";

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertasPage() {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", showAll],
    queryFn: () => api.get<Alert[]>(`/alerts${showAll ? "" : "?unread_only=true"}`),
  });

  const markRead = useMutation({
    mutationFn: (alertId: string) => api.patch(`/alerts/${alertId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alerts-unread"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/alerts/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alerts-unread"] });
    },
  });

  const unreadCount = alerts?.filter((a) => !a.read).length ?? 0;

  return (
    <>
      <Header title="Alertas" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              variant={showAll ? "outline" : "default"}
              size="sm"
              onClick={() => setShowAll(false)}
            >
              <Bell className="h-4 w-4 mr-2" />
              No leídas ({unreadCount})
            </Button>
            <Button
              variant={showAll ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAll(true)}
            >
              Todas
            </Button>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-muted-foreground">Cargando alertas...</p>
            ) : !alerts || alerts.length === 0 ? (
              <div className="text-center py-12">
                <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {showAll ? "No hay alertas." : "No hay alertas sin leer."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border transition-colors",
                      !alert.read && "bg-blue-50/50 border-blue-200"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-1 h-3 w-3 rounded-full shrink-0",
                        alert.severity === "critical" ? "bg-red-500" : "bg-yellow-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn("font-medium", !alert.read && "font-semibold")}>
                            {alert.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</p>
                          <div className="flex items-center gap-2 mt-1 justify-end">
                            <Badge
                              variant={alert.severity === "critical" ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              {alert.severity === "critical" ? "Crítica" : "Advertencia"}
                            </Badge>
                            {!alert.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => markRead.mutate(alert.id)}
                                disabled={markRead.isPending}
                              >
                                Marcar leída
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
