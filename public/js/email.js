/* ═══════════════════════════════════════════════════════════════
   EMAIL — Send clock in/out data to backend API
   ═══════════════════════════════════════════════════════════════ */

const Email = (() => {
  const API_URL = '/api/send-email';

  async function send(payload) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Clock In Email ──────────────────────────────────────
  async function sendClockIn(workerName, timestamp) {
    return send({
      type: 'clock-in',
      worker: workerName,
      timestamp,
    });
  }

  // ─── Clock Out Email ─────────────────────────────────────
  async function sendClockOut(workerName, clockIn, clockOut, duration, formData) {
    return send({
      type: 'clock-out',
      worker: workerName,
      clockIn,
      clockOut,
      duration,
      formData,
    });
  }

  async function sendTypedEmail(type, data) {
    return send({
      type,
      ...data
    });
  }

  return { sendClockIn, sendClockOut, sendTypedEmail };
})();
