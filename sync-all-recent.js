require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

/**
 * SYNC ALL RECENT MESSAGES
 * This script fetches ALL messages from last 7 days and syncs them to MongoDB
 * Use this to ensure no messages are missed
 */

async function syncAllRecentMessages() {
  console.log('🔄 Syncing ALL recent messages from Odoo...\n');
  
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
    
    // Get messages from last 7 days
    const daysAgo = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const startDateStr = startDate.toISOString().replace('T', ' ').substring(0, 19);
    
    console.log(`📅 Fetching ALL messages from last ${daysAgo} days`);
    console.log(`   Start: ${startDateStr}`);
    console.log(`   End: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
    
    // Fetch ALL messages (no message ID filter, just date)
    const messages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment'],
        ['date', '>=', startDateStr]
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'email_from', 'res_id', 'attachment_ids'],
        order: 'id desc',
        limit: 10000  // Get up to 10k messages
      }
    );
    
    if (messages.length === 0) {
      console.log('⚠️  No messages found in last 7 days');
      await store.client.close();
      process.exit(0);
    }
    
    console.log(`✅ Found ${messages.length} total messages\n`);
    
    // Group by date to show distribution
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const last3Days = new Date(today);
    last3Days.setDate(last3Days.getDate() - 3);
    
    const todayCount = messages.filter(m => new Date(m.date) >= today).length;
    const yesterdayCount = messages.filter(m => new Date(m.date) >= yesterday && new Date(m.date) < today).length;
    const last3DaysCount = messages.filter(m => new Date(m.date) >= last3Days).length;
    
    console.log('📊 Message Distribution:');
    console.log(`   Today: ${todayCount} messages`);
    console.log(`   Yesterday: ${yesterdayCount} messages`);
    console.log(`   Last 3 days: ${last3DaysCount} messages`);
    console.log(`   Last 7 days: ${messages.length} messages\n`);
    
    // Get unique channel IDs
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
    
    // Show channels with most messages
    const channelMessageCount = {};
    messages.forEach(m => {
      channelMessageCount[m.res_id] = (channelMessageCount[m.res_id] || 0) + 1;
    });
    
    const topChannels = Object.entries(channelMessageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('\n📊 Top 10 Channels by Message Count:');
    topChannels.forEach(([channelId, count], i) => {
      const channel = channelMap.get(parseInt(channelId));
      const channelName = channel ? channel.name : 'Unknown';
      console.log(`   ${i + 1}. ${channelName} (ID: ${channelId}) - ${count} messages`);
    });
    
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
        
        if (savedCount % 100 === 0) {
          console.log(`   📊 Progress: ${savedCount}/${messages.length} saved, ${duplicateCount} duplicates`);
        }
      } catch (err) {
        if (err.code === 11000) {
          duplicateCount++;
        } else {
          console.error('Error saving message:', err.message);
        }
      }
    }
    
    // Update last message ID to the HIGHEST message ID we found
    if (messages.length > 0) {
      const latestMessageId = Math.max(...messages.map(m => m.id));
      await store.updateLastGlobalMessageId(latestMessageId);
      console.log(`\n✅ Updated tracking to highest message ID: ${latestMessageId}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Sync Complete!');
    console.log('='.repeat(70));
    console.log(`📥 Total messages found: ${messages.length}`);
    console.log(`💾 Saved: ${savedCount} new messages`);
    console.log(`⏭️  Skipped: ${duplicateCount} duplicates`);
    console.log(`📅 Time Range: Last ${daysAgo} days`);
    console.log('\n📊 Messages by Type:');
    console.log(`   📱 WhatsApp: ${stats.whatsapp}`);
    console.log(`   💬 LiveChat: ${stats.livechat}`);
    console.log(`   👤 Direct Messages: ${stats.direct_message}`);
    console.log(`   📢 Team Channels: ${stats.team_channel}`);
    console.log(`   ❓ Unknown: ${stats.unknown}`);
    console.log('\n✨ Your dashboard should now show ALL recent messages!');
    console.log('🚀 Check: http://localhost:3000/index.html\n');
    
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

syncAllRecentMessages();

