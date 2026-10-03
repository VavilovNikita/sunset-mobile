// Web is a development/test target only (`npx expo start --web`, the Playwright walk-through) - it
// is never shipped. A browser has no secure storage, and a token in localStorage would be readable
// by any script on the page, so on web nothing is persisted: values live in memory and a reload
// signs you out.
const memory = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return memory.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  memory.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  memory.delete(key);
}
