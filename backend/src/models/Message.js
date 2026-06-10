const mongoose = require('mongoose');

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['text', 'image', 'emoji', 'system'], default: 'text' },
    content: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
