import { useEffect, useRef, useState } from "react";
import { MeshNetwork } from "./lib/webrtc/MeshNetwork";

type AppState = "idle" | "joining" | "joined";

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);

  const meshRef = useRef<MeshNetwork | null>(null);
  const localStreamsRef = useRef<MediaStream[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localScreen) {
      localVideoRef.current.srcObject = localScreen;
    }
  }, [localScreen]);

  async function join() {
    setAppState("joining");

    const mesh = new MeshNetwork(
      (peerId, stream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
      },
      (peerId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      },
    );

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    localStreamsRef.current = [micStream];

    await mesh.join(roomId);
    mesh.addLocalStream(micStream);

    meshRef.current = mesh;
    setAppState("joined");
  }

  async function startScreenShare() {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    localStreamsRef.current.push(screenStream);
    meshRef.current!.addLocalStream(screenStream);
    await meshRef.current!.applyScreenShareEncoding();
    setLocalScreen(screenStream);

    screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare(screenStream);
    };
  }

  function stopScreenShare(stream: MediaStream = localScreen!) {
    stream.getTracks().forEach((t) => t.stop());
    localStreamsRef.current = localStreamsRef.current.filter((s) => s !== stream);
    setLocalScreen(null);
  }

  async function leave() {
    await meshRef.current?.destroy();
    meshRef.current = null;
    localStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    localStreamsRef.current = [];
    setLocalScreen(null);
    setRemoteStreams(new Map());
    setAppState("idle");
  }

  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      {appState === "idle" && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="방 ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && roomId && void join()}
            style={{ border: "1px solid #ccc", padding: "4px 8px" }}
          />
          <button onClick={() => void join()} disabled={!roomId}>
            입장
          </button>
        </div>
      )}

      {appState === "joining" && <p>연결 중...</p>}

      {appState === "joined" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <strong>방: {roomId}</strong>
            <span>{remoteStreams.size}명 연결됨</span>
            {localScreen ? (
              <button onClick={() => stopScreenShare()}>화면공유 중지</button>
            ) : (
              <button onClick={() => void startScreenShare()}>화면공유 시작</button>
            )}
            <button onClick={() => void leave()}>퇴장</button>
          </div>
          {localScreen && (
            <div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>내 화면공유</div>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: 320, border: "1px solid #333" }}
              />
            </div>
          )}
          {[...remoteStreams.entries()].map(([peerId, stream]) => (
            <RemoteVideo key={peerId} peerId={peerId} stream={stream} />
          ))}
        </div>
      )}
    </div>
  );
}

function RemoteVideo({ peerId, stream }: { peerId: string; stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{peerId.slice(0, 8)}</div>
      <video ref={videoRef} autoPlay playsInline style={{ width: 320, border: "1px solid #333" }} />
    </div>
  );
}
