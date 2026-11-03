'use client';

import React, { useState } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/InstancePage.css';
import { setApiBase } from '@/lib/api';

const SERVERS = [
 {id:1,name:'splitter-1',category:'Primary Instance',users:null,federation:'Configurable',moderation:'Server policy',reputation:'unverified',description:'Primary Splitter community. Connect when selected.',region:'Cloud'},
 {id:2,name:'splitter-2',category:'Optional Peer',users:null,federation:'On demand',moderation:'Server policy',reputation:'unverified',description:'Configurable federation peer; may be offline.',region:'Cloud'}
].filter(server => server.name !== 'splitter-2' || !!process.env.NEXT_PUBLIC_INSTANCE_2_URL?.trim());
const REGIONS = ['All','Cloud'];
const MODERATION_LEVELS = ['All','Server policy'];

export default function InstancePage({ onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [customPeer,setCustomPeer] = useState('');
  const [peerError,setPeerError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedModeration, setSelectedModeration] = useState('All');

  const filteredServers = SERVERS.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRegion = selectedRegion === 'All' || server.region === selectedRegion;
    const matchesModeration = selectedModeration === 'All' || server.moderation === selectedModeration;

    return matchesSearch && matchesRegion && matchesModeration && (selectedFilter !== 'trusted' || server.reputation === 'trusted');
  });

  return (
    <div className="instance-container">
      {/* Header */}
      <div className="instance-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button
            className="instance-back-btn"
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
        <h1 className="instance-title">🧭 Join a Federated Server</h1>
        <p className="instance-subtitle">
          Choose a server community aligned with your values and interests
        </p>
      </div>

      {/* Search & Filter */}
      <div className="instance-controls">
        <div className="instance-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search servers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="instance-filters">
          <div className="filter-group">
            <label className="filter-label">Region:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="filter-select"
            >
              {REGIONS.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Moderation:</label>
            <select
              value={selectedModeration}
              onChange={(e) => setSelectedModeration(e.target.value)}
              className="filter-select"
            >
              {MODERATION_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <button
            className="filter-chip" onClick={() => setSelectedFilter(selectedFilter === 'trusted' ? 'all' : 'trusted')}
            title="Only show peers with verified reputation metadata"
          >
            {selectedFilter === 'trusted' ? 'Show all peers' : 'Verified peers'}
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
      </div>

      <form className="instance-controls" onSubmit={e => {e.preventDefault();try {setApiBase(customPeer);onNavigate('signup');}catch(err){setPeerError(err.message);}}}>
        <label>Custom peer URL <input required type="url" placeholder="https://your-instance.example" value={customPeer} onChange={e => setCustomPeer(e.target.value)} /></label>
        <button className="instance-card-btn" type="submit">Connect to custom peer</button>
        {peerError && <p role="alert">{peerError}</p>}
      </form>
      {/* Servers Grid */}
      <div className="instance-grid">
        {filteredServers.map(server => (
          <div
            key={server.id}
            className={`instance-card ${server.blocked ? 'blocked' : ''}`}
          >
            <div className="instance-card-header">
              <h3 className="instance-card-name">
                {server.name}
                {server.blocked && ' 🛑'}
              </h3>
              <span 
                className="instance-card-federation"
                title={server.federation === 'Open' ? 'This server accepts federation connections from other instances' : 'This server does not accept federation connections'}
                style={{ cursor: 'help' }}
              >
                {server.federation === 'Open' ? '🌐' : '🛑'} {server.federation}
              </span>
            </div>

            <p className="instance-card-category">{server.category}</p>
            <p className="instance-card-description">{server.description}</p>

            <div className="instance-card-stats">
              <div className="stat">
                <span className="stat-label">Users</span>
                <span className="stat-value">{server.users == null ? 'Not queried' : server.users.toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Region</span>
                <span className="stat-value">{server.region}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Moderation</span>
                <span 
                  className="stat-value" 
                  title={
                    server.moderation === 'Strict' ? 'Strict moderation: Proactive content review and enforcement' :
                    server.moderation === 'Moderate' ? 'Moderate moderation: Balanced approach to content policy' :
                    'Lenient moderation: Minimal intervention, community-driven'
                  }
                  style={{ cursor: 'help' }}
                >
                  {server.moderation}
                </span>
              </div>
            </div>

            {server.reputation === 'trusted' && (
              <div className="reputation-badge">
                <span title="This instance has been verified and is trusted by the network administrators" style={{ cursor: 'help' }}>🟢 Trusted Network</span>
              </div>
            )}

            {server.blocked && (
              <div className="blocked-badge">
                <span>⚠️ Blocked by Admin</span>
              </div>
            )}

            <button
              className={`instance-card-btn ${server.blocked ? 'blocked-btn' : ''}`}
              onClick={() => {if (!server.blocked) {setApiBase(server.name);onNavigate('signup');}}}
              disabled={server.blocked}
            >
              {server.blocked ? 'Blocked' : 'Join Server'}
            </button>
          </div>
        ))}
      </div>

      {filteredServers.length === 0 && (
        <div className="instance-empty">
          <p>No servers found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
