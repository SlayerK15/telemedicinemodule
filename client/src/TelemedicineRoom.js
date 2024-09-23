import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  height: 100vh;
`;

const VideoContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

const VideoWrapper = styled.div`
  position: relative;
  width: 45%;
  margin: 5px;
`;

const Video = styled.video`
  width: 100%;
  border-radius: 10px;
  background-color: black;
`;

const PeerEmail = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  color: white;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
`;

const Message = styled.div`
  margin-bottom: 20px;
  padding: 10px;
  background-color: #f0c040;
  border-radius: 5px;
  color: #333;
`;

const ChatContainer = styled.div`
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const ChatMessages = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  border: 1px solid #ccc;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #fafafa;
`;

const ChatMessage = styled.div`
  margin-bottom: 5px;
  word-break: break-word;
`;

const ChatInputContainer = styled.div`
  display: flex;
`;

const ChatInput = styled.input`
  flex-grow: 1;
  padding: 10px;
  border-radius: 5px 0 0 5px;
  border: 1px solid #ccc;
  border-right: none;
  outline: none;
`;

const SendButton = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: 1px solid #007bff;
  border-radius: 0 5px 5px 0;
  cursor: pointer;
  outline: none;

  &:hover {
    background-color: #0069d9;
  }
`;


const ControlsContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
`;

const ControlButton = styled.button`
  margin: 0 10px;
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background-color: #0056b3;
  }
`;

const TelemedicineRoom = ({ email, roomId }) => {
  const [peers, setPeers] = useState({});
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const emailRef = useRef(email);
  const [isDisconnected, setIsDisconnected] = useState(false);

  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  const handleChatMessage = useCallback(({ sender, message }) => {
    const displaySender = sender === emailRef.current ? 'You' : sender;
    setChatMessages((prev) => [...prev, { sender: displaySender, message }]);
  }, []);

  const handleUserConnected = useCallback(({ id, email: userEmail }) => {
    console.log('New user connected:', id, userEmail);
    const peer = createPeer(id, socketRef.current.id, streamRef.current);
    peersRef.current[id] = { peer, email: userEmail, pendingCandidates: [] };
    setPeers((prevPeers) => ({
      ...prevPeers,
      [id]: {
        email: userEmail,
      },
    }));
  }, []);

  const handleUserDisconnected = useCallback((id) => {
    console.log('User disconnected:', id);
    if (peersRef.current[id]) {
      peersRef.current[id].peer.close();
      delete peersRef.current[id];
      setPeers((prevPeers) => {
        const newPeers = { ...prevPeers };
        delete newPeers[id];
        return newPeers;
      });
    }
  }, []);

  useEffect(() => {
    const SERVER_URL = 'https://192.168.248.9:5000';
    console.log('Connecting to server:', SERVER_URL);

    socketRef.current = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setupMediaDevices();
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setMessage(`Connection error: ${error.message}`);
    });

    return () => {
      disconnectCall();
    };
  }, []);

  const setupMediaDevices = async () => {
    try {
      console.log('Attempting to access media devices...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log('Media devices accessed successfully');
      streamRef.current = stream;
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
        console.log('Local stream set to userVideo');
        userVideo.current.onloadedmetadata = () => {
          userVideo.current.play().catch(e => console.error('Error playing local video:', e));
        };
      }
      setupSocketEvents();
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setMessage(`Error accessing media devices: ${error.message}`);
    }
  };

  const setupSocketEvents = () => {
    socketRef.current.emit('join-room', { roomId, email });

    socketRef.current.on('user-connected', handleUserConnected);
    socketRef.current.on('user-disconnected', handleUserDisconnected);
    socketRef.current.on('offer', handleReceiveCall);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleNewICECandidateMsg);
    socketRef.current.on('chat-message', handleChatMessage);
  };

  function createPeer(userToSignal, callerID, stream) {
    console.log(`Creating peer connection to ${userToSignal}`);
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    });

    peer.onicecandidate = (event) => handleICECandidateEvent(event, userToSignal);
    peer.ontrack = (event) => handleTrackEvent(event, userToSignal);
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userToSignal);

    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log(`Adding track to peer connection: ${track.kind}`);
        peer.addTrack(track, stream);
      });
    } else {
      console.warn('No local stream available');
    }

    return peer;
  }

  function handleICECandidateEvent(e, userToSignal) {
    if (e.candidate) {
      console.log(`Sending ICE candidate to ${userToSignal}`);
      const payload = {
        target: userToSignal,
        caller: socketRef.current.id,
        candidate: e.candidate,
      };
      socketRef.current.emit('ice-candidate', payload);
    }
  }

  function handleTrackEvent(e, userToSignal) {
    console.log(`Received track from ${userToSignal}: ${e.track.kind}`);
    console.log('Track event:', e);
    const remoteStream = e.streams[0];
    setPeers((prevPeers) => {
      console.log('Updating peers state with new stream');
      return {
        ...prevPeers,
        [userToSignal]: {
          ...prevPeers[userToSignal],
          stream: remoteStream,
        },
      };
    });

    const videoElement = document.getElementById(`video-${userToSignal}`);
    if (videoElement) {
      videoElement.srcObject = remoteStream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(e => console.error('Error playing remote video:', e));
      };
    }
  }

  function handleNegotiationNeededEvent(userToSignal) {
    console.log(`Negotiation needed for ${userToSignal}`);
    peersRef.current[userToSignal].peer.createOffer()
      .then(offer => {
        return peersRef.current[userToSignal].peer.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userToSignal,
          caller: socketRef.current.id,
          sdp: peersRef.current[userToSignal].peer.localDescription
        };
        console.log(`Sending offer to ${userToSignal}`);
        socketRef.current.emit('offer', payload);
      })
      .catch(e => console.error('Error creating offer:', e));
  }

  function handleReceiveCall(incoming) {
    console.log('Received call:', incoming);
    const { caller, sdp } = incoming;
    const peer = createPeer(caller, socketRef.current.id, streamRef.current);
    peersRef.current[caller] = { peer, email: incoming.email, pendingCandidates: [] };

    peer.setRemoteDescription(new RTCSessionDescription(sdp))
      .then(() => {
        return peer.createAnswer();
      })
      .then(answer => {
        return peer.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: caller,
          caller: socketRef.current.id,
          sdp: peer.localDescription
        };
        console.log(`Sending answer to ${caller}`);
        socketRef.current.emit('answer', payload);

        if (peersRef.current[caller].pendingCandidates.length > 0) {
          console.log(`Adding ${peersRef.current[caller].pendingCandidates.length} pending ICE candidates for ${caller}`);
          peersRef.current[caller].pendingCandidates.forEach(candidate => {
            peer.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(e => console.error('Error adding stored ICE candidate:', e));
          });
          peersRef.current[caller].pendingCandidates = [];
        }
      })
      .catch(error => console.error('Error handling receive call:', error));
  }

  function handleAnswer(message) {
    console.log('Received answer:', message);
    const { sdp, caller } = message;
    const desc = new RTCSessionDescription(sdp);
    peersRef.current[caller].peer.setRemoteDescription(desc)
      .then(() => {
        if (peersRef.current[caller].pendingCandidates.length > 0) {
          console.log(`Adding ${peersRef.current[caller].pendingCandidates.length} pending ICE candidates for ${caller}`);
          peersRef.current[caller].pendingCandidates.forEach(candidate => {
            peersRef.current[caller].peer.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(e => console.error('Error adding stored ICE candidate:', e));
          });
          peersRef.current[caller].pendingCandidates = [];
        }
      })
      .catch(e => console.error('Error setting remote description:', e));
  }

  function handleNewICECandidateMsg(incoming) {
    console.log('Received ICE candidate:', incoming);
    const { candidate, caller } = incoming;
    
    if (!peersRef.current[caller]) {
      console.warn(`Peer ${caller} not found. Storing ICE candidate for later.`);
      if (!peersRef.current[caller]) {
        peersRef.current[caller] = { pendingCandidates: [] };
      }
      peersRef.current[caller].pendingCandidates.push(candidate);
      return;
    }

    const peerConnection = peersRef.current[caller].peer;
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      console.log(`Adding ICE candidate for ${caller}`);
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error('Error adding ICE candidate:', e));
    } else {
      console.warn('Remote description not set. Storing ICE candidate for later.');
      peersRef.current[caller].pendingCandidates.push(candidate);
    }
  }

  function sendChatMessage() {
    if (chatInput.trim()) {
      socketRef.current.emit('chat-message', {
        roomId,
        message: chatInput,
        sender: emailRef.current,
      });
      setChatInput('');
    }
  }

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

