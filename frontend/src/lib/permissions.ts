export const AI_ASSISTANT_ROLES = ["tesorero", "equipo_tesoreria"] as const;

export function canUseAiAssistant(role: string | null | undefined): boolean {
  return Boolean(role && AI_ASSISTANT_ROLES.includes(role as (typeof AI_ASSISTANT_ROLES)[number]));
}
