import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext';

function Avatar({ peer }) {
  return (
    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gray-800 text-4xl">
      {peer?.profile?.mainPhoto ? (
        <img src={peer.profile.mainPhoto} alt={peer.name} className="h-full w-full object-cover" />
      ) : (
        '🧑'
      )}
    </div>
  );
}

export default function CallModal() {
  const {
    callState,
    callType,
    peer,
    localStream,
    remoteStream,
    error,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  useEffect(() => {
    if (callState === 'idle') {
      setMuted(false);
      setVideoOff(false);
    }
  }, [callState]);

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white">
      {error && (
        <p className="absolute top-4 rounded bg-red-900/80 px-3 py-1 text-sm text-red-200">{error}</p>
      )}

      {callState === 'incoming' && (
        <div className="flex flex-col items-center gap-4">
          <Avatar peer={peer} />
          <p className="text-lg font-semibold">{peer?.name}</p>
          <p className="text-sm text-gray-400">Incoming {callType} call...</p>
          <div className="mt-4 flex gap-6">
            <button
              onClick={rejectCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-2xl"
            >
              ✕
            </button>
            <button
              onClick={acceptCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-2xl"
            >
              ✓
            </button>
          </div>
        </div>
      )}

      {callState === 'outgoing' && (
        <div className="flex flex-col items-center gap-4">
          <Avatar peer={peer} />
          <p className="text-lg font-semibold">{peer?.name}</p>
          <p className="text-sm text-gray-400">Calling...</p>
          <button
            onClick={endCall}
            className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-2xl"
          >
            ✕
          </button>
        </div>
      )}

      {callState === 'connected' && (
        <div className="relative flex h-full w-full flex-col items-center justify-center">
          {callType === 'video' ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute right-4 top-4 h-32 w-24 rounded-lg border border-gray-700 object-cover"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Avatar peer={peer} />
              <p className="text-lg font-semibold">{peer?.name}</p>
              <p className="text-sm text-gray-400">In call...</p>
              <audio ref={remoteAudioRef} autoPlay />
            </div>
          )}

          <div className="absolute bottom-8 flex gap-6">
            <button
              onClick={() => {
                setMuted((m) => {
                  toggleMute(!m);
                  return !m;
                });
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                muted ? 'bg-white text-black' : 'bg-gray-700/80'
              }`}
            >
              {muted ? '🔇' : '🎙️'}
            </button>
            {callType === 'video' && (
              <button
                onClick={() => {
                  setVideoOff((v) => {
                    toggleVideo(!v);
                    return !v;
                  });
                }}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                  videoOff ? 'bg-white text-black' : 'bg-gray-700/80'
                }`}
              >
                {videoOff ? '🚫' : '🎥'}
              </button>
            )}
            <button
              onClick={endCall}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
