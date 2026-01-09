require('dotenv').config();
const OdooClient = require('./odooClient');
const MessageStore = require('./messageStore');

/**
 * AUTO-REPLY BOT
 * 
 * Features:
 * - Processes messages from TEST NUMBERS only
 * - Generates AI replies (keyword-based for now, GPT-4 ready)
 * - Sends replies back to Odoo
 * - Marks messages as processed
 */

// 🎯 TEST NUMBERS - Only these will get auto-replies
const TEST_NUMBERS = [
  '966538797999',  // Your test number
  // Add more numbers here to enable auto-reply for them
];

class AutoReplyBot {
  constructor() {
    this.odoo = new OdooClient(
      process.env.ODOO_URL,
      process.env.ODOO_DB,
      process.env.ODOO_USERNAME,
      process.env.ODOO_PASSWORD
    );
    this.store = new MessageStore(process.env.MONGODB_URI);
    
    // Team members (won't get auto-replies)
    this.teamMembers = [
      'helen', 'admin', 'muhammad', 'abdullah', 'abdulrahman',
      'abdulraqeeb', 'amr', 'aseel', 'dania', 'faisal',
      'landing', 'sultan', 'walaa', 'youssuf', 'bot'
    ];
  }

  async initialize() {
    await this.odoo.authenticate();
    await this.store.connect();
    console.log('🤖 Auto-Reply Bot initialized');
    console.log(`🎯 Test numbers: ${TEST_NUMBERS.join(', ')}`);
    console.log(`👥 Team members will be skipped: ${this.teamMembers.length} members\n`);
  }

  async processMessages() {
    try {
      // Get unprocessed messages
      const messages = await this.store.getUnprocessedMessages(20);
      
      if (messages.length === 0) {
        return; // No messages to process
      }

      console.log(`\n📨 Found ${messages.length} unprocessed messages`);
      
      let repliedCount = 0;
      let skippedCount = 0;

      for (const msg of messages) {
        // Check if this is a team member
        const isTeam = this.isTeamMember(msg.author_id);
        
        if (isTeam) {
          // Skip team messages, just mark as processed
          await this.store.markAsProcessed(msg.message_id);
          skippedCount++;
          continue;
        }

        // Check if this is a test number
        const isTestNumber = TEST_NUMBERS.includes(msg.channel_name);
        
        if (!isTestNumber) {
          // Not test number, just mark as processed (no reply)
          await this.store.markAsProcessed(msg.message_id);
          skippedCount++;
          continue;
        }

        // THIS IS A CUSTOMER MESSAGE FROM TEST NUMBER!
        console.log(`\n🎯 AUTO-REPLYING to ${msg.channel_name}`);
        console.log(`   Message: ${this.cleanHtml(msg.body).substring(0, 60)}...`);

        try {
          // Generate reply
          const reply = await this.generateReply(msg);

          // Send reply to Odoo
          await this.sendReply(msg.channel_id, reply);

          // Mark as processed
          await this.store.markAsProcessed(msg.message_id);

          repliedCount++;
          console.log(`   ✅ Reply sent: ${reply.substring(0, 60)}...`);
          
          // Wait 2 seconds between replies (to avoid spam)
          await this.sleep(2000);
        } catch (error) {
          console.error(`   ❌ Error processing message ${msg.message_id}:`, error.message);
          // Don't mark as processed so we can retry later
        }
      }

      if (repliedCount > 0 || skippedCount > 0) {
        console.log(`\n📊 Summary: ${repliedCount} replied, ${skippedCount} skipped`);
      }

    } catch (error) {
      console.error('❌ Error in processMessages:', error);
    }
  }

