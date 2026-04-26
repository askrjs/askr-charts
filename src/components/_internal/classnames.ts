export function cx(...parts: Array<string | false | null | undefined>) {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
}
