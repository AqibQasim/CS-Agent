// const express = require('express');
// const OdooClient = require('./odooClient');
// const MessageStore = require('./messageStore');

// const app = express();
// const odoo = new OdooClient(/*...*/);
// const store = new MessageStore(/*...*/);

// // Get all channels
// app.get('/api/channels', async (req, res) => {
//   const channels = await odoo.getAllWhatsAppChannels();
//   res.json(channels);
// });

// // Get conversation for specific channel
// app.get('/api/channels/:id/messages', async (req, res) => {
//   const channelId = parseInt(req.params.id);
//   const messages = await odoo.getChannelConversation(channelId);
//   res.json(messages);
// });

// // Get latest messages from DB
// app.get('/api/messages/latest', async (req, res) => {
//   const messages = await store.db.collection('messages')
//     .find()
//     .sort({ date: -1 })
//     .limit(50)
//     .toArray();
//   res.json(messages);
// });

// // Get unprocessed messages (for AI)
// app.get('/api/messages/unprocessed', async (req, res) => {
//   const messages = await store.getUnprocessedMessages();
//   res.json(messages);
// });

// app.listen(3000, () => {
//   console.log('🌐 API server running on http://localhost:3000');
// });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public folder

// Initialize clients
const odoo = new OdooClient(
  process.env.ODOO_URL,
  process.env.ODOO_DB,
  process.env.ODOO_USERNAME,
  process.env.ODOO_PASSWORD
);

const store = new MessageStore(process.env.MONGODB_URI);

// Initialize on startup
let isInitialized = false;

async function initialize() {
  if (!isInitialized) {
    try {
      await odoo.authenticate();
      await store.connect();
      isInitialized = true;
      console.log('✅ API Server initialized');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }
}

// Helper to detect channel type
function detectChannelType(channel) {
  if (/^\d+$/.test(channel.name)) return 'whatsapp';
  if (channel.channel_type === 'livechat') return 'livechat';
  if (channel.channel_type === 'chat') return 'direct_message';
  if (channel.channel_type === 'channel') return 'team_channel';
  return 'unknown';
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    initialized: isInitialized,
    timestamp: new Date()
  });
});

// Get all channels
app.get('/api/channels', async (req, res) => {
  try {
    await initialize();
    const channels = await odoo.getAllChannels();
    
    // Add metadata to each channel
    const enrichedChannels = channels.all.map(ch => ({
      ...ch,
      source_type: detectChannelType(ch)
    }));

    res.json({
      all: enrichedChannels,
      whatsapp: channels.whatsapp,
      livechat: channels.livechat,
      chat: channels.chat,
      channel: channels.channel,
      total: channels.all.length
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest messages from ALL channels
app.get('/api/messages/latest', async (req, res) => {
  try {
    await initialize();
    const limit = parseInt(req.query.limit) || 50;
    
    const messages = await store.db.collection('messages')
      .find({})
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    res.json({
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for specific channel
app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    await initialize();
    const channelId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 100;

    const messages = await store.db.collection('messages')
      .find({ channel_id: channelId })
      .sort({ date: 1 })
      .limit(limit)
      .toArray();

    res.json({
      channelId: channelId,
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unprocessed messages (for AI)
app.get('/api/messages/unprocessed', async (req, res) => {
  try {
    await initialize();
    const limit = parseInt(req.query.limit) || 10;
    
    const messages = await store.getUnprocessedMessages(limit);

    res.json({
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching unprocessed messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    await initialize();
    
    const channels = await odoo.getAllChannels();
    const totalMessages = await store.db.collection('messages').countDocuments({});
    const unprocessedCount = await store.db.collection('messages')
      .countDocuments({ processed: false });

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMessages = await store.db.collection('messages')
      .countDocuments({ created_at: { $gte: last24Hours } });

    // Get messages by channel type
    const messagesByType = await store.db.collection('messages').aggregate([
      { $group: { _id: '$channel_type', count: { $sum: 1 } } }
    ]).toArray();

    res.json({
      channels: {
        total: channels.all.length,
        whatsapp: channels.whatsapp.length,
        livechat: channels.livechat.length,
        direct: channels.chat.length,
        team: channels.channel.length
      },
      messages: {
        total: totalMessages,
        unprocessed: unprocessedCount,
        last24h: recentMessages,
        byType: messagesByType
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search messages
app.get('/api/messages/search', async (req, res) => {
  try {
    await initialize();
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const messages = await store.db.collection('messages')
      .find({
        $or: [
          { body: { $regex: query, $options: 'i' } },
          { channel_name: { $regex: query, $options: 'i' } },
          { 'author_id.1': { $regex: query, $options: 'i' } }
        ]
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    res.json({
      query: query,
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🌐 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}/index.html`);
  console.log(`🔧 API endpoints:`);
  console.log(`   GET /api/health`);
  console.log(`   GET /api/channels`);
  console.log(`   GET /api/messages/latest`);
  console.log(`   GET /api/channels/:id/messages`);
  console.log(`   GET /api/messages/unprocessed`);
  console.log(`   GET /api/stats`);
  console.log(`   GET /api/messages/search?q=query\n`);
});

module.exports = app;
