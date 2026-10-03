import { networkInterfaces } from "node:os";

/**
 * The address a phone on the same Wi-Fi can reach this computer at. `localhost` would mean the
 * phone itself. Skips loopback, link-local and the usual virtual adapters (Docker, WSL, VPNs).
 */
export function lanAddress(): string | null {
  const virtual = /^(docker|br-|veth|vbox|vmnet|virbr|lo|tailscale|utun|wsl|vEthernet|zt)/i;
  const candidates: { name: string; address: string }[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const net of list ?? []) {
      if (net.family !== "IPv4" || net.internal || net.address.startsWith("169.254.")) continue;
      candidates.push({ name, address: net.address });
    }
  }
  // Prefer the usual home/office ranges over anything else.
  const score = (a: string) => (a.startsWith("192.168.") ? 0 : a.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3);
  candidates.sort((x, y) => score(x.address) - score(y.address));
  return candidates[0]?.address ?? null;
}
