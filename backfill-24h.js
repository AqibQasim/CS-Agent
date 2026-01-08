require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

async function backfillLast24Hours() {
  console.log('🔄 Backfilling messages from last 24 hours...\n');
  
  const odoo = new OdooClient(
    process.env.ODOO_URL,
    process.env.ODOO_DB,
    process.env.ODOO_USERNAME,
    process.env.ODOO_PASSWORD
  );
  
  const store = new MessageStore(process.env.MONGODB_URI);
  
  try {
    await odoo.authenticate();
    await store.connect();
    
    // Calculate 24 hours ago
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const yesterdayStr = yesterday.toISOString().replace('T', ' ').substring(0, 19);
    
    console.log(`📅 Fetching messages from: ${yesterdayStr}`);
    console.log(`📅 Until now: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
    
    // 🔥 Fetch messages from last 24 hours
    const messages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment'],
        ['date', '>=', yesterdayStr]  // 🔥 Last 24 hours
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'res_id', 'attachment_ids'],
        order: 'date desc',
        limit: 5000  // Max 5000 messages
      }
    );
    
    if (messages.length === 0) {
      console.log('⚠️  No messages found in last 24 hours');
      await store.client.close();
      process.exit(0);
    }
    
    console.log(`✅ Found ${messages.length} messages from last 24 hours\n`);
    
    // Get unique channel IDs
    const channelIds = [...new Set(messages.map(m => m.res_id))];
    console.log(`📱 Fetching info for ${channelIds.length} channels...`);
    
    const channels = await odoo.getChannelsByIds(channelIds);
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));
    
    // Save messages
    let savedCount = 0;
    let duplicateCount = 0;
    let channelTypeStats = {
      whatsapp: 0,
      livechat: 0,
      direct_message: 0,
      team_channel: 0,
      unknown: 0
    };
    
    console.log(`\n💾 Saving messages to database...\n`);
    
    for (const message of messages) {
      const channel = channelMap.get(message.res_id);
      if (!channel) continue;
      
      const channelType = detectChannelType(channel);
      channelTypeStats[channelType]++;
      
      try {
        await store.saveMessage({
          ...message,
          channel_type: channelType,
          channel_name: channel.name
        });
        savedCount++;
        
        if (savedCount % 100 === 0) {
          console.log(`   📊 Saved ${savedCount}/${messages.length} messages...`);
        }
      } catch (err) {
        // Skip duplicates
        if (err.code === 11000) {
          duplicateCount++;
        } else {
          console.error('Error saving message:', err.message);
        }
      }
    }
    
    // Update last message ID to the latest one
    if (messages.length > 0) {
      const latestMessageId = Math.max(...messages.map(m => m.id));
      await store.updateLastGlobalMessageId(latestMessageId);
      console.log(`\n✅ Updated tracking to message ID: ${latestMessageId}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Saved: ${savedCount} new messages`);
    console.log(`⏭️  Skipped: ${duplicateCount} duplicates`);
    console.log(`📅 Time Range: Last 24 hours`);
    console.log('\n📊 Messages by Type:');
    console.log(`   📱 WhatsApp: ${channelTypeStats.whatsapp}`);
    console.log(`   💬 LiveChat: ${channelTypeStats.livechat}`);
    console.log(`   👤 Direct Messages: ${channelTypeStats.direct_message}`);
    console.log(`   📢 Team Channels: ${channelTypeStats.team_channel}`);
    console.log(`   ❓ Unknown: ${channelTypeStats.unknown}`);
    console.log('\n🎯 Dashboard should now display these messages!');
    console.log('🚀 Run: node app.js to continue monitoring\n');
    
    await store.client.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function detectChannelType(channel) {
  if (/^\d+$/.test(channel.name)) return 'whatsapp';
  if (channel.channel_type === 'livechat') return 'livechat';
  if (channel.channel_type === 'chat') return 'direct_message';
  if (channel.channel_type === 'channel') return 'team_channel';
  return 'unknown';
}

backfillLast24Hours();
