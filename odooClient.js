const xmlrpc = require('xmlrpc');

class OdooClient {
  constructor(url, db, username, password) {
    this.url = url;
    this.db = db;
    this.username = username;
    this.password = password;
    this.uid = null;
    
    // Parse URL to handle http/https
    const urlObj = new URL(url);
    const isSecure = urlObj.protocol === 'https:';
    
    const commonUrl = `${url}/xmlrpc/2/common`;
    const objectUrl = `${url}/xmlrpc/2/object`;
    
    // Create clients based on protocol
    if (isSecure) {
      this.common = xmlrpc.createSecureClient(commonUrl);
      this.models = xmlrpc.createSecureClient(objectUrl);
    } else {
      this.common = xmlrpc.createClient(commonUrl);
      this.models = xmlrpc.createClient(objectUrl);
    }
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      console.log(`🔐 Attempting authentication...`);
      console.log(`   URL: ${this.url}`);
      console.log(`   DB: ${this.db}`);
      console.log(`   User: ${this.username}`);
      
      this.common.methodCall('authenticate', [
        this.db,
        this.username,
        this.password,
        {}
      ], (err, uid) => {
        if (err) {
          console.error('❌ Authentication error:', err.message);
          reject(new Error(`Authentication failed: ${err.message}`));
          return;
        }
        
        // 🔥 Check if UID is valid
        if (!uid || uid === false || typeof uid !== 'number') {
          console.error('❌ Authentication failed: Invalid credentials');
          console.error('   Received UID:', uid);
          console.error('   Please check:');
          console.error('   1. ODOO_USERNAME is correct');
          console.error('   2. ODOO_PASSWORD (API key) is valid');
          console.error('   3. ODOO_DB name is correct');
          reject(new Error('Authentication failed: Invalid credentials or expired API key'));
          return;
        }
        
        this.uid = uid;
        console.log('✅ Authenticated with UID:', uid);
        resolve(uid);
      });
    });
  }

  async execute(model, method, params = [], kwargs = {}) {
    // 🔥 Ensure we're authenticated
    if (!this.uid) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
    
    return new Promise((resolve, reject) => {
      this.models.methodCall('execute_kw', [
        this.db,
        this.uid,
        this.password,
        model,
        method,
        params,
        kwargs
      ], (err, result) => {
        if (err) {
          // Better error messages
          if (err.message.includes('Access Denied')) {
            reject(new Error('Access Denied - API key may have expired or insufficient permissions'));
          } else {
            reject(err);
          }
        } else {
          resolve(result);
        }
      });
    });
  }

  // Get ALL channels
  async getAllChannels() {
    const channels = await this.execute(
      'discuss.channel',
      'search_read',
      [[]],
      {
        fields: ['id', 'name', 'channel_type', 'channel_member_ids', 'description'],
        order: 'id desc',
        limit: 1000
      }
    );
    
    const grouped = {
      whatsapp: channels.filter(ch => /^\d+$/.test(ch.name)),
      livechat: channels.filter(ch => ch.channel_type === 'livechat'),
      chat: channels.filter(ch => ch.channel_type === 'chat'),
      channel: channels.filter(ch => ch.channel_type === 'channel'),
      all: channels
    };
    
    return grouped;
  }

  // Get active channels (with recent activity)
  async getActiveChannels(limit = 100) {
    const channels = await this.execute(
      'discuss.channel',
      'search_read',
      [[
        '|',
        ['channel_type', '=', 'chat'],
        ['name', '=like', '966%']
      ]],
      {
        fields: ['id', 'name', 'channel_type', 'channel_member_ids'],
        order: 'id desc',
        limit: limit
      }
    );
    
    return channels;
  }

  // Get latest messages from ALL channels
  async getLatestMessagesAllChannels(limit = 50) {
    const messages = await this.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment']
      ]],
      {
        fields: [
          'id', 'body', 'date', 'author_id', 'res_id', 
          'model', 'email_from', 'attachment_ids', 'subject',
          'message_type', 'record_name'
        ],
        order: 'id desc',
        limit: limit
      }
    );

    return messages;
  }

  // Get new messages after a specific message ID (optimized)
  async getNewMessagesGlobal(lastMessageId = 0, limit = 100) {
    const messages = await this.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['id', '>', lastMessageId],
        ['message_type', '=', 'comment']
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'res_id', 'attachment_ids'],
        order: 'id asc',
        limit: limit
      }
    );

    return messages;
  }

  // Get new messages for specific channel
  async getNewMessages(channelId, lastMessageId = 0) {
    const messages = await this.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['res_id', '=', channelId],
        ['id', '>', lastMessageId],
        ['message_type', '=', 'comment']
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'attachment_ids'],
        order: 'id asc'
      }
    );

    return messages;
  }

  // Get full conversation for a channel
  async getChannelConversation(channelId, limit = 100) {
    const messages = await this.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['res_id', '=', channelId]
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'message_type', 'email_from', 'attachment_ids'],
        order: 'date asc',
        limit: limit
      }
    );

    return messages;
  }

  // Get channel details by ID
  async getChannelById(channelId) {
    const channel = await this.execute(
      'discuss.channel',
      'read',
      [[channelId]],
      {
        fields: ['id', 'name', 'channel_member_ids', 'channel_type']
      }
    );

    return channel[0];
  }

  // Get multiple channels by IDs (batch)
  async getChannelsByIds(channelIds) {
    if (channelIds.length === 0) return [];
    
    const channels = await this.execute(
      'discuss.channel',
      'read',
      [channelIds],
      {
        fields: ['id', 'name', 'channel_type']
      }
    );

    return channels;
  }
}

module.exports = OdooClient;
