// const xmlrpc = require('xmlrpc');

// class OdooClient {
//   constructor(url, db, username, password) {
//     this.url = url;
//     this.db = db;
//     this.username = username;
//     this.password = password;
//     this.uid = null;
    
//     this.common = xmlrpc.createSecureClient(`${url}/xmlrpc/2/common`);
//     this.models = xmlrpc.createSecureClient(`${url}/xmlrpc/2/object`);
//   }

//   // Authenticate
//   async authenticate() {
//     return new Promise((resolve, reject) => {
//       this.common.methodCall('authenticate', [
//         this.db,
//         this.username,
//         this.password,
//         {}
//       ], (err, uid) => {
//         if (err) reject(err);
//         this.uid = uid;
//         console.log('✅ Authenticated with UID:', uid);
//         resolve(uid);
//       });
//     });
//   }

//   // Generic execute method
//   async execute(model, method, params = [], kwargs = {}) {
//     if (!this.uid) await this.authenticate();
    
//     return new Promise((resolve, reject) => {
//       this.models.methodCall('execute_kw', [
//         this.db,
//         this.uid,
//         this.password,
//         model,
//         method,
//         params,
//         kwargs
//       ], (err, result) => {
//         if (err) reject(err);
//         else resolve(result);
//       });
//     });
//   }

// // Replace the getAllWhatsAppChannels method with this:

// // Get ALL channels (WhatsApp, LiveChat, Email, etc.)
// async getAllChannels() {
//     const channels = await this.execute(
//       'mail.channel',
//       'search_read',
//       [[]],  // Empty domain = get ALL channels
//       {
//         fields: ['id', 'name', 'channel_type', 'channel_partner_ids', 'description', 'public'],
//         order: 'id desc'
//       }
//     );
    
//     // Group by channel type for easier processing
//     const grouped = {
//       whatsapp: channels.filter(ch => /^\d+$/.test(ch.name)), // Phone numbers
//       livechat: channels.filter(ch => ch.channel_type === 'livechat'),
//       chat: channels.filter(ch => ch.channel_type === 'chat'),
//       channel: channels.filter(ch => ch.channel_type === 'channel'),
//       all: channels
//     };
    
//     return grouped;
//   }
  
//   // Get latest messages from ALL channels (any type)
//   async getLatestMessagesAllChannels(limit = 50) {
//     const messages = await this.execute(
//       'mail.message',
//       'search_read',
//       [[
//         ['model', '=', 'mail.channel'],  // All discuss messages
//         ['message_type', '=', 'comment']  // Only user messages
//       ]],
//       {
//         fields: [
//           'id', 'body', 'date', 'author_id', 'res_id', 
//           'model', 'email_from', 'attachment_ids', 'subject',
//           'message_type', 'subtype_id', 'record_name'
//         ],
//         order: 'id desc',
//         limit: limit
//       }
//     );
  
//     return messages;
//   }
  
//   // Get channel info with type detection
//   async getChannelWithMetadata(channelId) {
//     const channel = await this.execute(
//       'mail.channel',
//       'read',
//       [[channelId]],
//       {
//         fields: [
//           'id', 'name', 'channel_type', 'channel_partner_ids', 
//           'description', 'public', 'uuid', 'email_send'
//         ]
//       }
//     );
  
//     const channelData = channel[0];
    
//     // Detect source type
//     if (/^\d+$/.test(channelData.name)) {
//       channelData.source_type = 'whatsapp';
//     } else if (channelData.channel_type === 'livechat') {
//       channelData.source_type = 'livechat';
//     } else if (channelData.channel_type === 'chat') {
//       channelData.source_type = 'direct_message';
//     } else {
//       channelData.source_type = 'channel';
//     }
  
//     return channelData;
//   }
  
//   // Get latest messages across ALL channels
//   async getLatestMessagesAllChannels(limit = 10) {
//     const channels = await this.getAllWhatsAppChannels();
//     const channelIds = channels.map(ch => ch.id);