  async generateReply(message) {
    // Get conversation history for context
    const history = await this.store.getMessagesByChannel(message.channel_id, 5);
    
    const messageText = this.cleanHtml(message.body).toLowerCase();
    
    // 🤖 KEYWORD-BASED REPLIES (Simple version)
    // Replace this with GPT-4 later!
    
    // Greetings
    if (messageText.includes('سلام') || messageText.includes('مرحبا') || 
        messageText.includes('hello') || messageText.includes('hi')) {
      return 'مرحباً بك! أنا مساعد خدمة عملاء ويكيب. كيف يمكنني مساعدتك؟ 😊';
    }
    
    // Price inquiry
    if (messageText.includes('سعر') || messageText.includes('كم') || 
        messageText.includes('price') || messageText.includes('cost')) {
      return 'شكراً على استفسارك! لتقديم عرض سعر دقيق، نحتاج بعض التفاصيل:\n\n1️⃣ صور أو فيديو للأغراض\n2️⃣ موقعك الحالي\n3️⃣ الوجهة (في حال النقل)\n\nهل يمكنك إرسال هذه المعلومات؟';
    }
    
    // Storage inquiry
    if (messageText.includes('تخزين') || messageText.includes('storage')) {
      return 'نوفر خدمات تخزين آمنة ومُكيفة لجميع أنواع الأثاث والأغراض! 📦\n\nنحتاج:\n• صور للأغراض\n• المدة المتوقعة للتخزين\n\nسيتواصل معك قسم المعاينة لتقديم عرض السعر المناسب.';
    }
    
    // Moving inquiry
    if (messageText.includes('نقل') || messageText.includes('شحن') || 
        messageText.includes('moving')) {
      return 'نقدم خدمات نقل الأثاث والعفش بكل احترافية! 🚚\n\nيرجى إرسال:\n• صور أو فيديو للأغراض\n• موقع المنزل القديم\n• موقع المنزل الجديد\n\nوسنقدم لك عرض سعر شامل للنقل والعمالة والأدوات.';
    }
    
    // Location shared
    if (messageText.includes('location') || message.body.includes('goo.gl') || 
        message.body.includes('maps')) {
      return 'شكراً على مشاركة الموقع! 📍\n\nتم استلام الموقع وسيتم مراجعته من قبل فريق المعاينة.\n\nهل يوجد تفاصيل إضافية تود مشاركتها؟';
    }
    
    // Photos/attachments
    if (message.attachment_ids && message.attachment_ids.length > 0) {
      return `شكراً على إرسال ${message.attachment_ids.length > 1 ? 'الصور' : 'الصورة'}! 📸\n\nتم استلامها وسيتم مراجعتها من قبل قسم المعاينة.\n\nسنتواصل معك قريباً بعرض السعر المناسب.`;
    }
    
    // Default response
    return 'شكراً على رسالتك! 🙏\n\nسيتم التواصل معك من قبل أحد موظفي خدمة العملاء قريباً.\n\nإذا كان لديك أي استفسار عاجل، يمكنك إرسال التفاصيل وسنرد عليك في أقرب وقت.';
  }

  async sendReply(channelId, message) {
    await this.odoo.execute(
      'mail.channel',
      'message_post',
      [channelId],
      {
        body: message,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment'
      }
    );
  }

  isTeamMember(authorId) {
    if (!authorId) return false;
    const author = authorId[1] ? authorId[1].toLowerCase() : '';
    return this.teamMembers.some(member => author.includes(member));
  }

  cleanHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start() {
    console.log('🤖 Auto-Reply Bot ACTIVE\n');
    console.log('Configuration:');
    console.log(`  • Test numbers: ${TEST_NUMBERS.length}`);
    console.log(`  • Team members to skip: ${this.teamMembers.length}`);
    console.log(`  • Check interval: 10 seconds`);
    console.log(`  • Reply mode: Keyword-based (upgrade to GPT-4 later)\n`);
    console.log('⚠️  IMPORTANT: Only test numbers will get auto-replies!');
    console.log('⚠️  All other messages will just be marked as processed.\n');
    console.log('Press Ctrl+C to stop\n');
    console.log('='.repeat(70));

    // Initial check
    await this.processMessages();

    // Check every 10 seconds
    setInterval(async () => {
      await this.processMessages();
    }, 10000);
  }
}

async function main() {
  const bot = new AutoReplyBot();
  
  try {
    await bot.initialize();
    await bot.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down Auto-Reply Bot...');
      if (bot.store.client) {
        await bot.store.client.close();
      }
      console.log('👋 Goodbye!\n');
      process.exit(0);
    });

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

module.exports = AutoReplyBot;

