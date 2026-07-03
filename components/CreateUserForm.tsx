"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

export type StaffUser = {
  id: string;
  email: string;
  name: string | null;
  role: "MANAGER" | "CASHIER";
  isActive: boolean;
  emailVerified?: Date | string | null;
};

type CreateUserFormProps = {
  users: StaffUser[];
  onCreate: (data: {
    email: string;
    name: string;
    password?: string;
    role: "MANAGER" | "CASHIER";
    sendInvite: boolean;
  }) => Promise<void>;
  onEdit: (id: string, data: { name?: string; email?: string; role?: "MANAGER" | "CASHIER" }) => Promise<void>;
  onToggleStatus: (id: string, isActive: boolean) => Promise<void>;
  onResetPassword: (
    id: string,
    password?: string
  ) => Promise<{ temporaryPassword?: string }>;
  onResendInvite: (id: string) => Promise<void>;
};

export function CreateUserForm({
  users,
  onCreate,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onResendInvite,
}: CreateUserFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MANAGER" | "CASHIER">("CASHIER");
  const [sendInvite, setSendInvite] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"MANAGER" | "CASHIER">("CASHIER");
  const [editLoading, setEditLoading] = useState(false);

  const resetTarget = users.find((u) => u.id === resetUserId);
  const editTarget = users.find((u) => u.id === editUserId);

  function isPendingInvite(user: StaffUser): boolean {
    return !user.emailVerified;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onCreate({
        email,
        name,
        password: sendInvite ? undefined : password,
        role,
        sendInvite,
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("CASHIER");
      setSendInvite(true);
      toast({
        title: sendInvite ? "Invitación enviada" : "Usuario creado",
        description: sendInvite
          ? "El usuario recibirá un correo para activar su cuenta."
          : "El usuario puede ingresar con la contraseña indicada.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    setResetLoading(true);
    try {
      const result = await onResetPassword(
        resetUserId,
        resetPassword.trim() ? resetPassword : undefined
      );
      if (result.temporaryPassword) {
        toast({
          title: "Contraseña temporal generada",
          description: `Entrégala al usuario: ${result.temporaryPassword}`,
          duration: 30000,
        });
      } else {
        toast({ title: "Contraseña restablecida", description: "El usuario deberá cambiarla al ingresar." });
      }
      setResetUserId(null);
      setResetPassword("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo restablecer",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  }

  function openEdit(user: StaffUser) {
    setEditUserId(user.id);
    setEditName(user.name ?? "");
    setEditEmail(user.email);
    setEditRole(user.role);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUserId) return;
    setEditLoading(true);
    try {
      await onEdit(editUserId, {
        name: editName,
        email: editEmail,
        role: editRole,
      });
      toast({ title: "Usuario actualizado" });
      setEditUserId(null);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo editar",
        variant: "destructive",
      });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleResendInvite(id: string) {
    try {
      await onResendInvite(id);
      toast({ title: "Invitación reenviada", description: "Revisa el correo del usuario." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo reenviar",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <h3 className="font-display text-lg font-semibold">Crear usuario staff</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-email">Correo</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-name">Nombre</Label>
          <Input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Enviar invitación por correo (recomendado)
          </label>
          <p className="text-xs text-muted-foreground">
            El usuario activará su cuenta y elegirá su contraseña desde el enlace del correo.
          </p>
        </div>
        {!sendInvite && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="staff-password">Contraseña temporal</Label>
            <Input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "MANAGER" | "CASHIER")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASHIER">Cajero</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creando..." : sendInvite ? "Crear y enviar invitación" : "Crear usuario"}
          </Button>
        </div>
      </form>

      {editTarget && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Editar usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSubmit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Correo</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as "MANAGER" | "CASHIER")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASHIER">Cajero</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditUserId(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {resetTarget && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Restablecer contraseña</CardTitle>
            <p className="text-sm text-muted-foreground">
              {resetTarget.name ?? resetTarget.email} — deberá cambiarla al ingresar.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="reset-pwd">Nueva contraseña temporal</Label>
                <Input
                  id="reset-pwd"
                  type="password"
                  placeholder="Opcional — dejar vacío para generar"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={8}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResetUserId(null);
                    setResetPassword("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetLoading}>
                  {resetLoading ? "Guardando..." : "Generar / Guardar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.name ?? "—"}</TableCell>
                <TableCell>{user.role === "MANAGER" ? "Manager" : "Cajero"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={user.isActive ? "success" : "muted"}>
                      {user.isActive ? "Activo" : "Desactivado"}
                    </Badge>
                    {isPendingInvite(user) && (
                      <Badge variant="outline">Invitación pendiente</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                      Editar
                    </Button>
                    {isPendingInvite(user) && (
                      <Button variant="outline" size="sm" onClick={() => handleResendInvite(user.id)}>
                        Reenviar invitación
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setResetUserId(user.id);
                        setResetPassword("");
                      }}
                    >
                      Restablecer contraseña
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleStatus(user.id, !user.isActive)}
                    >
                      {user.isActive ? "Desactivar" : "Reactivar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
