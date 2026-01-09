require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

async function fetchYesterday() {
  console.log('🔄 Fetching messages from yesterday (Jan 8, 2026)...\n');
  
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
    
    // Set specific date range for Jan 8, 2026
    const startDate = '2026-01-08 00:00:00';
    const endDate = '2026-01-09 23:59:59';
    
    console.log(`📅 Fetching from: ${startDate}`);
    console.log(`📅 Until: ${endDate}\n`);
    
    // Fetch messages from specific date range (including WhatsApp)
    const messages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', 'in', ['comment', 'whatsapp_message', 'notification']],
        ['date', '>=', startDate],
        ['date', '<=', endDate]
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'res_id', 'attachment_ids', 'message_type'],
        order: 'date desc',
        limit: 5000
      }
    );
    
    console.log(`✅ Found ${messages.length} messages from Jan 8-9, 2026\n`);
    
    if (messages.length === 0) {
      console.log('⚠️  No messages found in this date range');
      await store.client.close();
      process.exit(0);
    }
    
    // Show first few messages
    console.log('📋 Sample messages:');
    messages.slice(0, 5).forEach((msg, i) => {
      const author = msg.author_id ? msg.author_id[1] : 'Unknown';
      const body = (msg.body || '').replace(/<[^>]*>/g, '').substring(0, 50);
      console.log(`${i + 1}. [${msg.date}] ${author}: ${body}...`);
    });
    
    // Get channel info
    const channelIds = [...new Set(messages.map(m => m.res_id))];
    console.log(`\n📱 Fetching info for ${channelIds.length} channels...`);
    
    const channels = await odoo.getChannelsByIds(channelIds);
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));
    
    // Save messages
    let savedCount = 0;
    let duplicateCount = 0;
    
    console.log(`\n💾 Saving messages to MongoDB...\n`);
    
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
          console.log(`   📊 Saved ${savedCount}/${messages.length} messages...`);
        }
      } catch (err) {
        if (err.code === 11000) {
          duplicateCount++;
        } else {
          console.error('Error saving message:', err.message);
        }
      }
    }
    
    // Update last message ID
    if (messages.length > 0) {
      const latestMessageId = Math.max(...messages.map(m => m.id));
      await store.updateLastGlobalMessageId(latestMessageId);
      console.log(`\n✅ Updated tracking to message ID: ${latestMessageId}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Fetch Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Saved: ${savedCount} new messages`);
    console.log(`⏭️  Skipped: ${duplicateCount} duplicates`);
    console.log(`📅 Date Range: Jan 8-9, 2026`);
    console.log('\n🎯 Now refresh your dashboard!');
    console.log('🌐 http://localhost:3000/index.html\n');
    
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

fetchYesterday();

