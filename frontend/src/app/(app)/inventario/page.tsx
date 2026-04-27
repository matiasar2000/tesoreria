"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Asset, AssetSummary, Company, Expense, PaginatedResponse } from "@/types/api";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCLP, formatDate } from "@/lib/utils";
import { Boxes, CircleDollarSign, PackageCheck, Pencil, Plus } from "lucide-react";

type AssetCategory =
  | "vehiculo"
  | "herramienta"
  | "uniforme"
  | "equipamiento"
  | "inmueble"
  | "mobiliario"
  | "material_operativo"
  | "otro";

type AssetCondition = "bueno" | "regular" | "malo" | "baja";

interface Option<TValue extends string> {
  value: TValue;
  label: string;
}

interface AssetFormState {
  name: string;
  description: string;
  category: AssetCategory | "";
  serial_number: string;
  company_id: string;
  acquisition_expense_id: string;
  acquisition_date: string;
  acquisition_value: string;
  current_condition: AssetCondition;
  location: string;
  is_active: boolean;
  notes: string;
}

interface AssetPayload {
  name: string;
  description: string | null;
  category: AssetCategory;
  serial_number: string | null;
  company_id: string | null;
  acquisition_expense_id: string | null;
  acquisition_date: string | null;
  acquisition_value: number | null;
  current_condition: AssetCondition;
  location: string | null;
  is_active: boolean;
  notes: string | null;
}

interface UpdateAssetVariables {
  id: string;
  data: AssetPayload;
}

const CATEGORY_OPTIONS: Option<AssetCategory>[] = [
  { value: "vehiculo", label: "Vehículo" },
  { value: "herramienta", label: "Herramienta" },
  { value: "uniforme", label: "Uniforme" },
  { value: "equipamiento", label: "Equipamiento" },
  { value: "inmueble", label: "Inmueble" },
  { value: "mobiliario", label: "Mobiliario" },
  { value: "material_operativo", label: "Material Operativo" },
  { value: "otro", label: "Otro" },
];

const CONDITION_OPTIONS: Option<AssetCondition>[] = [
  { value: "bueno", label: "Bueno" },
  { value: "regular", label: "Regular" },
  { value: "malo", label: "Malo" },
  { value: "baja", label: "Baja" },
];

const CATEGORY_LABELS: Record<AssetCategory, string> = CATEGORY_OPTIONS.reduce(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  {} as Record<AssetCategory, string>
);

const CONDITION_LABELS: Record<AssetCondition, string> = CONDITION_OPTIONS.reduce(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  {} as Record<AssetCondition, string>
);

const CONDITION_BADGE_CLASSES: Record<AssetCondition, string> = {
  bueno: "bg-green-100 text-green-700",
  regular: "bg-yellow-100 text-yellow-800",
  malo: "bg-red-100 text-red-700",
  baja: "bg-gray-100 text-gray-700",
};

const ALL_CATEGORIES_VALUE = "__todas__";
const ALL_CONDITIONS_VALUE = "__todas_las_condiciones__";
const COMPANY_NONE_VALUE = "__sin_compania__";
const EXPENSE_NONE_VALUE = "__sin_gasto__";

function getEmptyForm(): AssetFormState {
  return {
    name: "",
    description: "",
    category: "",
    serial_number: "",
    company_id: "",
    acquisition_expense_id: "",
    acquisition_date: "",
    acquisition_value: "",
    current_condition: "bueno",
    location: "",
    is_active: true,
    notes: "",
  };
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as AssetCategory] ?? category;
}

function getConditionLabel(condition: string): string {
  return CONDITION_LABELS[condition as AssetCondition] ?? condition;
}

function getConditionBadgeClass(condition: string): string {
  return CONDITION_BADGE_CLASSES[condition as AssetCondition] ?? "bg-gray-100 text-gray-700";
}

function buildAssetsPath(category: string, condition: string): string {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  if (condition) {
    params.set("condition", condition);
  }
  const query = params.toString();
  return query ? `/assets?${query}` : "/assets";
}

function buildPayload(form: AssetFormState): AssetPayload {
  const description = form.description.trim();
  const serialNumber = form.serial_number.trim();
  const location = form.location.trim();
  const notes = form.notes.trim();
  const value = form.acquisition_value.trim();

  return {
    name: form.name.trim(),
    description: description || null,
    category: form.category as AssetCategory,
    serial_number: serialNumber || null,
    company_id: form.company_id || null,
    acquisition_expense_id: form.acquisition_expense_id || null,
    acquisition_date: form.acquisition_date || null,
    acquisition_value: value ? Number(value) : null,
    current_condition: form.current_condition,
    location: location || null,
    is_active: form.is_active,
    notes: notes || null,
  };
}

