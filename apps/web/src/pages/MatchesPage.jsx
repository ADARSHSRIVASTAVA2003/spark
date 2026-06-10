import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-2xl font-bold text-pink-400">Matches</h1>

      {loading && <p className="text-center text-gray-400">Loading...</p>}
      {error && <p className="text-center text-red-400">{error}</p>}
      {!loading && matches.length === 0 && (
        <p className="text-center text-gray-400">No matches yet. Keep swiping!</p>
      )}

      <div className="grid grid-cols-3 gap-3 pb-4">
        {matches.map((m) => (
          <Link
            key={m.matchId}
            to={`/chat`}
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-800 text-2xl">
              {m.user?.profile?.mainPhoto ? (
                <img src={m.user.profile.mainPhoto} alt={m.user.name} className="h-full w-full object-cover" />
              ) : (
                '🧑'
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">{m.user?.name}</p>
              <p className="text-xs text-gray-500">
                {m.user?.status?.isOnline ? (
                  <span className="text-green-400">Online</span>
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
