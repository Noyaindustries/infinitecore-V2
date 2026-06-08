export function normalizeWhatsAppDigits(input: string): string {
  return input.replace(/\D/g, '');
}

export function buildWhatsAppUrl(phoneDigits: string, message?: string): string {
  const digits = normalizeWhatsAppDigits(phoneDigits);
  if (!digits) return 'https://wa.me/';
  const base = `https://wa.me/${digits}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
