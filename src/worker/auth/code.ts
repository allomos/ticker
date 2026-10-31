// The sign-in code: 16 characters from an alphabet without look-alikes (no 0/O, 1/I/L), about
// 79 bits of randomness, shown in groups of four.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 16;

export function newCode(): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely: 248 = 8 × 31.
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2))) {
      if (b < 248 && out.length < CODE_LENGTH) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join("");
}

/** K7QM4XRP9TWD2HNC → K7QM-4XRP-9TWD-2HNC */
export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join("-");

/**
 * What the user typed or pasted, made plain: any case, with or without spaces and dashes (also
 * the email's non-breaking ones); null when it cannot be a code.
 */
export function normalizeCode(input: unknown): string | null {
  const plain = String(input ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (plain.length !== CODE_LENGTH) return null;
  for (const c of plain) if (!CODE_ALPHABET.includes(c)) return null;
  return plain;
}
