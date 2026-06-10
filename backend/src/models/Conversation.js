const mongoose = require('mongoose');

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ['direct', 'room'], default: 'direct' },
    name: { type: String, default: '', maxlength: 50 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    matchId: { type: Schema.Types.ObjectId, ref: 'Match' },
    lastMessage: {
      content: { type: String, default: '' },
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date },
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
