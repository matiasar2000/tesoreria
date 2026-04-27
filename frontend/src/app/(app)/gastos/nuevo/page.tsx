"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BudgetItem, FiscalYear } from "@/types/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCLP } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

const RESTRICTED_SOURCES = new Set(["fiscal", "municipal"]);

const SOURCE_LABELS: Record<string, string> = {
  fiscal: "Subvención Fiscal",
  municipal: "Subvención Municipal",
  propio: "Fondos Propios",
  donacion: "Donación",
  general: "General",
};

const ASSET_CATEGORIES = [
  { value: "vehiculo", label: "VehÃ­culo" },
  { value: "herramienta", label: "Herramienta" },
  { value: "uniforme", label: "Uniforme" },
  { value: "equipamiento", label: "Equipamiento" },
  { value: "inmueble", label: "Inmueble" },
  { value: "mobiliario", label: "Mobiliario" },
  { value: "material_operativo", label: "Material Operativo" },
  { value: "otro", label: "Otro" },
];

const ASSET_CONDITIONS = [
  { value: "bueno", label: "Bueno" },
  { value: "regular", label: "Regular" },
  { value: "malo", label: "Malo" },
  { value: "baja", label: "Baja" },
];

export default function NuevoGastoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: fiscalYears } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.get<FiscalYear[]>("/fiscal-years"),
  });
  const currentFY = fiscalYears?.[0];

  const { data: items } = useQuery({
    queryKey: ["budget-items", currentFY?.id],
    queryFn: () => api.get<BudgetItem[]>(`/fiscal-years/${currentFY!.id}/budget-items`),
    enabled: !!currentFY,
  });

  const [form, setForm] = useState({
    budget_item_id: "",
    amount: "",
    description: "",
    supplier_name: "",
    supplier_rut: "",
    invoice_number: "",
    expense_date: new Date().toISOString().split("T")[0],
    authorized_by_superintendent: false,
    notes: "",
    create_inventory_asset: false,
    asset_name: "",
    asset_category: "",
    asset_description: "",
    asset_serial_number: "",
    asset_condition: "bueno",
    asset_location: "",
    asset_notes: "",
  });
  const [error, setError] = useState("");

  const selectedItem = items?.find((i) => i.id === form.budget_item_id);
  const amount = parseFloat(form.amount) || 0;
  const exceedsBudget = selectedItem ? amount > selectedItem.available_amount : false;
  const requiresQuotations = amount > 1_000_000;
  const hasRestrictedFundSource = selectedItem ? RESTRICTED_SOURCES.has(selectedItem.fund_source) : false;
  const selectedFundSourceLabel = selectedItem
    ? SOURCE_LABELS[selectedItem.fund_source] ?? selectedItem.fund_source
    : "";
  const imm = currentFY?.imm_value ?? 500_000;
  const superintendentLimit = imm * 5;
  const exceedsSuperintendentLimit = form.authorized_by_superintendent && amount > superintendentLimit;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push("/gastos");
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate({
      budget_item_id: form.budget_item_id,
      amount,
      description: form.description,
      supplier_name: form.supplier_name || null,
      supplier_rut: form.supplier_rut || null,
      invoice_number: form.invoice_number || null,
      expense_date: form.expense_date,
      authorized_by_superintendent: form.authorized_by_superintendent,
      notes: form.notes || null,
      create_inventory_asset: form.create_inventory_asset,
      inventory_asset: form.create_inventory_asset
        ? {
            name: form.asset_name,
            category: form.asset_category,
            description: form.asset_description || null,
            serial_number: form.asset_serial_number || null,
            current_condition: form.asset_condition,
            location: form.asset_location || null,
            notes: form.asset_notes || null,
          }
        : null,
    });
  };

  return (
    <>
      <Header title="Nuevo Gasto" />
      <div className="p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Partida presupuestaria</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.budget_item_id}
                  onChange={(e) => setForm({ ...form, budget_item_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar partida...</option>
                  {items?.map((item) => (
                    <option key={item.id} value={item.id} disabled={item.is_blocked}>
                      #{item.number} - {item.name} (Disp: {formatCLP(item.available_amount)})
                      {item.is_blocked ? " [BLOQUEADA]" : ""}
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <p className="text-xs text-muted-foreground">
                    Disponible: {formatCLP(selectedItem.available_amount)} de {formatCLP(selectedItem.allocated_amount)}
                  </p>
                )}
                {hasRestrictedFundSource && (
                  <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    Esta partida usa fondos de {selectedFundSourceLabel}. Documente la justificación del gasto en el
                    campo de notas.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Monto ($)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  required
                  min="1"
                />
                {exceedsBudget && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Monto excede el saldo disponible de la partida.
                  </p>
                )}
                {requiresQuotations && (
                  <p className="text-sm text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Monto &gt; $1.000.000: requiere 3 cotizaciones (Circular N°9).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Fecha del gasto</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción del gasto..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Input
                    value={form.supplier_name}
                    onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RUT proveedor</Label>
                  <Input
                    value={form.supplier_rut}
                    onChange={(e) => setForm({ ...form, supplier_rut: e.target.value })}
                    placeholder="12.345.678-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>N° Factura</Label>
                <Input
                  value={form.invoice_number}
                  onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                  placeholder="Número de factura"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="superintendent"
                  checked={form.authorized_by_superintendent}
                  onChange={(e) => setForm({ ...form, authorized_by_superintendent: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="superintendent" className="text-sm font-normal">
                  Autorizado directamente por el Superintendente
                </Label>
              </div>
              {exceedsSuperintendentLimit && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Gasto de {formatCLP(amount)} supera el límite del Superintendente ({formatCLP(superintendentLimit)}).
                  Se generará una alerta al Directorio.
                </p>
              )}

              <div className="space-y-4 rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create_inventory_asset"
                    checked={form.create_inventory_asset}
                    onChange={(e) => setForm({ ...form, create_inventory_asset: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="create_inventory_asset" className="text-sm font-normal">
                    Registrar bien inventariable asociado a este gasto
                  </Label>
                </div>

                {form.create_inventory_asset && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nombre del bien</Label>
                        <Input
                          value={form.asset_name}
                          onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                          placeholder="Ej: Radio portÃ¡til VHF"
                          required={form.create_inventory_asset}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CategorÃ­a</Label>
                        <select
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={form.asset_category}
                          onChange={(e) => setForm({ ...form, asset_category: e.target.value })}
                          required={form.create_inventory_asset}
                        >
                          <option value="">Seleccionar categorÃ­a...</option>
                          {ASSET_CATEGORIES.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>NÃºmero de serie</Label>
                        <Input
                          value={form.asset_serial_number}
                          onChange={(e) => setForm({ ...form, asset_serial_number: e.target.value })}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CondiciÃ³n inicial</Label>
                        <select
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={form.asset_condition}
                          onChange={(e) => setForm({ ...form, asset_condition: e.target.value })}
                        >
                          {ASSET_CONDITIONS.map((condition) => (
                            <option key={condition.value} value={condition.value}>
                              {condition.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>UbicaciÃ³n</Label>
                      <Input
                        value={form.asset_location}
                        onChange={(e) => setForm({ ...form, asset_location: e.target.value })}
                        placeholder="Ej: Bodega comandancia"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>DescripciÃ³n del bien</Label>
                      <Textarea
                        value={form.asset_description}
                        onChange={(e) => setForm({ ...form, asset_description: e.target.value })}
                        placeholder="Detalle tÃ©cnico o alcance del bien..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notas de inventario</Label>
                      <Textarea
                        value={form.asset_notes}
                        onChange={(e) => setForm({ ...form, asset_notes: e.target.value })}
                        placeholder="Notas patrimoniales o de custodia..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending || exceedsBudget}>
                  {mutation.isPending ? "Registrando..." : "Registrar Gasto"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/gastos")}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
