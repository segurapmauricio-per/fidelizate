"use client";

import { StampGrid } from "@/components/StampGrid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LoyaltyCardData = {
  name: string;
  stampCount: number;
  rewardAt: number;
  primaryColor?: string;
  logoUrl?: string | null;
  businessName?: string;
};

type LoyaltyCardProps = {
  customer: LoyaltyCardData;
  displayCount?: number;
  rewardTriggered?: boolean;
  animateStamp?: boolean;
  onAddPurchase?: () => void;
  rewardPending?: boolean;
  onRedeem?: () => void;
  redeeming?: boolean;
  loading?: boolean;
  actionLabel?: string;
};

export function LoyaltyCard({
  customer,
  displayCount,
  rewardTriggered = false,
  animateStamp = false,
  onAddPurchase,
  rewardPending = false,
  onRedeem,
  redeeming = false,
  loading = false,
  actionLabel = "Agregar compra",
}: LoyaltyCardProps) {
  const count = displayCount ?? customer.stampCount;
  const progress = Math.min((count / customer.rewardAt) * 100, 100);
  const animateIndex = animateStamp ? count - 1 : null;
  const primary = customer.primaryColor ?? "#e63946";

  return (
    <div
      className="overflow-hidden rounded-[22px] border bg-white shadow-card"
      style={{
        background: `linear-gradient(180deg, #fff 0%, #fbfaf6 100%)`,
      }}
    >
      <div
        className="px-6 py-5 text-white"
        style={{
          background: `linear-gradient(145deg, ${primary}, ${primary}cc)`,
        }}
      >
        <div className="flex items-center gap-3">
          {customer.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.logoUrl}
              alt={customer.businessName ?? "Logo"}
              className="h-11 w-11 shrink-0 rounded-xl border border-white/30 bg-white/90 object-contain p-1"
            />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-lg"
              aria-hidden
            >
              ★
            </div>
          )}
          <div className="min-w-0 flex-1">
            {customer.businessName && (
              <p className="truncate text-xs font-semibold uppercase tracking-wider opacity-90">
                {customer.businessName}
              </p>
            )}
            <p className="text-[10px] font-medium tracking-[0.18em] opacity-75">
              TARJETA DE FIDELIZACIÓN
            </p>
            <p className="truncate font-display text-xl font-bold">{customer.name}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <StampGrid
          rewardAt={customer.rewardAt}
          filledCount={count}
          animateIndex={animateIndex}
          primaryColor={primary}
        />

        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium text-muted-foreground">
            <span>Progreso</span>
            <span>
              {count} / {customer.rewardAt}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${primary}, #f1c453)`,
              }}
            />
          </div>
        </div>

        {rewardTriggered && (
          <div
            className={cn(
              "rounded-xl border border-gold/40 bg-gold/15 px-4 py-3 text-center text-sm font-semibold text-ink"
            )}
          >
            🎁 ¡Esta compra activa el regalo!
          </div>
        )}

        {rewardPending && (
          <div className="rounded-xl border border-gold/50 bg-gold/15 px-4 py-3 text-center text-sm font-semibold text-ink">
            🎁 Premio disponible sin canjear
          </div>
        )}

        {rewardPending && onRedeem && (
          <Button
            size="lg"
            variant="outline"
            className="w-full border-2 text-base font-semibold"
            style={{ borderColor: "#e0a800", color: "#8a6500" }}
            onClick={onRedeem}
            disabled={redeeming || loading}
          >
            {redeeming ? "Canjeando..." : "🎁 Canjear premio"}
          </Button>
        )}

        {onAddPurchase && (
          <Button
            size="lg"
            className="w-full text-base font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: primary }}
            onClick={onAddPurchase}
            disabled={loading}
          >
            {loading ? "Registrando..." : `＋ ${actionLabel}`}
          </Button>
        )}
      </div>
    </div>
  );
}
