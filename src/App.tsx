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

    const [micStream, screenStream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ audio: true }),
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
    ]);

    localStreamsRef.current = [micStream, screenStream];

    await mesh.join(roomId);
    mesh.addLocalStream(micStream);
    mesh.addLocalStream(screenStream);
    await mesh.applyScreenShareEncoding();

    meshRef.current = mesh;
    setLocalScreen(screenStream);
    setAppState("joined");
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
            <button onClick={() => void leave()}>퇴장</button>
          </div>
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
