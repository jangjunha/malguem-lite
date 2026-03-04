import { useEffect, useRef, useState } from "react";
import { MeshNetwork } from "./lib/webrtc/MeshNetwork";

type AppState = "idle" | "joining" | "joined";

type LogEntry = { level: "log" | "error"; msg: string; time: string };

const logListeners = new Set<(entry: LogEntry) => void>();

const origLog = console.log.bind(console);
const origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  origLog(...args);
  const entry: LogEntry = { level: "log", msg: args.map(String).join(" "), time: ts() };
  logListeners.forEach((fn) => fn(entry));
};
console.error = (...args: unknown[]) => {
  origError(...args);
  const entry: LogEntry = { level: "error", msg: args.map(String).join(" "), time: ts() };
  logListeners.forEach((fn) => fn(entry));
};

function ts() {
  return new Date().toTimeString().slice(0, 8);
}

function useLogger() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    const fn = (entry: LogEntry) => setLogs((prev) => [...prev.slice(-199), entry]);
    logListeners.add(fn);
    return () => { logListeners.delete(fn); };
  }, []);
  return { logs, clear: () => setLogs([]) };
}

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const { logs, clear } = useLogger();

  const meshRef = useRef<MeshNetwork | null>(null);
  const localStreamsRef = useRef<MediaStream[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localScreen) {
      localVideoRef.current.srcObject = localScreen;
    }
  }, [localScreen]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function join() {
    setAppState("joining");
    console.log(`[app] 입장 시도: ${roomId}`);

    try {
      const mesh = new MeshNetwork(
        (peerId, stream) => {
          console.log(`[app] 스트림 수신: ${peerId.slice(0, 8)}`);
          setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
        },
        (peerId) => {
          console.log(`[app] 피어 퇴장: ${peerId.slice(0, 8)}`);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        },
      );

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[app] 마이크 획득 완료");

      localStreamsRef.current = [micStream];

      await mesh.join(roomId);
      console.log(`[app] 입장 완료 (my id: ${mesh.myPeerId.slice(0, 8)})`);
      mesh.addLocalStream(micStream);

      meshRef.current = mesh;
      setAppState("joined");
    } catch (e) {
      console.error("[app] 입장 실패:", e);
      setAppState("idle");
    }
  }

  async function startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      console.log("[app] 화면공유 시작");
      localStreamsRef.current.push(screenStream);
      meshRef.current!.addLocalStream(screenStream);
      await meshRef.current!.applyScreenShareEncoding();
      setLocalScreen(screenStream);

      screenStream.getVideoTracks()[0].onended = () => {
        console.log("[app] 화면공유 종료 (OS)");
        stopScreenShare(screenStream);
      };
    } catch (e) {
      console.error("[app] 화면공유 실패:", e);
    }
  }

  function stopScreenShare(stream: MediaStream = localScreen!) {
    stream.getTracks().forEach((t) => t.stop());
    localStreamsRef.current = localStreamsRef.current.filter((s) => s !== stream);
    setLocalScreen(null);
    console.log("[app] 화면공유 중지");
  }

  async function leave() {
    console.log("[app] 퇴장");
    await meshRef.current?.destroy();
    meshRef.current = null;
    localStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    localStreamsRef.current = [];
    setLocalScreen(null);
    setRemoteStreams(new Map());
    setAppState("idle");
  }

  return (
    <div style={{ padding: 16, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 12 }}>
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

      <LogPanel logs={logs} onClear={clear} logEndRef={logEndRef} />
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

function LogPanel({
  logs,
  onClear,
  logEndRef,
}: {
  logs: LogEntry[];
  onClear: () => void;
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#888" }}>로그</span>
        <button onClick={onClear} style={{ fontSize: 11, padding: "1px 6px" }}>
          지우기
        </button>
      </div>
      <div
        style={{
          background: "#111",
          color: "#eee",
          fontSize: 12,
          padding: 8,
          height: 200,
          overflowY: "auto",
          borderRadius: 4,
        }}
      >
        {logs.length === 0 && <span style={{ color: "#555" }}>로그 없음</span>}
        {logs.map((entry, i) => (
          <div key={i} style={{ color: entry.level === "error" ? "#f88" : "#eee", lineHeight: 1.5 }}>
            <span style={{ color: "#666" }}>{entry.time} </span>
            {entry.msg}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
