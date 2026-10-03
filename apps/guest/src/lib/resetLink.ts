/** Pull the token out of the emailed link (`…/guest/reset-password?token=…`), or accept the bare token. */
export function resetTokenFrom(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).searchParams.get("token");
  } catch {
    return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) ? trimmed : null;
  }
}

