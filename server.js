require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Global error handling for senior engineer robustness
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
// Ensure data directory exists (wrapped in try-catch for Vercel VFS)
try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
  }
} catch (err) {
  console.log('Skipping data directory creation (read-only environment like Vercel).');
}

// Simple JSON/PG Database Utility
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = connectionString ? new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
}) : null;

if (pool) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `).catch(err => console.error('PG Init Error:', err));
}

const getDB = async () => {
  if (pool) {
    try {
      const res = await pool.query('SELECT data FROM app_state WHERE id = 1');
      if (res.rows.length === 0) {
        const initial = { 
          users: [{
            id: 'acc-1', email: 'Ghisingrishav@gmail.com', password: process.env.ADMIN_PASSWORD || 'cat12345',
            profiles: [],
            createdAt: new Date().toISOString()
          }], shifts: [], activeShifts: {}, leaves: [] 
        };
        await pool.query('INSERT INTO app_state (id, data) VALUES (1, $1)', [initial]);
        return initial;
      }
      const data = res.rows[0].data;
      if (!data.activeShifts) data.activeShifts = {};
      if (!data.leaves) data.leaves = [];
      return data;
    } catch (err) {
      console.error('PG getDB error:', err);
      throw err;
    }
  }

  // Fallback
  if (!fs.existsSync(DB_PATH)) {
    const initial = { 
      users: [
        {
          id: 'acc-1', email: 'Ghisingrishav@gmail.com', password: process.env.ADMIN_PASSWORD || 'cat12345',
          profiles: [],
          createdAt: new Date().toISOString()
        }
      ], shifts: [], activeShifts: {}, leaves: [] 
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!data.activeShifts) data.activeShifts = {};
  if (!data.leaves) data.leaves = [];
  return data;
};

const saveDB = async (data) => {
  if (pool) {
    await pool.query('UPDATE app_state SET data = $1 WHERE id = 1', [JSON.stringify(data)]);
    return;
  }
  return new Promise((resolve, reject) => {
    fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), (err) => {
      if (err) reject(err); else resolve();
    });
  });
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH & PROFILE API ──────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = await getDB();
  const user = db.users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

app.post('/api/profiles', async (req, res) => {
  const { accId, profile } = req.body;
  if (!accId || !profile || !profile.name) {
    return res.status(400).json({ error: 'Missing account ID or profile name' });
  }
  
  const db = await getDB();
  const user = db.users.find(u => u.id === accId);

  if (!user) return res.status(404).json({ error: 'Account not found' });

  if (!user.profiles) user.profiles = [];

  const newProfile = {
    ...profile,
    id: `prof-${Date.now()}`,
    approved: true // Profiles created by logged-in users are pre-approved
  };

  user.profiles.push(newProfile);
  await saveDB(db);
  res.json({ success: true, profile: newProfile });
});

// ─── SHIFT API ───────────────────────────────────────────────
app.get('/api/shifts/:profileId', async (req, res) => {
  const { profileId } = req.params;
  const db = await getDB();
  const shifts = db.shifts.filter((s) => (s.profileId === profileId || s.userId === profileId));
  res.json(shifts);
});

app.post('/api/shifts', async (req, res) => {
  const { shift } = req.body;
  if (!shift || !shift.profileId || !shift.clockIn || !shift.clockOut) {
    return res.status(400).json({ error: 'Incomplete shift data' });
  }
  
  const db = await getDB();
  
  const newShift = {
    ...shift,
    id: `shift-${Date.now()}`
  };

  db.shifts.push(newShift);
  // Clear active shift on clock out
  if (newShift.profileId && db.activeShifts[newShift.profileId]) {
    delete db.activeShifts[newShift.profileId];
  }
  await saveDB(db);
  res.json({ success: true, shift: newShift });
});

app.get('/api/shifts/active/account/:accId', async (req, res) => {
  try {
    const { accId } = req.params;
    const db = await getDB();
    const user = db.users.find(u => u.id === accId);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    
    // Filter active shifts to only those belonging to this account's profiles
    const accountActive = {};
    (user.profiles || []).forEach(p => {
      if (db.activeShifts[p.id]) {
        accountActive[p.id] = db.activeShifts[p.id];
      }
    });
    
    res.json({ activeShifts: accountActive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active shifts', details: err.message });
  }
});

app.get('/api/shifts/active/:profileId', async (req, res) => {
  const { profileId } = req.params;
  const db = await getDB();
  res.json({ activeShift: db.activeShifts[profileId] || null });
});

app.post('/api/shifts/active', async (req, res) => {
  try {
    const { profileId, clockIn } = req.body;
    if (!profileId || !clockIn) return res.status(400).json({ error: 'Missing profileId or clockIn' });
    
    const db = await getDB();
    db.activeShifts[profileId] = { clockIn };
    await saveDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save active shift' });
  }
});

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('⚠️  SMTP connection failed:', error.message);
    console.log('📧 Email sending will not work until SMTP is configured correctly.');
  } else {
    console.log('✅ SMTP server connected — ready to send emails');
  }
});

// ─── Clock In Email ──────────────────────────────────────────
function buildClockInEmail(worker, timestamp) {
  const time = new Date(timestamp);
  const formatted = time.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney',
  });

  return {
    subject: `⏰ ${worker} — Clocked In | Azura Tracker`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #e0e6f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #4f8fff 0%, #7c5cff 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #fff;">⏰ Clock In</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Azura Worker Tracker</p>
        </div>
        <div style="padding: 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Worker</td>
              <td style="padding: 12px 0; color: #fff; font-size: 16px; font-weight: 600; text-align: right; border-bottom: 1px solid #1a1f3d;">${worker}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Action</td>
              <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #1a1f3d;"><span style="background: #00d68f; color: #0a0e27; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700;">CLOCKED IN</span></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px;">Time</td>
              <td style="padding: 12px 0; color: #fff; font-size: 15px; text-align: right;">${formatted}</td>
            </tr>
          </table>
        </div>
        <div style="padding: 16px 32px 24px; text-align: center; color: #4a5178; font-size: 12px;">
          Azura Worker Tracker — Automated Notification
        </div>
      </div>
    `,
  };
}

