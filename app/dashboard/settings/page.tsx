"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type Business = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  rewardAt: number;
  ghlPurchaseWebhookUrl: string | null;
  ghlRedeemWebhookUrl: string | null;
};

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);
  const [pingingPurchase, setPingingPurchase] = useState(false);
  const [pingingRedeem, setPingingRedeem] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((d) => setBusiness(d.business));
  }, []);

  if (!business) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(business),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Guardado", description: "Configuración actualizada." });
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.error });
    }
  }

  async function handlePing(type: "purchase" | "redeem") {
    if (type === "purchase") setPingingPurchase(true);
    else setPingingRedeem(true);

    const url =
      type === "redeem"
        ? "/api/business?action=ping&type=redeem"
        : "/api/business?action=ping";

    const res = await fetch(url, { method: "POST" });

    if (type === "purchase") setPingingPurchase(false);
    else setPingingRedeem(false);

    if (res.ok) {
      toast({ title: "Ping enviado", description: "GHL recibió el evento de prueba." });
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.error });
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/business/logo", { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      const data = await res.json();
      setBusiness((prev) => (prev ? { ...prev, logoUrl: data.url } : prev));
      toast({ title: "Logo subido" });
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.error });
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="font-display text-xl font-bold">Configuración</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Branding y fidelización</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del negocio</Label>
                <Input
                  id="name"
                  value={business.name}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo (URL)</Label>
                <Input
                  id="logoUrl"
                  value={business.logoUrl ?? ""}
                  onChange={(e) => setBusiness({ ...business, logoUrl: e.target.value || null })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoFile">Subir logo</Label>
                <p className="text-xs text-muted-foreground">
                  Aparece en la tarjeta de fidelización y en el encabezado de la caja.
                </p>
                <Input
                  id="logoFile"
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {business.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logoUrl} alt="Logo" className="mt-2 h-16 w-16 rounded-lg object-cover" />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Color primario</Label>
                <p className="text-xs text-muted-foreground">
                  Personaliza la caja y la tarjeta de fidelización: botones, encabezado, barra de progreso y acentos de sellos.
                </p>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    value={business.primaryColor}
                    onChange={(e) => setBusiness({ ...business, primaryColor: e.target.value })}
                  />
                  <input
                    type="color"
                    value={business.primaryColor}
                    onChange={(e) => setBusiness({ ...business, primaryColor: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rewardAt">Sellos para premio</Label>
                <Input
                  id="rewardAt"
                  type="number"
                  min={2}
                  max={50}
                  value={business.rewardAt}
                  onChange={(e) =>
                    setBusiness({ ...business, rewardAt: parseInt(e.target.value, 10) || 10 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook">Webhook GHL (compras)</Label>
                <Input
                  id="webhook"
                  value={business.ghlPurchaseWebhookUrl ?? ""}
                  onChange={(e) =>
                    setBusiness({
                      ...business,
                      ghlPurchaseWebhookUrl: e.target.value || null,
                    })
                  }
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePing("purchase")}
                  disabled={pingingPurchase}
                >
                  {pingingPurchase ? "Enviando..." : "Enviar ping de compra"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="redeemWebhook">Webhook GHL (canje de premio)</Label>
                <Input
                  id="redeemWebhook"
                  value={business.ghlRedeemWebhookUrl ?? ""}
                  onChange={(e) =>
                    setBusiness({
                      ...business,
                      ghlRedeemWebhookUrl: e.target.value || null,
                    })
                  }
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePing("redeem")}
                  disabled={pingingRedeem}
                >
                  {pingingRedeem ? "Enviando..." : "Enviar ping de canje"}
                </Button>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
