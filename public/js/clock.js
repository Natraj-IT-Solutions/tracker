/* ═══════════════════════════════════════════════════════════════
   CLOCK — Timer, duration calculations, clock in/out logic
   ═══════════════════════════════════════════════════════════════ */

const Clock = (() => {
  let timerInterval = null;
  let liveClockInterval = null;

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatHoursMinutes(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString(CONFIG.locale, {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: CONFIG.timezone,
    });
  }

  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString(CONFIG.locale, {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: CONFIG.timezone,
    });
  }

  function getElapsedSeconds(clockInISO) {
    return Math.floor((Date.now() - new Date(clockInISO).getTime()) / 1000);
  }

  function startTimer(clockInISO, onTick) {
    stopTimer();
    timerInterval = setInterval(() => onTick(getElapsedSeconds(clockInISO)), 1000);
    onTick(getElapsedSeconds(clockInISO));
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function startLiveClock(timeEl, dateEl) {
    function update() {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString(CONFIG.locale, {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: CONFIG.timezone,
      });
      dateEl.textContent = now.toLocaleDateString(CONFIG.locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: CONFIG.timezone,
      });
    }
    update();
    liveClockInterval = setInterval(update, 1000);
  }

  function stopLiveClock() {
    if (liveClockInterval) { clearInterval(liveClockInterval); liveClockInterval = null; }
  }

  return { formatDuration, formatHoursMinutes, formatTime, formatDate, getElapsedSeconds, startTimer, stopTimer, startLiveClock, stopLiveClock };
})();
