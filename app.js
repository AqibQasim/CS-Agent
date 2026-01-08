// require('dotenv').config();
// const OdooClient = require('./odooClient');
// const MessageStore = require('./messageStore');

// class OdooMessagePoller {
//   constructor() {
//     this.odoo = new OdooClient(
//       process.env.ODOO_URL,
//       process.env.ODOO_DB,
//       process.env.ODOO_USERNAME,
//       process.env.ODOO_PASSWORD
//     );
    
//     this.store = new MessageStore(process.env.MONGODB_URI);
//     this.isPolling = false;
//   }

//   async initialize() {
//     await this.odoo.authenticate();
//     await this.store.connect();
//     console.log('🚀 Odoo Message Poller initialized');
//   }

//   async pollMessages() {
//     if (this.isPolling) {
//       console.log('⏳ Already polling, skipping...');
//       return;
//     }

//     this.isPolling = true;

//     try {
//       // Get all WhatsApp channels
//       const channels = await this.odoo.getAllWhatsAppChannels();
//       console.log(`📱 Found ${channels.length} WhatsApp channels`);

//       // Process each channel
//       for (const channel of channels) {
//         await this.processChannel(channel);
//       }

//       console.log('✅ Polling complete\n');
//     } catch (error) {
//       console.error('❌ Polling error:', error);
//     } finally {
//       this.isPolling = false;
//     }
//   }

//   async processChannel(channel) {
//     const channelId = channel.id;
//     const channelName = channel.name;

//     // Get last processed message ID for this channel
//     const lastMessageId = await this.store.getLastMessageId(channelId);

//     // Get new messages after last processed ID
//     const newMessages = await this.odoo.getNewMessages(channelId, lastMessageId);

//     if (newMessages.length > 0) {
//       console.log(`📨 ${newMessages.length} new messages in ${channelName}`);

//       // Save messages to database
//       for (const message of newMessages) {
//         await this.store.saveMessage(message, channelName);
//       }

//       // Update last processed message ID
//       const latestMessageId = newMessages[newMessages.length - 1].id;
//       await this.store.updateLastMessageId(channelId, latestMessageId);
//     }
//   }

//   // Get full conversation for a specific channel (on-demand)
//   async getConversation(channelId) {
//     const channel = await this.odoo.getChannelById(channelId);
//     const messages = await this.odoo.getChannelConversation(channelId);
    
//     return {
//       channel: channel,
//       messages: messages,
//       messageCount: messages.length
//     };
//   }

//   // Start continuous polling
//   startPolling(interval = process.env.POLL_INTERVAL || 10000) {
//     console.log(`⏰ Starting polling every ${interval/1000} seconds`);
    
//     // Initial poll
//     this.pollMessages();
    
//     // Set interval for continuous polling
//     this.pollInterval = setInterval(() => {
//       this.pollMessages();
//     }, interval);
//   }

//   stopPolling() {
//     if (this.pollInterval) {
//       clearInterval(this.pollInterval);
//       console.log('🛑 Polling stopped');
//     }
//   }
// }

// // Main execution
// async function main() {
//   const poller = new OdooMessagePoller();
//   await poller.initialize();
  
//   // Start polling
//   poller.startPolling();

//   // Graceful shutdown
//   process.on('SIGINT', () => {
//     console.log('\n🛑 Shutting down gracefully...');
//     poller.stopPolling();
//     process.exit(0);
//   });
// }

// main().catch(console.error);
require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

class OdooMessagePoller {
  constructor() {
    this.odoo = new OdooClient(
      process.env.ODOO_URL,
      process.env.ODOO_DB,
      process.env.ODOO_USERNAME,
      process.env.ODOO_PASSWORD
    );
    
    this.store = new MessageStore(process.env.MONGODB_URI);
    this.isPolling = false;
    this.pollInterval = null;
  }