// ─── Clock Out Email ─────────────────────────────────────────
function buildClockOutEmail(worker, clockIn, clockOut, duration, formData) {
  const clockInTime = new Date(clockIn);
  const clockOutTime = new Date(clockOut);
  const fmt = (d) =>
    d.toLocaleString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney',
    });

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const durationStr = `${hours}h ${minutes}m`;

  const rating = formData.rating || 0;
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return {
    subject: `✅ ${worker} — Clocked Out (${durationStr}) | Azura Tracker`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #e0e6f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #3d8eb9 0%, #2a6f94 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #fff;">✅ Clock Out Report</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Azura Employee Tracker</p>
        </div>

        <!-- Shift Summary -->
        <div style="padding: 24px 32px 0;">
          <h2 style="font-size: 16px; color: #3d8eb9; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px;">Shift Summary</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Employee</td>
              <td style="padding: 12px 0; color: #fff; font-size: 16px; font-weight: 600; text-align: right; border-bottom: 1px solid #1a1f3d;">${worker}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Clock In</td>
              <td style="padding: 12px 0; color: #e0e6f0; font-size: 14px; text-align: right; border-bottom: 1px solid #1a1f3d;">${fmt(clockInTime)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Clock Out</td>
              <td style="padding: 12px 0; color: #e0e6f0; font-size: 14px; text-align: right; border-bottom: 1px solid #1a1f3d;">${fmt(clockOutTime)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Duration</td>
              <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #1a1f3d;"><span style="background: #3d8eb9; color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 14px; font-weight: 700;">${durationStr}</span></td>
            </tr>
          </table>
        </div>

        <!-- Work Report -->
        <div style="padding: 24px 32px 0;">
          <h2 style="font-size: 16px; color: #10b981; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px;">What They Did</h2>
          <div style="padding: 16px; background: #111827; border-radius: 10px; border: 1px solid #1a1f3d;">
            <p style="margin: 0; color: #fff; font-size: 14px; line-height: 1.6; white-space: pre-line;">${formData.tasks}</p>
          </div>
          ${formData.notes ? `
          <h2 style="font-size: 14px; color: #8892b0; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px;">Notes</h2>
          <div style="padding: 12px 16px; background: #111827; border-radius: 10px; border: 1px solid #1a1f3d;">
            <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5; white-space: pre-line;">${formData.notes}</p>
          </div>` : ''}
          ${rating > 0 ? `
          <p style="margin: 20px 0 0; color: #8892b0; font-size: 13px;">Shift Rating: <span style="color: #ffc048; font-size: 18px;">${stars}</span></p>` : ''}
        </div>

        <div style="padding: 24px 32px 32px; text-align: center; color: #4a5178; font-size: 12px;">
          Azura Employee Tracker — Automated Notification
        </div>
      </div>
    `,
  };
}

function buildLeaveEmail(worker, date, reason) {
  return {
    subject: `🌴 ${worker} — Leave Day | Azura Tracker`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #e0e6f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #fff;">🌴 Leave Day Record</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Azura Employee Tracker</p>
        </div>
        <div style="padding: 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Employee</td>
              <td style="padding: 12px 0; color: #fff; font-size: 16px; font-weight: 600; text-align: right; border-bottom: 1px solid #1a1f3d;">${worker}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px; border-bottom: 1px solid #1a1f3d;">Date</td>
              <td style="padding: 12px 0; color: #fff; font-size: 15px; text-align: right; border-bottom: 1px solid #1a1f3d;">${new Date(date).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #8892b0; font-size: 14px;">Status</td>
              <td style="padding: 12px 0; text-align: right;"><span style="background: #10b981; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700;">AUTO-APPROVED</span></td>
            </tr>
          </table>
          <div style="margin-top: 24px; padding: 16px; background: #111827; border-radius: 10px; border: 1px solid #1a1f3d;">
            <p style="margin: 0; color: #8892b0; font-size: 12px; text-transform: uppercase;">Reason</p>
            <p style="margin: 8px 0 0; color: #fff; font-size: 14px;">${reason || 'Not specified'}</p>
          </div>
        </div>
        <div style="padding: 16px 32px 24px; text-align: center; color: #4a5178; font-size: 12px;">
          Azura Employee Tracker — Automated Notification
        </div>
      </div>
    `,
  };
}

// ─── API Endpoint ────────────────────────────────────────────
app.post('/api/send-email', async (req, res) => {
  try {
    const { type, worker, timestamp, clockIn, clockOut, duration, formData } = req.body;

    if (!type || !worker) {
      return res.status(400).json({ error: 'Missing required fields: type, worker' });
    }

    let emailContent;

    if (type === 'clock-in') {
      emailContent = buildClockInEmail(worker, timestamp);
    } else if (type === 'clock-out') {
      if (!formData || !formData.tasks) {
        return res.status(400).json({ error: 'Clock-out requires formData with tasks' });
      }
      emailContent = buildClockOutEmail(worker, clockIn, clockOut, duration, formData);
    } else if (type === 'leave') {
      const { date, reason } = req.body;
      emailContent = buildLeaveEmail(worker, date, reason);
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be clock-in, clock-out or leave' });
    }

    await transporter.sendMail({
      from: `"Azura Tracker" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log(`📧 Email sent: ${type} — ${worker}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email error:', error.message);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

app.get('/api/profiles/:accId', async (req, res) => {
  const { accId } = req.params;
  const db = await getDB();
  const user = db.users.find(u => u.id === accId);

  if (!user) return res.status(404).json({ error: 'Account not found' });
  res.json(user.profiles || []);
});

app.get('/api/leaves/:profileId', async (req, res) => {
  const { profileId } = req.params;
  const db = await getDB();
  const leaves = db.leaves.filter((l) => l.profileId === profileId);
  res.json(leaves);
});

app.post('/api/leaves', async (req, res) => {
  try {
    const { profileId, date, reason, worker } = req.body;
    if (!profileId || !date) return res.status(400).json({ error: 'Missing profileId or date' });
    
    const db = await getDB();
    const newLeave = {
      id: `leave-${Date.now()}`,
      profileId,
      date,
      reason,
      worker,
      status: 'approved',
      createdAt: new Date().toISOString()
    };
    
    db.leaves.push(newLeave);
    await saveDB(db);
    res.json({ success: true, leave: newLeave });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save leave record' });
  }
});

// ─── Utility: Clear Dummy Data ───────────────────────────────
app.get('/api/admin/clear-dummy-data', async (req, res) => {
  const db = await getDB();
  db.shifts = [];
  db.activeShifts = {};
  db.leaves = [];
  db.users.forEach(u => u.profiles = []);
  await saveDB(db);
  res.json({ success: true, message: 'All dummy profiles, shifts, and leaves cleared successfully! You can close this page and refresh your app.' });
});

// ─── Catch-all: serve index.html for SPA ─────────────────────
// Place this AFTER all API routes!
app.get('*', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🕐 Azura Worker Tracker               ║
  ║   Running on http://localhost:${PORT}       ║
  ╚══════════════════════════════════════════╝
  `);
});


app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal API Error' });
});

// Required for Vercel Serverless Functions

module.exports = app;
