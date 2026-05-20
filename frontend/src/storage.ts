const STORAGE_KEY = 'url-shortener-links';

export function getStoredCodes(): string[] {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredCodes(codes: string[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
}

export function saveStoredCode(code: string) {
  const codes = getStoredCodes();
  if (!codes.includes(code)) {
    writeStoredCodes([...codes, code]);
  }
}

export function removeStoredCode(code: string) {
  writeStoredCodes(getStoredCodes().filter((storedCode) => storedCode !== code));
}

export function syncStoredCodes(existingCodes: Set<string>) {
  writeStoredCodes(getStoredCodes().filter((code) => existingCodes.has(code)));
}
