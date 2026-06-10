const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    refreshTokenHash: { type: String, select: false },

    isGuest: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    profile: {
      age: { type: Number, min: 18, max: 120 },
      gender: { type: String, enum: ['male', 'female', 'nonbinary', 'other'] },
      orientation: { type: String, enum: ['straight', 'gay', 'lesbian', 'bisexual', 'other'] },
      lookingFor: [{ type: String, enum: ['male', 'female', 'nonbinary', 'other'] }],
      bio: { type: String, maxlength: 500, default: '' },
      interests: [{ type: String, trim: true }],
      photos: [{ type: String }],
      mainPhoto: { type: String, default: '' },
      isVerified: { type: Boolean, default: false },
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      ipAddress: { type: String, default: '' },
    },

    settings: {
      maxDistance: { type: Number, default: 50 },
      ageRange: {
        min: { type: Number, default: 18 },
        max: { type: Number, default: 99 },
      },
      showOnline: { type: Boolean, default: true },
      notifications: { type: Boolean, default: true },
    },

    status: {
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now },
      isActive: { type: Boolean, default: true },
      isBanned: { type: Boolean, default: false },
    },

    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Guest accounts auto-expire via TTL index
    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

userSchema.methods.toPublicProfile = function () {
  const rounded = (this.location?.coordinates || [0, 0]).map((c) => Math.round(c * 100) / 100);
  return {
    id: this._id,
    name: this.name,
    profile: this.profile,
    location: {
      city: this.location?.city || '',
      country: this.location?.country || '',
      coordinates: rounded,
    },
    status: {
      isOnline: this.settings?.showOnline ? this.status.isOnline : undefined,
      lastSeen: this.settings?.showOnline ? this.status.lastSeen : undefined,
    },
  };
};

module.exports = mongoose.model('User', userSchema);
