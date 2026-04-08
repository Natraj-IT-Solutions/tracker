/**
 * ─── STORAGE MODULE ──────────────────────────────────────────
 * Persists shift data locally and syncs with the backend.
 * ───────────────────────────────────────────────────────────── */

const Storage = (() => {
  const SHIFTS_KEY = 'azura_shifts';
  const ACTIVE_KEY = 'azura_active_shift';

  // ─── Active Shift (Synced with Backend) ─────────────────────
  let cachedActiveShifts = {};

  const initActiveShifts = async (account) => {
    try {
      const resp = await fetch(`/api/shifts/active/account/${account.id}`);
      const data = await resp.json();
      if (data.activeShifts) {
        cachedActiveShifts = data.activeShifts;
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(cachedActiveShifts));
      }
    } catch (err) {
      console.warn('Active shift sync failed, using local fallback:', err);
      cachedActiveShifts = JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}');
    }
  };

  const getActiveShift = (profileId) => {
    return cachedActiveShifts[profileId] || null;
  };

  const setActiveShift = async (profileId, clockInTime) => {
    cachedActiveShifts[profileId] = { clockIn: clockInTime };
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(cachedActiveShifts));

    try {
      await fetch('/api/shifts/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, clockIn: clockInTime })
      });
    } catch (err) {
      console.warn('Backend active shift save failed:', err);
    }
  };

  const clearActiveShift = (profileId) => {
    delete cachedActiveShifts[profileId];
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(cachedActiveShifts));
    // server handles deletion on shift save/clock-out
  };

  // ─── Save Shift ──────────────────────────────────────────
  const saveShift = async (profileId, shiftData) => {
    const newShift = {
      ...shiftData,
      id: `shift-${Date.now()}`,
      profileId,
      savedAt: new Date().toISOString()
    };

    // Save locally first
    const shifts = getLocalShifts();
    shifts.push(newShift);
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));

    try {
      const resp = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift: newShift })
      });
      return await resp.json();
    } catch (err) {
      console.warn('Backend sync failed:', err);
      return { success: false, shift: newShift };
    }
  };

  const getLocalShifts = () => {
    try {
      return JSON.parse(localStorage.getItem(SHIFTS_KEY)) || [];
    } catch { return []; }
  };

  const getShiftsForUser = async (profileId) => {
    try {
      const resp = await fetch(`/api/shifts/${profileId}`);
      if (resp.ok) {
        const backendShifts = await resp.json();
        return backendShifts;
      }
    } catch (err) {
      console.warn('Could not fetch shifts from backend:', err);
    }
    return getLocalShifts().filter((s) => (s.profileId === profileId || s.userId === profileId));
  };

  const getStats = async (profileId) => {
    const shifts = await getShiftsForUser(profileId);
    const leaves = await getLeavesForUser(profileId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const tempDate = new Date(now);
    const day = tempDate.getDay();
    const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(tempDate.setDate(diff)).setHours(0,0,0,0);

    const todayShifts = shifts.filter(s => new Date(s.clockOut).getTime() >= startOfToday);
    const weekShifts = shifts.filter(s => new Date(s.clockOut).getTime() >= startOfWeek);

    const calcHours = (arr) => arr.reduce((acc, s) => acc + (s.duration || 0), 0);

    const monthLeaves = leaves.filter(l => {
      const d = new Date(l.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const uniqueDays = new Set([
      ...shifts.map(s => Clock.formatDate(s.clockIn)),
      ...leaves.map(l => Clock.formatDate(l.date))
    ]);

    return {
      today: calcHours(todayShifts),
      week: calcHours(weekShifts),
      totalHours: calcHours(shifts),
      totalShifts: shifts.length,
      workingDays: uniqueDays.size,
      leaveCount: monthLeaves.length,
      hasLeaveThisMonth: monthLeaves.length > 0,
      leaves: leaves,
      history: shifts.sort((a, b) => new Date(b.clockOut) - new Date(a.clockOut))
    };
  };

  const getLeavesForUser = async (profileId) => {
    try {
      const resp = await fetch(`/api/leaves/${profileId}`);
      if (resp.ok) return await resp.json();
    } catch (err) { console.warn('Fetch leaves failed:', err); }
    return [];
  };

  const saveLeave = async (profileId, worker, date, reason) => {
    try {
      const resp = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, worker, date, reason })
      });
      return await resp.json();
    } catch (err) { console.warn('Save leave failed:', err); return { success: false }; }
  };

  return {
    initActiveShifts,
    getActiveShift,
    setActiveShift,
    clearActiveShift,
    saveShift,
    getShiftsForUser,
    getStats,
    saveLeave
  };
})();
