import { motion, useMotionValue, useTransform } from 'framer-motion';

const SWIPE_THRESHOLD = 120;

export default function SwipeCard({ person, onSwipe, isTop }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  function handleDragEnd(_e, info) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipe('like');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipe('pass');
    }
  }

  const photo = person.profile?.mainPhoto;

  return (
    <motion.div
      className="absolute inset-0 mx-auto flex max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl"
      style={{ x, rotate }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.96, opacity: isTop ? 1 : 0.6 }}
      animate={{ scale: isTop ? 1 : 0.96, opacity: isTop ? 1 : 0.6 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.25 } }}
    >
      <div className="relative h-[60%] min-h-[320px] bg-gray-800">
        {photo ? (
          <img src={photo} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🧑</div>
        )}

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute left-6 top-6 rotate-[-15deg] rounded-lg border-4 border-green-400 px-4 py-1 text-2xl font-bold text-green-400"
        >
          LIKE
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute right-6 top-6 rotate-[15deg] rounded-lg border-4 border-red-400 px-4 py-1 text-2xl font-bold text-red-400"
        >
          PASS
        </motion.div>

        {person.distanceKm !== undefined && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs">
            {person.distanceKm} km away
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 p-4 text-left">
        <h2 className="text-xl font-semibold">
          {person.name}
          {person.profile?.age ? `, ${person.profile.age}` : ''}
        </h2>
        {person.location?.city && <p className="text-sm text-gray-400">{person.location.city}</p>}
        {person.profile?.bio && <p className="text-sm text-gray-300">{person.profile.bio}</p>}
        {person.profile?.interests?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {person.profile.interests.map((interest) => (
              <span key={interest} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                {interest}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