const disconnectCall = () => {
  if (socketRef.current) {
    socketRef.current.disconnect();
  }
  Object.values(peersRef.current).forEach(({ peer }) => {
    if (peer && typeof peer.close === 'function') {
      peer.close();
    }
  });
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
  }
  setIsDisconnected(true);
};

  useEffect(() => {
    console.log('Current peers:', peers);
    console.log('Current peersRef:', peersRef.current);
  }, [peers]);

  return (
    <Container>
      {message && <Message>{message}</Message>}
      <VideoContainer>
        <VideoWrapper>
          <Video muted ref={userVideo} autoPlay playsInline />
          <PeerEmail>You</PeerEmail>
        </VideoWrapper>
        {Object.entries(peers).map(
          ([peerId, { stream, email: peerEmail }]) => {
            console.log(`Rendering peer ${peerId} with stream:`, stream);
            return (
              <VideoWrapper key={peerId}>
                <Video
                  id={`video-${peerId}`}
                  autoPlay
                  playsInline
                  ref={(video) => {
                    if (video && stream && !video.srcObject) {
                      console.log(`Setting video source for peer ${peerId}`);
                      video.srcObject = stream;
                      video.onloadedmetadata = () => {
                        video.play().catch(e => console.error('Error playing remote video:', e));
                      };
                    }
                  }}
                />
                <PeerEmail>{peerEmail}</PeerEmail>
              </VideoWrapper>
            );
          }
        )}
      </VideoContainer>
    <ControlsContainer>
      <ControlButton onClick={toggleAudio}>
        {isAudioMuted ? 'Unmute' : 'Mute'}
      </ControlButton>
      <ControlButton onClick={toggleVideo}>
        {isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
      </ControlButton>
      <ControlButton onClick={disconnectCall}>
        Disconnect
      </ControlButton>
    </ControlsContainer>
      <ChatContainer>
        <ChatMessages>
          {chatMessages.map((msg, index) => (
            <ChatMessage key={index}>
              <strong>{msg.sender}:</strong> {msg.message}
            </ChatMessage>
          ))}
        </ChatMessages>
        <ChatInputContainer>
          <ChatInput
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
          />
          <SendButton onClick={sendChatMessage}>Send</SendButton>
        </ChatInputContainer>
      </ChatContainer>
    </Container>
  );
};

export default TelemedicineRoom;