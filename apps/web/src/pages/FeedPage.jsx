import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api/client';
import SwipeCard from '../components/SwipeCard';

export default function FeedPage() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchInfo, setMatchInfo] = useState(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/match/feed');
      setFeed(data.feed);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  async function handleSwipe(action) {
    const person = feed[0];
    if (!person) return;

    setFeed((f) => f.slice(1));

    try {
      if (action === 'like') {
        const { data } = await api.post('/match/like', { userId: person.id });
        if (data.match) {
          setMatchInfo({ name: person.name, photo: person.profile?.mainPhoto, conversationId: data.conversationId });
        }
      } else {
        await api.post('/match/pass', { userId: person.id });
      }
    } catch {
      // swallow swipe errors - card already removed
    }
  }

  return (
    <div className="flex h-full flex-col px-4 pt-6">
      <h1 className="mb-4 text-center text-2xl font-bold text-violet-400">Discover</h1>

      <div className="relative mx-auto w-full max-w-sm flex-1">
        {loading && <p className="mt-12 text-center text-gray-400">Loading...</p>}
        {!loading && error && <p className="mt-12 text-center text-red-400">{error}</p>}
        {!loading && !error && feed.length === 0 && (
          <div className="mt-12 text-center text-gray-400">
            <p className="mb-4">No more profiles right now.</p>
            <button onClick={loadFeed} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">
              Refresh
            </button>
          </div>
        )}

        <AnimatePresence>
          {feed.slice(0, 3).map((person, idx) => (
            <SwipeCard
              key={person.id}
              person={person}
              isTop={idx === 0}
              onSwipe={idx === 0 ? handleSwipe : () => {}}
            />
          ))}
        </AnimatePresence>
      </div>

      {!loading && feed.length > 0 && (
        <div className="mt-4 flex justify-center gap-6 pb-4">
          <button
            onClick={() => handleSwipe('pass')}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-2xl text-red-400 shadow-lg"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe('like')}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-2xl text-green-400 shadow-lg"
          >
            ♥
          </button>
        </div>
      )}

      <AnimatePresence>
        {matchInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-6 text-center"
          >
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="space-y-4">
              <h2 className="text-3xl font-bold text-violet-400">It's a match!</h2>
              <p className="text-gray-300">You and {matchInfo.name} liked each other.</p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setMatchInfo(null)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm"
                >
                  Keep swiping
                </button>
                <Link
                  to={`/chat/${matchInfo.conversationId}`}
                  onClick={() => setMatchInfo(null)}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Send a message
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
