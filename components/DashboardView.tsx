"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { CustomerTable, type CustomerRow } from "@/components/CustomerTable";
import { CreateUserForm, type StaffUser } from "@/components/CreateUserForm";
import { CustomerDetail } from "@/components/CustomerDetail";
import { BusinessSettingsPanel } from "@/components/BusinessSettingsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, LogOut, RefreshCw, ArrowLeft, Store, KeyRound } from "lucide-react";

type Stats = {
  activeCustomers: number;
  stampsToday: number;
  rewardsToday: number;
  activeCashiers: number;
};

type DashboardViewProps = {
  businessId?: string;
  mode?: "manager" | "admin";
};

export function DashboardView({ businessId, mode = "manager" }: DashboardViewProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? session?.user?.email ?? "";
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [businessName, setBusinessName] = useState("FIDELIZATE");
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const withBiz = useCallback(
    (url: string) =>
      businessId ? url + (url.includes("?") ? "&" : "?") + `businessId=${businessId}` : url,
    [businessId]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, customersRes, usersRes, businessRes] = await Promise.all([
      fetch(withBiz("/api/dashboard/stats")),
      fetch(
        withBiz(
          `/api/customers/list?status=${status}&query=${encodeURIComponent(query)}&page=${page}&limit=20`
        )
      ),
      fetch(withBiz("/api/users?status=all")),
      fetch(withBiz("/api/business")),
    ]);
    setLoading(false);

    if (statsRes.ok) setStats(await statsRes.json());
    if (customersRes.ok) {
      const data = await customersRes.json();
      setCustomers(data.customers);
      setTotal(data.total);
    }
    if (usersRes.ok) setUsers((await usersRes.json()).users);
    if (businessRes.ok) setBusinessName((await businessRes.json()).business.name);
  }, [page, query, status, withBiz]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function toggleCustomerStatus(id: string, isActive: boolean) {
    const res = await fetch(withBiz(`/api/customers/${id}/status`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) loadAll();
  }

  async function createUser(data: {
    email: string;
    name: string;
    password?: string;
    role: "MANAGER" | "CASHIER";
    sendInvite: boolean;
  }) {
    const res = await fetch(withBiz("/api/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al crear usuario");
    }
    loadAll();
  }

  async function editUser(
    id: string,
    data: { name?: string; email?: string; role?: "MANAGER" | "CASHIER" }
  ) {
    const res = await fetch(withBiz(`/api/users/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al editar usuario");
    }
    loadAll();
  }

  async function resendInvite(id: string) {
    const res = await fetch(withBiz(`/api/users/${id}/resend-invite`), { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al reenviar invitación");
    }
  }

  async function toggleUserStatus(id: string, isActive: boolean) {
    const res = await fetch(withBiz(`/api/users/${id}/status`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al cambiar estado");
    }
    loadAll();
  }

  async function resetUserPassword(id: string, password?: string) {
    const res = await fetch(withBiz(`/api/users/${id}/password`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password ? { password } : {}),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al restablecer contraseña");
    }
    return res.json() as Promise<{ temporaryPassword?: string }>;
  }

  const kpis = [
    { label: "Clientes activos", value: stats?.activeCustomers ?? "—" },
    { label: "Sellos hoy", value: stats?.stampsToday ?? "—" },
    { label: "Premios hoy", value: stats?.rewardsToday ?? "—" },
    { label: "Cajeros activos", value: stats?.activeCashiers ?? "—" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {mode === "admin" ? "Gestión de negocio" : "Dashboard"}
            </p>
            <h1 className="font-display text-2xl font-bold">{businessName}</h1>
            {userName && (
              <p className="text-sm text-muted-foreground">Hola, {userName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={businessId ? `/caja?businessId=${businessId}` : "/caja"}>
                <Store className="mr-2 h-4 w-4" />
                Caja
              </Link>
            </Button>
            {mode === "admin" ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Panel maestro
                  </Link>
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
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="customers">
          <TabsList>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="staff">Usuarios</TabsTrigger>
            {mode === "admin" && businessId && (
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="customers" className="mt-4">
            <CustomerTable
              customers={customers}
              total={total}
              page={page}
              limit={20}
              status={status}
              onStatusChange={(s) => {
                setStatus(s);
                setPage(1);
              }}
              onQueryChange={(q) => {
                setQuery(q);
                setPage(1);
              }}
              onPageChange={setPage}
              onToggleStatus={toggleCustomerStatus}
              onRowClick={setSelectedCustomer}
              loading={loading}
            />
          </TabsContent>
          <TabsContent value="staff" className="mt-4">
            <CreateUserForm
              users={users}
              onCreate={createUser}
              onEdit={editUser}
              onToggleStatus={toggleUserStatus}
              onResetPassword={resetUserPassword}
              onResendInvite={resendInvite}
            />
          </TabsContent>
          {mode === "admin" && businessId && (
            <TabsContent value="settings" className="mt-4">
              <BusinessSettingsPanel businessId={businessId} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {selectedCustomer && (
        <CustomerDetail
          customerId={selectedCustomer}
          businessId={businessId}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
