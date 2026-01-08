require('dotenv').config();
const OdooClient = require('./odooClient');

async function checkRecentMessages() {
  const odoo = new OdooClient(
    process.env.ODOO_URL,
    process.env.ODOO_DB,
    process.env.ODOO_USERNAME,
    process.env.ODOO_PASSWORD
  );
  
  try {
    await odoo.authenticate();
    
    console.log('🔍 Checking latest messages in Odoo...\n');
    
    // Check last 10 messages with all details
    const messages = await odoo.execute(
      'mail.message',
      'search_read',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment']
      ]],
      {
        fields: ['id', 'body', 'date', 'author_id', 'model', 'message_type', 'res_id'],
        order: 'id desc',
        limit: 10
      }
    );
    
    console.log(`📨 Last 10 messages in discuss.channel:\n`);
    
    messages.forEach((msg, i) => {
      const date = new Date(msg.date);
      const pktDate = date.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
      const author = msg.author_id ? msg.author_id[1] : 'Unknown';
      const body = (msg.body || '').replace(/<[^>]*>/g, '').substring(0, 60);
      
      console.log(`${i + 1}. ID: ${msg.id}`);
      console.log(`   📅 ${pktDate} PKT`);
      console.log(`   👤 ${author}`);
      console.log(`   💬 ${body}...`);
      console.log('');
    });
    
    // Also check if there are ANY messages today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().replace('T', ' ').substring(0, 19);
    
    const todayMessages = await odoo.execute(
      'mail.message',
      'search_count',
      [[
        ['model', '=', 'discuss.channel'],
        ['message_type', '=', 'comment'],
        ['date', '>=', todayStr]
      ]]
    );
    
    console.log(`📊 Messages posted TODAY (Jan 8, 2026): ${todayMessages}`);
    
    // Check all message types (not just discuss.channel)
    const allMessages = await odoo.execute(
      'mail.message',
      'search_read',
      [[]],
      {
        fields: ['id', 'date', 'model', 'message_type'],
        order: 'id desc',
        limit: 5
      }
    );
    
    console.log(`\n📋 Last 5 messages (ALL types):\n`);
    allMessages.forEach((msg, i) => {
      const date = new Date(msg.date);
      const pktDate = date.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
      console.log(`${i + 1}. ID: ${msg.id} | ${pktDate} | Model: ${msg.model} | Type: ${msg.message_type}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRecentMessages();
