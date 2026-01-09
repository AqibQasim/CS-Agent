const { MongoClient } = require('mongodb');

class MessageStore {
  constructor(mongoUri) {
    this.mongoUri = mongoUri;
    this.client = null;
    this.db = null;
  }

  async connect() {
    this.client = await MongoClient.connect(this.mongoUri);
    this.db = this.client.db();
    console.log('✅ Connected to MongoDB');

    // Create indexes
    await this.db.collection('messages').createIndex({ message_id: 1 }, { unique: true });
    await this.db.collection('messages').createIndex({ channel_id: 1 });
    await this.db.collection('messages').createIndex({ date: -1 });
    await this.db.collection('messages').createIndex({ created_at: -1 });
    await this.db.collection('messages').createIndex({ processed: 1 });
    await this.db.collection('channel_state').createIndex({ channel_id: 1 }, { unique: true });
  }

  // Save message to DB
  async saveMessage(message, channelName) {
    try {
      await this.db.collection('messages').insertOne({
        message_id: message.id,
        channel_id: message.res_id,
        channel_name: channelName || message.channel_name,
        channel_type: message.channel_type,
        body: message.body,
        author_id: message.author_id,
        email_from: message.email_from,
        date: new Date(message.date),
        attachment_ids: message.attachment_ids || [],
        created_at: new Date(),
        processed: false
      });
      // console.log(`💾 Saved message ${message.id}`);
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate message, ignore
        return;
      }
      throw err;
    }
  }

  // Get last processed message ID for a channel
  async getLastMessageId(channelId) {
    const state = await this.db.collection('channel_state').findOne({
      channel_id: channelId
    });

    return state ? state.last_message_id : 0;
  }

  // Update last processed message ID for a channel
  async updateLastMessageId(channelId, messageId) {
    await this.db.collection('channel_state').updateOne(
      { channel_id: channelId },
      {
        $set: {
          last_message_id: messageId,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
  }

  // Get last global message ID (for optimized polling)
  async getLastGlobalMessageId() {
    const state = await this.db.collection('global_state').findOne({ 
      key: 'last_message_id' 
    });
    return state ? state.value : 0;
  }

  // Update last global message ID
  async updateLastGlobalMessageId(messageId) {
    await this.db.collection('global_state').updateOne(
      { key: 'last_message_id' },
      { 
        $set: { 
          value: messageId, 
          updated_at: new Date() 
        } 
      },
      { upsert: true }
    );
  }

  // Get unprocessed messages for AI
  async getUnprocessedMessages(limit = 10) {
    return await this.db.collection('messages')
      .find({ processed: false })
      .sort({ date: 1 })
      .limit(limit)
      .toArray();
  }

  // Mark message as processed
  async markAsProcessed(messageId) {
    await this.db.collection('messages').updateOne(
      { message_id: messageId },
      { $set: { processed: true, processed_at: new Date() } }
    );
  }

  // Get all messages (with pagination)
  async getAllMessages(skip = 0, limit = 50) {
    return await this.db.collection('messages')
      .find({})
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  // Get messages by channel
  async getMessagesByChannel(channelId, limit = 100) {
    return await this.db.collection('messages')
      .find({ channel_id: channelId })
      .sort({ date: 1 })
      .limit(limit)
      .toArray();
  }

  // Search messages
  async searchMessages(query, limit = 20) {
    return await this.db.collection('messages')
      .find({
        $or: [
          { body: { $regex: query, $options: 'i' } },
          { channel_name: { $regex: query, $options: 'i' } },
          { 'author_id.1': { $regex: query, $options: 'i' } }
        ]
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
  }

  // Get messages by time range (in hours) - filters by when message was SENT in Odoo
  async getMessagesByTimeRange(hours = 24, limit = 100) {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.db.collection('messages')
      .find({
        date: { $gte: startTime }
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
  }

  // Get recently stored messages (filters by when we stored them in MongoDB)
  async getRecentlyStoredMessages(hours = 24, limit = 100) {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.db.collection('messages')
      .find({
        created_at: { $gte: startTime }
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  // Get statistics
  async getStats() {
    const totalMessages = await this.db.collection('messages').countDocuments({});
    const unprocessedCount = await this.db.collection('messages')
      .countDocuments({ processed: false });

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMessages = await this.db.collection('messages')
      .countDocuments({ created_at: { $gte: last24Hours } });

    const messagesByType = await this.db.collection('messages').aggregate([
      { $group: { _id: '$channel_type', count: { $sum: 1 } } }
    ]).toArray();

    return {
      totalMessages,
      unprocessedCount,
      recentMessages,
      messagesByType
    };
  }
}

module.exports = MessageStore;