export default function InventarioPage(): ReactElement {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetFormState>(getEmptyForm);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const {
    data: assets,
    isLoading: assetsLoading,
    isError: assetsHasError,
    error: assetsError,
  } = useQuery<Asset[], Error>({
    queryKey: ["assets", categoryFilter, conditionFilter],
    queryFn: () => api.get<Asset[]>(buildAssetsPath(categoryFilter, conditionFilter)),
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryHasError,
  } = useQuery<AssetSummary, Error>({
    queryKey: ["assets", "summary"],
    queryFn: () => api.get<AssetSummary>("/assets/summary"),
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[], Error>({
    queryKey: ["companies"],
    queryFn: () => api.get<Company[]>("/companies"),
  });

  const { data: expenseOptions, isLoading: expensesLoading } = useQuery<PaginatedResponse<Expense>, Error>({
    queryKey: ["expenses", "asset-link-options"],
    queryFn: () => api.get<PaginatedResponse<Expense>>("/expenses?page_size=100"),
  });

  const createAsset = useMutation({
    mutationFn: (data: AssetPayload) => api.post<Asset>("/assets", data),
    onSuccess: () => {
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateAsset = useMutation({
    mutationFn: ({ id, data }: UpdateAssetVariables) => api.put<Asset>(`/assets/${id}`, data),
    onSuccess: () => {
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const assetList = assets ?? [];
  const companyList = companies ?? [];
  const expenseList = expenseOptions?.items ?? [];
  const isEditing = editingAsset !== null;
  const isSaving = createAsset.isPending || updateAsset.isPending;
  const totalAssets = summary?.total_assets ?? 0;
  const totalValue = summary?.total_value ?? 0;
  const activeCount = summary?.active_count ?? 0;
  const bajaCount = summary?.baja_count ?? 0;

  function resetDialog(): void {
    setEditingAsset(null);
    setForm(getEmptyForm());
    setFormError("");
  }

  function closeDialog(): void {
    setIsDialogOpen(false);
    resetDialog();
  }

  function handleDialogOpenChange(open: boolean): void {
    setIsDialogOpen(open);
    if (!open) {
      resetDialog();
    }
  }

  function handleCreateClick(): void {
    setForm(getEmptyForm());
    setEditingAsset(null);
    setFormError("");
    setIsDialogOpen(true);
  }

  function handleEditClick(asset: Asset): void {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      description: asset.description ?? "",
      category: asset.category as AssetCategory,
      serial_number: asset.serial_number ?? "",
      company_id: asset.company_id ?? "",
      acquisition_expense_id: asset.acquisition_expense_id ?? "",
      acquisition_date: asset.acquisition_date ?? "",
      acquisition_value: asset.acquisition_value?.toString() ?? "",
      current_condition: asset.current_condition as AssetCondition,
      location: asset.location ?? "",
      is_active: asset.is_active,
      notes: asset.notes ?? "",
    });
    setFormError("");
    setIsDialogOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError("");
    setActionError("");

    const name = form.name.trim();
    const value = form.acquisition_value.trim();

    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    if (!form.category) {
      setFormError("La categoría es obligatoria.");
      return;
    }

    if (value && Number.isNaN(Number(value))) {
      setFormError("El valor de adquisición debe ser numérico.");
      return;
    }

    const data = buildPayload({ ...form, name });

    if (editingAsset) {
      updateAsset.mutate({ id: editingAsset.id, data });
      return;
    }

    createAsset.mutate(data);
  }

  return (
    <>
      <Header title="Inventario de Bienes" />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total bienes</p>
                  <p className="text-2xl font-bold">
                    {summaryLoading ? "..." : totalAssets}
                  </p>
                </div>
                <Boxes className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Valor total</p>
                  <p className="text-2xl font-bold font-mono">
                    {summaryLoading ? "..." : formatCLP(totalValue)}
                  </p>
                </div>
                <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold">
                    {summaryLoading ? "..." : activeCount}
                  </p>
                </div>
                <PackageCheck className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Bajas</p>
                <p className="text-2xl font-bold">
                  {summaryLoading ? "..." : bajaCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {summaryHasError && (
          <p className="text-sm text-red-600">No se pudo cargar el resumen del inventario.</p>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {CATEGORY_OPTIONS.map((category) => (
                <div key={category.value} className="min-w-32">
                  <p className="text-xs text-muted-foreground">{category.label}</p>
                  <p className="font-semibold">{summary?.by_category?.[category.value] ?? 0}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={categoryFilter || ALL_CATEGORIES_VALUE}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
              onValueChange={(v: any) =>
                setCategoryFilter(v === ALL_CATEGORIES_VALUE || v === null ? "" : v)
              }
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_VALUE}>Todas las categorías</SelectItem>
                {CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={conditionFilter || ALL_CONDITIONS_VALUE}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
              onValueChange={(v: any) =>
                setConditionFilter(v === ALL_CONDITIONS_VALUE || v === null ? "" : v)
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Todas las condiciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CONDITIONS_VALUE}>Todas las condiciones</SelectItem>
                {CONDITION_OPTIONS.map((condition) => (
                  <SelectItem key={condition.value} value={condition.value}>
                    {condition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Bien
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {assetList.length} bienes registrados
        </p>

        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        <Card>
          <CardContent className="pt-6">
            {assetsLoading ? (
              <p className="text-muted-foreground">Cargando bienes...</p>
            ) : assetsHasError ? (
              <p className="text-sm text-red-600">
                No se pudieron cargar los bienes: {assetsError.message}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Compañía</TableHead>
                      <TableHead>Condición</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No hay bienes registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {assetList.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{asset.name}</p>
                            {asset.acquisition_date && (
                              <p className="text-xs font-normal text-muted-foreground">
                                Adquirido el {formatDate(asset.acquisition_date)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(asset.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{asset.company_name ?? "Sin compañía"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={getConditionBadgeClass(asset.current_condition)}
                          >
                            {getConditionLabel(asset.current_condition)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm">
                          {asset.acquisition_expense_description ?? "Sin gasto asociado"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {asset.acquisition_value !== null ? formatCLP(asset.acquisition_value) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{asset.location || "Sin ubicación"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditClick(asset)}
                            title="Editar bien"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Bien" : "Nuevo Bien"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Actualiza los datos del bien seleccionado."
                : "Completa los datos para crear un nuevo bien."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={form.category || null}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
                  onValueChange={(v: any) => {
                    if (v) {
                      setForm({ ...form, category: v });
                    }
                  }}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar categoría..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Compañía</Label>
                <Select
                  value={form.company_id || COMPANY_NONE_VALUE}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
                  onValueChange={(v: any) =>
                    setForm({
                      ...form,
                      company_id: v === COMPANY_NONE_VALUE || v === null ? "" : v,
                    })
                  }
                  disabled={companiesLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={companiesLoading ? "Cargando compañías..." : "Sin compañía"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COMPANY_NONE_VALUE}>Sin compañía</SelectItem>
                    {companyList.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        #{company.number} - {company.name}
                        {!company.is_active ? " (inactiva)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Condición</Label>
                <Select
                  value={form.current_condition}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
                  onValueChange={(v: any) => {
                    if (v) {
                      setForm({ ...form, current_condition: v });
                    }
                  }}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar condición..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value}>
                        {condition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={form.is_active ? "true" : "false"}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
                  onValueChange={(v: any) => {
                    if (v) {
                      setForm({ ...form, is_active: v === "true" });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar estado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Activo</SelectItem>
                    <SelectItem value="false">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gasto de adquisicion</Label>
              <Select
                value={form.acquisition_expense_id || EXPENSE_NONE_VALUE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Select requiere value amplio en este wrapper.
                onValueChange={(v: any) => {
                  if (v === EXPENSE_NONE_VALUE || v === null) {
                    setForm({ ...form, acquisition_expense_id: "" });
                    return;
                  }

                  const selectedExpense = expenseList.find((expense) => expense.id === v);
                  setForm({
                    ...form,
                    acquisition_expense_id: v,
                    company_id: form.company_id || selectedExpense?.company_id || "",
                    acquisition_date: form.acquisition_date || selectedExpense?.expense_date || "",
                    acquisition_value: form.acquisition_value || selectedExpense?.amount.toString() || "",
                  });
                }}
                disabled={expensesLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={expensesLoading ? "Cargando gastos..." : "Sin gasto asociado"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EXPENSE_NONE_VALUE}>Sin gasto asociado</SelectItem>
                  {expenseList.map((expense) => (
                    <SelectItem key={expense.id} value={expense.id}>
                      {expense.description} - {formatCLP(expense.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serial_number">Número de serie</Label>
                <Input
                  id="serial_number"
                  value={form.serial_number}
                  onChange={(event) => setForm({ ...form, serial_number: event.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acquisition_date">Fecha adquisición</Label>
                <Input
                  id="acquisition_date"
                  type="date"
                  value={form.acquisition_date}
                  onChange={(event) => setForm({ ...form, acquisition_date: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acquisition_value">Valor adquisición</Label>
                <Input
                  id="acquisition_value"
                  type="number"
                  min="0"
                  step="1"
                  value={form.acquisition_value}
                  onChange={(event) => setForm({ ...form, acquisition_value: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Opcional"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear bien"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
