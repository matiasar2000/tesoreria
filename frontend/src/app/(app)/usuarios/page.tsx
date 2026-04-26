"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Company, User } from "@/types/api";
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
import { formatDate } from "@/lib/utils";
import { Pencil, Plus, Power, PowerOff } from "lucide-react";

type UserRole =
  | "tesorero"
  | "superintendente"
  | "equipo_tesoreria"
  | "director_compania"
  | "directorio";

interface RoleOption {
  value: UserRole;
  label: string;
}

interface UserFormState {
  full_name: string;
  email: string;
  password: string;
  role: UserRole | "";
  company_id: string;
  area: string;
}

interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  area: string | null;
}

interface UpdateUserPayload {
  full_name?: string;
  role?: UserRole;
  company_id?: string | null;
  area?: string | null;
  is_active?: boolean;
}

interface UpdateUserVariables {
  id: string;
  data: UpdateUserPayload;
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: "tesorero", label: "Tesorero" },
  { value: "superintendente", label: "Superintendente" },
  { value: "equipo_tesoreria", label: "Equipo Tesorería" },
  { value: "director_compania", label: "Director Compañía" },
  { value: "directorio", label: "Directorio" },
];

const ROLE_LABELS: Record<UserRole, string> = ROLE_OPTIONS.reduce(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  {} as Record<UserRole, string>
);

const COMPANY_NONE_VALUE = "__sin_compania__";

function getEmptyForm(): UserFormState {
  return {
    full_name: "",
    email: "",
    password: "",
    role: "",
    company_id: "",
    area: "",
  };
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role;
}

function getCreatedAtDate(createdAt: string): string {
  return formatDate(createdAt.split("T")[0]);
}

export default function UsuariosPage(): ReactElement {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(getEmptyForm);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const {
    data: users,
    isLoading: usersLoading,
    isError: usersHasError,
    error: usersError,
  } = useQuery<User[], Error>({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[], Error>({
    queryKey: ["companies"],
    queryFn: () => api.get<Company[]>("/companies"),
  });

  const createUser = useMutation({
    mutationFn: (data: CreateUserPayload) => api.post<User>("/users", data),
    onSuccess: () => {
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: UpdateUserVariables) => api.put<User>(`/users/${id}`, data),
    onSuccess: () => {
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const toggleUserStatus = useMutation({
    mutationFn: (user: User) => {
      const data: UpdateUserPayload = { is_active: !user.is_active };
      return api.put<User>(`/users/${user.id}`, data);
    },
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const userList = users ?? [];
  const companyList = companies ?? [];
  const isEditing = editingUser !== null;
  const isSaving = createUser.isPending || updateUser.isPending;

  function resetDialog(): void {
    setEditingUser(null);
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
    setEditingUser(null);
    setFormError("");
    setIsDialogOpen(true);
  }

  function handleEditClick(user: User): void {
    setEditingUser(user);
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: "",
      role: user.role as UserRole,
      company_id: user.company_id ?? "",
      area: user.area ?? "",
    });
    setFormError("");
    setIsDialogOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError("");
    setActionError("");

    const fullName = form.full_name.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    const area = form.area.trim();

    if (!fullName) {
      setFormError("El nombre completo es obligatorio.");
      return;
    }

    if (!form.role) {
      setFormError("El rol es obligatorio.");
      return;
    }

    if (!isEditing && !email) {
      setFormError("El email es obligatorio.");
      return;
    }

    if (!isEditing && !password) {
      setFormError("La contraseña es obligatoria.");
      return;
    }

    if (editingUser) {
      const data: UpdateUserPayload = {
        full_name: fullName,
        role: form.role,
        company_id: form.company_id || null,
        area: area || null,
      };
      updateUser.mutate({ id: editingUser.id, data });
      return;
    }

    const data: CreateUserPayload = {
      full_name: fullName,
      email,
      password,
      role: form.role,
      company_id: form.company_id || null,
      area: area || null,
    };
    createUser.mutate(data);
  }

  return (
    <>
      <Header title="Usuarios" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {userList.length} usuarios registrados
          </p>
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>

        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        <Card>
          <CardContent className="pt-6">
            {usersLoading ? (
              <p className="text-muted-foreground">Cargando usuarios...</p>
            ) : usersHasError ? (
              <p className="text-sm text-red-600">
                No se pudieron cargar los usuarios: {usersError.message}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha creación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay usuarios registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {userList.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{user.area || "Sin área"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              user.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }
                          >
                            {user.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {getCreatedAtDate(user.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditClick(user)}
                              title="Editar usuario"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleUserStatus.mutate(user)}
                              disabled={
                                toggleUserStatus.isPending &&
                                toggleUserStatus.variables?.id === user.id
                              }
                              title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
                            >
                              {user.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Actualiza los datos del usuario seleccionado."
                : "Completa los datos para crear un nuevo usuario."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
            </div>

            {!isEditing && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.role || null}
                onValueChange={(value) => {
                  if (value) {
                    setForm({ ...form, role: value });
                  }
                }}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar rol..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Compañía</Label>
              <Select
                value={form.company_id || COMPANY_NONE_VALUE}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    company_id: value === COMPANY_NONE_VALUE || value === null ? "" : value,
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
              <Label htmlFor="area">Área</Label>
              <Input
                id="area"
                value={form.area}
                onChange={(event) => setForm({ ...form, area: event.target.value })}
                placeholder="Opcional"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
