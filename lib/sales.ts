import { db } from "@/lib/db";
import { formatRut } from "@/lib/utils";
import { sendGhlPurchaseWebhook, formatPurchaseDate, type LoyaltyStage } from "@/lib/ghl";

function computeLoyaltyStage(params: {
  rewardTriggered: boolean;
  stampsToReward: number;
  totalPurchases: number;
}): LoyaltyStage {
  if (params.rewardTriggered) return "PREMIO_LISTO";
  if (params.stampsToReward <= 2) return "CASI_PREMIO";
  if (params.totalPurchases === 1) return "NUEVO";
  return "EN_PROGRESO";
}

export type StampResult = {
  displayCount: number;
  rewardTriggered: boolean;
  persistedCount: number;
  ghlSynced: boolean;
  saleId: string;
};

export async function registerPurchase(params: {
  customerId: string;
  cashierId: string;
  businessId: string;
}): Promise<StampResult> {
  const { customerId, cashierId, businessId } = params;

  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
      include: { business: true },
    });

    if (!customer) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    const current = customer.stampCount;
    const rewardAt = customer.business.rewardAt;
    const next = current + 1;
    const rewardTriggered = next === rewardAt;
    const persistedCount = rewardTriggered ? 0 : next;
    const totalPurchases = customer.totalStamps + 1;
    const isNewCustomer = customer.totalStamps === 0;
    const stampsToReward = rewardAt - next;
    const purchasedAt = new Date();

    const sale = await tx.sale.create({
      data: {
        customerId: customer.id,
        cashierId,
        stampAfter: next,
        rewardTriggered,
        ghlSynced: false,
        createdAt: purchasedAt,
      },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: {
        stampCount: persistedCount,
        totalStamps: { increment: 1 },
        lastPurchaseAt: purchasedAt,
        ...(rewardTriggered
          ? { rewardPending: true, rewardsEarned: { increment: 1 } }
          : {}),
      },
    });

    return {
      sale,
      customer,
      business: customer.business,
      displayCount: next,
      previousStampCount: current,
      rewardTriggered,
      persistedCount,
      totalPurchases,
      isNewCustomer,
      stampsToReward,
      purchasedAt,
    };
  });

  let ghlSynced = false;
  const webhookUrl = result.business.ghlPurchaseWebhookUrl;

  if (webhookUrl) {
    const ghlResult = await sendGhlPurchaseWebhook(webhookUrl, {
      rut: formatRut(result.customer.rut),
      name: result.customer.name,
      email: result.customer.email ?? "",
      phone: result.customer.phone ?? "",
      stampCount: result.displayCount,
      previousStampCount: result.previousStampCount,
      stampsToReward: result.stampsToReward,
      totalPurchases: result.totalPurchases,
      lastPurchaseAt: result.purchasedAt.toISOString(),
      lastPurchaseDate: formatPurchaseDate(result.purchasedAt),
      rewardAt: result.business.rewardAt,
      rewardTriggered: result.rewardTriggered,
      isNewCustomer: result.isNewCustomer,
      loyaltyStage: computeLoyaltyStage({
        rewardTriggered: result.rewardTriggered,
        stampsToReward: result.stampsToReward,
        totalPurchases: result.totalPurchases,
      }),
      ghlContactId: result.customer.ghlContactId ?? "",
    });

    ghlSynced = ghlResult.ok;
    if (ghlSynced) {
      await db.sale.update({
        where: { id: result.sale.id },
        data: { ghlSynced: true },
      });
    }
  }

  return {
    displayCount: result.displayCount,
    rewardTriggered: result.rewardTriggered,
    persistedCount: result.persistedCount,
    ghlSynced,
    saleId: result.sale.id,
  };
}
