'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/ModerationPage.css';
import { adminApi } from '@/lib/api';

export default function ModerationPage({ onNavigate, userData }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [activeTab, setActiveTab] = useState('reports');
  const [queue, setQueue] = useState([]);
  const [aiActions, setAIActions] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');

  if (userData?.role !== 'admin' && userData?.role !== 'moderator') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
        <h1 style={{ color: '#ff4444', marginBottom: '16px' }}>Access Denied</h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>You need moderator privileges to access this page.</p>
        <button onClick={() => onNavigate('home')} style={{ padding: '12px 24px', background: 'rgba(0,217,255,0.2)', border: '1px solid #00d9ff', color: '#00d9ff', borderRadius: '8px', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [queueRes, aiRes, appealsRes] = await Promise.all([
        adminApi.getModerationQueue().catch(() => ({ items: [] })),
        adminApi.getAIActions().catch(() => ({ items: [] })),
        adminApi.getAppeals().catch(() => ({ appeals: [] }))
      ]);
      setQueue(queueRes.items || []);
      setAIActions(aiRes.items || []);
      setAppeals(appealsRes.appeals || []);
    } catch (err) {
      setError(err.message || 'Failed to load moderation data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id, action, item) => {
    setActionLoading(id + action);
    try {
      if (action === 'remove') { await adminApi.removeContent(id); }
      else if (action === 'dismiss') { await adminApi.approveContent(id); }
      else if (action === 'warn') { await adminApi.warnUser(item.author_id, item.reason); }
      else if (action === 'suspend') { await adminApi.suspendUser(item.author_id); }
      else if (action === 'ban') { await adminApi.banUser(item.author_id, 'Banned via moderation panel'); }
      else if (action === 'block_domain') { await adminApi.blockDomain(item.server); }
      // Use functional update to avoid stale closure — always works with latest state
      setQueue(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      setError('Action failed: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveAppeal = async (appealId, decision) => {
    setActionLoading(appealId + decision);
    try {
      await adminApi.resolveAppeal(appealId, decision);
      setAppeals(prev => prev.filter(a => a.id !== appealId));
    } catch (err) {
      setError('Failed to resolve appeal: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredQueue = queue.filter(item => {
    if (filterType === 'spam') return item.reason?.toLowerCase().includes('spam');
    if (filterType === 'harassment') return item.reason?.toLowerCase().includes('harassment');
    if (filterType === 'federated') return item.isFederated || item.is_federated;
    return true;
  });

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    background: activeTab === tab ? 'rgba(0,217,255,0.15)' : 'transparent',
    border: activeTab === tab ? '1px solid #00d9ff' : '1px solid transparent',
    borderRadius: '6px',
    color: activeTab === tab ? '#00d9ff' : '#888',
    cursor: 'pointer', fontSize: '14px',
    fontWeight: activeTab === tab ? '600' : '400'
  });

  const mkBtn = (label, color, action) => {
    const palettes = { red: ['255,68,68','#ff8080'], green: ['0,255,136','#00ff88'], orange: ['255,170,0','#ffcc44'], blue: ['0,151,230','#29b6f6'] };
    const [bg, fg] = palettes[color] || palettes.blue;
    return { label, action, style: { padding: '5px 10px', background: `rgba(${bg},0.15)`, border: `1px solid ${fg}`, color: fg, borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', marginRight: '4px' } };
  };

  return (
    <div className="moderation-container" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <div className="moderation-navbar">
        <button className="nav-button back-button" onClick={() => onNavigate('home')}>Back</button>
        <h1 className="navbar-title">Moderation Panel</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => onNavigate('federation')} style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', color: '#ff4444', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Federation</button>
          <button onClick={() => onNavigate('profile')} style={{ padding: '8px 12px', background: isDarkMode ? 'rgba(0,217,255,0.1)' : 'rgba(100,100,100,0.1)', border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`, color: isDarkMode ? '#00d9ff' : '#333', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Profile</button>
          <button onClick={toggleTheme} style={{ padding: '8px 12px', background: isDarkMode ? 'rgba(0,217,255,0.1)' : 'rgba(100,100,100,0.1)', border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`, color: isDarkMode ? '#00d9ff' : '#333', borderRadius: '6px', cursor: 'pointer' }}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</button>
        </div>
      </div>

      <div className="moderation-content">
        <div className="moderation-header" style={{ marginBottom: '20px' }}>
          <div className="header-info">
            <h2 style={{ margin: 0 }}>Content Moderation</h2>
            <p style={{ color: '#888', margin: '4px 0 0', fontSize: '13px' }}>
              {queue.length} pending reports &bull; {aiActions.length} AI actions &bull; {appeals.filter(a => a.status === 'pending').length} open appeals
            </p>
          </div>
          <button onClick={fetchAll} disabled={isLoading} style={{ padding: '8px 16px', background: 'rgba(0,217,255,0.1)', border: '1px solid #00d9ff', color: '#00d9ff', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer' }}>Refresh</button>
        </div>

        {error && <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,68,68,0.45)', background: 'rgba(255,68,68,0.1)', color: '#ff8080' }}>{error}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button style={tabStyle('reports')} onClick={() => setActiveTab('reports')}>
            Reports{queue.length > 0 && <span style={{ marginLeft: '6px', background: '#ff4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{queue.length}</span>}
          </button>
          <button style={tabStyle('ai')} onClick={() => setActiveTab('ai')}>
            AI Actions{aiActions.length > 0 && <span style={{ marginLeft: '6px', background: '#ff8844', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{aiActions.length}</span>}
          </button>
          <button style={tabStyle('appeals')} onClick={() => setActiveTab('appeals')}>
            Appeals{appeals.filter(a => a.status === 'pending').length > 0 && <span style={{ marginLeft: '6px', background: '#ffd700', color: '#000', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{appeals.filter(a => a.status === 'pending').length}</span>}
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>Loading...</div>
        ) : (
          <>
            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <>
                <div className="filter-chips" style={{ marginBottom: '16px' }}>
                  {['all','spam','harassment','federated'].map(f => (
                    <button key={f} className={`chip ${filterType === f ? 'active' : ''}`} onClick={() => setFilterType(f)}>
                      {f === 'all' ? 'All' : f === 'federated' ? 'Federated' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="queue-table">
                  <div className="table-header">
                    <div className="col-preview">Preview</div>
                    <div className="col-user">User</div>
                    <div className="col-server">Server</div>
                    <div className="col-reason">Reason</div>
                    <div className="col-reason">Reported</div>
                    <div className="col-action">Actions</div>
                  </div>
                  {filteredQueue.length > 0 ? filteredQueue.map(item => (
                    <div key={item.id} className="table-row">
                      <div className="col-preview"><div className="preview-text">{item.preview || item.content}</div></div>
                      <div className="col-user">{item.author || '@unknown'}</div>
                      <div className="col-server">{item.server || 'local'}</div>
                      <div className="col-reason"><span className={`reason-tag ${(item.reason||'reported').toLowerCase().replace(/ /g,'-')}`}>{item.reason||'Reported'}</span></div>
                      <div className="col-reason" style={{ color: '#888', fontSize: '12px' }}>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</div>
                      <div className="col-action">
                        <div className="action-buttons">
                          {[mkBtn('Remove','red','remove'), mkBtn('Warn','orange','warn'), mkBtn('Suspend','orange','suspend'), ...(userData?.role==='admin'?[mkBtn('Ban','red','ban')]:[]), mkBtn('Dismiss','blue','dismiss')].map(btn => (
                            <button key={btn.action} style={btn.style} onClick={() => handleAction(item.id, btn.action, item)} disabled={actionLoading===item.id+btn.action}>
                              {actionLoading===item.id+btn.action ? '...' : btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : <div style={{ textAlign:'center', padding:'48px', color:'#666' }}><p style={{ marginBottom:'8px' }}>No pending reports</p><p style={{ fontSize:'13px' }}>All caught up.</p></div>}
                </div>
              </>
            )}

            {/* AI Actions Tab */}
            {activeTab === 'ai' && (
              <div className="queue-table">
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(255,136,68,0.08)', border: '1px solid rgba(255,136,68,0.3)', borderRadius: '8px', fontSize: '13px', color: '#ffaa66' }}>
                  These posts were automatically removed by the AI moderator. Users can submit appeals from their profile.
                </div>
                <div className="table-header">
                  <div className="col-preview">Content</div>
                  <div className="col-user">Author</div>
                  <div className="col-reason">Report Reason</div>
                  <div className="col-reason">AI Reason</div>
                  <div className="col-reason">Removed At</div>
                  <div className="col-action">Appeal</div>
                </div>
                {aiActions.length > 0 ? aiActions.map(item => (
                  <div key={item.id} className="table-row">
                    <div className="col-preview"><div className="preview-text">{item.preview||item.content}</div></div>
                    <div className="col-user">{item.author||'@unknown'}</div>
                    <div className="col-reason"><span className={`reason-tag ${(item.reason||'reported').toLowerCase().replace(/ /g,'-')}`}>{item.reason||'reported'}</span></div>
                    <div className="col-reason" style={{ fontSize:'12px', color:'#ff9966' }}>{item.ai_reason||'AI flagged content'}</div>
                    <div className="col-reason" style={{ color:'#888', fontSize:'12px' }}>{item.ai_screened_at ? new Date(item.ai_screened_at).toLocaleString() : '—'}</div>
                    <div className="col-action">{item.has_appeal ? <span style={{ fontSize:'12px', color:'#ffd700', fontWeight:'600' }}>Appeal Pending</span> : <span style={{ fontSize:'12px', color:'#888' }}>None</span>}</div>
                  </div>
                )) : <div style={{ textAlign:'center', padding:'48px', color:'#666' }}><p>No AI-actioned content</p></div>}
              </div>
            )}

            {/* Appeals Tab */}
            {activeTab === 'appeals' && (
              <div className="queue-table">
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '8px', fontSize: '13px', color: '#ffd700' }}>
                  Users have contested AI-removal decisions. Restore to reinstate the post; Uphold to confirm removal.
                </div>
                <div className="table-header">
                  <div className="col-preview">Content</div>
                  <div className="col-user">Author</div>
                  <div className="col-reason">AI Removed Because</div>
                  <div className="col-reason">User Appeal</div>
                  <div className="col-reason">Submitted</div>
                  <div className="col-action">Decision</div>
                </div>
                {appeals.length > 0 ? appeals.map(item => (
                  <div key={item.id} className="table-row">
                    <div className="col-preview"><div className="preview-text">{item.preview}</div></div>
                    <div className="col-user">{item.author||'@unknown'}</div>
                    <div className="col-reason" style={{ fontSize:'12px', color:'#ff9966' }}>{item.ai_reason||'—'}</div>
                    <div className="col-reason" style={{ fontSize:'12px', color:'#ccc' }}>{item.appeal_reason}</div>
                    <div className="col-reason" style={{ color:'#888', fontSize:'12px' }}>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</div>
                    <div className="col-action">
                      {item.status === 'pending' ? (
                        <div className="action-buttons">
                          <button onClick={() => handleResolveAppeal(item.id,'accept')} disabled={actionLoading===item.id+'accept'} style={{ padding:'5px 10px', background:'rgba(0,255,136,0.15)', border:'1px solid #00ff88', color:'#00ff88', borderRadius:'5px', cursor:'pointer', fontSize:'12px', fontWeight:'600', marginRight:'4px' }}>{actionLoading===item.id+'accept'?'...':'Restore'}</button>
                          <button onClick={() => handleResolveAppeal(item.id,'reject')} disabled={actionLoading===item.id+'reject'} style={{ padding:'5px 10px', background:'rgba(255,68,68,0.15)', border:'1px solid #ff4444', color:'#ff8080', borderRadius:'5px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>{actionLoading===item.id+'reject'?'...':'Uphold'}</button>
                        </div>
                      ) : <span style={{ fontSize:'12px', color: item.status==='accepted'?'#00ff88':'#ff8080', fontWeight:'600', textTransform:'capitalize' }}>{item.status}</span>}
                    </div>
                  </div>
                )) : <div style={{ textAlign:'center', padding:'48px', color:'#666' }}><p>No appeals submitted yet</p></div>}
              </div>
            )}
          </>
        )}

        <div className="moderation-notes" style={{ marginTop: '32px' }}>
          <h3>Moderation Flow</h3>
          <ul>
            <li><strong>User flags a post</strong> — AI screens it automatically within seconds</li>
            <li><strong>AI removes it</strong> — post hidden, appears in AI Actions tab</li>
            <li><strong>User contests</strong> — appeal appears in Appeals tab for human review</li>
            <li><strong>Restore</strong> — reinstates post; <strong>Uphold</strong> — confirms removal</li>
            <li><strong>Ban</strong> — permanently suspends user (admin only)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
