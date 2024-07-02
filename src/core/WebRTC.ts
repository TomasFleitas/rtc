type PeerType = 'unknown' | 'answerer' | 'offerer';

type OnReceiveMessageParams = (message: any) => void;

type InnerStateChangeParams = (state: RTCPeerConnectionState) => void;

type OnReceiveMediaStream = (stream: MediaStream) => void;

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
  orchestratorUrl?: string;
  onReceiveData?: OnReceiveMessageParams;
  onReceiveFile?: OnReceiveFile;
  onReceiveMediaStream?: OnReceiveMediaStream;
  onConnectionStateChange?: InnerStateChangeParams;
};

type Tracks = {
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
};

type TempCallback = (v?: { ms?: number; percentage?: number }) => void;

type TempTransferData = {
  type: 'data' | 'file';
  timestamp?: number;
  callback?: TempCallback;
  resolve?: TempCallback;
};

export class WebRTC {
  private peerConnection: RTCPeerConnection;
  private offerId: string;
  private answererId: string;
  private orchestratorUrl = 'wss://rtc.ewents.io';
  private clientKey: string;
  private isOfferer = true;
  private channelId: string;
  private dataChannel: RTCDataChannel;
  private innerChannel: RTCDataChannel;
  private fileChannel: RTCDataChannel;
  private ws: WebSocket;
  private innerStateChange: InnerStateChangeParams[] = new Array(2);
  private innerOnMessage: OnReceiveMessageParams[] = new Array(2);
  private innerOnReceiveFile: OnReceiveFile[] = new Array(2);
  private innerOnReceiveMediaStream: OnReceiveMediaStream[] = new Array(2);
  private senders: Map<string, RTCRtpSender> = new Map();
  private tempTransferData: Map<string, TempTransferData> = new Map();
  private mediaCallback: ((() => void) | undefined)[] = new Array(2);

  constructor({
    orchestratorUrl,
    peerId,
    onReceiveData,
    onReceiveFile,
    onReceiveMediaStream,
    onConnectionStateChange,
    clientKey,
  }: ConstructorParams) {
    this.orchestratorUrl = orchestratorUrl ?? this.orchestratorUrl;
    this.clientKey = clientKey;
    this.offerId = peerId;

    if (onReceiveData) {
      this.innerOnMessage[0] = onReceiveData;
    }
    if (onReceiveFile) {
      this.innerOnReceiveFile[0] = onReceiveFile;
    }
    if (onReceiveMediaStream) {
      this.innerOnReceiveMediaStream[0] = onReceiveMediaStream;
    }
    if (onConnectionStateChange) {
      this.innerStateChange[0] = onConnectionStateChange;
    }

    if (!this.clientKey) {
      throw Error('clientKey is required.');
    }

    if (!this.offerId) {
      throw Error('Peer is required.');
    }

    if (!this.orchestratorUrl) {
      throw Error('orchestratorUrl  is required.');
    }
    window.addEventListener('beforeunload', this.closeConnection.bind(this));
  }

  public getChannelId() {
    return this.channelId;
  }

  public peerType(): PeerType {
    let type: PeerType = 'unknown';

    if (!this.isConnected()) {
      return type;
    }

    if (!this.isOfferer) {
      type = 'answerer';
    }

    if (this.isOfferer) {
      type = 'offerer';
    }

    return type;
  }

  public isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  public onReceiveData(callback: OnReceiveMessageParams) {
    this.innerOnMessage[1] = callback;
  }
  public onReceivedFile(callback: OnReceiveFile) {
    this.innerOnReceiveFile[1] = callback;
  }
  public onReceiveMediaStream(callback: OnReceiveMediaStream) {
    this.innerOnReceiveMediaStream[1] = callback;
  }
  public onConnectionStateChange(
    callback: (state: RTCPeerConnectionState) => void,
  ) {
    this.innerStateChange[1] = callback;
    if (this.peerConnection) {
      this.peerConnection.onconnectionstatechange = () => {
        callback(this.peerConnection.connectionState);
        if (
          ['failed', 'disconnected'].includes(
            this.peerConnection.connectionState,
          )
        ) {
          this.restartConnection();
        }
      };
    }
  }

  public async closeConnection() {
    this.innerChannel?.send(JSON.stringify({ type: 'close-connection' }));
    this.isOfferer = true;
    this.peerConnection?.close();
    this.ws?.close();
    this.innerStateChange.forEach((callback) => callback?.('closed'));
    window.removeEventListener('beforeunload', this.closeConnection.bind(this));
  }

