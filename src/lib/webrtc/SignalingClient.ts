// src/lib/webrtc/SignalingClient.ts
import { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../supabase/client";

type SignalData = RTCSessionDescriptionInit | RTCIceCandidateInit;

interface SignalMessage {
  to: string;
  from: string;
  data: SignalData;
}

interface SignalingEvents {
  onJoined: (myId: string, existingPeers: string[]) => void;
  onPeerJoined: (peerId: string) => void;
  onPeerLeft: (peerId: string) => void;
  onSignal: (from: string, data: SignalData) => void;
}

export class SignalingClient {
  private channel: RealtimeChannel;
  private myId: string;
  private events: SignalingEvents;

  constructor(roomId: string, events: SignalingEvents) {
    this.myId = crypto.randomUUID();
    this.events = events;
    this.channel = supabase.channel(`room:${roomId}`);
  }

  async join() {
    // 1. signal 수신
    this.channel.on("broadcast", { event: "signal" }, ({ payload }: { payload: SignalMessage }) => {
      if (payload.to === this.myId) {
        this.events.onSignal(payload.from, payload.data);
      }
    });

    // 2. Presence로 입퇴장 관리
    this.channel.on("presence", { event: "join" }, ({ newPresences }) => {
      newPresences.forEach((p) => {
        if (p.peerId !== this.myId) {
          this.events.onPeerJoined(p.peerId as string);
        }
      });
    });

    this.channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      leftPresences.forEach((p) => {
        this.events.onPeerLeft(p.peerId as string);
      });
    });

    // 3. 구독 후 presence track
    await new Promise<void>((resolve) => {
      this.channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.channel.track({ peerId: this.myId });
          resolve();
        }
      });
    });

    // 4. 현재 접속자 목록 → 기존 피어들에게 offer 시작
    const state = this.channel.presenceState<{ peerId: string }>();
    const existingPeers = Object.values(state)
      .flat()
      .map((p) => p.peerId)
      .filter((id) => id !== this.myId);

    this.events.onJoined(this.myId, existingPeers);
  }

  send(to: string, data: SignalData) {
    void this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { to, from: this.myId, data } satisfies SignalMessage,
    });
  }

  async leave() {
    await this.channel.untrack();
    await supabase.removeChannel(this.channel);
  }
}