//     if (channelIds.length === 0) {
//       return [];
//     }

//     const messages = await this.execute(
//       'mail.message',
//       'search_read',
//       [[
//         ['model', '=', 'mail.channel'],
//         ['res_id', 'in', channelIds],
//         ['message_type', '=', 'comment']  // Only actual messages, not system notifications
//       ]],
//       {
//         fields: ['id', 'body', 'date', 'author_id', 'res_id', 'model', 'email_from', 'attachment_ids'],
//         order: 'id desc',
//         limit: limit
//       }
//     );

//     return messages;
//   }

//   // Get new messages after a specific message ID
//   async getNewMessages(channelId, lastMessageId = 0) {
//     const messages = await this.execute(
//       'mail.message',
//       'search_read',
//       [[
//         ['model', '=', 'mail.channel'],
//         ['res_id', '=', channelId],
//         ['id', '>', lastMessageId],
//         ['message_type', '=', 'comment']
//       ]],
//       {
//         fields: ['id', 'body', 'date', 'author_id', 'email_from', 'attachment_ids'],
//         order: 'id asc'  // Oldest first for processing
//       }
//     );

//     return messages;
//   }

//   // Get full conversation for a channel
//   async getChannelConversation(channelId, limit = 100) {
//     const messages = await this.execute(
//       'mail.message',
//       'search_read',
//       [[
//         ['model', '=', 'mail.channel'],
//         ['res_id', '=', channelId]
//       ]],
//       {
//         fields: ['id', 'body', 'date', 'author_id', 'message_type', 'email_from', 'attachment_ids'],
//         order: 'date asc',
//         limit: limit
//       }
//     );

//     return messages;
//   }

//   // Get channel details by ID
//   async getChannelById(channelId) {
//     const channel = await this.execute(
//       'mail.channel',
//       'read',
//       [[channelId]],
//       {
//         fields: ['id', 'name', 'channel_partner_ids', 'channel_last_seen_partner_id']
//       }
//     );

//     return channel[0];
//   }
// }

// module.exports = OdooClient;
const xmlrpc = require('xmlrpc');

class OdooClient {
  constructor(url, db, username, password) {
    this.url = url;
    this.db = db;
    this.username = username;
    this.password = password;
    this.uid = null;
    
    this.common = xmlrpc.createSecureClient(`${url}/xmlrpc/2/common`);
    this.models = xmlrpc.createSecureClient(`${url}/xmlrpc/2/object`);
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      this.common.methodCall('authenticate', [
        this.db,
        this.username,
        this.password,
        {}
      ], (err, uid) => {
        if (err) reject(err);
        this.uid = uid;
        console.log('✅ Authenticated with UID:', uid);
        resolve(uid);
      });
    });
  }

  async execute(model, method, params = [], kwargs = {}) {
    if (!this.uid) await this.authenticate();
    
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
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  // Get ALL channels (WhatsApp, LiveChat, Email, Direct Messages, etc.)
  async getAllChannels() {
    const channels = await this.execute(
      'discuss.channel',  // ← CHANGED FROM mail.channel
      'search_read',
      [[]],
      {
        fields: ['id', 'name', 'channel_type', 'channel_member_ids', 'description'],
        order: 'id desc'
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

  // Get latest messages from ALL channels
  async getLatestMessagesAllChannels(limit = 50) {
    const messages = await this.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],  // ← CHANGED
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

  // Get new messages after a specific message ID
  async getNewMessages(channelId, lastMessageId = 0) {
    const messages = await this.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],  // ← CHANGED
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
        ['model', '=', 'discuss.channel'],  // ← CHANGED
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
      'discuss.channel',  // ← CHANGED
      'read',
      [[channelId]],
      {
        fields: ['id', 'name', 'channel_member_ids', 'channel_type']
      }
    );

    return channel[0];
  }
}

module.exports = OdooClient;
