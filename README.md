# 🚀 Odoo Discuss Message Monitoring System

A real-time message monitoring and dashboard system for Odoo's **discuss.channel** model. Monitor WhatsApp, LiveChat, Direct Messages, and Team Channels with a beautiful web interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 📱 **Multi-Channel Support** - WhatsApp, LiveChat, Direct Messages, Team Channels
- ⏱️ **Time Range Filtering** - View messages from last hour, day, week, or custom range
- 🔴 **Live Odoo Queries** - Fetch real-time data directly from Odoo
- 💾 **MongoDB Storage** - Fast local storage with full-text search
- 📊 **Beautiful Dashboard** - Modern, responsive web interface
- 🔄 **Real-Time Polling** - Automatic updates every 10 seconds
- 🔍 **Advanced Search** - Search by content, author, or channel
- 📈 **Statistics & Analytics** - Track message volumes and trends
- 🚨 **Alert Keywords** - Get notified on urgent messages
- 📜 **Conversation History** - View full conversation context

---

## 🎯 Use Cases

- Monitor customer support messages across all channels
- Track WhatsApp business conversations
- Archive important messages for compliance
- Generate reports on message volumes
- Build AI-powered chatbot integrations
- Customer service analytics

---

## 📋 Prerequisites

- **Node.js** v14 or higher
- **MongoDB** (local or cloud)
- **Odoo** instance with API access
- **Odoo API Key** (Settings → Users → Your User → Security → API Keys)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

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
POLL_INTERVAL=10000
MESSAGE_LIMIT=5
CONVERSATION_LIMIT=20
SHOW_CONVERSATION_CONTEXT=true

# Optional Features
ENABLE_WHATSAPP_ONLY=false
ENABLE_NOTIFICATIONS=false
ALERT_KEYWORDS=urgent,help,emergency
```

### 3. Test Authentication

```bash
node test-auth.js
```

Expected output:
```
✅ SUCCESS! UID: 2
✅ Found 150 channels
```

### 4. Backfill Historical Messages

Choose one:

```bash
# Option A: Last 24 hours
node backfill-24h.js

# Option B: Last N messages
node backfill-last-n.js 100

# Option C: Custom hours
node backfill-custom.js 48
```

### 5. Start the System

**Terminal 1 - API Server:**
```bash
node server.js
```

**Terminal 2 - Polling Agent:**
```bash
node app.js
```

### 6. Open Dashboard

Visit: **http://localhost:3000/index.html**

---

## 📁 Project Structure

```
wheekeep-agents/
├── app.js                  # Main polling agent
├── server.js              # REST API server
├── odooClient.js          # Odoo XML-RPC client
├── messageStore.js        # MongoDB storage layer
├── public/
│   └── index.html         # Web dashboard
├── backfill-24h.js        # Backfill last 24 hours
├── backfill-last-n.js     # Backfill last N messages
├── backfill-custom.js     # Backfill custom time range
├── check-recent.js        # Check recent messages
├── test-auth.js           # Test Odoo authentication
├── package.json
├── .env                   # Configuration (create this)
├── README.md             # This file
├── DISCUSS_MODEL_GUIDE.md # Detailed technical guide
└── API_REFERENCE.md       # API documentation
```

---

## 🎨 Dashboard Features

### Time Range Selector ⏱️

Filter messages by time period:
- **1 Hour** - Very recent messages
- **6 Hours** - Recent messages
- **24 Hours** - Last day (default)
- **3 Days** - Recent activity
- **1 Week** - Weekly overview
- **All Time** - Complete history

### Live Fetch from Odoo 🔴

Click **"🔄 Fetch Live from Odoo"** to bypass MongoDB and query Odoo directly.

### Channel Filters 📱

Filter by channel type:
- **All Channels** - Show everything
- **WhatsApp** - WhatsApp conversations only
- **Live Chat** - LiveChat sessions
- **Direct Messages** - User-to-user messages
- **Team Channels** - Internal team channels

### Search 🔍

Search across:
- Message content
- Channel names
- Author names

---

## 🔧 Configuration Options

### Polling Settings

```env
# Check every 10 seconds
POLL_INTERVAL=10000

