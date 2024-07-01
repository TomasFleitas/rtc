type PeerType = 'unknown' | 'answerer' | 'offerer';

type OnReceiveMessageParams = (message: any) => void;

type InnerStateChangeParams = (state: RTCPeerConnectionState) => void;

type OnReceiveMediaStream = (value: {
  type: 'host' | 'remote';
  stream: MediaStream;
}) => void;

type OnReceiveFile = (value: {
  fileId: number;
  size: number;
  percentage: number;
  chunkSize: number;
  done: boolean;
  file?: Blob;
  fileName: string;
}) => void;

type ConstructorParams = {
  clientKey: string;
  peerId: string;
  baseUrl?: string;
  onReceiveData?: OnReceiveMessageParams;
  onReceiveFile?: OnReceiveFile;
  onReceiveMediaStream?: OnReceiveMediaStream;
  onConnectionStateChange?: InnerStateChangeParams;
};

type Tracks = {
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
};
