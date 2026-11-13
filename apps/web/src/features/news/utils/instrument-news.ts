export function noBriefMessage(name: string, held: boolean): string {
  return held
    ? `Nothing has been reported on ${name} in the window covered by the last update. The next brief arrives after the next one.`
    : `Briefs and prices are only collected for securities you hold. Add ${name} and the first of each arrives after the next update.`;
}

export function etfNewsMessage(held: boolean): string {
  return held
    ? "News isn't collected for ETFs. The price and your position are kept up to date, and this fund still counts towards your totals."
    : "News isn't collected for ETFs. Once you hold this fund, its price is kept up to date and it counts towards your totals.";
}
