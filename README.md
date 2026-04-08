# Azura Worker Tracker 🕐

A premium clock-in/clock-out system for Azura booking workers with SMTP email notifications and work summary reports.

## Features

- ✅ **Clock In / Clock Out** with real-time shift timer
- 📧 **SMTP Email Notifications** — admin receives clock-in and full work reports on clock-out
- 📝 **Clock-Out Form** — workers describe tasks, clients served, services, products, notes, and shift rating
- 📊 **Shift History** — last 7 days of shifts with weekly totals
- 💾 **No Database** — uses localStorage (emails serve as permanent records)
- 🎨 **Premium Dark UI** — glassmorphism design, responsive, mobile-first

## Quick Setup

### 1. Clone & Install

```bash
git clone https://github.com/Natraj-IT-Solutions/tracker.git
cd tracker
npm install
```

### 2. Configure SMTP

Copy the env example and fill in your SMTP credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@yourbusiness.com
PORT=3000
```

**For Gmail:** Use an [App Password](https://support.google.com/accounts/answer/185833) (not your regular password).

### 3. Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Open **http://localhost:3000** in your browser.

## Configure Workers

Edit `public/js/config.js` to add/remove workers:

```js
workers: [
  { id: 'worker-1', name: 'Alex Johnson', role: 'Senior Stylist' },
  { id: 'worker-2', name: 'Mia Chen', role: 'Stylist' },
  // Add more workers here...
],
```

## How It Works

1. Worker selects their name from the home screen
2. Click the green **Clock In** button — admin gets an email
3. Work your shift — timer counts in real-time
4. Click the red **Clock Out** button — fill in the work summary form
5. Submit — admin gets a detailed shift report via email

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Email:** Nodemailer (SMTP)
- **Storage:** Browser localStorage
