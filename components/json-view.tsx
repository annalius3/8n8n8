type JsonViewProps = {
  value: unknown;
  emptyLabel?: string;
  className?: string;
};

export function JsonView({ value, emptyLabel = "No data", className = "" }: JsonViewProps) {
  if (value === null || value === undefined) {
    return <p className={`text-sm text-muted-foreground ${className}`.trim()}>{emptyLabel}</p>;
  }

  return (
    <pre className={`overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5 ${className}`.trim()}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