# Fetch last 5 messages per poll
MESSAGE_LIMIT=5

# Show 20 messages of conversation history
CONVERSATION_LIMIT=20

# Enable/disable conversation context
SHOW_CONVERSATION_CONTEXT=true
```

### Filtering Options

```env
# Only track WhatsApp messages
ENABLE_WHATSAPP_ONLY=true

# Enable alert keywords
ENABLE_NOTIFICATIONS=true
ALERT_KEYWORDS=urgent,help,emergency,asap,critical
```

---

## 📡 API Endpoints

Base URL: `http://localhost:3000/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/channels` | GET | Get all channels |
| `/messages/latest` | GET | Latest messages |
| `/channels/:id/messages` | GET | Channel messages |
| `/messages/timerange?hours=24` | GET | Messages by time range ⭐ |
| `/odoo/messages/latest` | GET | Live from Odoo ⭐ |
| `/messages/unprocessed` | GET | Unprocessed messages |
| `/stats` | GET | System statistics |
| `/messages/search?q=query` | GET | Search messages |

⭐ = New features

**See `API_REFERENCE.md` for detailed documentation.**

---

## 💡 Usage Examples

### Fetch Messages from API

```bash
# Get latest messages
curl http://localhost:3000/api/messages/latest?limit=50

# Get messages from last 6 hours
curl http://localhost:3000/api/messages/timerange?hours=6

# Fetch live from Odoo
curl http://localhost:3000/api/odoo/messages/latest?limit=20

# Search messages
curl "http://localhost:3000/api/messages/search?q=urgent"

# Get statistics
curl http://localhost:3000/api/stats
```

### JavaScript Integration

```javascript
// Fetch messages in your app
async function getLatestMessages() {
  const response = await fetch('http://localhost:3000/api/messages/latest?limit=50');
  const data = await response.json();
  return data.messages;
}

// Get messages by time range
async function getMessagesByTime(hours) {
  const response = await fetch(`http://localhost:3000/api/messages/timerange?hours=${hours}`);
  const data = await response.json();
  return data.messages;
}

// Live fetch from Odoo
async function getLiveMessages() {
  const response = await fetch('http://localhost:3000/api/odoo/messages/latest');
  const data = await response.json();
  return data.messages;
}
```

---

## 🔍 Understanding discuss.channel

The system fetches messages from Odoo's `discuss.channel` model:

```javascript
// Query structure
const messages = await odoo.execute(
  'mail.message',
  'search_read',
  [[
    ['model', '=', 'discuss.channel'],  // Only discuss channels
    ['message_type', '=', 'comment'],   // Actual messages (not notifications)
    ['date', '>=', startDate]           // Optional time filter
  ]],
  { 
    fields: ['id', 'body', 'date', 'author_id', 'res_id'],
    order: 'date desc',
    limit: 100
  }
);
```

**Models:**
- `discuss.channel` - Channels (WhatsApp, LiveChat, etc.)
- `mail.message` - Messages within channels
- `ir.attachment` - File attachments

---

## 🐛 Troubleshooting

### ❌ Authentication Failed

**Problem:** `Authentication failed: Invalid credentials`

**Solutions:**
1. Verify `ODOO_PASSWORD` is an **API Key**, not your regular password
2. Generate API key: Odoo → Settings → Users → Your User → Security → API Keys
3. Check `ODOO_USERNAME` is your email
4. Verify `ODOO_DB` name is correct

### ❌ No Messages Appearing

**Problem:** Dashboard shows "No messages yet"

**Solutions:**
1. Run backfill script: `node backfill-24h.js`
2. Check if discuss.channel has messages: `node check-recent.js`
3. Verify MongoDB connection
4. Check if `app.js` is running

### ❌ Connection Refused

**Problem:** `ECONNREFUSED localhost:3000`

**Solutions:**
1. Start API server: `node server.js`
2. Check if port 3000 is available
3. Change `PORT` in `.env` if needed

### ❌ MongoDB Connection Error

**Problem:** `MongoServerError: Authentication failed`

**Solutions:**
1. Check `MONGODB_URI` format
2. Verify MongoDB is running: `mongod`
3. For local MongoDB: `mongodb://localhost:27017/odoo_messages`
4. For MongoDB Atlas: Use connection string from Atlas

