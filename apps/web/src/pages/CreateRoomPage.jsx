import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/match/matches');
        setMatches(data.matches);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load matches');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(userId) {
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/chat/rooms', { name: name.trim(), participantIds: selected });
      navigate(`/chat/${data.conversation.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create group');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/chat" className="text-gray-400">
          ←
        </Link>
        <h1 className="text-2xl font-bold text-violet-400">New group</h1>
      </div>

      <form onSubmit={createRoom} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Weekend crew"
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Add matches</label>
          {loading && <p className="text-sm text-gray-400">Loading...</p>}
          {!loading && matches.length === 0 && (
            <p className="text-sm text-gray-400">You need at least one match to start a group.</p>
          )}
          <div className="space-y-2">
            {matches.map((m) => {
              const checked = selected.includes(m.user.id);
              return (
                <button
                  type="button"
                  key={m.matchId}
                  onClick={() => toggle(m.user.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                    checked ? 'border-violet-400 bg-violet-500/10' : 'border-gray-800 bg-gray-900'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800 text-xl">
                    {m.user?.profile?.mainPhoto ? (
                      <img src={m.user.profile.mainPhoto} alt={m.user.name} className="h-full w-full object-cover" />
                    ) : (
                      '🧑'
                    )}
                  </div>
                  <span className="flex-1 text-sm font-semibold">{m.user?.name}</span>
                  {checked && <span className="text-violet-400">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={creating || !name.trim() || selected.length === 0}
          className="w-full rounded-lg bg-violet-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create group'}
        </button>
      </form>
    </div>
  );
}
