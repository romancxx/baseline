export function initials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const [first = "", second] = local.split(/[._-]+/).filter((part) => part.length > 0);
  const letters = second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2);
  return letters.toUpperCase();
}
