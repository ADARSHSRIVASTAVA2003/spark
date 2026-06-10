import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [interests, setInterests] = useState((user?.profile?.interests || []).join(', '));
  const [maxDistance, setMaxDistance] = useState(user?.settings?.maxDistance || 50);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.put('/users/profile', {
        bio,
        interests: interests
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
      });
      await api.put('/users/settings', { maxDistance: Number(maxDistance) });
      await refreshUser();
      setMessage('Profile updated');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await api.post('/users/photo', formData);
      await refreshUser();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(url) {
    try {
      await api.delete('/users/photo', { data: { url } });
      await refreshUser();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not remove photo');
    }
  }

  async function setMainPhoto(url) {
    try {
      await api.put('/users/photo/main', { url });
      await refreshUser();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not set main photo');
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleDeleteAccount() {
    if (!confirm('This will permanently delete your account and all data. Continue?')) return;
    await api.delete('/users/account');
    await logout();
    navigate('/login');
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="mb-4 text-2xl font-bold text-violet-600">Profile</h1>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-2xl">
          {user?.profile?.mainPhoto ? (
            <img src={user.profile.mainPhoto} alt="me" className="h-full w-full object-cover" />
          ) : (
            '🧑'
          )}
        </div>
        <div className="text-left">
          <p className="font-semibold">{user?.name}</p>
          <p className="text-sm text-gray-500">
            {user?.profile?.age ? `${user.profile.age} · ` : ''}
            {user?.profile?.gender}
          </p>
        </div>
      </div>

      {!user?.isGuest && (
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
              Interests (comma separated)
            </label>
            <input
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
              Max distance: {maxDistance} km
            </label>
            <input
              type="range"
              min={1}
              max={500}
              value={maxDistance}
              onChange={(e) => setMaxDistance(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
              Photos ({user?.profile?.photos?.length || 0}/9)
            </label>
            {user?.profile?.photos?.length > 0 && (
              <div className="mb-2 grid grid-cols-3 gap-2">
                {user.profile.photos.map((p) => {
                  const isMain = p === user.profile.mainPhoto;
                  return (
                    <div key={p} className="group relative">
                      <img
                        src={p}
                        alt=""
                        className={`h-24 w-full rounded-lg object-cover ${isMain ? 'ring-2 ring-violet-500' : ''}`}
                      />
                      {isMain && (
                        <span className="absolute left-1 top-1 rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Main
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {!isMain && (
                          <button
                            type="button"
                            onClick={() => setMainPhoto(p)}
                            className="rounded bg-black/70 px-2 py-1 text-[10px] text-white"
                          >
                            Set main
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(p)}
                          className="rounded bg-black/70 px-2 py-1 text-[10px] text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {(user?.profile?.photos?.length || 0) < 9 && (
              <label className="block w-full cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-3 text-center text-sm text-gray-500 hover:border-violet-500 hover:text-violet-600">
                {uploading ? 'Uploading...' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {message && <p className="text-sm text-violet-600">{message}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-violet-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      )}

      <div className="mt-8 space-y-2">
        <button onClick={handleLogout} className="w-full rounded-lg border border-gray-300 py-3 text-sm">
          Log out
        </button>
        {!user?.isGuest && (
          <button
            onClick={handleDeleteAccount}
            className="w-full rounded-lg border border-red-300 py-3 text-sm text-red-500"
          >
            Delete account
          </button>
        )}
      </div>
    </div>
  );
}
