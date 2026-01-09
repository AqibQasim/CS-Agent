# 🔧 Troubleshooting Guide

## Issue 1: Messages Not Showing in Time Range Filter

### Problem
When clicking "24 Hours" or "3 Days", the dashboard shows 0 messages even though there are recent messages in Odoo.

### Root Cause
The polling agent got "stuck" at a message ID and isn't detecting newer messages that came after it was initialized.

### Solution ✅

**Run the sync script to get ALL recent messages:**

```bash
node sync-all-recent.js
```

This script will:
- Fetch ALL messages from last 7 days (regardless of message ID)
- Show you which channels have the most messages
- Save all messages to MongoDB
- Update the tracking to the highest message ID

After running this, your dashboard will show ALL recent messages!

---

## Issue 2: Channel Missing from Frontend (966533241989)

### Problem
A specific WhatsApp channel (966533241989) exists in Odoo but doesn't appear in the frontend channel list.

### Root Cause
The frontend was limiting display to first 100 channels only.

### Solution ✅

**Already Fixed!** The channel list now shows ALL channels without limit.

Just refresh your dashboard: **http://localhost:3000/index.html**

---

## Issue 3: Duplicate Messages Showing

### Problem
Both "client" and "messenger" messages appearing, causing duplicates.

### Root Cause
Odoo stores both incoming and outgoing messages with different authors. Both are valid messages but may look duplicate in the UI.

### Solution

**Option 1: Filter by Author (Recommended for Auto-Reply System)**

When building your auto-reply system, only process messages from customers, not from your system:

```javascript
// Get unprocessed messages
const messages = await fetch('http://localhost:3000/api/messages/unprocessed').then(r => r.json());

// Filter out messages from your bot/system
const customerMessages = messages.messages.filter(msg => {
  // Only process if message is FROM customer (not your system)
  const author = msg.author_id ? msg.author_id[1] : msg.email_from;
  return author !== 'OdooBot' && author !== 'Administrator'; // Add your bot names here
});

// Process only customer messages
for (const msg of customerMessages) {
  // Your auto-reply logic here
  await sendReply(msg.channel_id, generateReply(msg.body));
  // Mark as processed
  await markAsProcessed(msg.message_id);
}
```

**Option 2: Deduplicate by Content**

The UI shows both because they're technically different messages. To deduplicate in your auto-reply system:

```javascript
// Group messages by channel and content
const uniqueMessages = {};
messages.forEach(msg => {
  const key = `${msg.channel_id}-${msg.body}`;
  if (!uniqueMessages[key] || msg.date > uniqueMessages[key].date) {
    uniqueMessages[key] = msg;
  }
});

// Process only unique messages
Object.values(uniqueMessages).forEach(msg => {
  // Your auto-reply logic
});
```

---

## Issue 4: Time Range Shows Wrong Results

### Problem
The time range filter uses the message's **original date** (when it was sent in Odoo), not when it was stored in MongoDB.

### Explanation

There are TWO date fields:
- `date` - When the message was sent in Odoo (original date)
- `created_at` - When we stored it in MongoDB (recent)

The time filter uses `date` field, so if you backfilled old messages, they won't appear in "Last 24 Hours" even though you just stored them.

### Solution ✅

**Use the sync script to get recent messages:**

```bash
node sync-all-recent.js
```

This fetches messages that were actually sent in the last 7 days in Odoo.

**Or, if you want to see what you recently stored, use this API:**

```bash
curl "http://localhost:3000/api/messages/latest?limit=100"
```

This gets the most recent 100 messages from MongoDB regardless of when they were sent.

---

## Issue 5: System Status - Check if Everything is Working

### Quick Health Check

```bash
# Check API server
curl http://localhost:3000/api/health

# Check statistics
curl http://localhost:3000/api/stats

# Check channels
curl http://localhost:3000/api/channels | jq '.total'

# Check messages
curl http://localhost:3000/api/messages/latest?limit=10 | jq '.count'
```

### Expected Output

```json
{
  "status": "ok",
  "initialized": true,
  "timestamp": "2026-01-09T..."
}
```

---

## Complete System Reset & Sync

If things are really messed up, here's the complete process to start fresh:

### Step 1: Stop Everything

```bash
# Press Ctrl+C in terminal running app.js
# Press Ctrl+C in terminal running server.js
```

### Step 2: Clear MongoDB (Optional - only if needed)

```bash
# In MongoDB shell or:
mongosh odoo_messages --eval "db.dropDatabase()"
```

### Step 3: Sync ALL Recent Messages

```bash
node sync-all-recent.js
```

### Step 4: Start System

```bash
# Terminal 1
node server.js

# Terminal 2
node app.js
```

### Step 5: Verify

Open: **http://localhost:3000/index.html**

