import { db } from "@/lib/db";
import { formatRut } from "@/lib/utils";
import { sendGhlRedeemWebhook } from "@/lib/ghl";

export type RedeemResult = {
  rewardsRedeemed: number;
  ghlSynced: boolean;
};

export async function redeemReward(params: {
  customerId: string;
  businessId: string;
}): Promise<RedeemResult> {
  const { customerId, businessId } = params;

  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
      include: { business: true },
    });

    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    if (!customer.rewardPending) throw new Error("NO_REWARD_PENDING");

    const redeemedAt = new Date();
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: {
        rewardPending: false,
        rewardsRedeemed: { increment: 1 },
        lastRedeemedAt: redeemedAt,
      },
    });

    return { customer, business: customer.business, updated, redeemedAt };
  });

  let ghlSynced = false;
  const webhookUrl = result.business.ghlRedeemWebhookUrl;

  if (webhookUrl) {
    const ghlResult = await sendGhlRedeemWebhook(webhookUrl, {
      event: "reward_redeemed",
      rut: formatRut(result.customer.rut),
      name: result.customer.name,
      phone: result.customer.phone ?? "",
      rewardsRedeemed: result.updated.rewardsRedeemed,
      redeemedAt: result.redeemedAt.toISOString(),
    });
    ghlSynced = ghlResult.ok;
  }

  return { rewardsRedeemed: result.updated.rewardsRedeemed, ghlSynced };
}
