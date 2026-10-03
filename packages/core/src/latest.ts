/**
 * Guards against an older response overwriting newer state - the stale-poll bug the web POS
 * ticket has (audit finding M12). Take a ticket before each request; apply the response only if
 * it is still the latest ticket. A write takes a ticket too, so a poll that started before the
 * write can never land after it.
 */
export function createLatestGuard() {
  let issued = 0;
  return {
    take(): number {
      issued += 1;
      return issued;
    },
    isLatest(ticket: number): boolean {
      return ticket === issued;
    },
  };
}
