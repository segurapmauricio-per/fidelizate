"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type BusinessConfig = {
  name: string;
  primaryColor: string;
  rewardAt: number;
  ghlPurchaseWebhookUrl: string | null;
  ghlRedeemWebhookUrl: string | null;
};

type BusinessSettingsPanelProps = {
  businessId: string;
};

export function BusinessSettingsPanel({ businessId }: BusinessSettingsPanelProps) {
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [pingingPurchase, setPingingPurchase] = useState(false);
  const [pingingRedeem, setPingingRedeem] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/business?businessId=${businessId}`);
    if (res.ok) {
      const data = await res.json();
      setBusiness(data.business);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!business) {
    return <p className="text-sm text-muted-foreground">Cargando configuración...</p>;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    const payload = business;
    setSaving(true);
    const res = await fetch(`/api/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        primaryColor: payload.primaryColor,
        rewardAt: payload.rewardAt,
        ghlPurchaseWebhookUrl: payload.ghlPurchaseWebhookUrl,
        ghlRedeemWebhookUrl: payload.ghlRedeemWebhookUrl,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Guardado", description: "Configuración del negocio actualizada." });
      load();
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
    }
  }

  async function handlePing(type: "purchase" | "redeem") {
    if (type === "purchase") setPingingPurchase(true);
    else setPingingRedeem(true);

    const url =
      type === "redeem"
        ? `/api/businesses/${businessId}/test-webhook?type=redeem`
        : `/api/businesses/${businessId}/test-webhook`;

    const res = await fetch(url, { method: "POST" });

    if (type === "purchase") setPingingPurchase(false);
    else setPingingRedeem(false);

    toast({
      title: res.ok ? "Ping enviado" : "Error",
      description: res.ok
        ? "GHL recibió el payload de prueba."
        : ((await res.json()).error ?? "Falló el ping"),
      variant: res.ok ? "default" : "destructive",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del negocio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Nombre</Label>
            <Input
              id="biz-name"
              value={business.name}
              onChange={(e) => setBusiness({ ...business, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="biz-color">Color primario</Label>
            <p className="text-xs text-muted-foreground">
              Personaliza la caja y la tarjeta de fidelización del negocio.
            </p>
            <div className="flex gap-2">
              <Input
                id="biz-color"
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
            <Label htmlFor="biz-reward">Sellos para premio</Label>
            <Input
              id="biz-reward"
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
            <Label htmlFor="biz-webhook-purchase">Webhook GHL (compras)</Label>
            <Input
              id="biz-webhook-purchase"
              value={business.ghlPurchaseWebhookUrl ?? ""}
              onChange={(e) =>
                setBusiness({ ...business, ghlPurchaseWebhookUrl: e.target.value || null })
              }
              placeholder="https://services.leadconnectorhq.com/hooks/..."
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePing("purchase")}
              disabled={pingingPurchase}
            >
              {pingingPurchase ? "Enviando..." : "Probar webhook de compra"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="biz-webhook-redeem">Webhook GHL (canje de premio)</Label>
            <Input
              id="biz-webhook-redeem"
              value={business.ghlRedeemWebhookUrl ?? ""}
              onChange={(e) =>
                setBusiness({ ...business, ghlRedeemWebhookUrl: e.target.value || null })
              }
              placeholder="https://services.leadconnectorhq.com/hooks/..."
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePing("redeem")}
              disabled={pingingRedeem}
            >
              {pingingRedeem ? "Enviando..." : "Probar webhook de canje"}
            </Button>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
