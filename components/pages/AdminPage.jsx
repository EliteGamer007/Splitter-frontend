'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/HomePage.css';
import { adminApi, postApi, searchApi } from '@/lib/api';

export default function AdminPage({ onNavigate, userData, handleLogout }) {
  /* ================= THEME (from your branch) ================= */
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  /* ================= STATE (from main branch – unchanged) ================= */
  const [activeTab, setActiveTab] = useState('home');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [moderationRequests, setModerationRequests] = useState([]);
  const [suspendedUsers, setSuspendedUsers] = useState([]);
  const [adminActions, setAdminActions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [showBanModal, setShowBanModal] = useState(false);
  
  // Federation state
  const [blockedDomains, setBlockedDomains] = useState([]);
  const [federationActivities, setFederationActivities] = useState([]);
  const [trafficMetrics, setTrafficMetrics] = useState({
    totalInbound: 0,
    totalOutbound: 0,
    successRate: 0,
    avgLatency: 0,
    activeDomains: 0
  });
  const [federationLoading, setFederationLoading] = useState(false);
  const [newBlockDomain, setNewBlockDomain] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const USERS_PAGE_SIZE = 10;

  /* ================= ACCESS CHECK ================= */
  if (userData?.role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h2>⛔ Access Denied</h2>
      </div>
    );
  }

  /* ================= EFFECTS ================= */
  useEffect(() => {
    loadTabData();
  }, [activeTab, page]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const delaySearch = setTimeout(() => {
        handleSearchUsers();
      }, 300); // Debounce search
      return () => clearTimeout(delaySearch);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSearchResults && !e.target.closest('.nav-search') && !e.target.closest('input')) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSearchResults]);

  /* ================= DATA LOADERS ================= */

  const loadTabData = async () => {
    setIsLoading(true);
    try {
      // Load stats for all tabs (sidebar always visible)
      fetchModerationRequests();
      fetchSuspendedUsers();
      if (activeTab !== 'users') {
        fetchUserCount(); // Get total user count for sidebar
      }
      if (activeTab === 'home') fetchPosts();
      if (activeTab === 'requests') {
        // Already loaded above
      }
      if (activeTab === 'bans') {
        fetchAdminActions();
      }
      if (activeTab === 'users') fetchAllUsers();
      if (activeTab === 'federation') fetchFederationData();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFederationData = async () => {
    setFederationLoading(true);
    try {
      const [inspector, blocked] = await Promise.all([
        adminApi.getFederationInspector(),
        adminApi.getBlockedDomains(),
      ]);

      const incoming = inspector?.recent_incoming || [];
      const outgoing = inspector?.recent_outgoing || [];
      const merged = [
        ...incoming.map((item, index) => ({
          id: `in-${index}`,
          type: 'inbox',
          domain: item.actor_uri || 'unknown',
          activity_type: item.type || 'unknown',
          status: item.status || 'received',
          timestamp: item.time,
        })),
        ...outgoing.map((item, index) => ({
          id: `out-${index}`,
          type: 'outbox',
          domain: item.target_inbox || 'unknown',
          activity_type: item.type || 'unknown',
          status: item.status || 'pending',
          timestamp: item.time,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const sigRateRaw = String(inspector?.metrics?.signature_validation || '0').replace('%', '');
      const sigRate = Number.parseFloat(sigRateRaw) || 0;

      setFederationActivities(merged.slice(0, 50));
      setBlockedDomains(blocked?.domains || []);
      setTrafficMetrics({
        totalInbound: incoming.length,
        totalOutbound: outgoing.length,
        successRate: sigRate,
        avgLatency: 0,
        activeDomains: (inspector?.servers || []).length,
      });
    } catch (error) {
      console.error('Failed to fetch federation data:', error);
    } finally {
      setFederationLoading(false);
    }
  };

  const fetchPosts = async () => {
    const feedPosts = await postApi.getPublicFeed(40, 0, false);
    // Deduplicate: same post may appear as local + cached-remote copy
    const seen = new Set();
    const unique = (feedPosts || []).filter(p => {
      const key = p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      // Also dedup by content+author fingerprint for cross-server copies
      const fp = `${(p.content || '').slice(0, 80)}|${p.author_username || p.author_did || ''}`;
      if (seen.has(fp)) return false;
      seen.add(fp);
      return true;
    });
    setPosts(unique);
  };

  const fetchModerationRequests = async () => {
    const result = await adminApi.getModerationRequests();
    setModerationRequests(result.requests || []);
  };

  const fetchSuspendedUsers = async () => {
    const result = await adminApi.getSuspendedUsers(100, 0);
    setSuspendedUsers(result.users || []);
  };

  const fetchAdminActions = async () => {
    const result = await adminApi.getAdminActions();
    setAdminActions(result.actions || []);
  };

  const fetchAllUsers = async () => {
    const result = await adminApi.getAllUsers(USERS_PAGE_SIZE, page * USERS_PAGE_SIZE);
    setUsers(result.users || []);
    setTotalUsers(result.total || 0);
  };

  const fetchUserCount = async () => {
    try {
      const result = await adminApi.getAllUsers(1, 0); // Just fetch 1 user to get total count
      setTotalUsers(result.total || 0);
    } catch (error) {
      console.error('Failed to fetch user count:', error);
    }
  };

  const handleSearchUsers = async () => {
    if (searchQuery.length < 2) return;
    setIsSearching(true);
    try {
      const result = await searchApi.searchUsers(searchQuery, 10, 0);
      setSearchResults(result.users || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  /* ================= HANDLERS ================= */

  const handleDeletePost = async (postId) => {
    await postApi.deletePost(postId);
    setPosts(posts.filter(p => p.id !== postId));
  };

  const handleApproveModeration = async (userId) => {
    setActionLoading(userId);
    try {
      await adminApi.approveModerationRequest(userId);
      setModerationRequests(moderationRequests.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Failed to approve moderation:', error);
      alert('Failed to approve moderation request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectModeration = async (userId) => {
    setActionLoading(userId);
    try {
      await adminApi.rejectModerationRequest(userId);
      setModerationRequests(moderationRequests.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Failed to reject moderation:', error);
      alert('Failed to reject moderation request');
    } finally {
      setActionLoading(null);
    }
  };

  const openBanModal = (user) => {
    setBanTarget(user);
    setShowBanModal(true);
  };

  const handleSuspendUser = async () => {
    if (!banTarget) return;
    setActionLoading(banTarget.id);
    try {
      if (banReason.trim()) {
        await adminApi.suspendUserWithReason(banTarget.id, banReason);
      } else {
        await adminApi.suspendUser(banTarget.id);
      }
      
      // Update lists
      setUsers(users.map(u => u.id === banTarget.id ? { ...u, is_suspended: true } : u));
      setSuspendedUsers([...suspendedUsers, { ...banTarget, is_suspended: true }]);
      if (searchResults.length > 0) {
        setSearchResults(searchResults.map(u => u.id === banTarget.id ? { ...u, is_suspended: true } : u));
      }
      
      // Close modal
      setShowBanModal(false);
      setBanTarget(null);
      setBanReason('');
      
      // Refresh admin actions
      fetchAdminActions();
    } catch (error) {
      console.error('Failed to suspend user:', error);
      alert('Failed to suspend user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspendUser = async (userId, username) => {
    if (!confirm(`Unsuspend @${username}?`)) return;
    setActionLoading(userId);
    try {
      await adminApi.unsuspendUser(userId);
      
      // Update lists
      setUsers(users.map(u => u.id === userId ? { ...u, is_suspended: false } : u));
      setSuspendedUsers(suspendedUsers.filter(u => u.id !== userId));
      if (searchResults.length > 0) {
        setSearchResults(searchResults.map(u => u.id === userId ? { ...u, is_suspended: false } : u));
      }
      
      // Refresh admin actions
      fetchAdminActions();
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
      alert('Failed to unsuspend user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      await adminApi.updateUserRole(userId, newRole);
      
      // Update lists
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (searchResults.length > 0) {
        setSearchResults(searchResults.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso);
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return new Date(iso).toLocaleDateString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /* ================= UI (UNCHANGED FROM MAIN) ================= */

  return (
    <div className="home-container">

      {/* ================= NAVBAR ================= */}
      <nav className="home-nav">

        <div className="nav-left">
          <h1 className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{
                height: '66px',
                width: 'auto',
                objectFit: 'contain',
                filter: isDarkMode ? 'invert(1) hue-rotate(180deg)' : 'none'
              }}
            />
            SPLITTER
          </h1>
        </div>

        <div className="nav-center">
          <button 
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Feed
          </button>
          <button 
            className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
            style={{ position: 'relative' }}
          >
            Requests
            {moderationRequests.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#ff4444',
                color: '#fff',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {moderationRequests.length}
              </span>
            )}
          </button>
          <button 
            className={`nav-item ${activeTab === 'bans' ? 'active' : ''}`}
            onClick={() => setActiveTab('bans')}
          >
            Bans
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={`nav-item ${activeTab === 'federation' ? 'active' : ''}`}
            onClick={() => setActiveTab('federation')}
          >
            Federation
          </button>
        </div>

        <div className="nav-right">
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
              className="nav-search"
              style={{ 
                minWidth: showSearchResults ? '400px' : '300px',
                width: showSearchResults ? '450px' : '300px',
                transition: 'all 0.3s ease'
              }}
            />
            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}>
                {isSearching ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                    No users found
                  </div>
                ) : (
                  searchResults.map(user => (
                    <div 
                      key={user.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}>
                        {user.avatar_url || '👤'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: '600' }}>
                          {user.display_name || user.username}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          @{user.username} · {user.role}
                          {user.is_suspended && <span style={{ color: '#ff4444', marginLeft: '8px' }}>Suspended</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!user.is_suspended ? (
                          <button
                            onClick={() => {
                              setShowSearchResults(false);
                              openBanModal(user);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'rgba(255,68,68,0.2)',
                              border: '1px solid #ff4444',
                              color: '#ff4444',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Ban
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setShowSearchResults(false);
                              handleUnsuspendUser(user.id, user.username);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'rgba(0,255,136,0.2)',
                              border: '1px solid #00ff88',
                              color: '#00ff88',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Unban
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="nav-btn-profile"
            onClick={() => onNavigate('home')}
            title="Exit Dashboard"
            style={{
              marginLeft: '10px',
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
            Exit Dashboard
          </button>
          <button
            className="nav-btn-profile"
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              marginLeft: '10px',
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
          {handleLogout && (
            <button
              className="nav-btn-profile"
              onClick={handleLogout}
              title="Logout"
              style={{
                marginLeft: '10px',
                padding: '8px 12px',
                background: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid #ff4444',
                color: '#ff4444',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" height="16" width="16">
                <path d="M1.728 8c0 0.20793333333333333 0.08259999999999999 0.4074 0.22959999999999997 0.5544 0.14706666666666665 0.147 0.3464666666666667 0.22959999999999997 0.5544 0.22959999999999997h5.9505333333333335L6.6593333333333335 10.579333333333333c-0.07339999999999999 0.07293333333333332 -0.1317333333333333 0.15966666666666665 -0.1716 0.2551333333333333 -0.0398 0.09559999999999999 -0.06026666666666666 0.19806666666666664 -0.06026666666666666 0.3015333333333333s0.020466666666666668 0.20593333333333333 0.06026666666666666 0.3015333333333333c0.03986666666666666 0.09546666666666666 0.09819999999999998 0.18219999999999997 0.1716 0.2551333333333333 0.07293333333333332 0.07346666666666667 0.15966666666666665 0.13179999999999997 0.2551333333333333 0.1716 0.09559999999999999 0.0398 0.19806666666666664 0.06026666666666666 0.3015333333333333 0.06026666666666666s0.20593333333333333 -0.020466666666666668 0.3015333333333333 -0.06026666666666666c0.09546666666666666 -0.0398 0.18219999999999997 -0.09813333333333332 0.2551333333333333 -0.1716l3.1359999999999997 -3.1359999999999997c0.07133333333333333 -0.0746 0.12726666666666664 -0.16246666666666665 0.1646 -0.2587333333333333 0.0784 -0.19093333333333332 0.0784 -0.40493333333333337 0 -0.5958666666666667 -0.03733333333333333 -0.09626666666666667 -0.09326666666666666 -0.18413333333333332 -0.1646 -0.2587333333333333l-3.1359999999999997 -3.1359999999999997c-0.07306666666666667 -0.07306666666666667 -0.15986666666666666 -0.13106666666666666 -0.2554666666666666 -0.1706 -0.09546666666666666 -0.039599999999999996 -0.1978 -0.059933333333333325 -0.30119999999999997 -0.059933333333333325 -0.10339999999999999 0 -0.20573333333333332 0.02033333333333333 -0.30119999999999997 0.059933333333333325 -0.09559999999999999 0.03953333333333333 -0.1824 0.09753333333333333 -0.2554666666666666 0.1706 -0.07306666666666667 0.07313333333333333 -0.13106666666666666 0.15993333333333332 -0.17066666666666666 0.25539999999999996 -0.039466666666666664 0.09553333333333333 -0.059866666666666665 0.19786666666666666 -0.059866666666666665 0.3012666666666667 0 0.10339999999999999 0.020399999999999998 0.20573333333333332 0.059866666666666665 0.3012666666666667 0.039599999999999996 0.09546666666666666 0.09759999999999999 0.18226666666666663 0.17066666666666666 0.25539999999999996l1.8032 1.7953333333333332H2.5119999999999996c-0.20793333333333333 0 -0.4073333333333333 0.08266666666666667 -0.5544 0.22966666666666663 -0.147 0.147 -0.22959999999999997 0.34639999999999993 -0.22959999999999997 0.5543333333333333ZM11.919999999999998 0.15999999999999998H4.08c-0.6237999999999999 0 -1.222 0.24779999999999996 -1.6631333333333331 0.6888666666666667 -0.4410666666666666 0.44113333333333327 -0.6888666666666667 1.0393333333333332 -0.6888666666666667 1.6631333333333331v2.352c0 0.20793333333333333 0.08259999999999999 0.4073333333333333 0.22959999999999997 0.5544 0.14706666666666665 0.147 0.3464666666666667 0.22959999999999997 0.5544 0.22959999999999997s0.4073333333333333 -0.08259999999999999 0.5544 -0.22959999999999997c0.147 -0.14706666666666665 0.22959999999999997 -0.3464666666666667 0.22959999999999997 -0.5544V2.5119999999999996c0 -0.20793333333333333 0.08259999999999999 -0.4073333333333333 0.22959999999999997 -0.5544 0.14706666666666665 -0.147 0.3464666666666667 -0.22959999999999997 0.5544 -0.22959999999999997h7.84c0.20793333333333333 0 0.4074 0.08259999999999999 0.5544 0.22959999999999997 0.147 0.14706666666666665 0.22959999999999997 0.3464666666666667 0.22959999999999997 0.5544v10.975999999999999c0 0.20793333333333333 -0.08259999999999999 0.4073333333333333 -0.22959999999999997 0.5544s-0.3464666666666667 0.22959999999999997 -0.5544 0.22959999999999997H4.08c-0.20793333333333333 0 -0.4073333333333333 -0.08259999999999999 -0.5544 -0.22959999999999997 -0.147 -0.147 -0.22959999999999997 -0.3464666666666667 -0.22959999999999997 -0.5544v-2.352c0 -0.20793333333333333 -0.08259999999999999 -0.4073333333333333 -0.22959999999999997 -0.5543333333333333 -0.14706666666666665 -0.147 -0.3464666666666667 -0.22966666666666663 -0.5544 -0.22966666666666663s-0.4073333333333333 0.08266666666666667 -0.5544 0.22966666666666663c-0.147 0.147 -0.22959999999999997 0.34639999999999993 -0.22959999999999997 0.5543333333333333v2.352c0 0.6237333333333333 0.24779999999999996 1.222 0.6888666666666667 1.6631333333333331 0.44113333333333327 0.4410666666666666 1.0393333333333332 0.6888666666666667 1.6631333333333331 0.6888666666666667h7.84c0.6237333333333333 0 1.222 -0.24779999999999996 1.6631333333333331 -0.6888666666666667 0.4410666666666666 -0.44113333333333327 0.6888666666666667 -1.0393999999999999 0.6888666666666667 -1.6631333333333331V2.5119999999999996c0 -0.6237999999999999 -0.24779999999999996 -1.222 -0.6888666666666667 -1.6631333333333331C13.142 0.4078 12.543733333333332 0.15999999999999998 11.919999999999998 0.15999999999999998Z" fill="#ff4444" strokeWidth="0.6667"></path>
              </svg>
            </button>
          )}
        </div>
      </nav>

      {/* Main Layout */}
      <div style={{
        display: 'flex',
        gap: '0',
        background: 'var(--bg-primary)',
        minHeight: 'calc(100vh - 80px)',
        width: '100%'
      }}>
        {/* ================= MAIN CONTENT ================= */}
        <main style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flex: 1,
          padding: '24px 24px 24px 48px',
          minWidth: 0,
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: '0'
        }}>
        {/* TAB: Feed/Home */}
        {activeTab === 'home' && (
          <>
            <div className="feed-header">
              <h2>Feed Monitoring</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Recent public posts from all users
              </p>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading posts...</div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', border: '1px solid #333', borderRadius: '12px' }}>
                <p style={{ color: '#666' }}>No posts yet</p>
              </div>
            ) : (
              posts.map(post => (
                <article key={post.id} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '12px',
                  maxWidth: '100%'
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '16px'
                    }}>
                      {post.author_avatar || '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {post.author_display_name || post.author_username}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            @{post.author_username} · {formatDate(post.created_at)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(255,68,68,0.2)',
                            border: '1px solid #ff4444',
                            color: '#ff4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            flexShrink: 0,
                            marginLeft: '8px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                      <p style={{ margin: '0', lineHeight: '1.4', color: 'var(--text-primary)', fontSize: '13px', wordBreak: 'break-word' }}>
                        {post.content}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </>
        )}

          {/* TAB: Moderation Requests */}
          {activeTab === 'requests' && (
            <>
              <div className="feed-header">
                <h2 style={{ color: 'var(--text-primary)' }}>Moderation Requests</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Users requesting moderator privileges ({moderationRequests.length} pending)
                </p>
              </div>

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Loading requests...
                </div>
              ) : moderationRequests.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px'
                }}>
                  <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>No pending requests</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>All moderation requests have been processed.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {moderationRequests.map(user => (
                    <div
                      key={user.id}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid #333',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00d9ff, #00ff88)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px'
                        }}>
                          {user.avatar_url || '👤'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '18px' }}>
                            {user.display_name || user.username}
                          </div>
                          <div style={{ color: '#00d9ff' }}>@{user.username}</div>
                          <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                            Member since {formatDate(user.created_at)}
                          </div>
                          {user.bio && (
                            <div style={{ color: '#888', fontSize: '13px', marginTop: '8px', maxWidth: '400px' }}>
                              "{user.bio}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => handleApproveModeration(user.id)}
                          disabled={actionLoading === user.id}
                          style={{
                            padding: '12px 24px',
                            background: 'rgba(0,255,136,0.2)',
                            border: '1px solid #00ff88',
                            color: '#00ff88',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}
                        >
                          {actionLoading === user.id ? '...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectModeration(user.id)}
                          disabled={actionLoading === user.id}
                          style={{
                            padding: '12px 24px',
                            background: 'rgba(255,68,68,0.2)',
                            border: '1px solid #ff4444',
                            color: '#ff4444',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}
                        >
                          {actionLoading === user.id ? '...' : '✕ Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB: Bans */}
          {activeTab === 'bans' && (
            <>
              <div className="feed-header">
                <h2>Ban Management</h2>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  View suspended users and admin action history
                </p>
              </div>

              {/* Currently Suspended Users */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ marginBottom: '16px', color: '#ff4444' }}>
                  🔴 Currently Suspended ({suspendedUsers.length})
                </h3>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
                ) : suspendedUsers.length === 0 ? (
                  <div style={{
                    padding: '30px',
                    background: 'rgba(0,255,136,0.05)',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '32px' }}>✅</span>
                    <p style={{ color: '#00ff88', marginTop: '8px' }}>No users are currently suspended</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {suspendedUsers.map(user => (
                      <div
                        key={user.id}
                        style={{
                          background: 'rgba(255,68,68,0.05)',
                          border: '1px solid rgba(255,68,68,0.3)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            background: 'rgba(255,68,68,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            filter: 'grayscale(50%)'
                          }}>
                            {user.avatar_url || '👤'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#ff4444' }}>
                              {user.display_name || user.username}
                            </div>
                            <div style={{ color: '#888', fontSize: '13px' }}>
                              @{user.username} · Suspended
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnsuspendUser(user.id, user.username)}
                          disabled={actionLoading === user.id}
                          style={{
                            padding: '10px 20px',
                            background: 'rgba(0,255,136,0.2)',
                            border: '1px solid #00ff88',
                            color: '#00ff88',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          {actionLoading === user.id ? '...' : '✓ Unsuspend'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin Action History */}
              <div>
                <h3 style={{ marginBottom: '16px', color: 'var(--primary-cyan)' }}>
                  📜 Recent Admin Actions
                </h3>
                {adminActions.length === 0 ? (
                  <div style={{
                    padding: '30px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No admin actions recorded yet.</p>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--secondary-navy)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Action</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Target</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Reason</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminActions.map((action, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                background: action.action_type === 'suspend' ? 'rgba(255,68,68,0.2)' : 'rgba(0,255,136,0.2)',
                                color: action.action_type === 'suspend' ? '#ff4444' : '#00ff88'
                              }}>
                                {action.action_type}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{action.target || 'N/A'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{action.reason || '—'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{formatDate(action.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB: All Users */}
          {activeTab === 'users' && (
            <>
              <div className="feed-header">
                <h2>All Users</h2>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  {totalUsers} total users on this instance
                </p>
              </div>

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading users...</div>
              ) : (
                <>
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                          <th style={{ padding: '16px', textAlign: 'left', color: '#888' }}>User</th>
                          <th style={{ padding: '16px', textAlign: 'left', color: '#888' }}>Role</th>
                          <th style={{ padding: '16px', textAlign: 'left', color: '#888' }}>Status</th>
                          <th style={{ padding: '16px', textAlign: 'left', color: '#888' }}>Joined</th>
                          <th style={{ padding: '16px', textAlign: 'right', color: '#888' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => (
                          <tr key={user.id} style={{ borderTop: '1px solid #333' }}>
                            <td style={{ padding: '16px' }}>
                              <div>
                                <div style={{ fontWeight: '600' }}>{user.display_name || user.username}</div>
                                <div style={{ color: '#666', fontSize: '12px' }}>@{user.username}</div>
                              </div>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span 
                                title={user.role === 'admin' ? 'Admin - Full system access' : user.role === 'moderator' ? 'Moderator - Can moderate content' : 'User - Regular user account'}
                                style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: user.role === 'admin' ? 'rgba(255,68,68,0.2)' :
                                           user.role === 'moderator' ? 'rgba(0,217,255,0.2)' : 'rgba(0,255,136,0.2)',
                                color: user.role === 'admin' ? '#ff4444' :
                                       user.role === 'moderator' ? '#00d9ff' : '#00ff88',
                                cursor: 'help'
                              }}>
                                {user.role === 'admin' ? '👑' : user.role === 'moderator' ? '🛡️' : '👤'} {user.role}
                              </span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              {user.is_suspended ? (
                                <span style={{ color: '#ff4444' }} title="This user is currently suspended">Suspended</span>
                              ) : (
                                <span style={{ color: '#00ff88' }} title="This user account is active">✓ Active</span>
                              )}
                            </td>
                            <td style={{ padding: '16px', color: '#888' }}>{formatDate(user.created_at)}</td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                              {user.role !== 'admin' && (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  {user.is_suspended ? (
                                    <button
                                      onClick={() => handleUnsuspendUser(user.id, user.username)}
                                      disabled={actionLoading === user.id}
                                      style={{
                                        padding: '6px 12px',
                                        background: 'rgba(0,255,136,0.2)',
                                        border: '1px solid #00ff88',
                                        color: '#00ff88',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      Unban
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openBanModal(user)}
                                      disabled={actionLoading === user.id}
                                      style={{
                                        padding: '6px 12px',
                                        background: 'rgba(255,68,68,0.2)',
                                        border: '1px solid #ff4444',
                                        color: '#ff4444',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      Ban
                                    </button>
                                  )}
                                  <select
                                    value={user.role}
                                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                    disabled={actionLoading === user.id}
                                    style={{
                                      padding: '6px 8px',
                                      background: '#1a1a2e',
                                      border: '1px solid #333',
                                      color: '#fff',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    <option value="user">User</option>
                                    <option value="moderator">Moderator</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalUsers > USERS_PAGE_SIZE && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                      <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(0,217,255,0.1)',
                          border: '1px solid #00d9ff',
                          color: '#00d9ff',
                          borderRadius: '6px',
                          cursor: page === 0 ? 'not-allowed' : 'pointer',
                          opacity: page === 0 ? 0.5 : 1
                        }}
                      >
                        ← Previous
                      </button>
                      <span style={{ padding: '8px 16px', color: '#666' }}>
                        Page {page + 1} of {Math.ceil(totalUsers / USERS_PAGE_SIZE)}
                      </span>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * USERS_PAGE_SIZE >= totalUsers}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(0,217,255,0.1)',
                          border: '1px solid #00d9ff',
                          color: '#00d9ff',
                          borderRadius: '6px',
                          cursor: (page + 1) * USERS_PAGE_SIZE >= totalUsers ? 'not-allowed' : 'pointer',
                          opacity: (page + 1) * USERS_PAGE_SIZE >= totalUsers ? 0.5 : 1
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Federation Tab */}
          {activeTab === 'federation' && (
            <>
              <h2 style={{ margin: '0 0 24px 0', color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700' }}>
                🌐 Federation Management
              </h2>

              {/* Traffic Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: 'rgba(0,217,255,0.1)', border: '1px solid #00d9ff', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Total Inbound</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#00d9ff' }}>{trafficMetrics.totalInbound}</div>
                </div>
                <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Total Outbound</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#00ff88' }}>{trafficMetrics.totalOutbound}</div>
                </div>
                <div style={{ background: 'rgba(255,106,236,0.1)', border: '1px solid #ff6aec', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Success Rate</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#ff6aec' }}>{trafficMetrics.successRate}%</div>
                </div>
                <div style={{ background: 'rgba(255,170,0,0.1)', border: '1px solid #ffaa00', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Avg Latency</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffaa00' }}>{trafficMetrics.avgLatency}ms</div>
                </div>
                <div style={{ background: 'rgba(138,43,226,0.1)', border: '1px solid #8a2be2', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Active Domains</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#8a2be2' }}>{trafficMetrics.activeDomains}</div>
                </div>
              </div>

              {/* Block Domain Form */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Block Domain</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Domain (e.g., spam.example.com)"
                    value={newBlockDomain}
                    onChange={(e) => setNewBlockDomain(e.target.value)}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Reason for blocking"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!newBlockDomain || !newBlockReason) return;
                      try {
                        await adminApi.blockDomainWithReason(newBlockDomain, newBlockReason);
                        setNewBlockDomain('');
                        setNewBlockReason('');
                        await fetchFederationData();
                      } catch (error) {
                        console.error('Failed to block domain:', error);
                        alert(`Failed to block domain: ${error.message}`);
                      }
                    }}
                    disabled={!newBlockDomain || !newBlockReason}
                    style={{
                      padding: '12px',
                      background: 'rgba(255,68,68,0.2)',
                      border: '1px solid #ff4444',
                      borderRadius: '8px',
                      color: '#ff4444',
                      cursor: (!newBlockDomain || !newBlockReason) ? 'not-allowed' : 'pointer',
                      opacity: (!newBlockDomain || !newBlockReason) ? 0.5 : 1
                    }}
                  >
                    🚫 Block Domain
                  </button>
                </div>
              </div>

              {/* Blocked Domains */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Blocked Domains ({blockedDomains.length})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>DOMAIN</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>REASON</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>BLOCKED AT</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>BLOCKED BY</th>
                        <th style={{ textAlign: 'center', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedDomains.map((domain, idx) => (
                        <tr key={`${domain.domain}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            <code style={{ background: 'rgba(255,68,68,0.1)', padding: '4px 8px', borderRadius: '4px', color: '#ff4444' }}>
                              {domain.domain}
                            </code>
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', color: '#ccc' }}>{domain.reason}</td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#888' }}>{formatDate(domain.blocked_at)}</td>
                          <td style={{ padding: '12px', fontSize: '13px' }}>@{domain.blocked_by}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={async () => {
                                try {
                                  await adminApi.unblockDomain(domain.domain);
                                  await fetchFederationData();
                                } catch (error) {
                                  console.error('Failed to unblock domain:', error);
                                  alert(`Failed to unblock domain: ${error.message}`);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(0,255,136,0.1)',
                                border: '1px solid #00ff88',
                                borderRadius: '6px',
                                color: '#00ff88',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Unblock
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Federation Activities */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Recent Federation Activities</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>TYPE</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>DOMAIN</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>ACTIVITY</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>STATUS</th>
                        <th style={{ textAlign: 'left', padding: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}>TIMESTAMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {federationLoading ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '16px', color: '#888' }}>Loading federation activity...</td>
                        </tr>
                      ) : federationActivities.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '16px', color: '#888' }}>No federation activity recorded yet.</td>
                        </tr>
                      ) : federationActivities.map((activity) => (
                        <tr key={activity.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: activity.type === 'inbox' ? 'rgba(0,217,255,0.1)' : 'rgba(0,255,136,0.1)',
                              color: activity.type === 'inbox' ? '#00d9ff' : '#00ff88'
                            }}>
                              {activity.type === 'inbox' ? '📥 IN' : '📤 OUT'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px' }}>
                            <code style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                              {activity.domain}
                            </code>
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', color: '#ccc' }}>{activity.activity_type}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              background: activity.status === 'success' ? 'rgba(0,255,136,0.1)' : 'rgba(255,170,0,0.1)',
                              color: activity.status === 'success' ? '#00ff88' : '#ffaa00'
                            }}>
                              {activity.status === 'success' ? '✓' : '⏳'} {activity.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#888' }}>{formatTimestamp(activity.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Right Sidebar - Admin Quick Stats */}
        <aside style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'sticky',
          top: '90px',
          alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 110px)',
          overflowY: 'auto',
          width: '320px',
          flexShrink: 0,
          padding: '24px 32px 24px 24px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600' }}>📊 Instance Stats</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Users</span>
                <span style={{ color: '#00d9ff', fontWeight: '600', fontSize: '14px' }}>{totalUsers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Pending Requests</span>
                <span style={{ color: '#ff006e', fontWeight: '600', fontSize: '14px' }}>{moderationRequests.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Suspended Users</span>
                <span style={{ color: '#ff4444', fontWeight: '600', fontSize: '14px' }}>{suspendedUsers.length}</span>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600' }}>🔧 Quick Actions</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              <button
                onClick={() => onNavigate('moderation')}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(0,217,255,0.1)',
                  border: '1px solid #00d9ff',
                  color: '#00d9ff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Content Moderation
              </button>
              <button
                onClick={() => onNavigate('federation')}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,0,110,0.1)',
                  border: '1px solid #ff006e',
                  color: '#ff006e',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                🌐 Federation Settings
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: moderationRequests.length > 0 ? 'rgba(255,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${moderationRequests.length > 0 ? '#ff4444' : '#333'}`,
                  color: moderationRequests.length > 0 ? '#ff4444' : '#888',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Review Requests {moderationRequests.length > 0 && `(${moderationRequests.length})`}
              </button>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600' }}>Admin Info</h3>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px 0' }}>Logged in as:</p>
              <p style={{ color: '#ff4444', fontWeight: '600', margin: '0 0 8px 0', fontSize: '15px' }}>@{userData?.username}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, padding: '8px 12px', background: 'rgba(255,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(255,68,68,0.3)' }}>
                ⚡ Full admin privileges enabled
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Ban Modal */}
      {showBanModal && banTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#1a1a2e',
            border: '1px solid #ff4444',
            borderRadius: '16px',
            padding: '24px',
            width: '400px',
            maxWidth: '90%'
          }}>
            <h2 style={{ color: '#ff4444', marginBottom: '16px' }}>Ban User</h2>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#888', marginBottom: '8px' }}>You are about to suspend:</p>
              <p style={{ color: '#fff', fontWeight: '600', fontSize: '18px' }}>
                @{banTarget.username}
              </p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#888', display: 'block', marginBottom: '8px' }}>
                Reason for ban (optional):
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Violation of community guidelines, spam, harassment, etc."
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanTarget(null);
                  setBanReason('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #333',
                  color: '#888',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendUser}
                disabled={actionLoading === banTarget.id}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(255,68,68,0.2)',
                  border: '1px solid #ff4444',
                  color: '#ff4444',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {actionLoading === banTarget.id ? 'Banning...' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
