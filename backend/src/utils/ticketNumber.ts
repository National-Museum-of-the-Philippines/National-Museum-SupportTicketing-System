export function generateTicketNumber() {
  const yr = new Date().getFullYear();
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  return `TKT-${yr}-${suffix}`;
}

export function generateFormRef() {
  const yr = new Date().getFullYear();
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  return `FRM-${yr}-${suffix}`;
}