  public async sendData(data: any, callback?: TempTransferData['callback']) {
    return new Promise<{ ms?: number } | undefined>((resolve, reject) => {
      if (this.isConnected()) {
        const id = this.generateId();

        this.tempTransferData.set(id, {
          type: data,
          timestamp: new Date().getTime(),
          callback,
          resolve,
        });

        this.dataChannel.send(JSON.stringify({ type: 'data', data, id }));
      } else {
        reject('Not connected');
      }
    });
  }

  public sendFile(
    file: File,
    callback?: ({ percentage }: { percentage: number }) => void,
  ) {
    if (this.isConnected()) {
      // Validate files
      /* if (!allowedFileTypes.includes(file.type)) {
        console.error('File type not allowed:', file.type);
        return;
      } */

      const chunkSize = 16384;
      const fileReader = new FileReader();
      let offset = 0;
      const fileId = this.generateId();

      this.tempTransferData.set(fileId, {
        type: 'file',
        callback,
      });

      fileReader.addEventListener('error', (error) =>
        console.error('Error reading file:', error),
      );

      fileReader.addEventListener('abort', (event) =>
        console.warn('File reading aborted:', event),
      );

      fileReader.addEventListener('load', (event) => {
        const data = event.target?.result;
        if (data && this.fileChannel) {
          if (data instanceof ArrayBuffer) {
            const percentage = Math.round((offset / file.size) * 100);
            const payload = {
              fileId,
              size: file.size,
              data: Array.from(new Uint8Array(data)),
              done: false,
              fileName: file.name,
              fileType: file.type,
              chunkSize,
              percentage,
            };
            this.fileChannel.send(
              JSON.stringify({
                type: 'file',
                data: { ...payload },
              }),
            );
            offset += data.byteLength;
            if (offset < file.size) {
              readSlice(offset);
            } else {
              this.fileChannel.send(
                JSON.stringify({
                  type: 'file',
                  data: {
                    ...payload,
                    done: true,
                    percentage: 100,
                  },
                }),
              );
            }
          }
        }
      });

      const readSlice = (o: number) => {
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
      };

      readSlice(0);
    }
  }

