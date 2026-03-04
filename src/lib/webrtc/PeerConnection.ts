// src/lib/webrtc/PeerConnection.ts
const STUN_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
};

type SignalData = RTCSessionDescriptionInit | RTCIceCandidateInit;

export class ManagedPeerConnection {
  private pc: RTCPeerConnection;
  private peerId: string;
  private onSignal: (data: SignalData) => void;
  private onRemoteStream: (stream: MediaStream) => void;

  constructor(
    peerId: string,
    onSignal: (data: SignalData) => void,
    onRemoteStream: (stream: MediaStream) => void,
  ) {
    this.peerId = peerId;
    this.onSignal = onSignal;
    this.onRemoteStream = onRemoteStream;
    this.pc = new RTCPeerConnection(STUN_CONFIG);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.onSignal(candidate.toJSON());
    };

    this.pc.ontrack = ({ streams }) => {
      if (streams[0]) this.onRemoteStream(streams[0]);
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[${this.peerId}] ${this.pc.connectionState}`);
    };
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.onSignal(offer);
  }

  async handleSignal(data: SignalData) {
    if ("type" in data) {
      await this.pc.setRemoteDescription(data);
      if (data.type === "offer") {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.onSignal(answer);
      }
    } else {
      await this.pc.addIceCandidate(data);
    }
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.pc.addTrack(track, stream);
  }

  async applyScreenShareEncoding() {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;
    const params = sender.getParameters();
    if (!params.encodings.length) params.encodings = [{}];
    params.encodings[0] = {
      maxBitrate: 8_000_000,
      maxFramerate: 60,
      priority: "high",
      networkPriority: "high",
    };
    await sender.setParameters(params);
  }

  close() {
    this.pc.close();
  }
}
