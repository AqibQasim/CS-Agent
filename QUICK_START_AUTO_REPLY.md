# 🚀 Quick Start: Auto-Reply System

## ✅ What's Been Fixed

### 1. **Attachment Download** ✅
- **Problem:** Attachments required authentication
- **Solution:** New API endpoint `/api/attachments/:id/download` that proxies the download
- **Status:** FIXED - Test it now!

### 2. **Auto-Reply Bot Created** ✅
- **File:** `auto-reply-bot.js`
- **Features:**
  - Only replies to TEST NUMBERS
  - Skips team member messages
  - Marks messages as processed
  - Keyword-based replies (upgradeable to GPT-4)

---

## 🎯 How to Test Auto-Reply

### Step 1: Restart Server (for attachment fix)

```bash
# Stop current server (Ctrl+C in server terminal)
npm run server
```

### Step 2: Test Attachment Download

1. Open dashboard: http://localhost:3000/index-v2.html
2. Click on any channel with attachments
3. Click on "📎 Attachment" button
4. Should open PDF/image in new tab ✅

---

### Step 3: Run Auto-Reply Bot

```bash
# In a NEW terminal
npm run autoreply
```

**What it does:**
- Checks for unprocessed messages every 10 seconds
- Only replies to numbers in `TEST_NUMBERS` array
- Skips team member messages
- Marks all messages as processed

**Current Test Number:**
- `966538797999` (your number from screenshot)

---

### Step 4: Send Test Message

1. Send a WhatsApp message to your Odoo number
2. Say: "كم السعر؟" or "Hello"
3. Wait 10-20 seconds
4. Bot should auto-reply!

---

## 📋 Bot Responses

The bot has keyword-based responses for:

### 🤝 Greetings
**Keywords:** سلام, مرحبا, hello, hi
**Reply:** Welcome message

### 💰 Price Inquiry
**Keywords:** سعر, كم, price, cost
**Reply:** Asks for photos, location, destination

### 📦 Storage
**Keywords:** تخزين, storage
**Reply:** Storage info + requests details

### 🚚 Moving
**Keywords:** نقل, شحن, moving
**Reply:** Moving info + requests details

### 📍 Location
**Detects:** Location shared
**Reply:** Confirms receipt

### 📸 Photos
**Detects:** Attachments
**Reply:** Thanks for photos

### 🤷 Default
**Any other message**
**Reply:** General acknowledgment

---

## 🎛️ Configuration

### Add More Test Numbers

Edit `auto-reply-bot.js`:

```javascript
const TEST_NUMBERS = [
  '966538797999',  // Your test number
  '966554022004',  // Add more here
];
```

### Disable Auto-Reply for Specific Number

Just remove from the array!

---

## 🚀 Upgrade to GPT-4 (Advanced)

### Step 1: Get OpenAI API Key

1. Go to https://platform.openai.com/
2. Create account
3. Get API key
4. Add to `.env`:

```env
OPENAI_API_KEY=sk-proj-...your-key...
```

### Step 2: Install OpenAI Package

```bash
npm install openai
```

### Step 3: Replace `generateReply` Method

In `auto-reply-bot.js`, replace the `generateReply` method with:

```javascript
async generateReply(message) {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Get conversation history
  const history = await this.store.getMessagesByChannel(message.channel_id, 5);
  
  const context = history.map(m => {
    const author = m.author_id ? m.author_id[1] : 'Customer';
    const body = this.cleanHtml(m.body);
    return `${author}: ${body}`;
  }).join('\n');

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `أنت موظفة خدمة عملاء في شركة "ويكيب" لخدمات التخزين والنقل.
        اسمك Helen Sarhan.
        
        خدماتنا:
        - تخزين الأثاث
        - نقل العفش
        - تغليف
        
        كوني مهذبة ومحترفة.
        
        المحادثة السابقة:
        ${context}`
      },
      {
        role: "user",
        content: this.cleanHtml(message.body)
      }
    ],
    max_tokens: 200
  });

  return response.choices[0].message.content;
}
```

---

## 🔍 Monitoring

### Watch Bot Activity

The bot logs everything:

```
🤖 Auto-Reply Bot ACTIVE

📨 Found 3 unprocessed messages

🎯 AUTO-REPLYING to 966538797999
   Message: كم السعر؟
   ✅ Reply sent: شكراً على استفسارك! لتقديم...

📊 Summary: 1 replied, 2 skipped
```

### Check Dashboard

The dashboard now shows:
- Messages by channel
- Clickable attachments ✅
- Send message input box ✅
- Better author detection ✅

---

## ⚠️ Important Notes

### About "Unprocessed" Count

**Issue:** Shows 514 unprocessed

**Why:** All messages are marked `processed: false` by default

**Fix:** The auto-reply bot marks messages as processed. After running for a while, count will decrease.

**To mark ALL as processed immediately:**

```javascript
// Create mark-all-processed.js
const MessageStore = require('./messageStore');

async function markAll() {
  const store = new MessageStore(process.env.MONGODB_URI);
  await store.connect();
  
  const result = await store.db.collection('messages').updateMany(
    { processed: false },
    { $set: { processed: true } }
  );
  
  console.log(`Marked ${result.modifiedCount} messages as processed`);
  await store.client.close();
}

markAll();
```

---

## 🎯 Next Steps

### Phase 1: Testing (This Week)
- [ ] Test attachment download ✅
- [ ] Run auto-reply bot
- [ ] Send test message from 966538797999
- [ ] Verify bot replies
- [ ] Monitor in dashboard

### Phase 2: Expand (Next Week)
- [ ] Add more test numbers
- [ ] Upgrade to GPT-4 (optional)
- [ ] Add RAG for better responses
- [ ] Fine-tune prompts

### Phase 3: Production (Month 2)
- [ ] Move to n8n workflow (optional)
- [ ] Add advanced business logic
- [ ] Scale to all channels
- [ ] Monitor and optimize

---

## 🆘 Troubleshooting

### Bot Not Replying

1. **Check bot is running:** `npm run autoreply`
2. **Check test number:** Is it in TEST_NUMBERS array?
3. **Check message is from customer:** Not team member?
4. **Check logs:** See what bot is doing

### Attachments Not Opening

1. **Check server is running:** `npm run server`
2. **Check browser console:** F12 → Console
3. **Check error logs:** In server terminal

### Messages Not Showing

1. **Run sync:** `npm run sync`
2. **Check polling agent:** `npm start`
3. **Check database:** Is MongoDB running?

---

## 📞 Support

If you need help:
1. Check logs in terminal
2. See `COMPLETE_ROADMAP_AI_AUTOREPLY.md` for detailed guide
3. See `TROUBLESHOOTING.md` for common issues

---

## 🎉 Success Checklist

- [ ] Server running on port 3000
- [ ] Polling agent fetching messages
- [ ] Auto-reply bot active
- [ ] Test message sent
- [ ] Bot replied successfully
- [ ] Message marked as processed
- [ ] Attachments clickable
- [ ] Dashboard showing correctly

---

## 💡 Tips

1. **Start Small:** Test with ONE number first
2. **Monitor Closely:** Watch the logs
3. **Iterate:** Improve responses based on feedback
4. **Upgrade Gradually:** Keyword → GPT-3.5 → GPT-4 → RAG
5. **Keep Frontend:** For monitoring and manual override

---

## 🚀 Ready to Go!

```bash
# Terminal 1: Polling agent
npm start

# Terminal 2: API server
npm run server

# Terminal 3: Auto-reply bot
npm run autoreply
```

Open dashboard: http://localhost:3000/index-v2.html

Send test message and watch the magic! 🎩✨

