export function applyTemplate(template: string, values: Record<string, string | undefined>) {
  const withDouble = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? "");
  return withDouble.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => values[key] ?? "");
}
