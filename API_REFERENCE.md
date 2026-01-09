# API Reference - Odoo Discuss Message System

## Base URL
```
http://localhost:3000/api
```

---

## 📡 Endpoints

### 1. Health Check
**GET** `/api/health`

Check if API server is running and initialized.

**Response:**
```json
{
  "status": "ok",
  "initialized": true,
  "timestamp": "2026-01-09T10:30:00.000Z"
}
```

---

### 2. Get All Channels
**GET** `/api/channels`

Fetch all discuss.channel records from Odoo.

**Response:**
```json
{
  "all": [...],
  "whatsapp": [...],
  "livechat": [...],
  "chat": [...],
  "channel": [...],
  "total": 150
}
```

**Example:**
```bash
curl http://localhost:3000/api/channels
```

---

### 3. Get Latest Messages
**GET** `/api/messages/latest`

Get latest messages from MongoDB storage.

**Query Parameters:**
- `limit` (optional, default: 20) - Number of messages to return

**Response:**
```json
{
  "messages": [
    {
      "_id": "...",
      "message_id": 12345,
      "channel_id": 67,
      "channel_name": "966501234567",
      "channel_type": "whatsapp",
      "body": "<p>Hello world</p>",
      "author_id": [123, "John Doe"],
      "date": "2026-01-09T10:00:00.000Z",
      "attachment_ids": []
    }
  ],
  "count": 20
}
```

**Example:**
```bash
curl http://localhost:3000/api/messages/latest?limit=50
```

---

### 4. Get Channel Messages
**GET** `/api/channels/:id/messages`

Get all messages for a specific channel.

**Path Parameters:**
- `id` - Channel ID

**Query Parameters:**
- `limit` (optional, default: 100) - Number of messages to return

**Response:**
```json
{
  "channelId": 67,
  "messages": [...],
  "count": 45
}
```

**Example:**
```bash
curl http://localhost:3000/api/channels/67/messages?limit=100
```

---

### 5. Get Messages by Time Range ⭐ NEW
**GET** `/api/messages/timerange`

Get messages from the last N hours.

**Query Parameters:**
- `hours` (optional, default: 24) - Number of hours to look back
- `limit` (optional, default: 100) - Maximum messages to return

**Response:**
```json
{
  "hours": 24,
  "messages": [...],
  "count": 78,
  "timeRange": {
    "from": "2026-01-08T10:00:00.000Z",
    "to": "2026-01-09T10:00:00.000Z"
  }
}
```

**Examples:**
```bash
# Last 24 hours (default)
curl http://localhost:3000/api/messages/timerange

# Last 6 hours
curl http://localhost:3000/api/messages/timerange?hours=6

# Last week (168 hours)
curl http://localhost:3000/api/messages/timerange?hours=168&limit=500
```

---

### 6. Get Live Messages from Odoo ⭐ NEW
**GET** `/api/odoo/messages/latest`

Fetch messages directly from Odoo (bypass MongoDB). Returns real-time data.

**Query Parameters:**
- `limit` (optional, default: 20) - Number of messages to fetch

**Response:**
```json
{
  "messages": [...],
  "count": 20,
  "source": "odoo_direct"
}
```

**Example:**
```bash
curl http://localhost:3000/api/odoo/messages/latest?limit=50
```

**Note:** This endpoint queries Odoo directly and may be slower than MongoDB queries.

---

### 7. Get Unprocessed Messages
**GET** `/api/messages/unprocessed`

Get messages that haven't been processed by AI or other systems.

**Query Parameters:**
- `limit` (optional, default: 10) - Number of messages to return

**Response:**
```json
{
  "messages": [...],
  "count": 5
}
```

**Example:**
```bash
curl http://localhost:3000/api/messages/unprocessed?limit=20
```

---

### 8. Get Statistics
**GET** `/api/stats`

Get system statistics and metrics.

**Response:**
```json
{
  "channels": {
    "total": 150,
    "whatsapp": 80,
    "livechat": 30,
    "direct": 25,
    "team": 15
  },
  "messages": {
    "total": 5420,
    "unprocessed": 12,
    "last24h": 234,
    "byType": [
      { "_id": "whatsapp", "count": 3200 },
      { "_id": "livechat", "count": 1800 },
      { "_id": "direct_message", "count": 320 },
      { "_id": "team_channel", "count": 100 }
    ]
  },
  "timestamp": "2026-01-09T10:00:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/stats
```

---

