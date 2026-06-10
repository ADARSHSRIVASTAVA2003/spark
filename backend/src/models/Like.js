const mongoose = require('mongoose');

const { Schema } = mongoose;

const likeSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'superlike', 'pass'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

likeSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
