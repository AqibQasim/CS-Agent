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
    await this.db.collection('channel_state').createIndex({ channel_id: 1 }, { unique: true });
  }

  // Save message to DB
  async saveMessage(message, channelName) {
    try {
      await this.db.collection('messages').insertOne({
        message_id: message.id,
        channel_id: message.res_id,
        channel_name: channelName,
        body: message.body,
        author_id: message.author_id,
        email_from: message.email_from,
        date: new Date(message.date),
        attachment_ids: message.attachment_ids || [],
        created_at: new Date(),
        processed: false  // For AI processing later
      });
      console.log(`💾 Saved message ${message.id} from channel ${channelName}`);
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

  // Update last processed message ID
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
}

module.exports = MessageStore;
