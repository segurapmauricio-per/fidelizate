"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { LogOut, RefreshCw, KeyRound } from "lucide-react";

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  rewardAt: number;
  ghlPurchaseWebhookUrl: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { customers: number; users: number };
};

const emptyForm = {
  name: "",
  slug: "",
  primaryColor: "#e63946",
  rewardAt: "10",
  ghlPurchaseWebhookUrl: "",
  ghlRedeemWebhookUrl: "",
  managerEmail: "",
  managerName: "",
  managerPassword: "",
};

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sendInvite, setSendInvite] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/businesses");
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setBusinesses(data.businesses);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        rewardAt: Number(form.rewardAt),
        sendInvite,
        ...(sendInvite ? {} : { managerPassword: form.managerPassword }),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error ?? "No se pudo crear el negocio" });
      return;
    }

    toast({
      title: "Negocio creado",
      description: sendInvite
        ? `${form.name} creado. El manager recibirá un correo de activación.`
        : `${form.name} y su manager quedaron listos.`,
    });
    setForm(emptyForm);
    setSendInvite(true);
    load();
  }

  async function toggleStatus(id: string, isActive: boolean) {
    const res = await fetch(`/api/businesses/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) load();
  }

  async function testWebhook(id: string) {
    const res = await fetch(`/api/businesses/${id}/test-webhook`, { method: "POST" });
    const data = await res.json();
    toast({
      title: res.ok ? "Ping enviado" : "Error",
      description: res.ok ? "GHL recibió el payload de prueba." : data.error ?? "Falló el ping",
    });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Panel maestro
            </p>
            <h1 className="font-display text-2xl font-bold">Negocios de la agencia</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/cambiar-contrasena">
                <KeyRound className="mr-2 h-4 w-4" />
                Contraseña
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-4 py-8">
        <form onSubmit={handleCreate} className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-display text-lg font-semibold">Crear negocio cliente</h2>
            <p className="text-sm text-muted-foreground">
              Configura el webhook de la subcuenta GHL y el manager inicial.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
              placeholder="ferreteria-tanzy"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rewardAt">Sellos para premio</Label>
            <Input
              id="rewardAt"
              type="number"
              min={2}
              max={50}
              value={form.rewardAt}
              onChange={(e) => set("rewardAt", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Color primario</Label>
            <Input
              id="primaryColor"
              type="color"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="h-10 w-full"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="webhook">Webhook de compra GHL (subcuenta)</Label>
            <Input
              id="webhook"
              type="url"
              value={form.ghlPurchaseWebhookUrl}
              onChange={(e) => set("ghlPurchaseWebhookUrl", e.target.value)}
              placeholder="https://services.leadconnectorhq.com/hooks/.../webhook-trigger/..."
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="redeemWebhook">
              Webhook de canje de premio GHL <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="redeemWebhook"
              type="url"
              value={form.ghlRedeemWebhookUrl}
              onChange={(e) => set("ghlRedeemWebhookUrl", e.target.value)}
              placeholder="https://services.leadconnectorhq.com/hooks/.../webhook-trigger/..."
            />
          </div>

          <div className="sm:col-span-2 mt-2 border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Manager inicial</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerName">Nombre del manager</Label>
            <Input
              id="managerName"
              value={form.managerName}
              onChange={(e) => set("managerName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerEmail">Correo del manager</Label>
            <Input
              id="managerEmail"
              type="email"
              value={form.managerEmail}
              onChange={(e) => set("managerEmail", e.target.value)}
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
              Enviar invitación por correo al manager (recomendado)
            </label>
          </div>
          {!sendInvite && (
            <div className="space-y-2">
              <Label htmlFor="managerPassword">Contraseña temporal</Label>
              <Input
                id="managerPassword"
                type="password"
                minLength={8}
                value={form.managerPassword}
                onChange={(e) => set("managerPassword", e.target.value)}
                required
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear negocio"}
            </Button>
          </div>
        </form>

        <div className="rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Clientes</TableHead>
                <TableHead className="text-center">Usuarios</TableHead>
                <TableHead className="text-center">Premio</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {loading ? "Cargando..." : "Aún no hay negocios cliente."}
                  </TableCell>
                </TableRow>
              )}
              {businesses.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs">{b.slug}</TableCell>
                  <TableCell className="text-center">{b._count.customers}</TableCell>
                  <TableCell className="text-center">{b._count.users}</TableCell>
                  <TableCell className="text-center">{b.rewardAt}</TableCell>
                  <TableCell>
                    <Badge variant={b.ghlPurchaseWebhookUrl ? "success" : "muted"}>
                      {b.ghlPurchaseWebhookUrl ? "Configurado" : "Falta"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.isActive ? "success" : "muted"}>
                      {b.isActive ? "Activo" : "Desactivado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/admin/business/${b.id}`}>Gestionar</Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => testWebhook(b.id)}>
                        Probar webhook
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(b.id, !b.isActive)}
                      >
                        {b.isActive ? "Desactivar" : "Reactivar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
