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
    this.channelCache = new Map();
    
    // 🔥 Load configuration from ENV
    this.config = {
      pollInterval: parseInt(process.env.POLL_INTERVAL) || 10000,
      messageLimit: parseInt(process.env.MESSAGE_LIMIT) || 5,
      conversationLimit: parseInt(process.env.CONVERSATION_LIMIT) || 20,
      showContext: process.env.SHOW_CONVERSATION_CONTEXT === 'true',
      whatsappOnly: process.env.ENABLE_WHATSAPP_ONLY === 'true',
      enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
      alertKeywords: (process.env.ALERT_KEYWORDS || '').split(',').map(k => k.trim().toLowerCase())
    };
  }

  async initialize() {
    try {
      await this.odoo.authenticate();
      await this.store.connect();
      await this.initializeMessageTracking();
      
      console.log('🚀 Odoo Message Poller initialized successfully');
      console.log(`📡 Connected to: ${process.env.ODOO_URL}`);
      console.log(`👤 User: ${process.env.ODOO_USERNAME}`);
      console.log('\n📋 Configuration:');
      console.log(`   ⏱️  Poll Interval: ${this.config.pollInterval/1000}s`);
      console.log(`   📨 Message Limit: ${this.config.messageLimit}`);
      console.log(`   📜 Conversation History: ${this.config.conversationLimit}`);
      console.log(`   🎯 Show Context: ${this.config.showContext}`);
      console.log(`   📱 WhatsApp Only: ${this.config.whatsappOnly}`);
      console.log(`   🔔 Notifications: ${this.config.enableNotifications}`);
      if (this.config.enableNotifications && this.config.alertKeywords.length > 0) {
        console.log(`   🚨 Alert Keywords: ${this.config.alertKeywords.join(', ')}`);
      }
      console.log('');
      
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async initializeMessageTracking() {
    const lastMessageId = await this.store.getLastGlobalMessageId();
    
    if (lastMessageId === 0) {
      console.log('\n🔍 First time setup - finding latest message ID...');
      
      try {
        const latestMessages = await this.odoo.execute(
          'mail.message',
          'search_read',
          [[
            ['model', '=', 'discuss.channel'],
            ['message_type', '=', 'comment']
          ]],
          {
            fields: ['id', 'date'],
            order: 'id desc',
            limit: 1
          }
        );

        if (latestMessages.length > 0) {
          const latestId = latestMessages[0].id;
          const latestDate = latestMessages[0].date;
          await this.store.updateLastGlobalMessageId(latestId);
          console.log(`✅ Initialized tracking from message ID: ${latestId}`);
          console.log(`📅 Latest message date: ${latestDate}`);
          console.log(`📌 Will now track only NEW messages from this point forward\n`);
        } else {
          console.log('⚠️  No messages found in system\n');
        }
      } catch (error) {
        console.error('❌ Error initializing message tracking:', error.message);
        console.log('⚠️  Will start from ID 0 (may fetch old messages)\n');
      }
    } else {
      console.log(`\n📌 Resuming from message ID: ${lastMessageId}\n`);
    }
  }

  // 🔥 Check if message contains alert keywords
  checkAlertKeywords(messageBody) {
    if (!this.config.enableNotifications || this.config.alertKeywords.length === 0) {
      return false;
    }
    
    const bodyLower = messageBody.toLowerCase();
    return this.config.alertKeywords.some(keyword => bodyLower.includes(keyword));
  }

  // 🔥 Main polling method with context (ENV configured)
  async pollWithContext() {
    if (this.isPolling) {
      console.log('⏳ Already polling, skipping this cycle...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      console.log('\n' + '='.repeat(70));
      console.log(`📊 Polling started at ${new Date().toLocaleTimeString()}`);
      console.log('='.repeat(70));

      const lastMessageId = await this.store.getLastGlobalMessageId();
      console.log(`🔍 Checking for last ${this.config.messageLimit} messages after ID: ${lastMessageId}`);

      // Fetch NEW messages (limited by MESSAGE_LIMIT)
      const newMessages = await this.odoo.getNewMessagesGlobal(
        lastMessageId, 
        this.config.messageLimit
      );

      console.log(`\n📨 New messages found: ${newMessages.length}\n`);

      if (newMessages.length > 0) {
        const channelIds = [...new Set(newMessages.map(m => m.res_id))];
        const channels = await this.odoo.getChannelsByIds(channelIds);
        const channelMap = new Map(channels.map(ch => [ch.id, ch]));
        
        let alertCount = 0;
        
        for (let i = 0; i < newMessages.length; i++) {
          const message = newMessages[i];
          const channel = channelMap.get(message.res_id);
          
          if (!channel) continue;

          const channelType = this.detectChannelType(channel);
          
          // 🔥 Filter: WhatsApp only mode
          if (this.config.whatsappOnly && channelType !== 'whatsapp') {
            continue;
          }
          
          await this.store.saveMessage({
            ...message,
            channel_type: channelType,
            channel_name: channel.name
          });

          // 🔥 Check for alert keywords
          const messageBody = this.extractTextFromHtml(message.body || '');
          const hasAlert = this.checkAlertKeywords(messageBody);
          
          if (hasAlert) {
            alertCount++;
            console.log(`\n🚨🚨🚨 ALERT MESSAGE DETECTED 🚨🚨🚨`);
          }

          // Show message header
          console.log(`\n${'═'.repeat(70)}`);
          console.log(`${hasAlert ? '🚨' : '📱'} Message ${i + 1}/${newMessages.length}: [${channelType}] ${channel.name}`);
          console.log(`${'═'.repeat(70)}`);
          
          // 🔥 Show conversation context if enabled
          if (this.config.showContext) {
            const conversationHistory = await this.odoo.getChannelConversation(
              message.res_id, 
              this.config.conversationLimit
            );

            console.log(`📜 Conversation History (last ${conversationHistory.length} messages):\n`);

            conversationHistory.forEach((msg, index) => {
              const author = msg.author_id ? msg.author_id[1] : msg.email_from || 'Unknown';
              const body = this.extractTextFromHtml(msg.body || '').substring(0, 150);
              const date = new Date(msg.date).toLocaleString();
              const isNew = msg.id === message.id ? '🆕' : '  ';
              
              console.log(`${isNew} [${index + 1}] ${date}`);
              console.log(`   👤 ${author}`);
              console.log(`   💬 ${body}${body.length >= 150 ? '...' : ''}`);
              
              if (msg.attachment_ids && msg.attachment_ids.length > 0) {
                console.log(`   📎 ${msg.attachment_ids.length} attachment(s)`);
              }
              console.log('');
            });
          } else {
            // Just show the new message
            const author = message.author_id ? message.author_id[1] : message.email_from || 'Unknown';
            const date = new Date(message.date).toLocaleString();
            
            console.log(`🆕 ${date}`);
            console.log(`👤 ${author}`);
            console.log(`💬 ${messageBody.substring(0, 200)}${messageBody.length > 200 ? '...' : ''}`);
            
            if (message.attachment_ids && message.attachment_ids.length > 0) {
              console.log(`📎 ${message.attachment_ids.length} attachment(s)`);
            }
            console.log('');
          }
        }

        const latestMessageId = newMessages[newMessages.length - 1].id;
        await this.store.updateLastGlobalMessageId(latestMessageId);
        
        console.log(`\n${'═'.repeat(70)}`);
        console.log(`✅ Processed ${newMessages.length} messages`);
        if (alertCount > 0) {
          console.log(`🚨 ALERTS: ${alertCount} urgent message(s) detected!`);
        }
        console.log(`✅ Updated last message ID to: ${latestMessageId}`);
        console.log(`${'═'.repeat(70)}`);
      } else {
        console.log('✨ No new messages - system is up to date');
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  Polling complete in ${duration}s`);
      console.log('='.repeat(70) + '\n');

    } catch (error) {
      console.error('❌ Polling error:', error.message);
      console.error(error.stack);
    } finally {
      this.isPolling = false;
    }
  }

  // Simple polling without context
  async pollMessagesDirectly() {
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

      const lastMessageId = await this.store.getLastGlobalMessageId();
      console.log(`🔍 Checking for messages after ID: ${lastMessageId}`);

      const newMessages = await this.odoo.getNewMessagesGlobal(lastMessageId, 100);

      console.log(`\n📨 New messages found: ${newMessages.length}`);

      if (newMessages.length > 0) {
        const channelIds = [...new Set(newMessages.map(m => m.res_id))];
        console.log(`📱 Channels with new messages: ${channelIds.length}`);
        
        const channels = await this.odoo.getChannelsByIds(channelIds);
        const channelMap = new Map(channels.map(ch => [ch.id, ch]));
        
        let savedCount = 0;
        for (const message of newMessages) {
          const channel = channelMap.get(message.res_id);
          if (!channel) continue;

          const channelType = this.detectChannelType(channel);
          
          await this.store.saveMessage({
            ...message,
            channel_type: channelType,
            channel_name: channel.name
          });

          savedCount++;

          const bodyPreview = this.extractTextFromHtml(message.body).substring(0, 50);
          const author = message.author_id ? message.author_id[1] : message.email_from || 'Unknown';
          console.log(`   💬 [${channelType}] ${channel.name}`);
          console.log(`      ${author}: ${bodyPreview}...`);
        }

        const latestMessageId = newMessages[newMessages.length - 1].id;
        await this.store.updateLastGlobalMessageId(latestMessageId);
        console.log(`\n✅ Saved ${savedCount} messages`);
        console.log(`✅ Updated last message ID to: ${latestMessageId}`);
      } else {
        console.log('✨ No new messages - system is up to date');
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  Polling complete in ${duration}s`);
      console.log('='.repeat(60) + '\n');

    } catch (error) {
      console.error('❌ Polling error:', error.message);
      console.error(error.stack);
    } finally {
      this.isPolling = false;
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

  async getStats() {
    try {
      const channels = await this.odoo.getAllChannels();
      const storeStats = await this.store.getStats();

      return {
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
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

  // 🔥 Start polling (uses config from ENV)
  startPolling() {
    console.log(`⏰ Starting continuous polling every ${this.config.pollInterval/1000} seconds`);
    
    if (this.config.showContext) {
      console.log(`📊 Mode: Last ${this.config.messageLimit} messages with ${this.config.conversationLimit} message history`);
    } else {
      console.log(`📊 Mode: Simple (no conversation context)`);
    }
    
    console.log(`⏸️  Press Ctrl+C to stop\n`);
    
    // Choose polling method based on configuration
    const pollMethod = this.config.showContext 
      ? () => this.pollWithContext() 
      : () => this.pollMessagesDirectly();
    
    // Initial poll
    pollMethod();
    
    // Set interval for continuous polling
    this.pollInterval = setInterval(pollMethod, this.config.pollInterval);
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

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = OdooMessagePoller;