You should now see:
- ✅ All channels including 966533241989
- ✅ Recent messages (last 7 days)
- ✅ Correct statistics
- ✅ Time filters working

---

## Auto-Reply System Architecture

Since you want to build an auto-reply system, here's the recommended architecture:

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    ODOO                             │
│           (WhatsApp, Web, LiveChat)                 │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ Incoming Messages
                    ▼
        ┌───────────────────────┐
        │   Polling Agent       │
        │    (app.js)           │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │     MongoDB           │
        │  (Message Storage)    │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Auto-Reply Bot       │
        │  (your new script)    │
        └───────────┬───────────┘
                    │
                    │ 1. Fetch unprocessed messages
                    │ 2. Generate AI reply
                    │ 3. Send reply to Odoo
                    │ 4. Mark as processed
                    │
                    ▼
        ┌───────────────────────┐
        │    Odoo RPC API       │
        │  (send message back)  │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Customer receives   │
        │   auto-reply          │
        └───────────────────────┘
```

### Sample Auto-Reply Bot

Create `auto-reply-bot.js`:

```javascript
require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

class AutoReplyBot {
  constructor() {
    this.odoo = new OdooClient(
      process.env.ODOO_URL,
      process.env.ODOO_DB,
      process.env.ODOO_USERNAME,
      process.env.ODOO_PASSWORD
    );
    this.store = new MessageStore(process.env.MONGODB_URI);
  }

  async initialize() {
    await this.odoo.authenticate();
    await this.store.connect();
    console.log('✅ Auto-Reply Bot initialized');
  }

  async processMessages() {
    // Get unprocessed messages
    const messages = await this.store.getUnprocessedMessages(10);
    
    for (const msg of messages) {
      // Filter: Only customer messages (not bot messages)
      const author = msg.author_id ? msg.author_id[1] : msg.email_from;
      if (author === 'OdooBot' || author === 'Administrator') {
        await this.store.markAsProcessed(msg.message_id);
        continue;
      }

      console.log(`📨 Processing message from ${author}`);
      console.log(`   Channel: ${msg.channel_name}`);
      console.log(`   Message: ${msg.body.substring(0, 50)}...`);

      // Generate reply (customize this!)
      const reply = this.generateReply(msg.body);

      // Send reply back to Odoo
      await this.sendReply(msg.channel_id, reply);

      // Mark as processed
      await this.store.markAsProcessed(msg.message_id);
      
      console.log(`✅ Replied: ${reply}\n`);
    }
  }

  generateReply(messageBody) {
    // Simple keyword-based replies (replace with AI later)
    const body = messageBody.toLowerCase();

    if (body.includes('price') || body.includes('cost')) {
      return 'Thank you for your inquiry! Our prices start at $X. Would you like more details?';
    }

    if (body.includes('hello') || body.includes('hi')) {
      return 'Hello! How can I help you today?';
    }

    // Default reply
    return 'Thank you for your message. A team member will respond shortly.';
  }

  async sendReply(channelId, message) {
    // Send message to discuss.channel
    try {
      await this.odoo.execute(
        'mail.channel',
        'message_post',
        [channelId],
        {
          body: message,
          message_type: 'comment'
        }
      );
    } catch (error) {
      console.error('Error sending reply:', error.message);
    }
  }

  async start() {
    console.log('🤖 Auto-Reply Bot started');
    console.log('⏰ Checking for messages every 5 seconds\n');

    // Process immediately
    await this.processMessages();

    // Then every 5 seconds
    setInterval(async () => {
      await this.processMessages();
    }, 5000);
  }
}

// Run bot
async function main() {
  const bot = new AutoReplyBot();
  await bot.initialize();
  await bot.start();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### To Run Auto-Reply Bot

```bash
node auto-reply-bot.js
```

---

## Summary of Fixes

1. ✅ **Sync Script** - `sync-all-recent.js` to fetch ALL recent messages
2. ✅ **Remove Channel Limit** - Frontend now shows ALL channels
3. ✅ **Better Indexing** - Added `created_at` index for performance
4. ✅ **Duplicate Handling** - Filter by author in auto-reply system
5. ✅ **Auto-Reply Architecture** - Sample bot code provided

---

## Next Steps

1. **Run sync script:**
   ```bash
   node sync-all-recent.js
   ```

2. **Refresh dashboard:**
   ```
   http://localhost:3000/index.html
   ```

3. **Verify all channels show** (including 966533241989)

4. **Verify messages appear** in time filters

5. **Build auto-reply bot** using the sample code above

---

## Need Help?

Check these files:
- `README.md` - Complete documentation
- `DISCUSS_MODEL_GUIDE.md` - Technical details
- `API_REFERENCE.md` - API endpoints
- `QUICK_START.md` - Setup guide

---

**Your system is now ready for auto-reply functionality!** 🚀

