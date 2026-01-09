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
app.use(express.static('public'));

// Initialize clients
const odoo = new OdooClient(
  process.env.ODOO_URL,
  process.env.ODOO_DB,
  process.env.ODOO_USERNAME,
  process.env.ODOO_PASSWORD
);

const store = new MessageStore(process.env.MONGODB_URI);

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

function detectChannelType(channel) {
  if (/^\d+$/.test(channel.name)) return 'whatsapp';
  if (channel.channel_type === 'livechat') return 'livechat';
  if (channel.channel_type === 'chat') return 'direct_message';
  if (channel.channel_type === 'channel') return 'team_channel';
  return 'unknown';
}

// Routes

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    initialized: isInitialized,
    timestamp: new Date()
  });
});

app.get('/api/channels', async (req, res) => {
  try {
    await initialize();
    const channels = await odoo.getAllChannels();
    
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

app.get('/api/messages/latest', async (req, res) => {
  try {
    await initialize();
    const limit = parseInt(req.query.limit) || 20;
    
    const messages = await store.getAllMessages(0, limit);

    res.json({
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/channels/:id/messages', async (req, res) => {
  try {
    await initialize();
    const channelId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 100;

    const messages = await store.getMessagesByChannel(channelId, limit);

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

app.get('/api/stats', async (req, res) => {
  try {
    await initialize();
    
    const channels = await odoo.getAllChannels();
    const storeStats = await store.getStats();

    res.json({
      channels: {
        total: channels.all.length,
        whatsapp: channels.whatsapp.length,
        livechat: channels.livechat.length,
        direct: channels.chat.length,
        team: channels.channel.length
      },
      messages: {
        total: storeStats.totalMessages,
        unprocessed: storeStats.unprocessedCount,
        last24h: storeStats.recentMessages,
        byType: storeStats.messagesByType
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/search', async (req, res) => {
  try {
    await initialize();
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const messages = await store.searchMessages(query, limit);

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

// New endpoint: Fetch messages by time range
app.get('/api/messages/timerange', async (req, res) => {
  try {
    await initialize();
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    const messages = await store.getMessagesByTimeRange(hours, limit);

    res.json({
      hours: hours,
      messages: messages,
      count: messages.length,
      timeRange: {
        from: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching messages by time range:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Fetch latest messages from Odoo directly (real-time)
app.get('/api/odoo/messages/latest', async (req, res) => {
  try {
    await initialize();
    const limit = parseInt(req.query.limit) || 20;
    
    // Fetch directly from Odoo
    const messages = await odoo.getLatestMessagesAllChannels(limit);
    
    // Get channel info
    const channelIds = [...new Set(messages.map(m => m.res_id))];
    const channels = await odoo.getChannelsByIds(channelIds);
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));
    
    // Enrich messages with channel info
    const enrichedMessages = messages.map(msg => ({
      ...msg,
      channel_name: channelMap.get(msg.res_id)?.name,
      channel_type: detectChannelType(channelMap.get(msg.res_id) || {})
    }));

    res.json({
      messages: enrichedMessages,
      count: enrichedMessages.length,
      source: 'odoo_direct'
    });
  } catch (error) {
    console.error('Error fetching from Odoo:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Send message to channel
app.post('/api/channels/:id/send', async (req, res) => {
  try {
    await initialize();
    const channelId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📤 Sending message to channel ${channelId}: ${message.substring(0, 50)}...`);

    // Send message to Odoo
    await odoo.execute(
      'mail.channel',
      'message_post',
      [channelId],
      {
        body: message,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment'
      }
    );

    console.log(`✅ Message sent successfully to channel ${channelId}`);

    res.json({
      success: true,
      channelId: channelId,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Get attachment info
app.get('/api/attachments/:id', async (req, res) => {
  try {
    await initialize();
    const attachmentId = parseInt(req.params.id);

    const attachment = await odoo.execute(
      'ir.attachment',
      'read',
      [[attachmentId]],
      { fields: ['name', 'datas_fname', 'mimetype', 'file_size', 'url'] }
    );

    if (attachment && attachment.length > 0) {
      res.json(attachment[0]);
    } else {
      res.status(404).json({ error: 'Attachment not found' });
    }
  } catch (error) {
    console.error('Error fetching attachment:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint: Download attachment (with authentication)
app.get('/api/attachments/:id/download', async (req, res) => {
  try {
    await initialize();
    const attachmentId = parseInt(req.params.id);

    // Get attachment data from Odoo
    const attachment = await odoo.execute(
      'ir.attachment',
      'read',
      [[attachmentId]],
      { fields: ['name', 'datas', 'mimetype', 'datas_fname'] }
    );

    if (attachment && attachment.length > 0 && attachment[0].datas) {
      const att = attachment[0];
      const buffer = Buffer.from(att.datas, 'base64');
      
      res.setHeader('Content-Type', att.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${att.name || att.datas_fname || 'attachment'}"`);
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'Attachment not found or no data' });
    }
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🌐 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}/index.html`);
  console.log(`📊 New V2 Dashboard at http://localhost:${PORT}/index-v2.html`);
  console.log(`🔧 API endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/channels`);
  console.log(`   GET  /api/messages/latest`);
  console.log(`   GET  /api/channels/:id/messages`);
  console.log(`   POST /api/channels/:id/send  ← NEW! Send messages`);
  console.log(`   GET  /api/messages/unprocessed`);
  console.log(`   GET  /api/stats`);
  console.log(`   GET  /api/messages/search?q=query`);
  console.log(`   GET  /api/messages/timerange?hours=24`);
  console.log(`   GET  /api/odoo/messages/latest?limit=20\n`);
});

module.exports = app;
