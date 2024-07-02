# ewents-rtc

This document explains how to integrate and use the `ewents-rtc` library in your projects. `ewents-rtc` is a library that enables peer-to-peer communication, allowing you to send information from one end to another. From here on, we will refer to the two ends as Peer1 and Peer2 to describe both parties.

Demo: 
https://ewents-rtc-example.web.app/

Demo code:
https://github.com/TomasFleitas/rtc-example

### NPM

To install the library using npm, run the following command in your terminal:

```batch
npm install ewents-rtc
```

### Uso

To start using the library after installing it, you need to import it into your projects as follows:

```javascript
import WebRTC from 'ewents-rtc';
```
Generate an instance for each peer you want to communicate with (keep in mind that if the user is communicating with N other users, you need to create 1 pair of peers for each user, meaning USERS = PEERS amount).

#### Example:
CurrentUser needs to connect with User1, User2, and User3.
| Peer1  | Peer2  |
|--------|--------|
|CurrentUser|User1|
|CurrentUser|User2|
|CurrentUser|User3|
---------------
## Initialization. (Peer1)
```javascript
const webRTC = new WebRTC({
  peerId: peer1-id, // Unique identifier of current peer (Peer1)
  clientKey: '66760d2b14813c0e8b53b4ff', // Default client key (it will be deleted in the future).
  onReceiveData: (data) => {}, // Data from Peer2
  onReceiveFile: ({ fileName, percentage, file }) => {}, // File from Peer2
  onConnectionStateChange: (state) => {}, // Connection state from Peer2
  onReceiveMediaStream: (stream) => {}, // Media streem from Peer2
});
webRTC.startConnection(peer2-id); // start connection with Peer2
```

## Initialization. (Peer2)
Same as Peer1, but you should change the peerId and the id that you pass to the `startConnection` method as shown below:
```javascript
const webRTC = new WebRTC({
  peerId: peer2-id, // Unique identifier of current peer (Peer2)
  clientKey: '66760d2b14813c0e8b53b4ff', // Default client key (it will be deleted in the future).
  ... // same as Peer1
});
webRTC.startConnection(peer1-id); // start connection with Peer1
```

#### Callbacks in another way (using the instance).
```javascript
    webRTC.onReceiveData((data) => {});  // Data from Peer2
    webRTC.onReceivedFile(({ fileName, percentage, file }) => {});  // File from Peer2
    webRTC.onConnectionStateChange((state) => {});  // Connection state from Peer2
    webRTC.onReceiveMediaStream((stream) => {}); // Media streem from Peer2
```
### Interact with Peer2.
* sendData.

This method allows you to send data to Peer2.
```javascript
 webRTC.sendData(any); // Send any data.
```
You can add a callback as the second parameter in the `sendData` method to know the time in milliseconds when Peer2 receives the data.
```javascript
 webRTC.sendData(any,({ms}) => {}); // Send any data.
```
Additionally, if you use the `await` keyword with the `sendData` method, you will also get the time in milliseconds when Peer2 receives the data.
```javascript
 const {ms} = await webRTC.sendData(any); // Send any data.
```
* sendFile

This method allows you to send file data to Peer2.
```javascript
webRTC.sendFile(File); // Send File object (directly from an input type="file")
```
You can add a callback as the second parameter in the `sendFile` method to receive multiple callbacks indicating the percentage of the file transfer, from 0 to 100%.
```javascript
 webRTC.sendFile(any,({percentage})=>{});
```
* setMediaTracks

The `setMediaTracks` method sets the audio and video tracks for peer-to-peer connection, following the below example:
```javascript
  webRTC.setMediaTracks({ audioTrack, videoTrack }, stream);
```
```javascript
  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    webRTC.setMediaTracks({ audioTrack, videoTrack }, stream);
  };
```
Then you can remove tracks using:
```javascript
 webRTC.removeMediaTrack('audio');
 webRTC.removeMediaTrack('video');
```
or get tracks:
```javascript
 webRTC.getMediaTrack('audio');
 webRTC.getMediaTrack('video');
 ```
 * closeConnection

 This method just closes the connection between peers.
 ```javascript
  webRTC.closeConnection();
 ```
 * Miscellaneous methods:
```javascript
 webRTC.getChannelId(); // Retrieve the unique identifier of the peer connection
 webRTC.peerType(); // Retrieve the peer type ('unknown' | 'answerer' | 'offerer')
 webRTC.isConnected() // true or false
```