  async initialize() {
    try {
      await this.odoo.authenticate();
      await this.store.connect();
      console.log('🚀 Odoo Message Poller initialized successfully');
      console.log(`📡 Connected to: ${process.env.ODOO_URL}`);
      console.log(`👤 User: ${process.env.ODOO_USERNAME}`);
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async pollMessages() {
    if (this.isPolling) {
      console.log('⏳ Already polling, skipping this cycle...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      console.log('\n' + '='.repeat(60));
      console.log(`📊 Polling started at ${new Date().toLocaleTimeString()}`);
      console.log('='.repeat(60));

      // Get ALL channels (WhatsApp, LiveChat, Email, Direct Messages, etc.)
      const channelGroups = await this.odoo.getAllChannels();
      const allChannels = channelGroups.all;
      
      console.log(`\n📱 Channel Summary:`);
      console.log(`   Total Channels: ${allChannels.length}`);
      console.log(`   - WhatsApp: ${channelGroups.whatsapp.length}`);
      console.log(`   - LiveChat: ${channelGroups.livechat.length}`);
      console.log(`   - Direct Messages: ${channelGroups.chat.length}`);
      console.log(`   - Team Channels: ${channelGroups.channel.length}`);

      let totalNewMessages = 0;

      // Process each channel
      for (const channel of allChannels) {
        const newMessageCount = await this.processChannel(channel);
        totalNewMessages += newMessageCount;
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n✅ Polling complete in ${duration}s`);
      console.log(`📨 Total new messages: ${totalNewMessages}`);
      console.log('='.repeat(60) + '\n');

    } catch (error) {
      console.error('❌ Polling error:', error.message);
      console.error(error.stack);
    } finally {
      this.isPolling = false;
    }
  }

  async processChannel(channel) {
    const channelId = channel.id;
    const channelName = channel.name;
    const channelType = this.detectChannelType(channel);

    try {
      // Get last processed message ID for this channel
      const lastMessageId = await this.store.getLastMessageId(channelId);

      // Get new messages after last processed ID
      const newMessages = await this.odoo.getNewMessages(channelId, lastMessageId);

      if (newMessages.length > 0) {
        console.log(`\n📨 ${newMessages.length} new message(s) in [${channelType}] ${channelName}`);

        // Save messages to database with enhanced metadata
        for (const message of newMessages) {
          await this.store.saveMessage({
            ...message,
            channel_type: channelType,
            channel_name: channelName
          });
          
          // Log message preview
          const bodyPreview = this.extractTextFromHtml(message.body).substring(0, 50);
          const author = message.author_id ? message.author_id[1] : message.email_from || 'Unknown';
          console.log(`   [${message.id}] ${author}: ${bodyPreview}...`);
        }

        // Update last processed message ID
        const latestMessageId = newMessages[newMessages.length - 1].id;
        await this.store.updateLastMessageId(channelId, latestMessageId);
      }

      return newMessages.length;

    } catch (error) {
      console.error(`❌ Error processing channel ${channelName}:`, error.message);
      return 0;
    }
  }

  detectChannelType(channel) {
    if (/^\d+$/.test(channel.name)) return 'whatsapp';
    if (channel.channel_type === 'livechat') return 'livechat';
    if (channel.channel_type === 'chat') return 'direct_message';
    if (channel.channel_type === 'channel') return 'team_channel';
    return 'unknown';
  }

  extractTextFromHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  // Get full conversation for a specific channel (on-demand)
  async getConversation(channelId, limit = 100) {
    try {
      const channel = await this.odoo.getChannelById(channelId);
      const messages = await this.odoo.getChannelConversation(channelId, limit);
      
      return {
        channel: channel,
        messages: messages,
        messageCount: messages.length,
        channelType: this.detectChannelType(channel)
      };
    } catch (error) {
      console.error(`Error getting conversation for channel ${channelId}:`, error);
      throw error;
    }
  }

  // Get statistics
  async getStats() {
    try {
      const channels = await this.odoo.getAllChannels();
      const unprocessed = await this.store.getUnprocessedMessages(1);
      const unprocessedCount = await this.store.db.collection('messages')
        .countDocuments({ processed: false });

      const totalMessages = await this.store.db.collection('messages')
        .countDocuments({});

      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentMessages = await this.store.db.collection('messages')
        .countDocuments({ created_at: { $gte: last24Hours } });

      return {
        totalChannels: channels.all.length,
        whatsappChannels: channels.whatsapp.length,
        livechatChannels: channels.livechat.length,
        directMessages: channels.chat.length,
        teamChannels: channels.channel.length,
        totalMessages: totalMessages,
        unprocessedMessages: unprocessedCount,
        recentMessages24h: recentMessages,
        lastUpdate: new Date()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

  // Start continuous polling
  startPolling(interval = parseInt(process.env.POLL_INTERVAL) || 10000) {
    console.log(`\n⏰ Starting continuous polling every ${interval/1000} seconds`);
    console.log(`⏸️  Press Ctrl+C to stop\n`);
    
    // Initial poll
    this.pollMessages();
    
    // Set interval for continuous polling
    this.pollInterval = setInterval(() => {
      this.pollMessages();
    }, interval);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      console.log('\n🛑 Polling stopped');
    }
  }

  async shutdown() {
    console.log('\n🔄 Shutting down gracefully...');
    this.stopPolling();
    if (this.store.client) {
      await this.store.client.close();
      console.log('✅ Database connection closed');
    }
    console.log('👋 Goodbye!\n');
    process.exit(0);
  }
}

// Main execution
async function main() {
  const poller = new OdooMessagePoller();
  
  try {
    await poller.initialize();
    
    // Start polling
    poller.startPolling();

    // Graceful shutdown handlers
    process.on('SIGINT', () => poller.shutdown());
    process.on('SIGTERM', () => poller.shutdown());

    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export for use in server.js
module.exports = OdooMessagePoller;
