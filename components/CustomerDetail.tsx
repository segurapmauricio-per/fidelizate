"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type SaleRow = {
  id: string;
  stampAfter: number;
  rewardTriggered: boolean;
  createdAt: string;
};

type CustomerDetailData = {
  id: string;
  rut: string;
  name: string;
  email: string | null;
  phone: string | null;
  stampCount: number;
  totalStamps: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  rewardPending: boolean;
  isActive: boolean;
  lastPurchaseAt: string | null;
  lastRedeemedAt: string | null;
  createdAt: string;
  rewardAt: number;
  primaryColor?: string;
  sales: SaleRow[];
};

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString("es-CL") : "—";
}

export function CustomerDetail({
  customerId,
  businessId,
  onClose,
}: {
  customerId: string;
  businessId?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const qs = businessId ? `?businessId=${businessId}` : "";
    fetch(`/api/customers/${customerId}${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) {
          setData(d?.customer ?? null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [customerId, businessId]);

  const primary = data?.primaryColor ?? "#e63946";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between px-6 py-5 text-white"
          style={{ background: `linear-gradient(145deg, ${primary}, ${primary}dd)` }}
        >
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] opacity-90">FICHA DE CLIENTE</p>
            <p className="font-display text-xl font-bold">{data?.name ?? "Cargando..."}</p>
            <p className="font-mono text-sm opacity-90">{data?.rut}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : !data ? (
          <div className="p-8 text-center text-muted-foreground">No se pudo cargar el cliente.</div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Sellos actuales" value={`${data.stampCount} / ${data.rewardAt}`} />
              <Info label="Compras totales" value={String(data.totalStamps)} />
              <Info label="Premios ganados" value={String(data.rewardsEarned)} />
              <Info label="Premios canjeados" value={String(data.rewardsRedeemed)} />
              <Info label="Teléfono" value={data.phone ?? "—"} />
              <Info label="Correo" value={data.email ?? "—"} />
              <Info label="Última compra" value={fmt(data.lastPurchaseAt)} />
              <Info label="Último canje" value={fmt(data.lastRedeemedAt)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={data.isActive ? "success" : "muted"}>
                {data.isActive ? "Activo" : "Desactivado"}
              </Badge>
              {data.rewardPending && <Badge variant="warning">🎁 Premio pendiente de canje</Badge>}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">
                Historial de compras (últimas {data.sales.length})
              </p>
              {data.sales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin compras registradas.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {data.sales.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>{new Date(s.createdAt).toLocaleString("es-CL")}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">Sello {s.stampAfter}</span>
                        {s.rewardTriggered && <Badge variant="warning">premio</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
