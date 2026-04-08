/* ═══════════════════════════════════════════════════════════════
   CONFIG — Workers, task categories, and app settings
   Edit this file to add/remove employees and task categories
   ═══════════════════════════════════════════════════════════════ */

const CONFIG = {
  // ─── Employees ──────────────────────────────────────────────
  // Add or remove employees here
  workers: [
    { id: 'worker-1', name: 'Alex Johnson', role: 'Team Lead' },
    { id: 'worker-2', name: 'Mia Chen', role: 'Developer' },
    { id: 'worker-3', name: 'Sam Patel', role: 'Designer' },
    { id: 'worker-4', name: 'Jordan Lee', role: 'Support' },
    { id: 'worker-5', name: 'Taylor Kim', role: 'Marketing' },
    { id: 'worker-6', name: 'Riley Shah', role: 'Operations' },
  ],

  // ─── App Settings ───────────────────────────────────────────
  timezone: 'Australia/Sydney',
  locale: 'en-AU',
  maxShiftHours: 14,
};
