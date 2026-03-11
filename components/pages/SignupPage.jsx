'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/SignupPage.css';
import { authApi, setApiBase } from '@/lib/api';
import { generateKeyPair, storeKeyPair, exportRecoveryFile } from '@/lib/crypto';
import WalkthroughTooltip from '@/components/ui/WalkthroughTooltip';

// Real Splitter server instances
const SERVERS = [
  {
    id: 1,
    name: 'splitter-1',
    category: 'Primary Instance',
    users: 0,
    federation: 'Open',
    moderation: 'Moderate',
    reputation: 'trusted',
    description: 'Primary Splitter instance — your main server',
    region: 'Cloud',
    location: 'splitter-m0kv.onrender.com',
    uptime: '100%',
    ping: '~1s'
  },
  {
    id: 2,
    name: 'splitter-2',
    category: 'Federation Instance',
    users: 0,
    federation: 'Open',
    moderation: 'Moderate',
    reputation: 'trusted',
    description: 'Second Splitter instance for federation — separate database',
    region: 'Cloud',
    location: 'splitter-2.onrender.com',
    uptime: '100%',
    ping: '~1s'
  }
];

const REGIONS = ['All', 'Cloud'];
const SERVER_DISCOVERY_URLS = {
  'splitter-1': 'https://splitter-m0kv.onrender.com/api/v1/federation/public-users?limit=1',
  'splitter-2': 'https://splitter-2.onrender.com/api/v1/federation/public-users?limit=1'
};

