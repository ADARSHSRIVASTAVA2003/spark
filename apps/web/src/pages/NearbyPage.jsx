import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function NearbyPage() {
  const { user, refreshUser } = useAuth();
  const { liveStatus } = useSocket();
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const hasLocation = user?.location?.coordinates?.some((c) => c !== 0);

  const loadNearby = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/geo/nearby');
      setNearby(data.nearby);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load nearby people');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLocation) loadNearby();
    else setLoading(false);
  }, [hasLocation, loadNearby]);

  async function detectLocation() {
    setLocating(true);
    setError('');
    try {
      const { data } = await api.post('/geo/detect');
      await api.put('/geo/location', { lat: data.lat, lng: data.lng, city: data.city, country: data.country });
      await refreshUser();
      await loadNearby();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not detect location');
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-2xl font-bold text-violet-600">Nearby</h1>

      {!hasLocation && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p className="mb-3">
            Enable location to see people near you. We only ever show your approximate location
            (~1km), never your exact address.
          </p>
          <button
            onClick={detectLocation}
            disabled={locating}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {locating ? 'Detecting...' : 'Use my location'}
          </button>
        </div>
      )}

      {loading && <p className="text-center text-gray-500">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-3 pb-4">
        {nearby.map((person) => {
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
                <p className="text-xs text-gray-500">{person.distanceKm} km away</p>
                {showStatus && (
                  <p className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                    {isOnline ? 'Active now' : 'Offline'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && hasLocation && nearby.length === 0 && (
        <p className="text-center text-gray-500">No one nearby yet. Check back later!</p>
      )}
    </div>
  );
}
