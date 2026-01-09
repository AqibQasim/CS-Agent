# Odoo Discuss Model - Message Fetching System

## 📋 Overview

This system monitors and displays messages from Odoo's **discuss.channel** model in real-time. It fetches messages from various channel types (WhatsApp, LiveChat, Direct Messages, Team Channels) and displays them in a beautiful web dashboard.

---

## 🏗️ Architecture

### **Backend Components**

#### 1. **OdooClient.js** - Odoo XML-RPC Connection
Handles all communication with Odoo via XML-RPC protocol.

**Key Methods:**
- `authenticate()` - Authenticates with Odoo using API key
- `getAllChannels()` - Fetches all discuss.channel records
- `getNewMessagesGlobal(lastMessageId, limit)` - Fetches messages after a specific ID
- `getChannelConversation(channelId, limit)` - Gets full conversation history
- `getLatestMessagesAllChannels(limit)` - Gets latest messages from all channels

**Odoo Model Used:** `discuss.channel` (for channels) and `mail.message` (for messages)

```javascript
// Example: Fetch latest messages
const messages = await odoo.execute(
  'mail.message',
  'search_read',
  [[
    ['model', '=', 'discuss.channel'],  // ← Only discuss.channel messages
    ['message_type', '=', 'comment']
  ]],
  {
    fields: ['id', 'body', 'date', 'author_id', 'res_id'],
    order: 'id desc',
    limit: 50
  }
);
```

#### 2. **MessageStore.js** - MongoDB Storage
Stores and manages messages in MongoDB.

**Collections:**
- `messages` - Stores all fetched messages
- `channel_state` - Tracks last processed message per channel
- `global_state` - Tracks last processed message globally

**New Methods Added:**
- `getMessagesByTimeRange(hours, limit)` - Get messages from last N hours

#### 3. **App.js** - Polling Agent
Continuously monitors Odoo for new messages and stores them.

**Features:**
- Configurable polling interval (ENV: `POLL_INTERVAL`)
- Message limit per poll (ENV: `MESSAGE_LIMIT`)
- WhatsApp-only mode (ENV: `ENABLE_WHATSAPP_ONLY`)
- Alert keywords (ENV: `ALERT_KEYWORDS`)

#### 4. **Server.js** - REST API
Provides HTTP endpoints for the frontend.

**API Endpoints:**

| Endpoint | Description | Example |
|----------|-------------|---------|
| `GET /api/channels` | Get all discuss channels | `/api/channels` |
| `GET /api/messages/latest` | Get latest messages | `/api/messages/latest?limit=50` |
| `GET /api/channels/:id/messages` | Get messages for specific channel | `/api/channels/123/messages` |
| `GET /api/messages/timerange` | **NEW** Get messages by time range | `/api/messages/timerange?hours=24` |
| `GET /api/odoo/messages/latest` | **NEW** Fetch live from Odoo | `/api/odoo/messages/latest?limit=20` |
| `GET /api/stats` | Get system statistics | `/api/stats` |
| `GET /api/messages/search` | Search messages | `/api/messages/search?q=hello` |

---

## 🎨 Frontend Dashboard

**File:** `public/index.html`

### New Features Added:

#### ⏱️ **Time Range Selector**
Select different time periods to view messages:
- **1 Hour** - Messages from last hour
- **6 Hours** - Messages from last 6 hours
- **24 Hours** - Messages from last 24 hours (default)
- **3 Days** - Messages from last 3 days
- **1 Week** - Messages from last week
- **All Time** - All stored messages

#### 🔴 **Live Fetch from Odoo**
Click "🔄 Fetch Live from Odoo" to bypass the database and fetch directly from Odoo in real-time.

**JavaScript Functions:**
```javascript
// Set time range filter
dashboard.setTimeRange(24); // Last 24 hours

// Fetch live from Odoo
dashboard.loadFromOdooDirect();
```

---

## 🚀 Usage Guide

### **Step 1: Setup Environment Variables**

Create a `.env` file:

