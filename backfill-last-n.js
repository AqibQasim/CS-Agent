require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

async function backfillLastN(count = 100) {
  console.log(`🔄 Backfilling last ${count} messages (ignoring time)...\n`);
  
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
    
    console.log(`📥 Fetching last ${count} messages from Odoo...`);
    
    // 🔥 Get last N messages by ID (no date filter)
    const messages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment']
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'res_id', 'attachment_ids'],
        order: 'id desc',  // 🔥 Most recent first
        limit: count
      }
    );
    
    if (messages.length === 0) {
      console.log('⚠️  No messages found');
      await store.client.close();
      process.exit(0);
    }
    
    console.log(`✅ Found ${messages.length} messages\n`);
    
    // Show date range
    const oldestDate = new Date(messages[messages.length - 1].date);
    const newestDate = new Date(messages[0].date);
    console.log(`📅 Date range:`);
    console.log(`   Oldest: ${oldestDate.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT`);
    console.log(`   Newest: ${newestDate.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} PKT\n`);
    
    // Get channel info
    const channelIds = [...new Set(messages.map(m => m.res_id))];
    console.log(`📱 Fetching info for ${channelIds.length} channels...`);
    
    const channels = await odoo.getChannelsByIds(channelIds);
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));
    
    // Save messages
    let savedCount = 0;
    let duplicateCount = 0;
    let stats = {
      whatsapp: 0,
      livechat: 0,
      direct_message: 0,
      team_channel: 0,
      unknown: 0
    };
    
    console.log(`\n💾 Saving to database...\n`);
    
    for (const message of messages) {
      const channel = channelMap.get(message.res_id);
      if (!channel) continue;
      
      const channelType = detectChannelType(channel);
      stats[channelType]++;
      
      try {
        await store.saveMessage({
          ...message,
          channel_type: channelType,
          channel_name: channel.name
        });
        savedCount++;
        
        if (savedCount % 20 === 0) {
          console.log(`   📊 Progress: ${savedCount}/${messages.length}`);
        }
      } catch (err) {
        if (err.code === 11000) duplicateCount++;
      }
    }
    
    // Update tracking to latest message ID
    if (messages.length > 0) {
      const latestMessageId = messages[0].id;  // First message is most recent
      await store.updateLastGlobalMessageId(latestMessageId);
      console.log(`\n✅ Updated tracking to message ID: ${latestMessageId}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Saved: ${savedCount} new messages`);
    console.log(`⏭️  Duplicates: ${duplicateCount}`);
    console.log(`📊 Total processed: ${messages.length}`);
    console.log('\n📊 Messages by Type:');
    console.log(`   📱 WhatsApp: ${stats.whatsapp}`);
    console.log(`   💬 LiveChat: ${stats.livechat}`);
    console.log(`   👤 Direct Messages: ${stats.direct_message}`);
    console.log(`   📢 Team Channels: ${stats.team_channel}`);
    console.log(`   ❓ Unknown: ${stats.unknown}`);
    console.log('\n🎯 Dashboard should now display these messages!');
    console.log('🚀 Run: node app.js\n');
    
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

// Usage: node backfill-last-n.js 200
const count = parseInt(process.argv[2]) || 100;
backfillLastN(count);
