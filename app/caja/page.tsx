"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LoyaltyCard } from "@/components/LoyaltyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatRut, normalizeRut } from "@/lib/utils";
import { isValidRut } from "@/lib/rut";
import { ArrowLeft, LogOut, KeyRound, Search } from "lucide-react";

type CustomerData = {
  id: string;
  rut: string;
  name: string;
  stampCount: number;
  rewardPending?: boolean;
  rewardAt: number;
  primaryColor?: string;
  logoUrl?: string | null;
  businessName?: string;
};

type BusinessBranding = {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
};

function CajaInner() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId") ?? undefined;
  const { data: session } = useSession();

  const role = session?.user?.role;
  const userName = session?.user?.name ?? session?.user?.email ?? "";

  const withBiz = useCallback(
    (url: string) =>
      businessId ? url + (url.includes("?") ? "&" : "?") + `businessId=${businessId}` : url,
    [businessId]
  );

  const [needsBusiness, setNeedsBusiness] = useState(false);
  const [business, setBusiness] = useState<BusinessBranding | null>(null);

  useEffect(() => {
    if (businessId) return;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (s?.user?.role === "SUPER_ADMIN") setNeedsBusiness(true);
      })
      .catch(() => {});
  }, [businessId]);

  useEffect(() => {
    if (needsBusiness) return;
    fetch(withBiz("/api/business"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.business) setBusiness(d.business);
      })
      .catch(() => {});
  }, [needsBusiness, withBiz]);

  const primary = business?.primaryColor ?? "#e63946";

  const [rutInput, setRutInput] = useState("");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [displayCount, setDisplayCount] = useState<number | null>(null);
  const [rewardTriggered, setRewardTriggered] = useState(false);
  const [animateStamp, setAnimateStamp] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  function resetSearchState() {
    setCustomer(null);
    setNotFound(false);
    setRutInput("");
    setDisplayCount(null);
    setRewardTriggered(false);
    setAnimateStamp(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRut(rutInput)) {
      toast({ title: "RUT inválido", description: "Verifica el formato y dígito verificador." });
      return;
    }

    setSearching(true);
    setNotFound(false);
    setCustomer(null);
    setDisplayCount(null);
    setRewardTriggered(false);
    setAnimateStamp(false);

    const res = await fetch(withBiz(`/api/customers?rut=${encodeURIComponent(rutInput)}`));
    setSearching(false);

    if (res.status === 404) {
      setNotFound(true);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error ?? "No se pudo buscar el cliente" });
      return;
    }

    const data = await res.json();
    setCustomer(data.customer);
  }

  async function registerSale(customerId: string) {
    setLoading(true);
    const res = await fetch(withBiz("/api/sales"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error ?? "No se pudo registrar la compra" });
      return;
    }

    const data = await res.json();
    setDisplayCount(data.displayCount);
    setRewardTriggered(data.rewardTriggered);
    setAnimateStamp(true);

    if (customer) {
      setCustomer({
        ...customer,
        stampCount: data.persistedCount,
        rewardPending: data.rewardTriggered ? true : customer.rewardPending,
      });
    }

    if (!data.ghlSynced) {
      toast({
        title: "Sincronización pendiente",
        description: "La compra quedó registrada. GHL se sincronizará después.",
      });
    }
  }

  async function handleRedeem() {
    if (!customer) return;

    const confirmed = window.confirm(
      `¿Confirmas canjear el premio de ${customer.name}?\n\nEsta acción reinicia su tarjeta de sellos.`
    );
    if (!confirmed) return;

    setRedeeming(true);
    const res = await fetch(withBiz("/api/redeem"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id }),
    });
    setRedeeming(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error ?? "No se pudo canjear el premio" });
      return;
    }

    const data = await res.json();
    setCustomer({ ...customer, rewardPending: false });
    toast({ title: "Premio canjeado", description: "Registrado. ¡Empieza una nueva tarjeta!" });
    if (!data.ghlSynced) {
      toast({ title: "Sincronización pendiente", description: "El canje se sincronizará con GHL después." });
    }
  }

  async function handleCreateAndStamp(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRut(rutInput)) return;

    setLoading(true);
    const createRes = await fetch(withBiz("/api/customers"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rut: rutInput,
        name: newName,
        phone: newPhone,
        email: newEmail,
      }),
    });

    if (!createRes.ok) {
      setLoading(false);
      const err = await createRes.json();
      toast({ title: "Error", description: err.error ?? "No se pudo crear el cliente" });
      return;
    }

    const { customer: created } = await createRes.json();
    setCustomer(created);
    setNotFound(false);
    await registerSale(created.id);
    setLoading(false);
  }

  const cardCustomer = customer
    ? {
        ...customer,
        primaryColor: customer.primaryColor ?? business?.primaryColor,
        logoUrl: customer.logoUrl ?? business?.logoUrl,
        businessName: customer.businessName ?? business?.name,
      }
    : null;

  const showSearchForm = !customer;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <header className="mb-6 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {business?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="h-10 w-10 shrink-0 rounded-xl border object-contain p-0.5"
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{
                    background: `linear-gradient(145deg, ${primary}, ${primary}cc)`,
                  }}
                >
                  ★
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold">
                  {business?.name ?? "Caja"}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {userName ? `Hola, ${userName}` : "Punto de venta"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/cambiar-contrasena" title="Cambiar contraseña">
                  <KeyRound className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {role === "MANAGER" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            )}
            {role === "SUPER_ADMIN" && businessId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/business/${businessId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Gestionar negocio
                </Link>
              </Button>
            )}
          </div>
        </header>

        {needsBusiness ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Elige un negocio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Como cuenta maestra, abre la caja desde un negocio: Panel maestro → Gestionar → Caja.
              </p>
              <Button asChild className="w-full">
                <Link href="/admin">Ir al panel maestro</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {showSearchForm && (
              <form onSubmit={handleSearch} className="mb-6 space-y-3">
                <Label htmlFor="rut" className="text-base font-semibold">
                  RUT del cliente
                </Label>
                <Input
                  id="rut"
                  placeholder="12.345.678-9"
                  value={rutInput}
                  onChange={(e) => setRutInput(e.target.value)}
                  onBlur={() => {
                    if (isValidRut(rutInput)) setRutInput(formatRut(rutInput));
                  }}
                  className="h-12 text-lg"
                  autoFocus
                />
                <Button
                  type="submit"
                  className="w-full text-white hover:opacity-90"
                  size="lg"
                  disabled={searching}
                  style={{ backgroundColor: primary }}
                >
                  {searching ? "Buscando..." : "Buscar"}
                </Button>
              </form>
            )}

            {notFound && (
              <Card className="mb-4 border-dashed">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-display text-xl">Cliente nuevo</CardTitle>
                    <Button type="button" variant="ghost" size="sm" onClick={resetSearchState}>
                      Cancelar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateAndStamp} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      RUT: <span className="font-mono">{formatRut(normalizeRut(rutInput))}</span>
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+56 9 1234 5678"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Correo <span className="text-muted-foreground">(opcional)</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="cliente@correo.cl"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full text-white hover:opacity-90"
                      size="lg"
                      disabled={loading}
                      style={{ backgroundColor: primary }}
                    >
                      {loading ? "Creando..." : "Crear y agregar primer sello"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {cardCustomer && (
              <div className="space-y-3">
                <Button type="button" variant="outline" className="w-full" onClick={resetSearchState}>
                  <Search className="mr-2 h-4 w-4" />
                  Nueva búsqueda
                </Button>
                <LoyaltyCard
                  customer={cardCustomer}
                  displayCount={displayCount ?? cardCustomer.stampCount}
                  rewardTriggered={rewardTriggered}
                  animateStamp={animateStamp}
                  onAddPurchase={() => registerSale(cardCustomer.id)}
                  rewardPending={cardCustomer.rewardPending}
                  onRedeem={handleRedeem}
                  redeeming={redeeming}
                  loading={loading}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CajaPage() {
  return (
    <Suspense fallback={null}>
      <CajaInner />
    </Suspense>
  );
}