```env
# Odoo Connection
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database
ODOO_USERNAME=your_email@example.com
ODOO_PASSWORD=your_api_key_here

# MongoDB
MONGODB_URI=mongodb://localhost:27017/odoo_messages

# Server
PORT=3000

# Polling Configuration
POLL_INTERVAL=10000          # 10 seconds
MESSAGE_LIMIT=5              # Fetch last 5 messages per poll
CONVERSATION_LIMIT=20        # Show 20 messages in conversation history
SHOW_CONVERSATION_CONTEXT=true

# Filtering
ENABLE_WHATSAPP_ONLY=false   # Set to true to only track WhatsApp
ENABLE_NOTIFICATIONS=false
ALERT_KEYWORDS=urgent,help,emergency
```

### **Step 2: Install Dependencies**

```bash
npm install
```

### **Step 3: Backfill Historical Messages**

Before starting the real-time monitoring, fetch historical messages:

#### Option A: Last 24 Hours
```bash
node backfill-24h.js
```

#### Option B: Last N Messages (ignoring time)
```bash
node backfill-last-n.js 100  # Last 100 messages
```

#### Option C: Custom Time Range
```bash
node backfill-custom.js 48   # Last 48 hours
```

### **Step 4: Start the System**

#### Terminal 1: Start API Server
```bash
node server.js
```
This starts the REST API on `http://localhost:3000`

#### Terminal 2: Start Polling Agent
```bash
node app.js
```
This starts monitoring Odoo for new messages

### **Step 5: Open Dashboard**

Open your browser and go to:
```
http://localhost:3000/index.html
```

---

## 🔧 Customizing Time Ranges

### **Backend: Add Custom Time Range API**

The new endpoint supports any time range:

```bash
# Get messages from last 2 hours
curl http://localhost:3000/api/messages/timerange?hours=2

# Get messages from last 7 days (168 hours)
curl http://localhost:3000/api/messages/timerange?hours=168
```

### **Frontend: Add More Time Range Buttons**

Edit `public/index.html`, find the time range buttons section and add:

```html
<button onclick="dashboard.setTimeRange(12)" class="time-range-btn px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-blue-600 hover:text-white transition">
  12 Hours
</button>
```

---

## 📊 How It Works

### **Message Flow:**

```
┌─────────────┐
│    Odoo     │
│  (discuss   │
│  .channel)  │
└──────┬──────┘
       │
       │ XML-RPC API
       ▼
┌─────────────┐
│ OdooClient  │ ← Fetches messages via XML-RPC
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ MessageStore│ ← Stores in MongoDB
│  (MongoDB)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Server.js │ ← Serves via REST API
│  (REST API) │
└──────┬──────┘
       │
       │ HTTP
       ▼
┌─────────────┐
│  Dashboard  │ ← Displays in browser
│   (HTML/JS) │
└─────────────┘
```

### **Real-Time Polling:**

1. `app.js` polls Odoo every N seconds (configurable)
2. Fetches only NEW messages (using message ID tracking)
3. Stores messages in MongoDB with metadata
4. Dashboard auto-refreshes every 10 seconds
5. Frontend can also fetch live from Odoo directly

---

## 🎯 Key Features

### ✅ **What's Already Working:**
- ✅ Fetches from `discuss.channel` model
- ✅ Stores messages in MongoDB
- ✅ Real-time polling
- ✅ Beautiful web dashboard
- ✅ Channel filtering (WhatsApp, LiveChat, etc.)
- ✅ Search functionality
- ✅ Conversation history
- ✅ Statistics and metrics

### 🆕 **What We Just Added:**
- 🆕 **Time range filtering** (1h, 6h, 24h, 3d, 1w, all)
- 🆕 **Live fetch from Odoo** (bypass database)
- 🆕 **Custom time range API** endpoint
- 🆕 **Direct Odoo query** endpoint

---

## 🔍 Understanding discuss.channel Model

### **What is discuss.channel?**

In Odoo, `discuss.channel` is the model that represents:
- WhatsApp conversations
- LiveChat sessions
- Direct messages between users
- Team channels
- Email discussions

