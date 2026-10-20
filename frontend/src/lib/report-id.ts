export function formatReportIdentifier(id: string): string {
  const compactId = BigInt(`0x${id.replaceAll('-', '')}`)
    .toString(36)
    .toUpperCase()
    .padStart(25, '0');

  return `PR-${compactId}`;
}
