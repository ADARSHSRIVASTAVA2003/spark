import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useSocket } from '../context/SocketContext';
import { startConversation } from '../utils/chat';

export default function SuggestPage() {
  const { liveStatus } = useSocket();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messaging, setMessaging] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/match/suggestions');
        setSuggestions(data.suggestions);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load suggestions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function messageUser(userId) {
    setMessaging(userId);
    setError('');
    try {
      const conversationId = await startConversation(userId);
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start conversation');
    } finally {
      setMessaging(null);
    }
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-2xl font-bold text-violet-600">Suggestions</h1>

      {loading && <p className="text-center text-gray-500">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}
      {!loading && suggestions.length === 0 && (
        <p className="text-center text-gray-500">No suggestions right now. Check back later!</p>
      )}

      <div className="grid grid-cols-2 gap-3 pb-4">
        {suggestions.map((person) => {
          const live = liveStatus.get(person.id);
          const isOnline = live ? live.isOnline : person.status?.isOnline;
          const showStatus = isOnline !== undefined;

          return (
            <div key={person.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative flex h-32 items-center justify-center bg-gray-100 text-4xl">
                {person.profile?.mainPhoto ? (
                  <img src={person.profile.mainPhoto} alt={person.name} className="h-full w-full object-cover" />
                ) : (
                  '🧑'
                )}
                {showStatus && isOnline && (
                  <span className="absolute right-2 top-2 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                )}
              </div>
              <div className="p-2 text-left">
                <p className="text-sm font-semibold">
                  {person.name}
                  {person.profile?.age ? `, ${person.profile.age}` : ''}
                </p>
                {showStatus && (
                  <p className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                    {isOnline ? 'Active now' : 'Offline'}
                  </p>
                )}
                <button
                  onClick={() => messageUser(person.id)}
                  disabled={messaging === person.id}
                  className="mt-2 w-full rounded-lg bg-violet-500 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {messaging === person.id ? 'Opening...' : 'Message'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
