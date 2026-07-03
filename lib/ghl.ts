export type LoyaltyStage = "NUEVO" | "EN_PROGRESO" | "CASI_PREMIO" | "PREMIO_LISTO";

// Formato MM-DD-YYYY (hora local) para el campo Date de GHL.
export function formatPurchaseDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

export interface GhlPurchasePayload {
  rut: string;
  name: string;
  email: string;
  phone: string;
  stampCount: number;
  previousStampCount: number;
  stampsToReward: number;
  totalPurchases: number;
  lastPurchaseAt: string;
  lastPurchaseDate: string;
  rewardAt: number;
  rewardTriggered: boolean;
  isNewCustomer: boolean;
  loyaltyStage: LoyaltyStage;
  ghlContactId: string;
}

export async function sendGhlPurchaseWebhook(
  webhookUrl: string,
  payload: GhlPurchasePayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, error: `GHL respondió ${response.status}` };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo conectar con GHL" };
  }
}

export interface GhlRedeemPayload {
  event: "reward_redeemed";
  rut: string;
  name: string;
  phone: string;
  rewardsRedeemed: number;
  redeemedAt: string;
}

export async function sendGhlRedeemWebhook(
  webhookUrl: string,
  payload: GhlRedeemPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, error: `GHL respondió ${response.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo conectar con GHL" };
  }
}

export async function sendGhlRedeemPing(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  return sendGhlRedeemWebhook(webhookUrl, {
    event: "reward_redeemed",
    rut: "12.345.678-9",
    name: "Ping de prueba FIDELIZATE",
    phone: "+56900000000",
    rewardsRedeemed: 1,
    redeemedAt: new Date().toISOString(),
  });
}

export async function sendGhlPing(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  return sendGhlPurchaseWebhook(webhookUrl, {
    rut: "12.345.678-9",
    name: "Ping de prueba FIDELIZATE",
    email: "ping@fidelizate.local",
    phone: "+56900000000",
    stampCount: 1,
    previousStampCount: 0,
    stampsToReward: 9,
    totalPurchases: 1,
    lastPurchaseAt: new Date().toISOString(),
    lastPurchaseDate: formatPurchaseDate(new Date()),
    rewardAt: 10,
    rewardTriggered: false,
    isNewCustomer: true,
    loyaltyStage: "NUEVO",
    ghlContactId: "",
  });
}
