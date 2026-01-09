require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

/**
 * Example Usage: Fetch Messages from Odoo discuss.channel Model
 * 
 * This script demonstrates various ways to fetch and work with
 * messages from Odoo's discuss.channel model.
 */

async function exampleUsage() {
  console.log('🎯 Odoo Discuss Model - Example Usage\n');
  console.log('=' .repeat(60));
  
  // Initialize Odoo client
  const odoo = new OdooClient(
    process.env.ODOO_URL,
    process.env.ODOO_DB,
    process.env.ODOO_USERNAME,
    process.env.ODOO_PASSWORD
  );
  
  // Initialize MongoDB store
  const store = new MessageStore(process.env.MONGODB_URI);
  
  try {
    // Authenticate with Odoo
    await odoo.authenticate();
    await store.connect();
    
    console.log('\n✅ Connected successfully!\n');
    
    // ========================================
    // Example 1: Get All Channels
    // ========================================
    console.log('📋 Example 1: Get All Channels');
    console.log('-'.repeat(60));
    
    const channels = await odoo.getAllChannels();
    console.log(`Total channels: ${channels.all.length}`);
    console.log(`  📱 WhatsApp: ${channels.whatsapp.length}`);
    console.log(`  💬 LiveChat: ${channels.livechat.length}`);
    console.log(`  👤 Direct Messages: ${channels.chat.length}`);
    console.log(`  📢 Team Channels: ${channels.channel.length}`);
    
    // Show first 3 channels
    console.log('\nFirst 3 channels:');
    channels.all.slice(0, 3).forEach(ch => {
      console.log(`  - [${ch.id}] ${ch.name} (${ch.channel_type})`);
    });
    
    // ========================================
    // Example 2: Get Latest Messages (Last 10)
    // ========================================
    console.log('\n\n📋 Example 2: Get Latest Messages');
    console.log('-'.repeat(60));
    
    const latestMessages = await odoo.getLatestMessagesAllChannels(10);
    console.log(`Found ${latestMessages.length} latest messages`);
    
    latestMessages.forEach((msg, i) => {
      const author = msg.author_id ? msg.author_id[1] : 'Unknown';
      const date = new Date(msg.date).toLocaleString();
      const body = msg.body.replace(/<[^>]*>/g, '').substring(0, 50);
      
      console.log(`\n${i + 1}. Message ID: ${msg.id}`);
      console.log(`   Date: ${date}`);
      console.log(`   Author: ${author}`);
      console.log(`   Channel ID: ${msg.res_id}`);
      console.log(`   Body: ${body}...`);
    });
    
    // ========================================
    // Example 3: Get Messages from Last 24 Hours
    // ========================================
    console.log('\n\n📋 Example 3: Get Messages from Last 24 Hours');
    console.log('-'.repeat(60));
    
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const yesterdayStr = yesterday.toISOString().replace('T', ' ').substring(0, 19);
    
    const last24hMessages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment'],
        ['date', '>=', yesterdayStr]
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'res_id'],
        order: 'date desc',
        limit: 100
      }
    );
    
    console.log(`Found ${last24hMessages.length} messages from last 24 hours`);
    console.log(`Time range: ${yesterdayStr} to now`);
    
    // ========================================
    // Example 4: Get Conversation History for a Channel
    // ========================================
    console.log('\n\n📋 Example 4: Get Conversation History');
    console.log('-'.repeat(60));
    
    if (channels.all.length > 0) {
      const firstChannel = channels.all[0];
      console.log(`Channel: ${firstChannel.name} (ID: ${firstChannel.id})`);
      
      const conversation = await odoo.getChannelConversation(firstChannel.id, 10);
      console.log(`Messages in conversation: ${conversation.length}\n`);
      
      conversation.forEach((msg, i) => {
        const author = msg.author_id ? msg.author_id[1] : 'Unknown';
        const date = new Date(msg.date).toLocaleString();
        const body = msg.body.replace(/<[^>]*>/g, '').substring(0, 40);
        
        console.log(`${i + 1}. [${date}] ${author}: ${body}...`);
      });
    }
    
    // ========================================
    // Example 5: Get Messages for WhatsApp Channels Only
    // ========================================
    console.log('\n\n📋 Example 5: Get WhatsApp Messages Only');
    console.log('-'.repeat(60));
    
    if (channels.whatsapp.length > 0) {
      const whatsappChannelIds = channels.whatsapp.map(ch => ch.id);
      
      const whatsappMessages = await odoo.execute(
        'mail.message',
        'search_read',
        [[
          ['model', '=', 'discuss.channel'],
          ['res_id', 'in', whatsappChannelIds.slice(0, 10)],  // Limit to first 10 channels
          ['message_type', '=', 'comment']
        ]],
        {
          fields: ['id', 'body', 'date', 'author_id', 'res_id'],
          order: 'date desc',
          limit: 20
        }
      );
      
      console.log(`Found ${whatsappMessages.length} WhatsApp messages`);
      console.log(`From ${Math.min(10, channels.whatsapp.length)} WhatsApp channels`);
    } else {
      console.log('No WhatsApp channels found');
    }
    
    // ========================================
    // Example 6: Save Messages to MongoDB
    // ========================================
    console.log('\n\n📋 Example 6: Save Messages to MongoDB');
    console.log('-'.repeat(60));
    
    if (latestMessages.length > 0) {
      const messageToSave = latestMessages[0];
      const channel = channels.all.find(ch => ch.id === messageToSave.res_id);
      
      if (channel) {
        try {
          await store.saveMessage({
            ...messageToSave,
            channel_type: detectChannelType(channel),
            channel_name: channel.name
          });
          console.log(`✅ Saved message ID ${messageToSave.id} to MongoDB`);
        } catch (err) {
          if (err.code === 11000) {
            console.log(`ℹ️  Message ID ${messageToSave.id} already exists in MongoDB`);
          } else {
            throw err;
          }
        }
      }
    }
    
    // ========================================
    // Example 7: Query Messages from MongoDB
    // ========================================
    console.log('\n\n📋 Example 7: Query Messages from MongoDB');
    console.log('-'.repeat(60));
    
    // Get latest messages from MongoDB
    const storedMessages = await store.getAllMessages(0, 5);
    console.log(`Messages in MongoDB: ${storedMessages.length}\n`);
    
    storedMessages.forEach((msg, i) => {
      const author = msg.author_id ? msg.author_id[1] : 'Unknown';
      const date = new Date(msg.date).toLocaleString();
      
      console.log(`${i + 1}. [${msg.channel_type}] ${msg.channel_name}`);
      console.log(`   ${author} - ${date}`);
    });
    
    // ========================================
    // Example 8: Get Statistics
    // ========================================
    console.log('\n\n📋 Example 8: System Statistics');
    console.log('-'.repeat(60));
    
    const stats = await store.getStats();
    console.log(`Total messages in MongoDB: ${stats.totalMessages}`);
    console.log(`Unprocessed messages: ${stats.unprocessedCount}`);
    console.log(`Messages from last 24h: ${stats.recentMessages}`);
    
    if (stats.messagesByType.length > 0) {
      console.log('\nMessages by type:');
      stats.messagesByType.forEach(type => {
        console.log(`  ${type._id || 'unknown'}: ${type.count}`);
      });
    }
    
    // ========================================
    // Example 9: Search Messages
    // ========================================
    console.log('\n\n📋 Example 9: Search Messages in MongoDB');
    console.log('-'.repeat(60));
    
    const searchTerm = 'hello';
    const searchResults = await store.searchMessages(searchTerm, 5);
    console.log(`Found ${searchResults.length} messages containing "${searchTerm}"`);
    
    searchResults.forEach((msg, i) => {
      const body = msg.body.replace(/<[^>]*>/g, '').substring(0, 60);
      console.log(`${i + 1}. ${body}...`);
    });
    
    // ========================================
    // Example 10: Get Messages by Time Range (NEW)
    // ========================================
    console.log('\n\n📋 Example 10: Get Messages by Time Range (NEW)');
    console.log('-'.repeat(60));
    
    const last6Hours = await store.getMessagesByTimeRange(6, 50);
    console.log(`Messages from last 6 hours: ${last6Hours.length}`);
    
    const lastWeek = await store.getMessagesByTimeRange(168, 100);
    console.log(`Messages from last week: ${lastWeek.length}`);
    
    // ========================================
    // Summary
    // ========================================
    console.log('\n\n' + '='.repeat(60));
    console.log('✅ All examples completed successfully!');
    console.log('='.repeat(60));
    
    console.log('\n📚 What you learned:');
    console.log('  1. How to connect to Odoo and authenticate');
    console.log('  2. How to fetch all discuss.channel records');
    console.log('  3. How to get latest messages from Odoo');
    console.log('  4. How to filter messages by time range');
    console.log('  5. How to get conversation history');
    console.log('  6. How to filter by channel type (WhatsApp)');
    console.log('  7. How to save messages to MongoDB');
    console.log('  8. How to query messages from MongoDB');
    console.log('  9. How to get system statistics');
    console.log(' 10. How to search messages');
    console.log(' 11. How to use time range filtering (NEW)');
    
    console.log('\n💡 Next steps:');
    console.log('  - Customize the queries for your use case');
    console.log('  - Build your own dashboard or integration');
    console.log('  - Use the REST API (see API_REFERENCE.md)');
    console.log('  - Read DISCUSS_MODEL_GUIDE.md for more details\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    if (store.client) {
      await store.client.close();
    }
    process.exit(0);
  }
}

function detectChannelType(channel) {
  if (/^\d+$/.test(channel.name)) return 'whatsapp';
  if (channel.channel_type === 'livechat') return 'livechat';
  if (channel.channel_type === 'chat') return 'direct_message';
  if (channel.channel_type === 'channel') return 'team_channel';
  return 'unknown';
}

// Run examples
if (require.main === module) {
  exampleUsage().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = exampleUsage;

