// Same palette and meanings as sunset-beach (see its CLAUDE.md "Colour meanings"): sea = free,
// coral = needs intervention, sand = not cleaned, amber = attention, green = paid, slate =
// confirmed. Don't repurpose them.
export const colors = {
  ink: "#0F262B",
  ink2: "#153138",
  ink3: "#1C3D45",
  sand: "#F3ECDA",
  sand2: "#E9DDC0",
  coral: "#E2612F",
  coralDeep: "#A83D1D",
  sea: "#6E9C90",
  cream: "#FBF6EC",
  creamMuted: "rgba(251,246,236,0.6)",
  creamFaint: "rgba(251,246,236,0.12)",
  amber: "#FBBF24",
  green: "#16A34A",
  slate: "#475569",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Minimum touch target - the phone is used one-handed on the floor. */
export const TOUCH = 48;
