import React, { useState } from 'react';
import TelemedicineRoom from './TelemedicineRoom';

function App() {
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [email, setEmail] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (email && roomId) {
      setJoinedRoom(true);
    }
  };

  const handleDisconnect = () => {
    setJoinedRoom(false);
    setShowThankYou(true);
  };

  if (showThankYou) {
    return (
      <div className="App">
        <h1>Thank You for Attending the Call</h1>
        <p>We appreciate your participation.</p>
      </div>
    );
  }

  if (joinedRoom) {
    return <TelemedicineRoom email={email} roomId={roomId} onDisconnect={handleDisconnect} />;
  }

  return (
    <div className="App">
      <h1>Join Telemedicine Room</h1>
      <form onSubmit={handleJoinRoom}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter room ID"
          required
        />
        <button type="submit">Join Room</button>
      </form>
    </div>
  );
}

export default App;