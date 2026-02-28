'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/DMPage.css';
import { messageApi, searchApi, userApi, federationApi, getCurrentInstance, resolveMediaUrl } from '@/lib/api';
import {
  loadKeyPair,
  loadEncryptionKeys,
  generateKeyPair,
  deriveSharedSecret,
  importEncryptionPublicKey,
  encryptMessage,
  decryptMessage
} from '@/lib/crypto';


export default function DMPage({ onNavigate, userData, selectedUser }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const currentInstance = getCurrentInstance();
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // E2EE State
  const [myKeyPair, setMyKeyPair] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [recruitPublicKey, setRecruitPublicKey] = useState(null); // For new chats
  const [encryptionStatus, setEncryptionStatus] = useState('loading'); // loading, ready, missing_keys, recipient_missing_keys
  const [decryptedPreviews, setDecryptedPreviews] = useState({}); // Store decrypted previews by thread ID
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessage, setEditMessage] = useState('');

  const messagesEndRef = useRef(null);

  const getOfflineQueueKey = () => {
    const uid = userData?.id || 'anonymous';
    return `splitter_dm_offline_queue_${uid}`;
  };

  const loadOfflineQueue = () => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(getOfflineQueueKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveOfflineQueue = (queue) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getOfflineQueueKey(), JSON.stringify(queue));
  };

  const queueOfflineMessage = (queuedMessage) => {
    const queue = loadOfflineQueue();
    queue.push(queuedMessage);
    saveOfflineQueue(queue);
  };

  const syncQueuedMessages = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const queue = loadOfflineQueue();
    if (queue.length === 0) return;

    try {
      const result = await messageApi.syncQueuedMessages(queue);
      const successful = (result.results || []).filter((entry) => !entry.error);
      const successIds = new Set(successful.map((entry) => entry.client_message_id));
      const remaining = queue.filter((entry) => !successIds.has(entry.client_message_id));
      saveOfflineQueue(remaining);

      if (selectedThread) {
        await selectThread(selectedThread);
      }
      await fetchThreads();
    } catch (err) {
      console.warn('Offline DM sync failed; will retry later:', err?.message || err);
    }
  };

  const renderAvatar = (user, className = '', size = 40) => {
    const raw = user?.avatar_url || user?.avatar || '';
    const resolved = resolveMediaUrl(raw);
    if (resolved) {
      return (
        <img
          src={resolved}
          alt={`${user?.username || 'user'} avatar`}
          className={className}
          style={className ? undefined : { width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
      );
    }
    return '👤';
  };

  const resolveRemoteRecipientKey = async (user) => {
    try {
      const domain = user?.domain || user?.instance_domain;
      if (!user?.username || !domain) return '';

      const query = `@${user.username}@${domain}`;
      const result = await federationApi.searchUsers(query);
      const candidates = result?.users || [];
      const exact = candidates.find((u) =>
        String(u.username || '').toLowerCase() === String(user.username || '').toLowerCase() &&
        String(u.domain || u.instance_domain || '').toLowerCase() === String(domain || '').toLowerCase()
      );

      return exact?.encryption_public_key || '';
    } catch {
      return '';
    }
  };

  // Load my keys on mount
  useEffect(() => {
    async function loadKeys() {
      // Try loading full keypair first (for DID users with signing keys)
      let keys = await loadKeyPair();

      // Fallback to loading only encryption keys (for username/password users)
      if (!keys || !keys.encryptionPrivateKey) {
        const encKeys = await loadEncryptionKeys();
        if (encKeys && encKeys.encryptionPrivateKey) {
          // Convert to KeyPair format for compatibility
          keys = {
            publicKey: null,
            privateKey: null,
            publicKeyBase64: '',
            privateKeyBase64: '',
            did: '',
            encryptionPrivateKey: encKeys.encryptionPrivateKey,
            encryptionPublicKey: encKeys.encryptionPublicKey,
            encryptionPrivateKeyBase64: encKeys.encryptionPrivateKeyBase64,
            encryptionPublicKeyBase64: encKeys.encryptionPublicKeyBase64,
          };
          setMyKeyPair(keys);
          console.log('Encryption keys loaded from localStorage (encryption-only mode)');
          return;
        }
      }

      if (keys && keys.encryptionPrivateKey) {
        setMyKeyPair(keys);
        console.log('Encryption keys loaded from localStorage (full keypair)');
      } else {
        setEncryptionStatus('missing_keys');
        console.warn('No encryption keys found for current user');
      }
    }
    loadKeys();
  }, []);

  // Fetch threads on mount
  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      syncQueuedMessages();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      syncQueuedMessages();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedThread, userData?.id]);

  // Handle selectedUser from navigation (New Chat)
  useEffect(() => {
    if (selectedUser) {
      startConversationWithUser(selectedUser);
    }
  }, [selectedUser]);

  // Derive Shared Secret when Thread Changes
  useEffect(() => {
    async function setupEncryption() {
      setSharedSecret(null);
      setIsEncryptionReady(false);

      if (!selectedThread || !myKeyPair) return;

      const otherUser = getOtherUser(selectedThread);
      let otherUserPublicKey = otherUser.encryption_public_key;

      if (!otherUserPublicKey && otherUser?.is_remote) {
        const resolvedKey = await resolveRemoteRecipientKey(otherUser);
        if (resolvedKey) {
          otherUserPublicKey = resolvedKey;
          setSelectedThread((prev) => prev ? {
            ...prev,
            other_user: {
              ...prev.other_user,
              encryption_public_key: resolvedKey,
            },
          } : prev);
        }
      }

      if (!otherUserPublicKey) {
        setEncryptionStatus('recipient_missing_keys');
        return;
      }

      try {
        const importedPublicKey = await importEncryptionPublicKey(otherUserPublicKey);
        const secret = await deriveSharedSecret(myKeyPair.encryptionPrivateKey, importedPublicKey);
        setSharedSecret(secret);
        setIsEncryptionReady(true);
        setEncryptionStatus('ready');
      } catch (err) {
        console.error('Failed to setup encryption:', err);
        setEncryptionStatus('error');
      }
    }

    setupEncryption();
  }, [selectedThread, myKeyPair]);

  // Decrypt Messages when Messages or SharedSecret changes
  useEffect(() => {
    async function decryptAll() {
      if (!sharedSecret || messages.length === 0) return;

      const decryptedMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.decrypted) return msg; // Already decrypted
        if (!msg.ciphertext) return { ...msg, decrypted: true }; // Plaintext message

        try {
          // Ciphertext format expected: "ciphertext|iv" or separate fields. 
          // My backend stores "ciphertext" and "iv"? 
          // Wait, backend model only has Ciphertext string. 
          // In crypto.ts encryptMessage returns { ciphertext, iv }.
          // I should combine them or store IV separately.
          // Current Plan: I'll store them as JSON string or delimiter separated in the single "ciphertext" column if I can't change schema easily.
          // Reviewing backend `SendMessage`: it takes `ciphertext` string.
          // I will store JSON.stringify({ c: ciphertext, iv: iv }) in the ciphertext column.

          let iv, content;
          try {
            const parsed = JSON.parse(msg.ciphertext);
            iv = parsed.iv;
            content = parsed.c;
          } catch (e) {
            // Legacy or simple format if I changed my mind? 
            // Let's assume JSON format for now.
            console.error("Invalid ciphertext format", e);
            return { ...msg, content: '⚠️ Invalid format', decrypted: true, error: true };
          }

          const decryptedText = await decryptMessage(content, iv, sharedSecret);
          return { ...msg, content: decryptedText, decrypted: true };
        } catch (err) {
          console.error('Failed to decrypt message:', msg.id, err);
          return { ...msg, content: '🔒 Decryption failed', decrypted: true, error: true };
        }
      }));

      // Only update if there are changes to avoid loops
      // Simple check: check if any message was not decrypted and now is
      const needsUpdate = messages.some((m, i) => !m.decrypted && decryptedMessages[i].decrypted);
      if (needsUpdate) {
        setMessages(decryptedMessages);
      }
    }

    decryptAll();
  }, [messages, sharedSecret]);


  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Decrypt last message preview for conversation list
  useEffect(() => {
    async function decryptPreviews() {
      if (!myKeyPair || threads.length === 0) return;

      const newPreviews = {};

      for (const thread of threads) {
        if (!thread.last_message?.ciphertext) continue;

        const otherUser = getOtherUser(thread);
        if (!otherUser.encryption_public_key) continue;

        try {
          const importedPublicKey = await importEncryptionPublicKey(otherUser.encryption_public_key);
          const secret = await deriveSharedSecret(myKeyPair.encryptionPrivateKey, importedPublicKey);

          const parsed = JSON.parse(thread.last_message.ciphertext);
          const decryptedText = await decryptMessage(parsed.c, parsed.iv, secret);
          newPreviews[thread.id] = decryptedText.substring(0, 30) + (decryptedText.length > 30 ? '...' : '');
        } catch (err) {
          console.error('Failed to decrypt preview for thread', thread.id, err);
          newPreviews[thread.id] = '🔒 Encrypted message';
        }
      }

      setDecryptedPreviews(newPreviews);
    }

    decryptPreviews();
  }, [threads, myKeyPair]);

  // Check if message is deletable/editable (within 3 hours)
  const canModifyMessage = (createdAt) => {
    const now = new Date();
    const messageTime = new Date(createdAt);
    const hoursSince = (now - messageTime) / (1000 * 60 * 60);
    return hoursSince < 3;
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;

    try {
      await messageApi.deleteMessage(messageId);
      // Refresh messages
      if (selectedThread) {
        await selectThread(selectedThread);
      }
      // Refresh thread list to update preview
      await fetchThreads();
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditMessage = async (messageId, originalMessage) => {
    setEditingMessageId(messageId);
    setEditMessage(originalMessage.content || '');
  };

  const submitEdit = async (messageId) => {
    if (!editMessage.trim()) return;

    try {
      let ciphertext = '';

      // Re-encrypt if this was an encrypted message
      if (encryptionStatus === 'ready' && sharedSecret) {
        const { ciphertext: encrypted, iv } = await encryptMessage(editMessage, sharedSecret);
        ciphertext = JSON.stringify({ c: encrypted, iv });
      }

      await messageApi.editMessage(messageId, editMessage, ciphertext);
      setEditingMessageId(null);
      setEditMessage('');

      // Refresh messages
      if (selectedThread) {
        await selectThread(selectedThread);
      }
      // Refresh thread list to update preview
      await fetchThreads();
    } catch (err) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message: ' + (err.response?.data?.error || err.message));
    }
  };

  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const result = await messageApi.getThreads();
      setThreads(result.threads || []);

      // If we have threads and none selected, select the first one
      if (result.threads?.length > 0 && !selectedThread) {
        selectThread(result.threads[0]);
      }
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectThread = async (thread) => {
    setSelectedThread(thread);
    try {
      const result = await messageApi.getMessages(thread.id);
      // Messages come with ciphertext. Transformation happens in useEffect.
      setMessages(result.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setMessages([]);
    }
  };

  const handleGenerateEncryptionKeys = async () => {
    try {
      // Generate new key pair (includes both signing and encryption keys)
      const keyPair = await generateKeyPair();

      // Use the encryption keys from the generated keypair
      const publicKeyBase64 = keyPair.encryptionPublicKeyBase64;
      const privateKeyBase64 = keyPair.encryptionPrivateKeyBase64;

      if (!publicKeyBase64 || !privateKeyBase64) {
        throw new Error('Failed to generate encryption keys');
      }

      // Update user's encryption key on backend
      await userApi.updateEncryptionKey(publicKeyBase64);

      // Store in localStorage (use same keys as loadKeyPair expects)
      localStorage.setItem('encryption_public_key', publicKeyBase64);
      localStorage.setItem('encryption_private_key', privateKeyBase64);

      // Reload the key pair to update state properly
      const loadedKeyPair = await loadKeyPair();
      setMyKeyPair(loadedKeyPair);
      setEncryptionStatus('ready');

      alert('✅ Encryption keys generated successfully! E2E encryption is now active.');
    } catch (err) {
      console.error('Failed to generate encryption keys:', err);
      alert('Failed to generate encryption keys: ' + err.message);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedThread) return;
    if (isSending) return;

    setIsSending(true);
    try {
      // Determine recipient ID
      const recipientId = selectedThread.participant_a_id === userData?.id
        ? selectedThread.participant_b_id
        : selectedThread.participant_a_id;

      let payload = {
        recipient_id: recipientId,
        content: messageText // Fallback/Metadata content? Or keep empty? 
        // Backend requires content OR ciphertext. 
        // I'll send a placeholder in content like "Encrypted Message" for backward compat clients.
      };

      if (isEncryptionReady && sharedSecret) {
        const { ciphertext, iv } = await encryptMessage(messageText, sharedSecret);
        // Store as JSON
        const combinedCipher = JSON.stringify({ c: ciphertext, iv });
        payload.ciphertext = combinedCipher;
        payload.content = "🔒 Encrypted Message";
      } else {
        // Fallback to plain text if encryption not ready (e.g. recipient partial support)
        // User should be warned.
        if (encryptionStatus === 'recipient_missing_keys') {
          if (!confirm("Recipient has no encryption keys. Send as plain text?")) {
            setIsSending(false);
            return;
          }
        } else if (encryptionStatus === 'missing_keys') {
          alert("You don't have encryption keys. Cannot send message.");
          setIsSending(false);
          return;
        }
      }

      const clientMessageId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const clientCreatedAt = new Date().toISOString();

      if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        queueOfflineMessage({
          client_message_id: clientMessageId,
          recipient_id: recipientId,
          content: payload.content,
          ciphertext: payload.ciphertext || '',
          client_created_at: clientCreatedAt,
        });

        const queuedLocalMessage = {
          id: `queued-${clientMessageId}`,
          thread_id: selectedThread.id,
          sender_id: userData?.id,
          recipient_id: recipientId,
          client_message_id: clientMessageId,
          content: messageText,
          ciphertext: payload.ciphertext || '',
          is_read: false,
          created_at: clientCreatedAt,
          decrypted: true,
          queued_offline: true,
        };

        setMessages(prev => [...prev, queuedLocalMessage]);
        setMessageText('');
        return;
      }

      const result = await messageApi.sendMessage(recipientId, payload.content, payload.ciphertext);

      // Add message to local state
      // Optimistically add? Or use result. 
      // Result message has the same content/ciphertext.
      // We need to set it as decrypted immediately to show to user.
      const newMsg = {
        ...result.message,
        content: messageText, // Show original text immediately
        decrypted: true
      };

      setMessages(prev => [...prev, newMsg]);
      setMessageText('');

      // Refresh threads to update last message
      fetchThreads();
    } catch (err) {
      const errorMessage = err?.message || '';
      const likelyNetworkError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed');

      if (likelyNetworkError) {
        try {
          const recipientId = selectedThread.participant_a_id === userData?.id
            ? selectedThread.participant_b_id
            : selectedThread.participant_a_id;

          const clientMessageId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          const clientCreatedAt = new Date().toISOString();

          let fallbackPayload = {
            recipient_id: recipientId,
            content: messageText,
            ciphertext: ''
          };

          if (isEncryptionReady && sharedSecret) {
            const { ciphertext, iv } = await encryptMessage(messageText, sharedSecret);
            fallbackPayload = {
              recipient_id: recipientId,
              content: '🔒 Encrypted Message',
              ciphertext: JSON.stringify({ c: ciphertext, iv })
            };
          }

          queueOfflineMessage({
            client_message_id: clientMessageId,
            recipient_id: fallbackPayload.recipient_id,
            content: fallbackPayload.content,
            ciphertext: fallbackPayload.ciphertext,
            client_created_at: clientCreatedAt,
          });

          setMessages(prev => [...prev, {
            id: `queued-${clientMessageId}`,
            thread_id: selectedThread.id,
            sender_id: userData?.id,
            recipient_id: fallbackPayload.recipient_id,
            client_message_id: clientMessageId,
            content: messageText,
            ciphertext: fallbackPayload.ciphertext,
            is_read: false,
            created_at: clientCreatedAt,
            decrypted: true,
            queued_offline: true,
          }]);
          setMessageText('');
          setIsOffline(true);
          return;
        } catch (queueErr) {
          console.error('Failed to queue message after network failure:', queueErr);
        }
      }

      console.error('Failed to send message:', err);
      alert('Failed to send message: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Search for users to start new conversation
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const current = getCurrentInstance();

      // Search local users
      const localResult = await searchApi.searchUsers(searchQuery);
      const localUsers = (localResult.users || [])
        .filter(u => u.id !== userData?.id)
        .map(u => {
          const instanceDomain = u.instance_domain || '';
          const isGhostRemote = instanceDomain && instanceDomain !== 'localhost' && instanceDomain !== current.domain;
          return {
            ...u,
            is_remote: isGhostRemote,
            domain: instanceDomain || current.domain,
          };
        })
        .filter(u => !u.is_remote);

      // Also search federated users  
      let federatedUsers = [];
      try {
        const fedResult = await federationApi.searchUsers(searchQuery);
        federatedUsers = (fedResult.users || []).filter(u => u.is_remote && u.id !== userData?.id).map(u => ({
          ...u,
          is_remote: true,
        }));
      } catch (fedErr) {
        console.log('Federation user search unavailable:', fedErr);
      }

      // Merge and deduplicate
      const seen = new Set();
      const merged = [];
      for (const u of localUsers) {
        const key = `${u.username}@${u.domain || u.instance_domain || 'local'}`;
        if (!seen.has(key)) { seen.add(key); merged.push(u); }
      }
      for (const u of federatedUsers) {
        const key = `${u.username}@${u.domain || 'remote'}`;
        if (!seen.has(key)) { seen.add(key); merged.push(u); }
      }

      setSearchResults(merged);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const startConversationWithUser = async (user) => {
    try {
      const result = await messageApi.startConversation(user.id);
      setShowNewChat(false);
      setSearchQuery('');
      setSearchResults([]);

      // Refresh threads and select the new one
      await fetchThreads();
      selectThread(result.thread);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      alert('Failed to start conversation: ' + err.message);
    }
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getOtherUser = (thread) => {
    return thread.other_user || { username: 'Unknown', display_name: 'Unknown User' };
  };

  return (
    <div className="dm-container">

      {/* Top Navigation */}
      <div className="dm-navbar">
        <button
          className="nav-button back-button"
          onClick={() => onNavigate('home')}
        >
          ← Back
        </button>
        <h1 className="navbar-title">Messages 🔒</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button onClick={() => onNavigate('profile')} style={{ padding: '8px 12px', background: 'rgba(0,217,255,0.1)', border: '1px solid #00d9ff', color: '#00d9ff', borderRadius: '6px', cursor: 'pointer' }}>Profile</button>
          <button onClick={() => onNavigate('security')} style={{ padding: '8px 12px', background: 'rgba(0,217,255,0.1)', border: '1px solid #00d9ff', color: '#00d9ff', borderRadius: '6px', cursor: 'pointer' }}>🔐 Security</button>
          <button onClick={toggleTheme} style={{ padding: '8px 12px', background: 'rgba(0,217,255,0.1)', border: '1px solid #00d9ff', color: '#00d9ff', borderRadius: '6px', cursor: 'pointer' }}>{isDarkMode ? '🌙' : '☀️'}</button>
        </div>
      </div>

      <div className="dm-content">
        {/* Sidebar - Inbox */}
        <div className="dm-sidebar">
          <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Inbox</h2>
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              style={{
                padding: '6px 12px',
                background: showNewChat ? 'rgba(255,68,68,0.2)' : 'rgba(0,217,255,0.2)',
                border: `1px solid ${showNewChat ? '#ff4444' : '#00d9ff'}`,
                color: showNewChat ? '#ff4444' : '#00d9ff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showNewChat ? '✕ Cancel' : '+ New'}
            </button>
          </div>

          {/* New Chat Search */}
          {showNewChat && (
            <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
              <input
                type="text"
                placeholder="Search users to message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDarkMode ? '#333' : '#cbd5e1'}`,
                  borderRadius: '6px',
                  color: isDarkMode ? '#fff' : '#111827',
                  fontSize: '14px'
                }}
              />
              {isSearching && (
                <div style={{ padding: '8px', color: '#666', textAlign: 'center' }}>
                  Searching...
                </div>
              )}
              {searchResults.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {searchResults.map((user, idx) => (
                    <div
                      key={`${user.id || 'user'}-${user.domain || user.instance_domain || 'local'}-${idx}`}
                      onClick={() => startConversationWithUser(user)}
                      style={{
                        padding: '10px',
                        background: isDarkMode ? 'rgba(0,217,255,0.1)' : 'rgba(2,132,199,0.08)',
                        border: `1px solid ${isDarkMode ? 'transparent' : 'rgba(148,163,184,0.45)'}`,
                        borderRadius: '6px',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {renderAvatar(user, '', 32)}
                      </div>
                      <div>
                        <div style={{ color: isDarkMode ? '#fff' : '#111827', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {user.display_name || user.username}
                          {user.is_remote && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              background: 'rgba(255,136,0,0.2)',
                              color: '#ff8800',
                              borderRadius: '4px',
                              border: '1px solid rgba(255,136,0,0.3)'
                            }}>🌐 {user.domain || 'Remote'}</span>
                          )}
                        </div>
                        <div style={{ color: isDarkMode ? '#666' : '#475569', fontSize: '12px' }}>
                          @{user.username}@{user.domain || user.instance_domain || 'local'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="conversations-list">
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                Loading conversations...
              </div>
            ) : threads.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                <p>No conversations yet</p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                  Click "+ New" to start messaging someone
                </p>
              </div>
            ) : (
              threads.map(thread => {
                const otherUser = getOtherUser(thread);
                return (
                  <div
                    key={thread.id}
                    className={`conversation-item ${selectedThread?.id === thread.id ? 'active' : ''}`}
                    onClick={() => selectThread(thread)}
                  >
                    <div className="conversation-avatar">
                      {renderAvatar(otherUser, 'conversation-avatar-image')}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-name">
                        @{otherUser.username}
                        {otherUser.instance_domain && otherUser.instance_domain !== 'localhost' && otherUser.instance_domain !== currentInstance.domain && (
                          <span className="remote-indicator">🌐</span>
                        )}
                      </div>
                      <div className="conversation-preview">
                        {thread.last_message?.deleted_at ? (
                          <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Message deleted</span>
                        ) : thread.last_message?.ciphertext
                          ? (decryptedPreviews[thread.id] || '🔒 Decrypting...')
                          : (thread.last_message?.content?.substring(0, 30) || 'No messages yet') + (thread.last_message?.content?.length > 30 ? '...' : '')}
                      </div>
                    </div>
                    {thread.unread_count > 0 && (
                      <div style={{
                        background: '#00d9ff',
                        color: '#000',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        {thread.unread_count}
                      </div>
                    )}
                    <div className="encryption-badge" title="End-to-end encrypted conversation">🔒</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="dm-chat-window">
          {!selectedThread ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
              <h3 style={{ color: '#fff', marginBottom: '8px' }}>Select a conversation</h3>
              <p>Choose a conversation from the sidebar or start a new one</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-avatar">
                    {renderAvatar(getOtherUser(selectedThread), 'chat-avatar-image')}
                  </div>
                  <div className="chat-title-section">
                    <h2 className="chat-title">@{getOtherUser(selectedThread).username}</h2>
                    <div className="chat-status">
                      {getOtherUser(selectedThread).instance_domain && getOtherUser(selectedThread).instance_domain !== 'localhost' && getOtherUser(selectedThread).instance_domain !== currentInstance.domain && (
                        <span className="status-text">🌐 Remote • </span>
                      )}

                      {encryptionStatus === 'ready' && <span className="status-text" style={{ color: '#00ff88' }}>🔒 Encrypted With Signal Protocol (ECDH)</span>}
                      {encryptionStatus === 'loading' && <span className="status-text">🔄 Verifying Keys...</span>}
                      {encryptionStatus === 'recipient_missing_keys' && <span className="status-text" style={{ color: '#ffaa00' }}>⚠️ Recipient has no keys</span>}
                      {encryptionStatus === 'missing_keys' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="status-text" style={{ color: '#ff4444' }}>⚠️ No encryption keys</span>
                          <button
                            onClick={handleGenerateEncryptionKeys}
                            style={{
                              padding: '4px 12px',
                              background: '#00d9ff',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#000',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                            title="Generate encryption keys to enable E2E encryption"
                          >
                            🔐 Generate Keys & Enable E2E
                          </button>
                        </div>
                      )}
                      {encryptionStatus === 'error' && <span className="status-text" style={{ color: '#ff4444' }}>❌ Encryption Error</span>}

                    </div>
                  </div>
                </div>
              </div>

              {/* Encryption Banner */}
              <div className="encryption-banner" style={{
                background: encryptionStatus === 'ready' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 170, 0, 0.1)',
                borderColor: encryptionStatus === 'ready' ? '#00ff88' : '#ffaa00'
              }}>
                {encryptionStatus === 'ready'
                  ? '🔒 Messages are end-to-end encrypted. Only you and the recipient can read them.'
                  : '⚠️ End-to-end encryption is not active. Keys may be missing.'}
              </div>

              {isOffline && (
                <div className="encryption-banner" style={{
                  background: 'rgba(255, 170, 0, 0.15)',
                  borderColor: '#ffaa00',
                  marginTop: '8px'
                }}>
                  📡 Offline mode: messages are queued locally and will sync automatically when connection is restored.
                </div>
              )}

              {/* Messages Area */}
              <div className="messages-area">
                {messages.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSent = msg.sender_id === userData?.id;
                    const canModify = isSent && canModifyMessage(msg.created_at);
                    const isDeleted = msg.deleted_at;
                    const isEdited = msg.edited_at;

                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble ${isSent ? 'sent' : 'received'}`}
                      >
                        {isDeleted ? (
                          <div className="message-content" style={{ fontStyle: 'italic', opacity: 0.6 }}>
                            {isSent ? 'You deleted this message' : 'This message was deleted'}
                          </div>
                        ) : editingMessageId === msg.id ? (
                          <div>
                            <textarea
                              value={editMessage}
                              onChange={(e) => setEditMessage(e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '60px',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #333',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                fontSize: '14px',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button
                                onClick={() => submitEdit(msg.id)}
                                style={{
                                  padding: '4px 12px',
                                  background: '#00d9ff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: '#000',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingMessageId(null); setEditMessage(''); }}
                                style={{
                                  padding: '4px 12px',
                                  background: 'transparent',
                                  border: '1px solid #666',
                                  borderRadius: '4px',
                                  color: '#999',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="message-content">
                              {msg.content}
                              {msg.queued_offline && (
                                <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8 }}>⏳ Queued</span>
                              )}
                              {isEdited && (
                                <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.7 }}>✏️ Edited</span>
                              )}
                            </div>
                            <div className="message-meta">
                              <span className="message-timestamp">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {msg.ciphertext && <span className="message-encryption" title="End-to-end encrypted">🔒</span>}
                            </div>
                            {canModify && !isDeleted && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', fontSize: '11px' }}>
                                <button
                                  onClick={() => handleEditMessage(msg.id, msg)}
                                  style={{
                                    padding: '2px 8px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '3px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '10px'
                                  }}
                                  title="Edit (within 3 hours)"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  style={{
                                    padding: '2px 8px',
                                    background: 'rgba(255,68,68,0.2)',
                                    border: '1px solid rgba(255,68,68,0.4)',
                                    borderRadius: '3px',
                                    color: '#ff4444',
                                    cursor: 'pointer',
                                    fontSize: '10px'
                                  }}
                                  title="Delete (within 3 hours)"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Box */}
              <div className="message-input-box">
                <textarea
                  className="message-input"
                  placeholder={encryptionStatus === 'ready' ? "Type an encrypted message..." : "Type a message..."}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending}
                ></textarea>
                <button
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || isSending}
                  title={encryptionStatus === 'ready' ? "Send encrypted" : "Send"}
                  style={{
                    background: encryptionStatus === 'ready' ? 'linear-gradient(135deg, #00d9ff, #00ff88)' : undefined
                  }}
                >
                  {isSending ? 'Sending...' : (encryptionStatus === 'ready' ? 'Send 🔒' : 'Send')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
