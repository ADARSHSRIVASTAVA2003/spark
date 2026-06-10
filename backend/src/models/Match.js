const mongoose = require('mongoose');

const { Schema } = mongoose;

const matchSchema = new Schema({
  users: {
    type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    validate: (v) => Array.isArray(v) && v.length === 2,
  },
  status: { type: String, enum: ['pending', 'matched', 'rejected'], default: 'matched' },
  likedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  likedAt: { type: Date },
  matchedAt: { type: Date, default: Date.now },
});

matchSchema.index({ users: 1 });

module.exports = mongoose.model('Match', matchSchema);
