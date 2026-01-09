# ⚡ Quick Start Guide - Odoo Discuss Messages

Get up and running with Odoo message monitoring in 5 minutes!

---

## 📦 What You Need

- ✅ Node.js installed
- ✅ MongoDB running
- ✅ Odoo instance with API access
- ✅ Odoo API key

---

## 🚀 5-Minute Setup

### Step 1: Clone & Install (1 min)

```bash
cd wheekeep-agents
npm install
```

### Step 2: Configure (2 min)

Create `.env` file:

```env
ODOO_URL=https://your-odoo.com
ODOO_DB=your_database
ODOO_USERNAME=your@email.com
ODOO_PASSWORD=your_api_key

MONGODB_URI=mongodb://localhost:27017/odoo_messages
PORT=3000
POLL_INTERVAL=10000
MESSAGE_LIMIT=5
```

**Get API Key:**
1. Login to Odoo
2. Settings → Users → Your User
3. Security → API Keys → Generate

### Step 3: Test Connection (30 sec)

```bash
node test-auth.js
```

Expected: `✅ SUCCESS! UID: 2`

### Step 4: Load Messages (1 min)

```bash
node backfill-24h.js
```

This fetches messages from the last 24 hours.

### Step 5: Start System (30 sec)

**Terminal 1:**
```bash
node server.js
```

**Terminal 2:**
```bash
node app.js
```

### Step 6: Open Dashboard

Visit: **http://localhost:3000/index.html**

---

## 🎯 You're Done!

You should now see:
- ✅ Dashboard with messages
- ✅ Real-time updates
- ✅ Channel list
- ✅ Statistics

---

## 🎨 Using the Dashboard

### Time Range Buttons

Click to filter messages:
- **1 Hour** - Very recent
- **6 Hours** - Recent  
- **24 Hours** - Last day (default)
- **3 Days** - Recent activity
- **1 Week** - Weekly view
- **All Time** - Everything

### Live Fetch

Click **"🔄 Fetch Live from Odoo"** to get real-time data directly from Odoo.

### Channel Filters

- **All Channels** - Everything
- **WhatsApp** - WhatsApp only
- **Live Chat** - LiveChat sessions
- **Direct Messages** - User messages
- **Team Channels** - Internal channels

### Search

Type in the search box and press Enter to search messages.

---

## 📡 Using the API

Base URL: `http://localhost:3000/api`

### Get Latest Messages

```bash
curl http://localhost:3000/api/messages/latest?limit=50
```

### Get Messages from Last 6 Hours

```bash
curl http://localhost:3000/api/messages/timerange?hours=6
```

### Fetch Live from Odoo

```bash
curl http://localhost:3000/api/odoo/messages/latest?limit=20
```

### Get All Channels

```bash
curl http://localhost:3000/api/channels
```

### Search Messages

```bash
curl "http://localhost:3000/api/messages/search?q=urgent"
```

### Get Statistics

```bash
curl http://localhost:3000/api/stats
```

---

## 🔧 Common Commands

### Start Everything

```bash
# Terminal 1
node server.js

# Terminal 2  
node app.js
```

### Backfill More Data

```bash
# Last 100 messages
node backfill-last-n.js 100

# Last 48 hours
node backfill-custom.js 48

# Last week (168 hours)
node backfill-custom.js 168
```

### Check Recent Messages

```bash
node check-recent.js
```

### Test Odoo Connection

```bash
node test-auth.js
```

### Run Examples

```bash
node example-usage.js
```

---

## 🐛 Troubleshooting

### Problem: Authentication Failed

**Solution:**
- Check `.env` file
- Verify API key is correct
- Make sure `ODOO_PASSWORD` is the API key, not your login password

### Problem: No Messages

**Solution:**
```bash
# Run backfill first
node backfill-24h.js

# Or check if there are recent messages
node check-recent.js
```

### Problem: Can't Connect to MongoDB

**Solution:**
```bash
# Check if MongoDB is running
mongod --version

# Start MongoDB (if needed)
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env
```

### Problem: Port 3000 Already in Use

**Solution:**
- Change `PORT=3001` in `.env`
- Or stop the other process using port 3000

---

## 📚 Learn More

- **[README.md](./README.md)** - Full documentation
- **[DISCUSS_MODEL_GUIDE.md](./DISCUSS_MODEL_GUIDE.md)** - Technical guide
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API documentation
- **[example-usage.js](./example-usage.js)** - Code examples

---

## 🎯 What's Next?

### Customize the System

1. **Adjust Polling**
   - Edit `POLL_INTERVAL` in `.env`
   - Lower = more real-time (more load)
   - Higher = less real-time (less load)

2. **Filter by WhatsApp Only**
   ```env
   ENABLE_WHATSAPP_ONLY=true
   ```

3. **Enable Alerts**
   ```env
   ENABLE_NOTIFICATIONS=true
   ALERT_KEYWORDS=urgent,help,emergency
   ```

4. **Show Conversation History**
   ```env
   SHOW_CONVERSATION_CONTEXT=true
   CONVERSATION_LIMIT=20
   ```

### Build Your Own Integration

```javascript
// Fetch messages in your code
const response = await fetch('http://localhost:3000/api/messages/latest?limit=50');
const data = await response.json();

// Process messages
data.messages.forEach(msg => {
  console.log(msg.body);
  // Your logic here
});
```

### Create Custom Dashboard

The API returns JSON - build any frontend you want:
- React app
- Vue app
- Mobile app
- Desktop app
- CLI tool

---

## 💡 Pro Tips

1. **Use Time Range Filters** - Faster than loading all messages
2. **Monitor System Resources** - Adjust polling if CPU/memory is high
3. **Backup MongoDB** - Important messages should be backed up
4. **Use Live Fetch Sparingly** - Direct Odoo queries are slower
5. **Check Logs** - `app.js` shows detailed message info

---

## 🎉 Success Checklist

- [ ] API server running on http://localhost:3000
- [ ] Polling agent running (`app.js`)
- [ ] Dashboard accessible in browser
- [ ] Messages appearing in dashboard
- [ ] Time range filters working
- [ ] Search working
- [ ] Statistics showing correct data

---

## 🆘 Need Help?

1. **Check the logs** - Look for error messages
2. **Read the docs** - See README.md and DISCUSS_MODEL_GUIDE.md
3. **Test connection** - Run `node test-auth.js`
4. **Check MongoDB** - Verify it's running
5. **Restart services** - Sometimes a restart helps

---

## 🚀 You're Ready!

Your Odoo message monitoring system is now running. 

**Key URLs:**
- Dashboard: http://localhost:3000/index.html
- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health

**Key Commands:**
```bash
node server.js          # Start API
node app.js            # Start polling
node backfill-24h.js   # Load messages
node test-auth.js      # Test Odoo
```

Happy monitoring! 🎊

