require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

async function backfillCustomRange(hoursAgo = 24) {
  console.log(`🔄 Backfilling messages from last ${hoursAgo} hours...\n`);
  
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
    
    // Calculate time ago
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hoursAgo);
    const startDateStr = startDate.toISOString().replace('T', ' ').substring(0, 19);
    
    console.log(`📅 Start: ${startDateStr}`);
    console.log(`📅 End: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
    console.log(`⏱️  Duration: ${hoursAgo} hours\n`);
    
    // Fetch messages (including WhatsApp)
    const messages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', 'in', ['comment', 'whatsapp_message', 'notification']],
        ['date', '>=', startDateStr]
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'res_id', 'attachment_ids', 'message_type'],
        order: 'date desc',
        limit: 10000
      }
    );
    
    if (messages.length === 0) {
      console.log(`⚠️  No messages found in last ${hoursAgo} hours`);
      await store.client.close();
      process.exit(0);
    }
    
    console.log(`✅ Found ${messages.length} messages\n`);
    
    // Get channel info
    const channelIds = [...new Set(messages.map(m => m.res_id))];
    console.log(`📱 Fetching info for ${channelIds.length} channels...`);
    
    const channels = await odoo.getChannelsByIds(channelIds);
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));
    
    // Save messages
    let savedCount = 0;
    let duplicateCount = 0;
    
    console.log(`\n💾 Saving to database...\n`);
    
    for (const message of messages) {
      const channel = channelMap.get(message.res_id);
      if (!channel) continue;
      
      const channelType = detectChannelType(channel);
      
      try {
        await store.saveMessage({
          ...message,
          channel_type: channelType,
          channel_name: channel.name
        });
        savedCount++;
        
        if (savedCount % 50 === 0) {
          console.log(`   📊 Progress: ${savedCount}/${messages.length}`);
        }
      } catch (err) {
        if (err.code === 11000) duplicateCount++;
      }
    }
    
    // Update tracking
    if (messages.length > 0) {
      const latestMessageId = Math.max(...messages.map(m => m.id));
      await store.updateLastGlobalMessageId(latestMessageId);
    }
    
    console.log('\n✅ Backfill Complete!');
    console.log(`   💾 Saved: ${savedCount}`);
    console.log(`   ⏭️  Duplicates: ${duplicateCount}`);
    console.log(`   📅 Period: ${hoursAgo} hours`);
    console.log('\n🚀 Ready to run: node app.js\n');
    
    await store.client.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
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

// Usage: node backfill-custom.js 24
// Or: node backfill-custom.js 48 (for 48 hours)
const hours = parseInt(process.argv[2]) || 24;
backfillCustomRange(hours);
