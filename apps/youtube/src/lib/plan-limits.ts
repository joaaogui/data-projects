export type PlanTier = "free" | "pro" | "enterprise";

export interface PlanLimits {
  maxTrackedChannels: number;
  syncQuotaDaily: number;
  label: string;
}

const PLAN_CONFIG: Record<PlanTier, PlanLimits> = {
  free: {
    maxTrackedChannels: 5,
    syncQuotaDaily: 10,
    label: "Free",
  },
  pro: {
    maxTrackedChannels: 25,
    syncQuotaDaily: 50,
    label: "Pro",
  },
  enterprise: {
    maxTrackedChannels: 100,
    syncQuotaDaily: 200,
    label: "Enterprise",
  },
};

export function getPlanLimits(plan: PlanTier): PlanLimits {
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;
}