export default function SignupPage({ onNavigate, updateUserData, setIsAuthenticated }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    server: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    bio: '',
    avatar: '👤'
  });
  const [keyPair, setKeyPair] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [servers, setServers] = useState(SERVERS);
  const [isRefreshingServers, setIsRefreshingServers] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadServerCounts = async () => {
      setIsRefreshingServers(true);
      try {
        const updated = await Promise.all(
          SERVERS.map(async (server) => {
            const endpoint = SERVER_DISCOVERY_URLS[server.name];
            if (!endpoint) return server;

            try {
              const response = await fetch(endpoint);
              if (!response.ok) {
                return server;
              }
              const data = await response.json();
              const userCount = Number(data?.total);
              return {
                ...server,
                users: Number.isFinite(userCount) ? userCount : server.users
              };
            } catch {
              return server;
            }
          })
        );

        if (isMounted) {
          setServers(updated);
        }
      } finally {
        if (isMounted) {
          setIsRefreshingServers(false);
        }
      }
    };

    loadServerCounts();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter servers based on search and region
  const filteredServers = servers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = selectedRegion === 'All' || server.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Check password strength
    if (name === 'password') {
      let strength = 0;
      if (value.length >= 8) strength++;
      if (/[A-Z]/.test(value)) strength++;
      if (/[a-z]/.test(value)) strength++;
      if (/[0-9]/.test(value)) strength++;
      if (/[^A-Za-z0-9]/.test(value)) strength++;
      setPasswordStrength(strength);
    }
  };

  const handleServerChange = (e) => {
    const serverName = e.target.value;
    setFormData({ ...formData, server: serverName });
    setApiBase(serverName); // Switch API to this instance
  };

  const handleGenerateDID = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newKeyPair = await generateKeyPair();
      setKeyPair(newKeyPair);
      // Store the key pair for this session
      await storeKeyPair(newKeyPair);
    } catch (err) {
      setError('Failed to generate cryptographic keys. Please try again.');
      console.error('Key generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadRecovery = async () => {
    if (!keyPair || !formData.username) return;

    try {
      const passphrase = window.prompt('Optional: Set a recovery file passphrase (min 8 chars). Leave blank for unencrypted export.');
      const normalizedPassphrase = passphrase && passphrase.trim().length >= 8 ? passphrase.trim() : undefined;
      await exportRecoveryFile(keyPair, formData.username, formData.server, normalizedPassphrase);
    } catch (err) {
      setError('Failed to create recovery file');
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return '#ff4444';
    if (passwordStrength <= 2) return '#ffaa00';
    if (passwordStrength <= 3) return '#ffff00';
    return '#00ff00';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 2) return 'Fair';
    if (passwordStrength <= 3) return 'Good';
    return 'Strong';
  };

  const validateStep2 = () => {
    if (!formData.username || formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const nextStep = async () => {
    setError(null);
    if (step === 2 && !validateStep2()) {
      return;
    }

    // Auto-generate encryption keys when moving to step 3 if they don't exist
    // This ensures ALL users have E2E encryption keys
    if (step === 2 && !keyPair) {
      setIsLoading(true);
      try {
        const newKeyPair = await generateKeyPair();
        setKeyPair(newKeyPair);
        await storeKeyPair(newKeyPair);
        console.log('✅ Auto-generated encryption keys for E2E messaging');
      } catch (err) {
        console.error('Failed to auto-generate keys:', err);
        setError('Failed to generate encryption keys. Please try again.');
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    setStep(step + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep(step - 1);
  };

  const submitSignup = async () => {
    const normalizedUsername = (formData.username || '').trim();
    const normalizedEmail = (formData.email || '').trim();
    const normalizedDisplayName = (formData.displayName || '').trim();

    if (!normalizedUsername || normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      setError('Username must be between 3 and 50 characters');
      return;
    }

    if (!formData.displayName) {
      setError('Please enter a display name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Register with backend - include DID if generated, otherwise backend auto-generates
      const registrationData = {
        username: normalizedUsername,
        email: normalizedEmail,
        password: formData.password,
        display_name: normalizedDisplayName,
        bio: (formData.bio || '').trim(),
        instance_domain: formData.server
      };

      // Always include encryption keys (auto-generated if user didn't manually generate DID)
      // This ensures E2E encryption works for ALL new users
      if (keyPair) {
        registrationData.did = keyPair.did;
        registrationData.public_key = keyPair.publicKeyBase64;
        registrationData.encryption_public_key = keyPair.encryptionPublicKeyBase64;
      } else {
        // This should never happen now due to auto-generation, but handle gracefully
        console.warn('⚠️ No keyPair found during signup - this should not happen!');
        setError('Encryption keys missing. Please refresh and try again.');
        setIsLoading(false);
        return;
      }

      const result = await authApi.register(registrationData, avatarFile || undefined);
      console.log('Registration successful:', result);

      // Move to success step
      setStep(5);

      // Redirect to login after success
      setTimeout(() => {
        onNavigate('login');
      }, 2000);

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-box">
        <div className="signup-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button
              className="signup-back-btn"
              onClick={() => onNavigate('landing')}
            >
              ← Back
            </button>
            <button
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                padding: '8px 12px',
                background: isDarkMode ? 'rgba(0, 217, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)',
                border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`,
                color: isDarkMode ? '#00d9ff' : '#333',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {isDarkMode ? '🌙' : '☀️'}
            </button>
          </div>
          <h1 className="signup-title">Create Your Identity</h1>
          <p className="signup-subtitle">Set up your decentralized account</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255, 68, 68, 0.1)',
            border: '1px solid #ff4444',
            color: '#ff4444',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Progress Bar */}
        <div className="signup-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
          <div className="progress-steps">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
            <div className={`step ${step >= 4 ? 'active' : ''}`}>4</div>
          </div>
        </div>

        {/* Step 1: Select Server */}
        {step === 1 && (
          <>
            {/* Walkthrough for Instance Selection */}
            <WalkthroughTooltip
              storageKey="signup-instance-walkthrough-v1"
              title="Choosing Your Server"
              message={`Servers (or instances) are like neighborhoods in Splitter. Each has its own vibe and moderation style, but you can still follow and chat with anyone on any server.

Pick based on:
• Location (lower ping = faster)
• Community type (tech, creative, academic)
• Moderation policy that matches your values

Don't worry - you can always move later.`}
              position="right"
            />

            <div className="signup-form">
              <h2 className="step-title">Select Your Server 🧭</h2>
              <p style={{ color: isDarkMode ? '#888' : '#555', marginBottom: '16px', fontSize: '14px' }}>
                Choose a Splitter server aligned with your interests and region
              </p>
              <p style={{ color: isDarkMode ? '#777' : '#666', marginBottom: '14px', fontSize: '12px' }}>
                {isRefreshingServers ? 'Syncing live instance user counts…' : 'User counts are live from each instance'}
              </p>

              {/* Search & Filter */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: isDarkMode ? '#666' : '#999' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search servers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      border: isDarkMode ? '1px solid #333' : '1px solid #ddd',
                      borderRadius: '8px',
                      color: isDarkMode ? '#fff' : '#333',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    border: isDarkMode ? '1px solid #333' : '1px solid #ddd',
                    borderRadius: '8px',
                    color: isDarkMode ? '#fff' : '#333',
                    fontSize: '14px',
                    minWidth: '150px'
                  }}
                >
                  {REGIONS.map(region => (
                    <option key={region} value={region} style={{ background: isDarkMode ? '#1a1a2e' : '#fff', color: isDarkMode ? '#fff' : '#333' }}>{region}</option>
                  ))}
                </select>
              </div>

              {/* Server Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {filteredServers.map(server => (
                  <div
                    key={server.id}
                    onClick={() => { setFormData({ ...formData, server: server.name }); setApiBase(server.name); }}
                    style={{
                      background: formData.server === server.name
                        ? 'linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(0, 255, 136, 0.1))'
                        : isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: formData.server === server.name
                        ? '2px solid #00d9ff'
                        : isDarkMode ? '1px solid #333' : '1px solid #ddd',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Selected indicator */}
                    {formData.server === server.name && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '24px',
                        height: '24px',
                        background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                      }}>✓</div>
                    )}

                    {/* Server Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>
                        {server.reputation === 'trusted' ? '🟢' : server.reputation === 'dev' ? '🔧' : '🟡'}
                      </span>
                      <h3 style={{ margin: 0, color: isDarkMode ? '#fff' : '#000', fontSize: '16px', fontWeight: '600' }}>
                        {server.name}
                      </h3>
                    </div>

                    {/* Location */}
                    <div style={{ color: '#00d9ff', fontSize: '13px', marginBottom: '8px' }}>
                      {server.location}
                    </div>

                    {/* Category Badge */}
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      background: 'rgba(0, 217, 255, 0.1)',
                      border: '1px solid rgba(0, 217, 255, 0.3)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#00d9ff',
                      marginBottom: '8px'
                    }}>
                      {server.category}
                    </div>

                    {/* Description */}
                    <p style={{ color: isDarkMode ? '#888' : '#555', fontSize: '12px', margin: '8px 0', lineHeight: '1.4' }}>
                      {server.description}
                    </p>

                    {/* Stats */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: isDarkMode ? '1px solid #333' : '1px solid #e0e0e0'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: isDarkMode ? '#666' : '#999', fontSize: '10px', textTransform: 'uppercase' }}>Users</div>
                        <div style={{ color: isDarkMode ? '#fff' : '#000', fontSize: '14px', fontWeight: '600' }}>
                          {server.users.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: isDarkMode ? '#666' : '#999', fontSize: '10px', textTransform: 'uppercase' }}>Uptime</div>
                        <div style={{ color: '#00ff88', fontSize: '14px', fontWeight: '600' }}>
                          {server.uptime}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: isDarkMode ? '#666' : '#999', fontSize: '10px', textTransform: 'uppercase' }}>Ping</div>
                        <div style={{ color: '#00d9ff', fontSize: '14px', fontWeight: '600' }}>
                          {server.ping}
                        </div>
                      </div>
                    </div>

                    {/* Moderation Badge */}
                    <div style={{
                      marginTop: '12px',
                      padding: '6px 10px',
                      background: server.moderation === 'Strict' ? 'rgba(255, 68, 68, 0.1)' :
                        server.moderation === 'Moderate' ? 'rgba(255, 170, 0, 0.1)' :
                          'rgba(0, 255, 136, 0.1)',
                      border: `1px solid ${server.moderation === 'Strict' ? 'rgba(255, 68, 68, 0.3)' :
                        server.moderation === 'Moderate' ? 'rgba(255, 170, 0, 0.3)' :
                          'rgba(0, 255, 136, 0.3)'}`,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: server.moderation === 'Strict' ? '#ff4444' :
                        server.moderation === 'Moderate' ? '#ffaa00' : '#00ff88',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>{server.moderation === 'Strict' ? '🛡️' : server.moderation === 'Moderate' ? '⚖️' : '🌿'}</span>
                      {server.moderation} Moderation • {server.federation} Network
                    </div>
                  </div>
                ))}
              </div>

              {filteredServers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: isDarkMode ? '#666' : '#999' }}>
                  <p>No servers found matching your criteria</p>
                </div>
              )}

              <div className="form-buttons" style={{ marginTop: '20px' }}>
                <button
                  className={`btn-primary ${!formData.server ? 'disabled' : ''}`}
                  onClick={nextStep}
                  disabled={!formData.server}
                  style={{
                    background: formData.server ? 'linear-gradient(135deg, #00d9ff, #00ff88)' : '#333',
                    color: formData.server ? '#000' : '#666'
                  }}
                >
                  Continue with {formData.server || 'selected server'} →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Account Credentials */}
        {step === 2 && (
          <>
            {/* Walkthrough for Password */}
            <WalkthroughTooltip
              storageKey="signup-password-walkthrough-v1"
              title="Secure Your Account"
              message={`Your password is the primary way to access your account. Choose a strong password that:

• Is at least 8 characters long
• Combines uppercase and lowercase letters
• Includes numbers and special characters
• Is unique to this account

Your password is encrypted and stored securely. We never see or store your plain text password.`}
              position="right"
            />

            <div className="signup-form">
              <h2 className="step-title">Account Credentials 🔑</h2>

              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="your_username"
                  className="form-input"
                  autoComplete="username"
                />
                <small>This will be your public handle (letters, numbers, underscores)</small>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="form-input"
                  autoComplete="email"
                />
                <small>For account recovery and notifications</small>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="form-input"
                  autoComplete="new-password"
                />
                {formData.password && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      height: '4px',
                      background: isDarkMode ? '#333' : '#e0e0e0',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(passwordStrength / 5) * 100}%`,
                        height: '100%',
                        background: getPasswordStrengthColor(),
                        transition: 'all 0.3s'
                      }} />
                    </div>
                    <small style={{ color: getPasswordStrengthColor() }}>
                      Password strength: {getPasswordStrengthText()}
                    </small>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password:</label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="form-input"
                  autoComplete="new-password"
                />
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <small style={{ color: '#ff4444' }}>Passwords do not match</small>
                )}
                {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password && (
                  <small style={{ color: '#00ff00' }}>✓ Passwords match</small>
                )}
              </div>

              <div className="form-buttons">
                <button
                  className="btn-secondary"
                  onClick={prevStep}
                >
                  ← Back
                </button>
                <button
                  className="btn-primary"
                  onClick={nextStep}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Generate DID (Optional) */}
        {step === 3 && (
          <>
            {/* Walkthrough for DID */}
            <WalkthroughTooltip
              storageKey="signup-did-walkthrough-v1"
              title="Decentralized Identity"
              message={`A DID (Decentralized Identity) is a cryptographic key pair that provides advanced security benefits:

What it is:
• A unique identifier that you own and control
• Uses public-key cryptography for authentication
• Cannot be revoked or taken away by any server

How it helps:
• Stronger security than passwords alone
• Prove your identity across different servers
• Sign posts cryptographically to prevent tampering
• Move between servers while keeping your identity

This is optional - you can always add it later. If you generate it now, download the recovery file to keep it safe.`}
              position="right"
            />

            <div className="signup-form">
              <h2 className="step-title">Decentralized Identity</h2>
              <div className="security-banner" style={{
                background: 'rgba(0, 217, 255, 0.1)',
                border: '1px solid #00d9ff',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <span>ℹ️</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                  Generate a DID for enhanced security with cryptographic authentication.
                  This is <strong>optional</strong> - you can still use password login.
                </p>
              </div>

              {!keyPair ? (
                <div className="form-group">
                  <p className="form-description">
                    Your decentralized identifier (DID) will be generated using WebCrypto and stored securely on your device.
                  </p>
                  <button
                    className="btn-generate"
                    onClick={handleGenerateDID}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#000',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px'
                    }}
                  >
                    {isLoading ? 'Generating...' : '🔑 Generate Decentralized Identity'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={nextStep}
                    style={{ width: '100%' }}
                  >
                    Skip - Use Password Only →
                  </button>
                </div>
              ) : (
                <div className="did-display">
                  <div className="did-section" style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#00d9ff', fontWeight: '600' }}>✅ Your DID (Public):</label>
                    <div className="did-box" style={{
                      background: 'rgba(0, 255, 136, 0.1)',
                      border: '1px solid #00ff88',
                      borderRadius: '8px',
                      padding: '12px',
                      marginTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>{keyPair.did}</code>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(keyPair.did)}
                        style={{
                          background: 'none',
                          border: '1px solid #00ff88',
                          color: '#00ff88',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginLeft: '8px'
                        }}
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>

                  <div className="did-section" style={{ marginBottom: '16px' }}>
                    <label style={{ color: isDarkMode ? '#888' : '#555' }}>Private Key:</label>
                    <div className="did-box locked" style={{
                      background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '12px',
                      marginTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <code>••••••••••••••••••••••••••••••••</code>
                      <span className="lock-icon">🔒 Stored Securely</span>
                    </div>
                  </div>

                  <div className="security-banner" style={{
                    background: 'rgba(255, 170, 0, 0.1)',
                    border: '1px solid #ffaa00',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px'
                  }}>
                    <span>⚠️</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                      Download your recovery file! If you lose this device, you'll need it to recover your DID.
                    </p>
                  </div>

                  <button
                    className="btn-recovery"
                    onClick={handleDownloadRecovery}
                    disabled={!formData.username}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255, 170, 0, 0.2)',
                      border: '1px solid #ffaa00',
                      borderRadius: '8px',
                      color: '#ffaa00',
                      fontWeight: '600',
                      cursor: formData.username ? 'pointer' : 'not-allowed',
                      marginBottom: '16px'
                    }}
                  >
                    💾 Download Recovery File
                  </button>
                </div>
              )}

              <div className="form-buttons">
                <button
                  className="btn-secondary"
                  onClick={prevStep}
                >
                  ← Back
                </button>
                {keyPair && (
                  <button
                    className="btn-primary"
                    onClick={nextStep}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Step 4: Profile Setup */}
        {step === 4 && (
          <div className="signup-form">
            <h2 className="step-title">Complete Your Profile</h2>
            <div className="form-group">
              <label htmlFor="displayName">Display Name:</label>
              <input
                id="displayName"
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                placeholder="Your Full Name"
                className="form-input"
              />
              <small>This is how others will see you</small>
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio (Optional):</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell us about yourself..."
                className="form-textarea"
                rows="4"
              />
            </div>

            <div className="form-group">
              <label htmlFor="avatar">Profile Photo (Optional):</label>
              <input
                id="avatar"
                type="file"
                accept="image/png, image/jpeg, image/gif"
                className="form-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    setError('Avatar image must be 5MB or smaller');
                    return;
                  }
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
              {avatarPreview && (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', marginTop: '8px' }}
                />
              )}
            </div>

            <div className="account-summary" style={{
              background: 'rgba(0, 217, 255, 0.1)',
              border: '1px solid #00d9ff',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#00d9ff' }}>Account Summary</h4>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Server:</strong> {formData.server}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Username:</strong> @{formData.username}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Email:</strong> {formData.email}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>DID:</strong> {keyPair ? '✅ Generated' : '⏭️ Auto-generated on server'}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Auth:</strong> Password {keyPair ? '+ DID Challenge' : 'only'}
              </p>
            </div>

            <div className="form-group">
              <label>Default Post Visibility:</label>
              <div className="visibility-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <label className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="visibility" defaultChecked />
                  <span>Public 🌐</span>
                </label>
                <label className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="visibility" />
                  <span>Followers Only 👥</span>
                </label>
                <label className="radio-option disabled" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                  <input type="radio" name="visibility" disabled />
                  <span>Custom Circle 🟡 (Coming Soon)</span>
                </label>
              </div>
            </div>

            <div className="form-buttons">
              <button
                className="btn-secondary"
                onClick={prevStep}
              >
                ← Back
              </button>
              <button
                className={`btn-primary ${!formData.displayName || isLoading ? 'disabled' : ''}`}
                onClick={submitSignup}
                disabled={!formData.displayName || isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Create Account ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="signup-form">
            <div className="signing-complete" style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="success-icon" style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '40px'
              }}>✓</div>
              <h3 style={{ color: '#00d9ff', marginBottom: '8px' }}>Account Created!</h3>
              <p style={{ color: isDarkMode ? '#888' : '#555' }}>Welcome to Splitter, @{formData.username}</p>
              <p style={{ color: isDarkMode ? '#666' : '#999', marginTop: '8px', fontSize: '14px' }}>
                Server: {formData.server}
              </p>
              <p style={{ color: isDarkMode ? '#666' : '#999', marginTop: '16px' }}>Redirecting to login...</p>
            </div>
          </div>
        )}

        {/* Link to login */}
        {step < 5 && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#00d9ff',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