### 9. Search Messages
**GET** `/api/messages/search`

Search messages by text content.

**Query Parameters:**
- `q` (required) - Search query
- `limit` (optional, default: 20) - Number of results

**Response:**
```json
{
  "query": "hello",
  "messages": [...],
  "count": 15
}
```

**Example:**
```bash
curl "http://localhost:3000/api/messages/search?q=hello&limit=30"
```

**Search Fields:**
- Message body
- Channel name
- Author name

---

## 🔐 Authentication

Currently, the API server uses Odoo credentials from `.env` file. No additional authentication is required for API endpoints (local use only).

**For Production:** Add JWT or API key authentication to secure endpoints.

---

## 📊 Response Formats

### Message Object
```json
{
  "message_id": 12345,
  "channel_id": 67,
  "channel_name": "966501234567",
  "channel_type": "whatsapp",
  "body": "<p>Message content</p>",
  "author_id": [123, "John Doe"],
  "email_from": "john@example.com",
  "date": "2026-01-09T10:00:00.000Z",
  "attachment_ids": [456, 789],
  "created_at": "2026-01-09T10:00:01.000Z",
  "processed": false
}
```

### Channel Object
```json
{
  "id": 67,
  "name": "966501234567",
  "channel_type": "chat",
  "source_type": "whatsapp",
  "channel_member_ids": [1, 2, 3],
  "description": "WhatsApp conversation"
}
```

---

## 🚀 Usage Examples

### JavaScript (Fetch API)
```javascript
// Get latest messages
const response = await fetch('http://localhost:3000/api/messages/latest?limit=50');
const data = await response.json();
console.log(data.messages);

// Get messages from last 6 hours
const response = await fetch('http://localhost:3000/api/messages/timerange?hours=6');
const data = await response.json();
console.log(`Found ${data.count} messages`);

// Fetch live from Odoo
const response = await fetch('http://localhost:3000/api/odoo/messages/latest?limit=20');
const data = await response.json();
console.log('Live messages:', data.messages);
```

### Python (requests)
```python
import requests

# Get statistics
response = requests.get('http://localhost:3000/api/stats')
stats = response.json()
print(f"Total messages: {stats['messages']['total']}")

# Get messages from last 24 hours
response = requests.get('http://localhost:3000/api/messages/timerange', params={'hours': 24})
data = response.json()
print(f"Found {data['count']} messages from last 24 hours")

# Search messages
response = requests.get('http://localhost:3000/api/messages/search', params={'q': 'urgent', 'limit': 10})
results = response.json()
print(f"Found {results['count']} messages containing 'urgent'")
```

### cURL
```bash
# Get all channels
curl -X GET http://localhost:3000/api/channels | jq

# Get latest 100 messages
curl -X GET "http://localhost:3000/api/messages/latest?limit=100" | jq

# Get messages from last week
curl -X GET "http://localhost:3000/api/messages/timerange?hours=168" | jq

# Search for keyword
curl -X GET "http://localhost:3000/api/messages/search?q=urgent" | jq
```

---

## ⚡ Performance Tips

1. **Use time range filtering** - More efficient than fetching all messages
2. **Set appropriate limits** - Don't fetch more data than needed
3. **Use MongoDB endpoints** - Faster than direct Odoo queries
4. **Cache results** - If data doesn't change frequently

---

## 🐛 Error Responses

### 400 Bad Request
```json
{
  "error": "Query parameter 'q' is required"
}
```

### 500 Internal Server Error
```json
{
  "error": "Authentication failed: Invalid credentials"
}
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- HTML in message bodies is preserved
- Attachment IDs reference `ir.attachment` model in Odoo
- Channel types are auto-detected based on patterns
- Messages are sorted by date (newest first) unless specified otherwise

---

## 🔄 Real-Time Updates

The dashboard auto-refreshes every 10 seconds. For custom implementations, poll these endpoints:

```javascript
// Poll for new messages every 10 seconds
setInterval(async () => {
  const response = await fetch('http://localhost:3000/api/messages/latest?limit=10');
  const data = await response.json();
  updateUI(data.messages);
}, 10000);
```

---

## 🎯 Best Practices

1. **Start with small limits** and increase if needed
2. **Use time range filters** to reduce data transfer
3. **Cache channel data** (changes infrequently)
4. **Poll, don't hammer** - 10-30 second intervals are good
5. **Handle errors gracefully** - Network issues happen

---

For more information, see `DISCUSS_MODEL_GUIDE.md`

