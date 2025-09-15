import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { 
  Heart, 
  User, 
  MessageCircle, 
  Download, 
  Upload, 
  Settings, 
  Crown,
  Ban,
  Clock,
  Shield,
  Users,
  Send,
  LogOut,
  CheckCircle
} from 'lucide-react';

const socket = io('http://localhost:5000');

const APPEARANCE_OPTIONS = {
  male: {
    hair: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'
    ]
  },
  female: {
    hair: [
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    ]
  }
};

const SCENARIO_OPTIONS = [
  'Date Night',
  'Adventure',
  'Therapy Session',
  'Sexy'
];

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [character, setCharacter] = useState({
    name: '',
    age: '',
    gender: 'female',
    appearance: '',
    personality: '',
    backstory: '',
    interests: ''
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [chatMessages, setChatMessages] = useState({}); // userId -> messages array
  const [currentMessage, setCurrentMessage] = useState('');
  const [waitingUsers, setWaitingUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null); // Active user tab for admin
  const [activeUsers, setActiveUsers] = useState([]); // List of active user chats for admin
  const [isInChat, setIsInChat] = useState(false);
  const [userId, setUserId] = useState(null);
  const [adminToken, setAdminToken] = useState('');
  const [readMessages, setReadMessages] = useState(new Set());
  const [selectedScenario, setSelectedScenario] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    socket.on('character-loaded', (data) => {
      setCharacter(data.character);
      setUserId(data.userId);
      setSelectedScenario(data.scenario || '');
      setCurrentPage('waiting');
    });

    socket.on('waiting-for-admin', (data) => {
      setCurrentPage('waiting');
    });

    socket.on('admin-connected', (data) => {
      setIsInChat(true);
      setCurrentPage('chat');
      setChatMessages({ [userId]: [] });
    });

    socket.on('admin-logged-in', (data) => {
      setIsAdmin(true);
      setAdminData(data);
      setCurrentPage('admin-dashboard');
    });

    socket.on('waiting-users-list', (data) => {
      setWaitingUsers(data);
    });

    socket.on('user-connected', (data) => {
      setActiveUsers(prev => [...prev, { ...data, scenario: data.scenario || '' }]);
      setChatMessages(prev => ({ ...prev, [data.userId]: [] }));
      setCurrentUserId(data.userId);
      setSelectedScenario(data.scenario || '');
      setIsInChat(true);
    });

    socket.on('user-message', (data) => {
      setChatMessages(prev => ({
        ...prev,
        [data.userId]: [
          ...(prev[data.userId] || []),
          { id: data.messageId, sender: 'user', message: data.message, timestamp: data.timestamp }
        ]
      }));
      if (isAdmin && currentUserId === data.userId) {
        socket.emit('message-read', { messageId: data.messageId, userId: data.userId });
      }
    });

    socket.on('admin-message', (data) => {
      setChatMessages(prev => ({
        ...prev,
        [userId]: [
          ...(prev[userId] || []),
          { id: data.messageId, sender: 'admin', message: data.message, timestamp: data.timestamp }
        ]
      }));
      if (!isAdmin) {
        socket.emit('message-read', { messageId: data.messageId, userId });
      }
    });

    socket.on('message-read-receipt', (data) => {
      setReadMessages(prev => new Set(prev).add(data.messageId));
    });

    socket.on('scenario-updated', (data) => {
      if (isAdmin && data.userId === currentUserId) {
        setSelectedScenario(data.scenario);
      }
      setActiveUsers(prev =>
        prev.map(user =>
          user.userId === data.userId ? { ...user, scenario: data.scenario } : user
        )
      );
    });

    socket.on('chat-ended', (data) => {
      setIsInChat(false);
      setCurrentPage('download');
    });

    socket.on('chat-ended-admin', (data) => {
      setActiveUsers(prev => prev.filter(user => user.userId !== data.userId));
      setChatMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[data.userId];
        return newMessages;
      });
      if (currentUserId === data.userId) {
        setCurrentUserId(activeUsers.length > 1 ? activeUsers[0].userId : null);
        setIsInChat(activeUsers.length > 1);
      }
    });

    socket.on('user-disconnected', (data) => {
      setActiveUsers(prev => prev.filter(user => user.userId !== data.userId));
      setChatMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[data.userId];
        return newMessages;
      });
      if (currentUserId === data.userId) {
        setCurrentUserId(activeUsers.length > 1 ? activeUsers[0].userId : null);
        setIsInChat(activeUsers.length > 1);
      }
    });

    socket.on('banned', (data) => {
      alert(`You have been banned: ${data.reason}`);
      setCurrentPage('banned');
    });

    socket.on('error', (data) => {
      alert(`Error: ${data.message}`);
    });

    return () => {
      socket.off('character-loaded');
      socket.off('waiting-for-admin');
      socket.off('admin-connected');
      socket.off('admin-logged-in');
      socket.off('waiting-users-list');
      socket.off('user-connected');
      socket.off('user-message');
      socket.off('admin-message');
      socket.off('message-read-receipt');
      socket.off('scenario-updated');
      socket.off('chat-ended');
      socket.off('chat-ended-admin');
      socket.off('user-disconnected');
      socket.off('banned');
      socket.off('error');
    };
  }, [userId, isAdmin, currentUserId, activeUsers]);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, currentUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCharacterSubmit = () => {
    if (!character.name || !character.personality || !character.backstory) {
      alert('Please fill in all required fields');
      return;
    }
    
    const userId = Date.now().toString();
    setUserId(userId);
    socket.emit('character-created', { character, userId, scenario: selectedScenario });
  };

  const downloadCharacter = () => {
    const dataStr = JSON.stringify({ ...character, scenario: selectedScenario }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${character.name || 'character'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          socket.emit('upload-character', { characterData: e.target.result });
        } catch (error) {
          alert('Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    
    if (isAdmin) {
      socket.emit('admin-message', { message: currentMessage, userId: currentUserId });
      setChatMessages(prev => ({
        ...prev,
        [currentUserId]: [
          ...(prev[currentUserId] || []),
          { id: Date.now(), sender: 'admin', message: currentMessage, timestamp: Date.now() }
        ]
      }));
    } else {
      socket.emit('user-message', { message: currentMessage });
      setChatMessages(prev => ({
        ...prev,
        [userId]: [
          ...(prev[userId] || []),
          { id: Date.now(), sender: 'user', message: currentMessage, timestamp: Date.now() }
        ]
      }));
    }
    
    setCurrentMessage('');
  };

  const handleScenarioChange = (scenario) => {
    setSelectedScenario(scenario);
    socket.emit('scenario-selected', { userId, scenario });
  };

  const endChat = (targetUserId = null) => {
    socket.emit('end-chat', { userId: targetUserId });
    if (!isAdmin) {
      setCurrentPage('download');
    }
  };

  const acceptUser = (userId) => {
    socket.emit('admin-accept-user', { userId });
  };

  const adminLogin = () => {
    fetch('http://localhost:5000/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: adminToken })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        socket.emit('admin-login', { adminId: data.adminId });
      } else {
        alert('Invalid admin token');
      }
    })
    .catch(err => {
      alert('Login failed');
    });
  };

  const banUser = (ip, type, duration = null, reason = '') => {
    fetch('http://localhost:5000/admin/ban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminToken,
        ip,
        type,
        duration,
        reason
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
      } else {
        alert(data.error);
      }
    });
  };

  const getTextingAreaClass = () => {
    switch (selectedScenario) {
      case 'Date Night':
        return 'texting-area-date-night';
      case 'Adventure':
        return 'texting-area-adventure';
      case 'Therapy Session':
        return 'texting-area-therapy-session';
      case 'Sexy':
        return 'texting-area-sexy';
      default:
        return 'texting-area-default';
    }
  };

  const renderHomePage = () => (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Heart className="w-16 h-16 text-pink-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-black mb-2">LongPartner</h1>
          <p className="text-gray-600">Create your perfect ompanion that is real, for you.</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => setCurrentPage('create')}
            className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 px-6 rounded-full transition duration-200"
          >
            Create New Partner
          </button>
          
          <button
            onClick={() => fileInputRef.current.click()}
            className="w-full bg-pink-100 hover:bg-pink-200 text-pink-600 font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload Existing Partner
          </button>
          
          <button
            onClick={() => setCurrentPage('admin-login')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
          >
            <Crown className="w-5 h-5 mr-2" />
            Admin Login
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );

  const renderCreatePage = () => (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Create Your Partner</h1>
          <p className="text-gray-600">Design every detail of your perfect companion</p>
        </div>
        
        <div className="bg-white rounded-3xl shadow-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={character.name}
              onChange={(e) => setCharacter(prev => ({...prev, name: e.target.value}))}
              className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="Enter partner's name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
              <input
                type="number"
                value={character.age}
                onChange={(e) => setCharacter(prev => ({...prev, age: e.target.value}))}
                className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="Age"
                min="18"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <select
                value={character.gender}
                onChange={(e) => setCharacter(prev => ({...prev, gender: e.target.value, appearance: ''}))}
                className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">Appearance</label>
            <div className="grid grid-cols-5 gap-3">
              {APPEARANCE_OPTIONS[character.gender].hair.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCharacter(prev => ({...prev, appearance: image}))}
                  className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${
                    character.appearance === image 
                      ? 'ring-4 ring-pink-400 transform scale-105' 
                      : 'hover:ring-2 hover:ring-pink-200'
                  }`}
                >
                  <img
                    src={image}
                    alt={`Appearance ${index + 1}`}
                    className="w-full h-20 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Personality</label>
            <textarea
              value={character.personality}
              onChange={(e) => setCharacter(prev => ({...prev, personality: e.target.value}))}
              className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400 h-32 resize-none"
              placeholder="Describe your partner's personality traits, quirks, and characteristics..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Backstory</label>
            <textarea
              value={character.backstory}
              onChange={(e) => setCharacter(prev => ({...prev, backstory: e.target.value}))}
              className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400 h-32 resize-none"
              placeholder="Write your partner's history, background, and life experiences..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests & Hobbies</label>
            <input
              type="text"
              value={character.interests}
              onChange={(e) => setCharacter(prev => ({...prev, interests: e.target.value}))}
              className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="What does your partner enjoy doing?"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scenario</label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              <option value="">Select a Scenario</option>
              {SCENARIO_OPTIONS.map((scenario) => (
                <option key={scenario} value={scenario}>{scenario}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentPage('home')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-6 rounded-full transition duration-200"
            >
              Back
            </button>
            <button
              onClick={downloadCharacter}
              className="flex-1 bg-pink-100 hover:bg-pink-200 text-pink-600 font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Character
            </button>
            <button
              onClick={handleCharacterSubmit}
              className="flex-1 bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 px-6 rounded-full transition duration-200"
            >
              Create Partner
            </button>
            <button
              onClick={() => endChat()}
              className="flex-1 bg-red-400 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
            >
              <LogOut className="w-5 h-5 mr-2" />
              End Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWaitingPage = () => (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-pink-400 mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-black mb-4">Connecting you with {character.name}...</h2>
        <p className="text-gray-600 mb-6">Please wait while we find an available admin to chat with your partner</p>
        
        {character.appearance && (
          <div className="mb-6">
            <img
              src={character.appearance}
              alt={character.name}
              className="w-24 h-24 rounded-full mx-auto object-cover ring-4 ring-pink-100"
            />
            <p className="text-lg font-semibold text-black mt-2">{character.name}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <button
            onClick={downloadCharacter}
            className="w-full bg-pink-100 hover:bg-pink-200 text-pink-600 font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
          >
            <Download className="w-5 h-5 mr-2" />
            Download Character
          </button>
          <button
            onClick={() => setCurrentPage('home')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-6 rounded-full transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={() => endChat()}
            className="w-full bg-red-400 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
          >
            <LogOut className="w-5 h-5 mr-2" />
            End Session
          </button>
        </div>
      </div>
    </div>
  );

  const renderChatPage = () => (
    <div className="h-screen bg-white flex flex-col">
      {isAdmin && (
        <div className="bg-pink-50 border-b border-pink-100 p-4 flex overflow-x-auto">
          {activeUsers.map(user => (
            <button
              key={user.userId}
              onClick={() => setCurrentUserId(user.userId)}
              className={`flex items-center px-4 py-2 mr-2 rounded-t-lg transition duration-200 ${
                currentUserId === user.userId ? 'bg-white border-t border-x border-pink-100' : 'bg-pink-100 hover:bg-pink-200'
              }`}
            >
              <img
                src={user.character.appearance}
                alt={user.character.name}
                className="w-8 h-8 rounded-full mr-2 object-cover"
              />
              <span className="font-semibold">{user.character.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  endChat(user.userId);
                }}
                className="ml-2 text-red-400 hover:text-red-500"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </button>
          ))}
        </div>
      )}
      
      <div className="bg-pink-50 border-b border-pink-100 p-4 flex items-center justify-between">
        <div className="flex items-center">
          {character.appearance && !isAdmin && (
            <img
              src={character.appearance}
              alt={character.name}
              className="w-10 h-10 rounded-full mr-3 object-cover"
            />
          )}
          <div>
            <h3 className="font-semibold text-black">
              {isAdmin ? `Chatting as ${activeUsers.find(u => u.userId === currentUserId)?.character.name}` : `Chatting with ${character.name}`}
            </h3>
            <p className="text-sm text-gray-500">
              {isAdmin ? `User: ${currentUserId} (IP: ${activeUsers.find(u => u.userId === currentUserId)?.ip})` : 'Connected successfully'}
            </p>
            <p className="text-sm text-pink-600">
              Scenario: {selectedScenario || 'None'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isAdmin && (
            <>
              <select
                value={selectedScenario}
                onChange={(e) => handleScenarioChange(e.target.value)}
                className="p-2 border border-pink-200 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="">Select a Scenario</option>
                {SCENARIO_OPTIONS.map((scenario) => (
                  <option key={scenario} value={scenario}>{scenario}</option>
                ))}
              </select>
              <button
                onClick={downloadCharacter}
                className="bg-pink-100 hover:bg-pink-200 text-pink-600 p-2 rounded-full transition duration-200"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => endChat()}
                className="bg-red-400 hover:bg-red-500 text-white p-2 rounded-full transition duration-200"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(isAdmin ? (chatMessages[currentUserId] || []) : (chatMessages[userId] || [])).map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              (isAdmin && msg.sender === 'admin') || (!isAdmin && msg.sender === 'user')
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl relative ${
                (isAdmin && msg.sender === 'admin') || (!isAdmin && msg.sender === 'user')
                  ? 'bg-pink-400 text-white'
                  : 'bg-gray-100 text-black'
              }`}
            >
              <p>{msg.message}</p>
              <div className="flex items-center justify-between">
                <p className={`text-xs mt-1 ${
                  (isAdmin && msg.sender === 'admin') || (!isAdmin && msg.sender === 'user')
                    ? 'text-pink-100'
                    : 'text-gray-500'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
                {readMessages.has(msg.id) && (
                  <CheckCircle className="w-4 h-4 text-green-400 ml-2" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className={`p-4 ${getTextingAreaClass()}`}>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 p-3 border rounded-full focus:outline-none focus:ring-2"
            placeholder="Type your message..."
          />
          <button
            onClick={sendMessage}
            className="p-3 rounded-full transition duration-200"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderDownloadPage = () => (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Heart className="w-16 h-16 text-pink-400 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-black mb-4">Chat Complete!</h2>
        <p className="text-gray-600 mb-6">
          Your conversation with {character.name} has ended. Download your character data to save for next time.
        </p>
        
        {character.appearance && (
          <div className="mb-6">
            <img
              src={character.appearance}
              alt={character.name}
              className="w-24 h-24 rounded-full mx-auto object-cover ring-4 ring-pink-100"
            />
            <p className="text-lg font-semibold text-black mt-2">{character.name}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <button
            onClick={downloadCharacter}
            className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center"
          >
            <Download className="w-5 h-5 mr-2" />
            Download Character Data
          </button>
          
          <button
            onClick={() => {
              setCurrentPage('home');
              setCharacter({
                name: '',
                age: '',
                gender: 'female',
                appearance: '',
                personality: '',
                backstory: '',
                interests: ''
              });
              setChatMessages({});
              setSelectedScenario('');
            }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-6 rounded-full transition duration-200"
          >
            Create New Partner
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Crown className="w-16 h-16 text-pink-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-black mb-2">Admin Login</h1>
          <p className="text-gray-600">Enter your admin credentials</p>
        </div>
        
        <div className="space-y-4">
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400"
            placeholder="Admin Token"
          />
          
          <button
            onClick={adminLogin}
            className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 px-6 rounded-full transition duration-200"
          >
            Login
          </button>
          
          <button
            onClick={() => setCurrentPage('home')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-6 rounded-full transition duration-200"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black">Admin Dashboard</h1>
            <p className="text-gray-600">Manage user connections and moderation</p>
          </div>
          <button
            onClick={() => {
              setIsAdmin(false);
              setAdminData(null);
              setCurrentPage('home');
            }}
            className="bg-red-400 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded-full transition duration-200 flex items-center"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
        
        {isInChat && currentUserId ? renderChatPage() : (
          <div className="grid gap-6">
            <div className="bg-pink-50 rounded-3xl p-6">
              <div className="flex items-center mb-4">
                <Users className="w-6 h-6 text-pink-400 mr-3" />
                <h2 className="text-xl font-semibold text-black">Waiting Users</h2>
              </div>
              
              {waitingUsers.length === 0 ? (
                <p className="text-gray-500">No users waiting</p>
              ) : (
                <div className="space-y-3">
                  {waitingUsers.map((user, index) => (
                    <div key={index} className="bg-white rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mr-4">
                          <User className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-black">{user.character.name}</h3>
                          <p className="text-sm text-gray-500">Age {user.character.age}</p>
                          <p className="text-sm text-gray-600">{user.character.personality.substring(0, 50)}...</p>
                          <p className="text-sm text-pink-600">Scenario: {user.scenario || 'None'}</p>
                          <p className="text-sm text-gray-500">IP: {user.ip}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => acceptUser(user.userId)}
                          className="bg-pink-400 hover:bg-pink-500 text-white font-semibold py-2 px-4 rounded-full transition duration-200"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Ban IP ${user.ip} permanently?`)) {
                              banUser(user.ip, 'permanent', null, 'Admin initiated ban');
                            }
                          }}
                          className="bg-red-400 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-full transition duration-200"
                        >
                          Ban
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-red-50 rounded-3xl p-6">
              <div className="flex items-center mb-4">
                <Shield className="w-6 h-6 text-red-400 mr-3" />
                <h2 className="text-xl font-semibold text-black">Moderation Tools</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-4">
                  <h3 className="font-semibold text-black mb-3">Temporary Ban</h3>
                  <input
                    type="text"
                    placeholder="IP Address"
                    className="w-full p-2 border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                    id="temp-ban-ip"
                  />
                  <input
                    type="number"
                    placeholder="Duration (minutes)"
                    className="w-full p-2 border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                    id="temp-ban-duration"
                  />
                  <input
                    type="text"
                    placeholder="Reason"
                    className="w-full p-2 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
                    id="temp-ban-reason"
                  />
                  <button
                    onClick={() => {
                      const ip = document.getElementById('temp-ban-ip').value;
                      const duration = document.getElementById('temp-ban-duration').value;
                      const reason = document.getElementById('temp-ban-reason').value;
                      if (ip && duration && reason) {
                        banUser(ip, 'temporary', parseInt(duration), reason);
                      }
                    }}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-semibold py-2 px-4 rounded-full transition duration-200 flex items-center justify-center"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Temporary Ban
                  </button>
                </div>
                
                <div className="bg-white rounded-2xl p-4">
                  <h3 className="font-semibold text-black mb-3">Permanent Ban</h3>
                  <input
                    type="text"
                    placeholder="IP Address"
                    className="w-full p-2 border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                    id="perm-ban-ip"
                  />
                  <input
                    type="text"
                    placeholder="Reason"
                    className="w-full p-2 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
                    id="perm-ban-reason"
                  />
                  <button
                    onClick={() => {
                      const ip = document.getElementById('perm-ban-ip').value;
                      const reason = document.getElementById('perm-ban-reason').value;
                      if (ip && reason && confirm('Are you sure you want to permanently ban this IP?')) {
                        banUser(ip, 'permanent', null, reason);
                      }
                    }}
                    className="w-full bg-red-400 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-full transition duration-200 flex items-center justify-center"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Permanent Ban
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderBannedPage = () => (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Ban className="w-16 h-16 text-red-400 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-black mb-4">Access Restricted</h2>
        <p className="text-gray-600 mb-6">
          Your access to LongPartner has been restricted due to a violation of our terms of service.
        </p>
        <p className="text-sm text-gray-500">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );

  switch (currentPage) {
    case 'create':
      return renderCreatePage();
    case 'waiting':
      return renderWaitingPage();
    case 'chat':
      return renderChatPage();
    case 'download':
      return renderDownloadPage();
    case 'admin-login':
      return renderAdminLogin();
    case 'admin-dashboard':
      return renderAdminDashboard();
    case 'banned':
      return renderBannedPage();
    default:
      return renderHomePage();
  }
}

export default App;