### **Related Models:**

```
discuss.channel (channels)
    ├── mail.message (messages in channel)
    ├── mail.channel.member (channel members)
    └── ir.attachment (attachments)
```

### **Message Detection:**

```javascript
// Fetch messages where model = 'discuss.channel'
const domain = [
  ['model', '=', 'discuss.channel'],  // Only discuss messages
  ['message_type', '=', 'comment'],   // Only actual messages (not notifications)
  ['date', '>=', '2026-01-01']        // Optional: time filter
];
```

### **Channel Types:**

| channel_type | Description |
|--------------|-------------|
| `chat` | Direct message between users |
| `channel` | Team channel |
| `livechat` | Live chat session |
| WhatsApp | Detected by numeric name pattern |

---

## 🛠️ Advanced Configuration

### **Fetch Only WhatsApp Messages:**

In `.env`:
```env
ENABLE_WHATSAPP_ONLY=true
```

Or in code:
```javascript
const messages = await odoo.execute(
  'mail.message',
  'search_read',
  [[
    ['model', '=', 'discuss.channel'],
    ['res_id', 'in', whatsappChannelIds]  // Only WhatsApp channel IDs
  ]],
  { fields: ['id', 'body', 'date'], limit: 100 }
);
```

### **Custom Polling Interval:**

In `.env`:
```env
POLL_INTERVAL=5000  # Poll every 5 seconds
MESSAGE_LIMIT=10    # Fetch 10 messages per poll
```

### **Alert Keywords:**

Get notified for urgent messages:
```env
ENABLE_NOTIFICATIONS=true
ALERT_KEYWORDS=urgent,help,emergency,asap
```

---

## 📱 Testing

### **Test Odoo Authentication:**
```bash
node test-auth.js
```

### **Check Recent Messages:**
```bash
node check-recent.js
```

### **Test API Endpoints:**
```bash
# Get channels
curl http://localhost:3000/api/channels

# Get latest messages
curl http://localhost:3000/api/messages/latest

# Get messages from last 6 hours
curl http://localhost:3000/api/messages/timerange?hours=6

# Fetch live from Odoo
curl http://localhost:3000/api/odoo/messages/latest?limit=20
```

---

## 🐛 Troubleshooting

### **No messages appearing?**
1. Check Odoo authentication: `node test-auth.js`
2. Verify discuss.channel has messages
3. Run backfill script: `node backfill-24h.js`
4. Check MongoDB connection

### **"Authentication failed" error?**
- Verify `ODOO_PASSWORD` is an API key (not regular password)
- Check `ODOO_USERNAME` format (email)
- Ensure user has access to discuss.channel

### **Messages not updating in real-time?**
- Check `app.js` is running
- Verify `POLL_INTERVAL` is set
- Check browser console for errors

---

## 📚 Further Customization

### **Add New Message Fields:**

Edit `odooClient.js`:
```javascript
fields: [
  'id', 'body', 'date', 'author_id',
  'subject',           // Add subject
  'subtype_id',        // Add message subtype
  'tracking_value_ids' // Add tracking values
]
```

### **Create Custom Dashboard View:**

The frontend is fully customizable. Edit `public/index.html` to:
- Add new filters
- Change colors/styling
- Add charts/graphs
- Export functionality

---

## 🎉 Summary

This system provides a **complete solution** for monitoring Odoo's `discuss.channel` model with:

1. ✅ Real-time message fetching
2. ✅ Historical data backfill
3. ✅ Time-range filtering
4. ✅ Live Odoo queries
5. ✅ Beautiful web dashboard
6. ✅ MongoDB storage
7. ✅ REST API
8. ✅ Search & filtering

**You can now:**
- View messages from last 1h, 6h, 24h, 3d, 1w, or all time
- Fetch live messages directly from Odoo
- Filter by channel type (WhatsApp, LiveChat, etc.)
- Search messages
- Monitor in real-time

Enjoy your Odoo message monitoring system! 🚀

