"use client";

import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export function Header({ title }: { title: string }) {
  const { data } = useQuery({
    queryKey: ["alerts-unread"],
    queryFn: () => api.get<{ count: number }>("/alerts/unread-count"),
    refetchInterval: 60000,
  });

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="relative inline-flex items-center justify-center rounded-md p-2 hover:bg-muted transition-colors">
          <Bell className="h-4 w-4" />
          {data && data.count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {data.count}
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}
