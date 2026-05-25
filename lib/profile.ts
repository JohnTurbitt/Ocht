import { Level } from "./analysis";

type AthleteLevel = "STARTER" | "COMPETITIVE" | "ELITE";
type SubscriptionStatus = "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type PublicUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  subscription: SubscriptionStatus;
  defaultLevel: Level;
  defaultTargetTime: string;
  createdAt: Date | string;
};

export const athleteLevelByLevel: Record<Level, AthleteLevel> = {
  starter: "STARTER",
  competitive: "COMPETITIVE",
  elite: "ELITE",
};

export const levelByAthleteLevel: Record<AthleteLevel, Level> = {
  STARTER: "starter",
  COMPETITIVE: "competitive",
  ELITE: "elite",
};

export function toPublicUser(user: {
  id: string;
  email: string;
  emailVerifiedAt: Date | string | null;
  name: string | null;
  subscription: SubscriptionStatus;
  defaultLevel: AthleteLevel;
  defaultTargetTime: string;
  createdAt: Date | string;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    name: user.name,
    subscription: user.subscription,
    defaultLevel: levelByAthleteLevel[user.defaultLevel],
    defaultTargetTime: user.defaultTargetTime,
    createdAt:
      user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}
