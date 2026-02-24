'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/SecurityPage.css';
import { userApi, authApi } from '@/lib/api';
import { generateKeyPair } from '@/lib/ed25519-browser';

export default function SecurityPage({ onNavigate, userData, updateUserData }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Key rotation state
  const [isRotating, setIsRotating] = useState(false);
  const [rotationResult, setRotationResult] = useState(null); // { success, message, newKey }
  const [keyHistory, setKeyHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [revokedKeys, setRevokedKeys] = useState([]);

  // Inline key-check tool state
  const [checkKeyInput, setCheckKeyInput] = useState('');
  const [checkKeyResult, setCheckKeyResult] = useState(null); // { status, revoked }
  const [isCheckingKey, setIsCheckingKey] = useState(false);

  // Fetch fresh user data from server so public_key is up to date
  const [livePublicKey, setLivePublicKey] = useState(userData?.public_key || null);
  useEffect(() => {
    userApi.getCurrentUser()
      .then(u => {
        const pk = u?.public_key || null;
        setLivePublicKey(pk);
        // Load revocation list
        if (pk) {
          setIsLoadingHistory(true);
          authApi.getRevokedKeys()
            .then(res => {
              setRevokedKeys(res.revoked_keys || []);
              setKeyHistory(res.revoked_keys || []);
            })
            .catch(() => { })
            .finally(() => setIsLoadingHistory(false));
        }
      })
      .catch(() => { }); // silently fail if /users/me is down
  }, []);

  const hasPublicKey = !!livePublicKey;

  // ─── Initialize Key Handler (for accounts with no key yet) ──────────────
  const handleInitializeKey = async () => {
    const confirmed = window.confirm(
      '🔑 Add Signing Key\n\nThis will generate a new Ed25519 key pair and register your public key with the server.\n\nYour private key stays only in this browser. Continue?'
    );
    if (!confirmed) return;

    setIsRotating(true);
    setRotationResult(null);

    try {
      // generateKeyPair uses crypto.getRandomValues + crypto.subtle SHA-512 — no library deps
      const kp = await generateKeyPair();
      const pubKeyB64 = btoa(String.fromCharCode(...kp.publicKey));

      const result = await authApi.registerKey(pubKeyB64);

      // Store 64-byte secretKey as hex
      const skHex = Array.from(kp.secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('private_key', skHex);

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(storedUser), public_key: pubKeyB64 }));
      }

      setLivePublicKey(pubKeyB64);
      setRotationResult({ success: true, message: result.message, newKey: pubKeyB64 });
    } catch (err) {
      setRotationResult({ success: false, message: err.message || 'Failed to initialize key' });
    } finally {
      setIsRotating(false);
    }
  };
  // ─── Key Rotation Handler ────────────────────────────────────────────────
  const handleRotateKey = async () => {
    if (!hasPublicKey) {
      alert('Key rotation is only available for DID-based accounts with a signing key.');
      return;
    }
    const confirmed = window.confirm(
      '🔄 Rotate Signing Key\n\nThis will generate a new key pair and replace your current one. Continue?'
    );
    if (!confirmed) return;

    setIsRotating(true);
    setRotationResult(null);

    try {
      // Generate new key pair — no signing needed, JWT auth is sufficient
      const newKP = await generateKeyPair();
      const newPubKeyB64 = btoa(String.fromCharCode(...newKP.publicKey));

      const result = await authApi.rotateKey({ new_public_key: newPubKeyB64 });

      // Store new 64-byte secretKey as 128-char hex
      const newSkHex = Array.from(newKP.secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('private_key', newSkHex);

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(storedUser), public_key: newPubKeyB64 }));
      }

      setRotationResult({ success: true, message: result.message, newKey: newPubKeyB64 });
      setLivePublicKey(newPubKeyB64);

      const hist = await authApi.getKeyHistory();
      setKeyHistory(hist.key_history || []);

    } catch (err) {
      setRotationResult({ success: false, message: err.message || 'Key rotation failed' });
    } finally {
      setIsRotating(false);
    }
  };

  // ─── Revoke Key Handler ───────────────────────────────────────────
  const handleRevokeKey = async () => {
    const confirmed = window.confirm(
      '⚠️ Revoke Signing Key\n\nThis will permanently disable your current signing key and move it to the revocation list. You will not be able to sign messages until you initialize a new key.\n\nContinue?'
    );
    if (!confirmed) return;

    setIsRotating(true);
    setRotationResult(null);

    try {
      const result = await authApi.revokeKey();

      // Wipe private key from browser storage
      localStorage.removeItem('private_key');

      // Update local storage user object if exists
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(storedUser), public_key: null }));
      }

      setRotationResult({ success: true, message: result.message });
      setLivePublicKey(null);

      // Refresh revocation list
      authApi.getRevokedKeys()
        .then(res => setRevokedKeys(res.revoked_keys || []))
        .catch(() => { });

    } catch (err) {
      setRotationResult({ success: false, message: err.message || 'Key revocation failed' });
    } finally {
      setIsRotating(false);
    }
  };


  // Privacy settings state
  const [defaultVisibility, setDefaultVisibility] = useState(userData?.default_visibility || 'public');
  const [messagePrivacy, setMessagePrivacy] = useState(userData?.message_privacy || 'everyone');
  const [accountLocked, setAccountLocked] = useState(userData?.account_locked || false);

  const recoveryCode = 'RECOVERY_CODE_9c8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d';
  const did = userData?.did || 'did:key:z6Mkjx9J5aQ2vP7nL4mK8vQ5wR2xT9nY6bZ3cD5eF7gH9...';
  const publicKeyFingerprint = 'A4:9C:2B:7D:E1:5F:8A:3C:9B:6E:2A:4D:7C:1F:8E:5B';

  const handleCopyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSavePrivacySettings = async () => {
    setIsSaving(true);
    try {
      await userApi.updateProfile({
        default_visibility: defaultVisibility,
        message_privacy: messagePrivacy,
        account_locked: accountLocked
      });
      if (updateUserData) {
        updateUserData({
          ...userData,
          default_visibility: defaultVisibility,
          message_privacy: messagePrivacy,
          account_locked: accountLocked
        });
      }
      alert('Privacy settings saved successfully!');
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="security-container" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Navigation */}
      <div className="security-navbar">
        <button
          className="nav-button back-button"
          onClick={() => onNavigate('home')}
        >
          ← Back
        </button>
        <h1 className="navbar-title">Security Dashboard</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="nav-btn-profile"
            onClick={() => onNavigate('profile')}
            style={{
              padding: '8px 12px',
              background: isDarkMode ? 'rgba(0, 217, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)',
              border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`,
              color: isDarkMode ? '#00d9ff' : '#333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Profile
          </button>
          <button
            className="nav-btn-profile"
            onClick={() => onNavigate('dm')}
            style={{
              padding: '8px 12px',
              background: isDarkMode ? 'rgba(0, 217, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)',
              border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`,
              color: isDarkMode ? '#00d9ff' : '#333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            💬 Messages
          </button>
          <button
            className="nav-btn-profile"
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              padding: '8px 12px',
              background: isDarkMode ? 'rgba(0, 217, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)',
              border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`,
              color: isDarkMode ? '#00d9ff' : '#333',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {isDarkMode ? '🌞' : '🌙'}
          </button>
        </div>
      </div>

      <div className="security-content">
        {/* Intro Banner */}
        <div className="security-banner" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
          <div className="banner-icon">🔐</div>
          <div className="banner-text">
            <h2 style={{ color: 'var(--text-primary)' }}>Client-Side Key Custody</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              This device controls your identity. Your private key is stored
              only on this device. Losing access means losing your account.
            </p>
          </div>
        </div>

        {/* Privacy Settings Card - NEW */}
        <div className="status-card" style={{ marginBottom: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
          <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>🔒 Privacy Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>

            {/* Default Post Visibility */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>Default Post Visibility</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Who can see your new posts by default</div>
              </div>
              <select
                value={defaultVisibility}
                onChange={(e) => setDefaultVisibility(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: isDarkMode ? '#1a1a2e' : '#f5f5f5',
                  border: '1px solid var(--border-color)',
                  color: isDarkMode ? '#e0e0e0' : '#333',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="public" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>🌐 Public</option>
                <option value="followers" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>👥 Followers Only</option>
                <option value="circle" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>🔒 Circle Only</option>
              </select>
            </div>

            {/* Message Privacy */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>Who Can Message You</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Control who can send you direct messages</div>
              </div>
              <select
                value={messagePrivacy}
                onChange={(e) => setMessagePrivacy(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: isDarkMode ? '#1a1a2e' : '#f5f5f5',
                  border: '1px solid var(--border-color)',
                  color: isDarkMode ? '#e0e0e0' : '#333',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="everyone" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>🌐 Everyone</option>
                <option value="followers" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>👥 Followers Only</option>
                <option value="none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>🚫 No One</option>
              </select>
            </div>

            {/* Account Lock Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>Lock Account</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Require approval for new followers</div>
              </div>
              <button
                onClick={() => setAccountLocked(!accountLocked)}
                style={{
                  padding: '8px 16px',
                  background: accountLocked ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.1)',
                  border: `1px solid ${accountLocked ? '#00ff88' : '#ff4444'}`,
                  color: accountLocked ? '#00ff88' : '#ff4444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  minWidth: '100px'
                }}
              >
                {accountLocked ? '🔒 Locked' : '🔓 Open'}
              </button>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSavePrivacySettings}
              disabled={isSaving}
              style={{
                padding: '12px 24px',
                background: 'var(--accent-gradient)',
                border: 'none',
                color: isDarkMode ? '#000' : '#fff',
                borderRadius: '8px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                marginTop: '8px',
                opacity: isSaving ? 0.7 : 1
              }}
            >
              {isSaving ? 'Saving...' : '💾 Save Privacy Settings'}
            </button>
          </div>
        </div>

        {/* Identity Status Card */}
        <div className="status-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Identity Status</h3>
          <div className="status-items">
            <div className="status-item">
              <div className="status-check" style={{ color: 'var(--success-green)' }}>✔</div>
              <div className="status-text">
                <div className="status-label" style={{ color: 'var(--text-primary)' }}>Private Key Present</div>
                <div className="status-sublabel" style={{ color: 'var(--text-secondary)' }}>Stored in IndexedDB</div>
              </div>
            </div>

            <div className="status-item">
              <div className="status-check" style={{ color: 'var(--success-green)' }}>✔</div>
              <div className="status-text">
                <div className="status-label" style={{ color: 'var(--text-primary)' }}>Public Key Registered</div>
                <div className="status-sublabel" style={{ color: 'var(--text-secondary)' }}>On your home instance</div>
              </div>
            </div>

            <div className="status-item">
              <div className="status-check" style={{ color: 'var(--success-green)' }}>✔</div>
              <div className="status-text">
                <div className="status-label" style={{ color: 'var(--text-primary)' }}>Recovery File Exported</div>
                <div className="status-sublabel" style={{ color: 'var(--text-secondary)' }}>Download available below</div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Information Card */}
        <div className="key-info-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Key Information</h3>

          {/* DID */}
          <div className="key-field">
            <label className="key-label" style={{ color: 'var(--text-secondary)' }}>Decentralized Identifier (DID)</label>
            <div className="key-value-container" style={{ background: isDarkMode ? '#1a1a2e' : '#f5f5f5', border: '1px solid var(--border-color)' }}>
              <code className="key-value" style={{ color: isDarkMode ? '#e0e0e0' : '#333', background: 'transparent' }}>{did}</code>
              <button
                className={`copy-button ${copiedField === 'did' ? 'copied' : ''}`}
                onClick={() => handleCopyToClipboard(did, 'did')}
                title="Copy to clipboard"
                style={{ background: 'var(--primary-cyan)', color: isDarkMode ? '#000' : '#fff' }}
              >
                {copiedField === 'did' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Public Key Fingerprint */}
          <div className="key-field">
            <label className="key-label" style={{ color: 'var(--text-secondary)' }}>Public Key Fingerprint (SHA-256)</label>
            <div className="key-value-container" style={{ background: isDarkMode ? '#1a1a2e' : '#f5f5f5', border: '1px solid var(--border-color)' }}>
              <code className="key-value" style={{ color: isDarkMode ? '#e0e0e0' : '#333', background: 'transparent' }}>{publicKeyFingerprint}</code>
              <button
                className={`copy-button ${copiedField === 'fingerprint' ? 'copied' : ''}`}
                onClick={() =>
                  handleCopyToClipboard(publicKeyFingerprint, 'fingerprint')
                }
                title="Copy to clipboard"
                style={{ background: 'var(--primary-cyan)', color: isDarkMode ? '#000' : '#fff' }}
              >
                {copiedField === 'fingerprint' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Recovery Code */}
          <div className="key-field">
            <label className="key-label" style={{ color: 'var(--text-secondary)' }}>Recovery Code</label>
            <div className="recovery-code-section">
              {showRecoveryCode ? (
                <div className="key-value-container" style={{ background: isDarkMode ? '#1a1a2e' : '#f5f5f5', border: '1px solid var(--border-color)' }}>
                  <code className="key-value recovery-code" style={{ color: isDarkMode ? '#e0e0e0' : '#333', background: 'transparent' }}>
                    {recoveryCode}
                  </code>
                  <button
                    className={`copy-button ${copiedField === 'recovery' ? 'copied' : ''}`}
                    onClick={() =>
                      handleCopyToClipboard(recoveryCode, 'recovery')
                    }
                    style={{ background: 'var(--primary-cyan)', color: isDarkMode ? '#000' : '#fff' }}
                  >
                    {copiedField === 'recovery' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              ) : (
                <button
                  className="reveal-button"
                  onClick={() => setShowRecoveryCode(true)}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  👁 Reveal Code
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Key Actions Card */}
        <div className="actions-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Key Actions</h3>

          {/* Rotation result banner */}
          {rotationResult && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: rotationResult.success ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
              border: `1px solid ${rotationResult.success ? '#00ff88' : '#ff4444'}`,
              color: rotationResult.success ? '#00ff88' : '#ff4444',
              fontSize: '14px'
            }}>
              {rotationResult.success ? '✅ ' : '❌ '}{rotationResult.message}
              {rotationResult.success && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  New key: <code>{rotationResult.newKey?.substring(0, 32)}…</code>
                </div>
              )}
            </div>
          )}

          <div className="actions-grid">
            <button
              className="action-btn primary"
              onClick={() => alert('Recovery file would download: recovery_' + Date.now() + '.json')}
              style={{ background: 'var(--accent-gradient)', color: isDarkMode ? '#000' : '#fff', border: 'none' }}
            >
              📥 Export Recovery File
            </button>

            <button
              className="action-btn primary"
              onClick={hasPublicKey ? handleRotateKey : handleInitializeKey}
              disabled={isRotating}
              title={hasPublicKey
                ? 'Generate a new Ed25519 key pair, signed by your current key'
                : 'Generate an Ed25519 key pair and register your public key'}
              style={{
                background: hasPublicKey ? 'rgba(0,217,255,0.15)' : 'rgba(0,255,136,0.15)',
                border: `1px solid ${hasPublicKey ? '#00d9ff' : '#00ff88'}`,
                color: hasPublicKey ? '#00d9ff' : '#00ff88',
                cursor: isRotating ? 'not-allowed' : 'pointer',
                opacity: isRotating ? 0.7 : 1,
              }}
            >
              {isRotating
                ? '⏳ Working…'
                : hasPublicKey
                  ? '🔄 Rotate Key'
                  : '🔑 Initialize Key'}
            </button>

            <button
              className="action-btn"
              onClick={handleRevokeKey}
              disabled={!hasPublicKey || isRotating}
              title={hasPublicKey ? 'Permanently disable current signing key' : 'No key to revoke'}
              style={{
                background: 'rgba(255,68,68,0.15)',
                border: '1px solid #ff4444',
                color: '#ff4444',
                cursor: !hasPublicKey || isRotating ? 'not-allowed' : 'pointer',
                opacity: !hasPublicKey || isRotating ? 0.7 : 1
              }}
            >
              ✕ Revoke Key
            </button>
          </div>
        </div>

        {/* Revocation List */}
        {hasPublicKey && (
          <div className="status-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', marginTop: '0' }}>
            <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>🔐 Key Revocation List</h3>

            {/* Active Key */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Current Active Key
              </div>
              <div style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '12px',
                background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.3)',
                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'
              }}>
                <span style={{
                  background: '#00ff88', color: '#000', borderRadius: '4px',
                  padding: '2px 8px', fontSize: '10px', fontWeight: 700, flexShrink: 0
                }}>🟢 ACTIVE</span>
                <code style={{ color: '#00ff88', wordBreak: 'break-all', flexGrow: 1 }}>
                  {livePublicKey?.substring(0, 44)}…
                </code>
                <button
                  onClick={() => handleCopyToClipboard(livePublicKey, 'activekey')}
                  style={{ background: 'transparent', border: '1px solid rgba(0,255,136,0.4)', color: '#00ff88', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                >
                  {copiedField === 'activekey' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Revoked Keys */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Revoked Keys ({revokedKeys.length})
            </div>
            {isLoadingHistory ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</div>
            ) : revokedKeys.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '10px', background: isDarkMode ? '#1a1a2e' : '#f5f5f5', borderRadius: '8px' }}>
                No revoked keys — your original key is still your only key.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {revokedKeys.map((entry, i) => (
                  <div key={entry.id || i} style={{
                    padding: '10px 14px', borderRadius: '8px', fontSize: '12px',
                    background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#ff4444', color: '#fff', borderRadius: '4px',
                        padding: '2px 8px', fontSize: '10px', fontWeight: 700, flexShrink: 0
                      }}>🔴 REVOKED</span>
                      <span style={{
                        background: isDarkMode ? '#2a1a1a' : '#ffeaea', color: 'var(--text-secondary)',
                        borderRadius: '4px', padding: '2px 8px', fontSize: '10px', flexShrink: 0
                      }}>
                        {entry.reason || 'rotated'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: 'auto' }}>
                        🗓 {new Date(entry.rotated_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: '#ff8888', wordBreak: 'break-all', marginBottom: '4px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ marginRight: '4px' }}>Key:</strong> <code style={{ marginRight: '8px' }}>{entry.old_public_key?.substring(0, 44)}…</code>
                      <button
                        onClick={() => handleCopyToClipboard(entry.old_public_key, `revoked-${i}`)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,136,136,0.3)',
                          color: '#ff8888',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        {copiedField === `revoked-${i}` ? '✓' : 'Copy Full Key'}
                      </button>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      <strong>Replaced by:</strong> <code>{entry.new_public_key?.substring(0, 32)}…</code>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Check Key Tool */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                🔍 Check Key Status
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Paste a base64 public key…"
                  value={checkKeyInput}
                  onChange={e => { setCheckKeyInput(e.target.value); setCheckKeyResult(null); }}
                  style={{
                    flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                    background: isDarkMode ? '#1a1a2e' : '#f5f5f5',
                    border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
                <button
                  disabled={!checkKeyInput.trim() || isCheckingKey}
                  onClick={async () => {
                    setIsCheckingKey(true);
                    try {
                      let keyToCheck = checkKeyInput.trim();
                      if (keyToCheck.startsWith('did:key:')) {
                        // Strip did:key:z6Mk... prefix to get the raw public key
                        if (keyToCheck.startsWith('did:key:z6Mk')) {
                          keyToCheck = keyToCheck.substring(12);
                        } else if (keyToCheck.startsWith('did:key:z')) {
                          keyToCheck = keyToCheck.substring(9);
                        }
                      }
                      const res = await authApi.checkKeyRevocation(keyToCheck);
                      setCheckKeyResult(res);
                    } catch (e) {
                      setCheckKeyResult({ status: 'error', revoked: false });
                    } finally {
                      setIsCheckingKey(false);
                    }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                    background: 'var(--primary-cyan)', color: '#000', border: 'none', fontWeight: 600,
                    opacity: !checkKeyInput.trim() || isCheckingKey ? 0.5 : 1
                  }}
                >
                  {isCheckingKey ? '…' : 'Check'}
                </button>
              </div>
              {checkKeyResult && (
                <div style={{
                  marginTop: '8px', padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                  background: checkKeyResult.revoked ? 'rgba(255,68,68,0.1)' : checkKeyResult.status === 'error' ? 'rgba(255,170,0,0.1)' : 'rgba(0,255,136,0.1)',
                  border: `1px solid ${checkKeyResult.revoked ? '#ff4444' : checkKeyResult.status === 'error' ? '#ffaa00' : '#00ff88'}`,
                  color: checkKeyResult.revoked ? '#ff4444' : checkKeyResult.status === 'error' ? '#ffaa00' : '#00ff88'
                }}>
                  {checkKeyResult.status === 'error' ? '⚠️ Could not check key status' :
                    checkKeyResult.revoked ? '🔴 REVOKED — this key has been rotated out' :
                      '🟢 ACTIVE — this key is not in the revocation list'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Tips Card */}
        <div className="security-tips-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Security Tips</h3>
          <ul className="tips-list" style={{ color: 'var(--text-secondary)' }}>
            <li>Never share your recovery code with anyone</li>
            <li>Save your recovery file in a secure location</li>
            <li>Clear browser cache if using a shared device</li>
            <li>Your private key never leaves this device</li>
            <li>Losing your private key means losing permanent access</li>
          </ul>
        </div>
      </div>
    </div >
  );
}