---

## 📊 Performance Tips

1. **Use Time Range Filtering** - Faster than fetching all messages
2. **Adjust Poll Interval** - Balance between real-time and server load
3. **Limit Message Count** - Don't fetch more than needed
4. **Index MongoDB** - Indexes are created automatically
5. **Monitor System Resources** - Watch CPU/Memory usage

---

## 🔐 Security Recommendations

For **Production Deployment:**

1. **Add Authentication** - Implement JWT or API keys
2. **Use HTTPS** - Enable SSL/TLS
3. **Rate Limiting** - Prevent API abuse
4. **Input Validation** - Sanitize all inputs
5. **Environment Variables** - Never commit `.env` to git
6. **CORS Configuration** - Restrict allowed origins
7. **MongoDB Security** - Use authentication and encryption

---

## 🎯 Advanced Use Cases

### AI Chatbot Integration

```javascript
// Get unprocessed messages for AI
const response = await fetch('http://localhost:3000/api/messages/unprocessed');
const messages = await response.json();

// Process with AI
for (const msg of messages.messages) {
  const reply = await aiModel.generateReply(msg.body);
  // Send reply to Odoo
  // Mark as processed
}
```

### Custom Analytics

```javascript
// Get messages by time range
const last24h = await fetch('http://localhost:3000/api/messages/timerange?hours=24');
const lastWeek = await fetch('http://localhost:3000/api/messages/timerange?hours=168');

// Calculate metrics
const todayCount = last24h.count;
const weekCount = lastWeek.count;
const averagePerDay = weekCount / 7;
```

### Export Messages

```javascript
// Fetch all messages
const response = await fetch('http://localhost:3000/api/messages/latest?limit=10000');
const data = await response.json();

// Convert to CSV
const csv = convertToCSV(data.messages);
downloadFile('messages.csv', csv);
```

---

## 📚 Documentation

- **[DISCUSS_MODEL_GUIDE.md](./DISCUSS_MODEL_GUIDE.md)** - Complete technical guide
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API endpoint documentation

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- [ ] Add WebSocket support for real-time updates
- [ ] Export messages to CSV/Excel
- [ ] Email notifications for alerts
- [ ] Message analytics dashboard
- [ ] AI-powered auto-replies
- [ ] Multi-language support
- [ ] Dark mode theme

---

## 📝 License

MIT License - See LICENSE file for details

---

## 👤 Author

**Wheekeep Agents Team**

For questions or support, please open an issue.

---

## 🎉 Changelog

### v1.0.0 (2026-01-09)

#### 🆕 New Features
- ✅ Time range filtering (1h, 6h, 24h, 3d, 1w, all time)
- ✅ Live fetch from Odoo (bypass database)
- ✅ Custom time range API endpoint
- ✅ Direct Odoo query endpoint

#### ✨ Existing Features
- ✅ Real-time message polling
- ✅ MongoDB storage
- ✅ Beautiful web dashboard
- ✅ Channel filtering
- ✅ Search functionality
- ✅ Statistics and metrics
- ✅ Conversation history
- ✅ Alert keywords
- ✅ Backfill scripts

---

## 🚦 Status

- ✅ **Production Ready**
- ✅ All features tested
- ✅ Documentation complete
- ✅ API stable

---

## ⭐ Show Your Support

If this project helped you, please give it a star! ⭐

---

**Happy Monitoring! 🚀**