  public async setMediaTracks(
    { audioTrack, videoTrack }: Tracks,
    mediaStream: MediaStream,
    callback?: () => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const tracks: MediaStreamTrack[] = [];

      if (audioTrack) {
        tracks.push(audioTrack);
      }

      if (videoTrack) {
        tracks.push(videoTrack);
      }

      if (this.isConnected()) {
        if (tracks.length) {
          tracks.forEach((track) => {
            const existingSender = this.senders.get(track.kind);
            if (existingSender) {
              // Replace the existing track
              existingSender.replaceTrack(track);
            } else {
              // Add a new track
              const sender = this.peerConnection.addTrack(track, mediaStream);
              this.senders.set(track.kind, sender);
            }
          });

          this.mediaCallback[0] = resolve;
          this.mediaCallback[1] = callback;
          this.renegotiateConnection();
        } else {
          reject('Not tracks provided.');
        }
      } else {
        reject('Not connected');
      }
    });
  }

  public removeMediaTrack(kind: 'audio' | 'video') {
    if (this.isConnected()) {
      const sender = this.senders.get(kind);
      if (sender) {
        this.peerConnection.removeTrack(sender);
        if (sender.track) {
          sender.track.stop();
        }
        this.senders.delete(kind);
      }
    }
  }

  public getMediaTrack(kind: 'audio' | 'video') {
    if (this.isConnected()) {
      return this.senders.get(kind)?.track;
    }
  }

  public getMediaTracks() {
    const tracks: MediaStreamTrack[] = [];
    if (this.isConnected()) {
      this.senders.forEach((sender) => {
        if (sender.track) {
          tracks.push(sender.track);
        }
      });
    }
    return tracks;
  }

  public startConnection(peerId: string) {
    if (this.peerConnection?.connectionState === 'connected') {
      console.warn('Connection already established.');
      return;
    }

    if (!this.offerId) {
      throw Error('Current peer id is required.');
    }

    if (!peerId) {
      throw Error('Peer is required.');
    }

    if (this.offerId === peerId) {
      throw Error('Cannot connect with the same peer.');
    }

    this.isOfferer = true;
    this.createRTC();
    this.answererId = peerId;
    this.channelId = [this.offerId, this.answererId]
      .sort((a, b) => a.localeCompare(b))
      .join('-');
    this.connectWebSocket();
  }

  private async renegotiateConnection() {
    if (this.peerConnection.signalingState !== 'stable') {
      console.warn(
        'Cannot renegotiate connection while signaling state is not stable.',
      );
      return;
    }

    this.checkAndSendOffer(true);
  }

  private generateId(): string {
    const generatePart = () => Math.random().toString(36).substring(2, 15);
    return generatePart() + generatePart() + generatePart() + generatePart();
  }

  private connectWebSocket() {
    try {
      this.ws?.close();
      this.ws = new WebSocket(
        `${this.orchestratorUrl}?client-key=${this.clientKey}`,
      );
      this.ws.onclose = ({ code, reason }) => {
        if (code === 1008) console.error(reason);
      };
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onopen = () => this.checkAndSendOffer();
    } catch (error) {
      console.log(error);
    }
  }

  private setOnTrack() {
    this.peerConnection.ontrack = (event) => {
      this.innerChannel.send(JSON.stringify({ type: 'media-started' }));
      this.innerOnReceiveMediaStream.forEach((callback) =>
        callback?.(event.streams[0]),
      );
    };
  }

  private async checkAndSendOffer(renegotiate = false) {
    if (!renegotiate || this.innerChannel.readyState !== 'open') {
      this.setupDataChannels();
    }

    const offerDescription = await this.peerConnection.createOffer({
      iceRestart: true,
    });

    (renegotiate ? this.innerChannel : this.ws).send(
      JSON.stringify({
        type: 'offer',
        data: {
          channelId: this.channelId,
          offerId: this.offerId,
          offer: {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
          },
        },
      }),
    );
  }

  private async setupAsOfferer(
    offer: RTCSessionDescriptionInit,
    renegotiate = false,
  ) {
    this.isOfferer = true;

    await this.peerConnection.setLocalDescription(
      new RTCSessionDescription(offer),
    );

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendICECandidate(
          renegotiate ? 'renegotiate-ice-offer' : 'ice-offer',
          event.candidate.toJSON(),
        );
      }
    };
  }

  private createRTC() {
    this.peerConnection?.close();

    const peerConnectionConfig: RTCConfiguration = {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
      ],
      iceCandidatePoolSize: 1,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      certificates: [],
    };

    this.peerConnection = new RTCPeerConnection(peerConnectionConfig);

    this.setOnTrack();

    this.peerConnection.onconnectionstatechange = () => {
      this.innerStateChange.forEach((callback) =>
        callback?.(this.peerConnection.connectionState),
      );
      if (
        ['failed', 'disconnected'].includes(this.peerConnection.connectionState)
      ) {
        this.restartConnection();
      }
    };
  }

  private restartConnection() {
    this.checkAndSendOffer();
  }

  private async setupAsAnswerer(
    offer: RTCSessionDescriptionInit,
    renegotiate = false,
  ) {
    this.isOfferer = false;
    if (!renegotiate) {
      this.peerConnection.close();
      this.createRTC();
      this.setupDataChannels();
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer),
    );

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendICECandidate(
          renegotiate ? 'renegotiate-ice-answer' : 'ice-answer',
          event.candidate.toJSON(),
        );
      }
    };

    const answerDescription = await this.peerConnection.createAnswer();

    (renegotiate ? this.innerChannel : this.ws).send(
      JSON.stringify({
        type: 'answer',
        data: {
          channelId: this.channelId,
          answer: {
            sdp: answerDescription.sdp,
            type: answerDescription.type,
          },
          ...(renegotiate && { existingOffer: offer }),
          answerId: this.answererId,
        },
      }),
    );

    await this.peerConnection.setLocalDescription(
      new RTCSessionDescription(answerDescription),
    );
  }

  private async sendICECandidate(
    role:
      | 'ice-offer'
      | 'ice-answer'
      | 'renegotiate-ice-answer'
      | 'renegotiate-ice-offer',
    candidate: RTCIceCandidateInit,
  ) {
    (['renegotiate-ice-answer', 'renegotiate-ice-offer'].includes(role)
      ? this.innerChannel
      : this.ws
    ).send(
      JSON.stringify({
        type: role,
        data: {
          channelId: this.channelId,
          candidate: candidate,
        },
      }),
    );
  }

  private setupDataChannels() {
    if (this.isOfferer) {
      const dataChannel = this.peerConnection.createDataChannel('data');
      const fileChannel = this.peerConnection.createDataChannel('file');
      const innerChannel =
        this.peerConnection.createDataChannel('innerChannel');

      this.configureDataChannel(dataChannel);
      this.configurateInnerChannel(innerChannel);
      this.configurateDataFile(fileChannel);
    } else {
      this.peerConnection.ondatachannel = (event) => {
        if (event.channel.label === 'data') {
          this.configureDataChannel(event.channel);
        }

        if (event.channel.label === 'file') {
          this.configurateDataFile(event.channel);
        }

        if (event.channel.label === 'innerChannel') {
          this.configurateInnerChannel(event.channel);
        }
      };
    }
  }

  private configurateInnerChannel(innerChannel: RTCDataChannel) {
    innerChannel.onopen = () => {};
    innerChannel.onclose = () => {};

    innerChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);

      /* RENEGOTIATE  */
      if (data.type === 'answer') {
        this.setupAsOfferer(data.data.existingOffer, true);
        this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.data.answer),
        );
      }
      if (data.type === 'offer') {
        this.setupAsAnswerer(data.data.offer, true);
      }
      if (
        ['renegotiate-ice-offer', 'renegotiate-ice-answer'].includes(data.type)
      ) {
        if (data.data.candidate) {
          this.peerConnection.addIceCandidate(
            new RTCIceCandidate(data.data.candidate),
          );
        }
      }

      /* ===== */

      /* INNER COMUNICAITON */
      if (data.type === 'close-connection') {
        this.closeConnection();
        this.innerStateChange.forEach((callback) => callback?.('closed'));
      }

      if (data.type === 'media-started') {
        this.mediaCallback.forEach((callback) => callback?.());
      }

      if (data.type === 'delivery-validation') {
        const { id, info } = data;

        const tempData = this.tempTransferData.get(id);
        if (tempData) {
          let delivered = {};

          if (tempData.type === 'data') {
            delivered = {
              ms: new Date().getTime() - (tempData!.timestamp || 0),
            };
            this.tempTransferData.delete(id);
          }

          if (tempData.type === 'file') {
            delivered = {
              percentage: info.percentage,
            };
            if (info.percentage === 100) {
              this.tempTransferData.delete(id);
            }
          }

          tempData.resolve?.(delivered);
          tempData.callback?.(delivered);
        }
      }
    };

    this.innerChannel = innerChannel;
  }

  private configurateDataFile(fileChannel: RTCDataChannel) {
    const receivedFiles: {
      [fileId: string]: {
        chunks: ArrayBuffer[];
        fileName: string;
        fileType: string;
        size: number;
      };
    } = {};

    fileChannel.onopen = () => {};
    fileChannel.onclose = () => {};
    fileChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'file') {
        const {
          fileId,
          chunkSize,
          data: chunkData,
          done,
          fileName,
          fileType,
          size,
          percentage,
        } = data.data;

        if (!receivedFiles[fileId]) {
          receivedFiles[fileId] = { chunks: [], fileName, fileType, size };
        }

        const chunk = new Uint8Array(chunkData).buffer;
        receivedFiles[fileId].chunks.push(chunk);

        const payload = {
          fileId,
          percentage,
          size,
          chunkSize,
          fileName,
          done,
        };

        this.innerChannel.send(
          JSON.stringify({
            type: 'delivery-validation',
            id: fileId,
            info: { percentage },
          }),
        );

        if (done) {
          const fileBlob = new Blob(receivedFiles[fileId].chunks, {
            type: fileType,
          });
          this.innerOnReceiveFile.forEach((callback) =>
            callback?.({
              ...payload,
              file: fileBlob,
            }),
          );
          delete receivedFiles[fileId];
        } else {
          this.innerOnReceiveFile.forEach((callback) =>
            callback?.({
              ...payload,
            }),
          );
        }
      }
    };

    this.fileChannel = fileChannel;
  }

  private configureDataChannel(dataChannel: RTCDataChannel) {
    dataChannel.onopen = () => {
      this.ws?.close();
    };

    dataChannel.onclose = () => {};

    dataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);

      /* COMMON DATA TRANSFER */
      if (data.type === 'data') {
        this.innerChannel.send(
          JSON.stringify({ type: 'delivery-validation', id: data.id }),
        );
        this.innerOnMessage.forEach((callback) => callback?.(data.data));
      }
    };

    this.dataChannel = dataChannel;
  }

  private onMessage(event: MessageEvent) {
    const message = JSON.parse(event.data);

    if (message.type === 'waiting-answer') {
      this.setupAsOfferer(message.existingOffer);
    }

    if (message.type === 'you-answer') {
      this.setupAsAnswerer(message.existingOffer);
    }

    if (message.type === 'answer') {
      this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(message.data.answer),
      );
    }

    if (message.type === 'ice-offer' || message.type === 'ice-answer') {
      if (message.data.candidate) {
        this.peerConnection.addIceCandidate(
          new RTCIceCandidate(message.data.candidate),
        );
      }
    }
  }
}
