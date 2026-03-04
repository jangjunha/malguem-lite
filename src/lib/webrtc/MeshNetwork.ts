// src/lib/webrtc/MeshNetwork.ts
import { ManagedPeerConnection } from "./PeerConnection";
import { SignalingClient } from "./SignalingClient";

export class MeshNetwork {
  private peers = new Map<string, ManagedPeerConnection>();
  private localStreams: MediaStream[] = [];
  private signaling!: SignalingClient;
  private onRemoteStream: (peerId: string, stream: MediaStream) => void;
  private onPeerLeft: (peerId: string) => void;
  public myPeerId: string = "";

  constructor(
    onRemoteStream: (peerId: string, stream: MediaStream) => void,
    onPeerLeft: (peerId: string) => void,
  ) {
    this.onRemoteStream = onRemoteStream;
    this.onPeerLeft = onPeerLeft;
  }

  async join(roomId: string) {
    const client = new SignalingClient(roomId, {
      onJoined: (myId, existingPeers) => {
        this.myPeerId = myId;
        // 기존 멤버에게 offer 전송 (내가 나중에 들어온 사람)
        existingPeers.forEach((id) => this.createPeer(id, true));
      },
      onPeerJoined: (peerId) => {
        // 상대가 나중에 들어옴 → offer 기다림
        this.createPeer(peerId, false);
      },
      onPeerLeft: (peerId) => {
        this.peers.get(peerId)?.close();
        this.peers.delete(peerId);
        this.onPeerLeft(peerId);
      },
      onSignal: (from, data) => {
        this.peers.get(from)?.handleSignal(data);
      },
    });

    await client.join();
    this.signaling = client;
  }

  private createPeer(peerId: string, initiator: boolean) {
    const peer = new ManagedPeerConnection(
      peerId,
      (data) => this.signaling.send(peerId, data),
      (stream) => this.onRemoteStream(peerId, stream),
    );

    this.localStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    });

    this.peers.set(peerId, peer);
    if (initiator) peer.createOffer();
  }

  addLocalStream(stream: MediaStream) {
    this.localStreams.push(stream);
    this.peers.forEach((peer) => {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    });
  }

  async applyScreenShareEncoding() {
    for (const peer of this.peers.values()) {
      await peer.applyScreenShareEncoding();
    }
  }

  async destroy() {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    await this.signaling.leave();
  }
}
