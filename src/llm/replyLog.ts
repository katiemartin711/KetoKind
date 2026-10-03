// Last on-device model reply for a meal, kept in memory so a preview build
// can show it under Today's entries. Nothing here is written to the database
// or sent off the phone. The line is compiled in only when the preview
// publish sets EXPO_PUBLIC_SHOW_MODEL_REPLY=1.

export interface ModelReply {
  raw: string;
  stored: boolean;
}

const replies = new Map<number, ModelReply>();

/** True on a preview bundle that was published with the reply line enabled. */
export function modelReplyVisible(flag: string | undefined): boolean {
  return flag === '1';
}

export function rememberModelReply(mealId: number, reply: ModelReply): void {
  replies.set(mealId, reply);
}

export function clearModelReply(mealId: number): void {
  replies.delete(mealId);
}

/** The line to show under a meal, or undefined when this build hides replies. */
export function visibleModelReply(
  mealId: number,
  flag: string | undefined = process.env.EXPO_PUBLIC_SHOW_MODEL_REPLY,
): string | undefined {
  if (!modelReplyVisible(flag)) return undefined;
  const reply = replies.get(mealId);
  if (!reply) return undefined;
  return formatModelReplyLine(reply.raw, reply.stored);
}

/** Raw model text, with a short note when the app refused to store it. */
export function formatModelReplyLine(raw: string, stored: boolean): string {
  const body = raw.trim() === '' ? '(empty reply)' : raw.trim();
  return stored ? `Qwen: ${body}` : `Qwen (not saved): ${body}`;
}
