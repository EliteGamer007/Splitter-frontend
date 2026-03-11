'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/FederationPage.css';
import { adminApi } from '@/lib/api';

export default function FederationPage({ onNavigate, userData }) {
  if (userData?.role !== "admin" && userData?.role !== "moderator") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <h2>Access Denied</h2>
      </div>
    );
  }

  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspector, setInspector] = useState({
    metrics: {
      incoming_per_minute: 0,
      outgoing_per_minute: 0,
      signature_validation: '0%',
      retry_queue: 0,
      failing_domains: 0
    },
    servers: [],
    failing_domains: [],
    recent_incoming: [],
    recent_outgoing: []
  });
  const [networkGraph, setNetworkGraph] = useState({ nodes: [], edges: [] });

  const loadInspector = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminApi.getFederationInspector();
      setInspector(data);
      const networkData = await adminApi.getFederationNetwork();
      setNetworkGraph(networkData || { nodes: [], edges: [] });
    } catch (err) {
      setError(err.message || 'Failed to load federation inspector data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInspector();
    const timer = setInterval(loadInspector, 15000);
    return () => clearInterval(timer);
  }, []);

  const mergedTraffic = useMemo(() => {
    const incoming = (inspector.recent_incoming || []).map((entry, idx) => ({
      ...entry,
      id: `in-${idx}`
    }));
    const outgoing = (inspector.recent_outgoing || []).map((entry, idx) => ({
      ...entry,
      id: `out-${idx}`
    }));
    return [...incoming, ...outgoing]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
  }, [inspector]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return '#00ff88';
      case 'degraded':
        return '#ffd700';
      case 'blocked':
        return '#ff4444';
      case 'circuit_open':
        return '#ff8844';
      default:
        return '#888';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':     return '[OK]';
      case 'degraded':    return '[!]';
      case 'blocked':     return '[X]';
      case 'circuit_open': return '[CB]';
      default:            return '[-]';
    }
  };

  const graphLayout = useMemo(() => {
    const width = 760;
    const height = 320;
    const nodes = (networkGraph.nodes || []).map((node, index) => ({
      ...node,
      x: 60 + (index * 80) % (width - 120),
      y: 80 + ((index * 40) % (height - 140)),
      vx: 0,
      vy: 0
    }));

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edges = (networkGraph.edges || []).filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target));

    for (let i = 0; i < 120; i++) {
      for (const edge of edges) {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const desired = 120;
        const force = (distance - desired) * 0.0025;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const na = nodes[a];
          const nb = nodes[b];
          const dx = nb.x - na.x;
          const dy = nb.y - na.y;
          const distanceSq = dx * dx + dy * dy || 1;
          const repulse = 240 / distanceSq;
          na.vx -= dx * repulse * 0.0008;
          na.vy -= dy * repulse * 0.0008;
          nb.vx += dx * repulse * 0.0008;
          nb.vy += dy * repulse * 0.0008;
        }
      }

      for (const node of nodes) {
        node.vx *= 0.86;
        node.vy *= 0.86;
        node.x = Math.max(30, Math.min(width - 30, node.x + node.vx));
        node.y = Math.max(35, Math.min(height - 35, node.y + node.vy));
      }
    }

    return { width, height, nodes, edges };
  }, [networkGraph]);

  return (
    <div className="federation-container">
      {/* Navigation */}
      <div className="federation-navbar">
        <button
          className="nav-button back-button"
          onClick={() => onNavigate('home')}
        >
          &larr; Back
        </button>
        <h1 className="navbar-title">Splitter Moderation</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="nav-btn-profile"
            onClick={() => onNavigate('moderation')}
            style={{
              padding: '8px 12px',
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid #ff4444',
              color: '#ff4444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Moderation
          </button>
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
            onClick={toggleTheme}
            style={{
              padding: '8px 12px',
              background: isDarkMode ? 'rgba(0, 217, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)',
              border: `1px solid ${isDarkMode ? '#00d9ff' : '#666'}`,
              color: isDarkMode ? '#00d9ff' : '#333',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>

      <div className="federation-content">
        {error && (
          <div style={{
            marginBottom: '18px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(255,68,68,0.45)',
            background: 'rgba(255,68,68,0.1)',
            color: '#ff8080'
          }}>
            {error}
          </div>
        )}

        {/* Health Metrics */}
        <div className="health-section">
          <h2 className="section-title">Network Health</h2>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-info">
                <div className="metric-label">Incoming Activities</div>
                <div className="metric-value">{inspector.metrics?.incoming_per_minute || 0}/min</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <div className="metric-label">Outgoing Activities</div>
                <div className="metric-value">{inspector.metrics?.outgoing_per_minute || 0}/min</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <div className="metric-label">Signature Validation</div>
                <div className="metric-value">{inspector.metrics?.signature_validation || '0%'}</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <div className="metric-label">Retry Queue</div>
                <div className="metric-value">{inspector.metrics?.retry_queue || 0} pending</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <div className="metric-label">Failing Domains</div>
                <div className="metric-value">{inspector.metrics?.failing_domains || 0}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="servers-section">
          <h2 className="section-title">Retry Queue by Domain</h2>
          <div className="servers-table">
            <div className="table-header">
              <div className="col-domain">Domain</div>
              <div className="col-status">Queued</div>
              <div className="col-status">Max Retry</div>
              <div className="col-lastseen">Next Retry</div>
              <div className="col-lastseen">Circuit Until</div>
            </div>
            {(inspector.failing_domains || []).map((domain, idx) => (
              <div key={`${domain.domain || 'domain'}-${idx}`} className="table-row">
                <div className="col-domain">
                  <span className="domain-name">{domain.domain}</span>
                </div>
                <div className="col-status">{domain.queued || 0}</div>
                <div className="col-status">{domain.max_retry_count || 0}</div>
                <div className="col-lastseen">{domain.next_retry_at && domain.next_retry_at !== '—' ? new Date(domain.next_retry_at).toLocaleString() : '—'}</div>
                <div className="col-lastseen">{domain.circuit_open_until && domain.circuit_open_until !== '—' ? new Date(domain.circuit_open_until).toLocaleString() : '—'}</div>
              </div>
            ))}
            {(inspector.failing_domains || []).length === 0 && !isLoading && (
              <div className="table-row">
                <div className="col-domain" style={{ padding: '12px', color: '#888' }}>No failing domains in retry queue.</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Federation Traffic */}
        <div className="activity-chart">
          <h3>Recent Federation Traffic</h3>
          <div className="servers-table">
            <div className="table-header">
              <div className="col-status">Direction</div>
              <div className="col-domain">Target / Actor</div>
              <div className="col-reputation">Type</div>
              <div className="col-status">Status</div>
              <div className="col-lastseen">Time</div>
            </div>
            {mergedTraffic.length > 0 ? mergedTraffic.map((entry) => (
              <div key={entry.id} className="table-row">
                <div className="col-status">{entry.direction === 'incoming' ? 'In' : 'Out'}</div>
                <div className="col-domain">
                  <span className="domain-name">{entry.actor_uri || entry.target_inbox || '—'}</span>
                </div>
                <div className="col-reputation">{entry.type || '—'}</div>
                <div className="col-status">{entry.status || 'received'}</div>
                <div className="col-lastseen">{entry.time ? new Date(entry.time).toLocaleString() : '—'}</div>
              </div>
            )) : (
              <div className="table-row">
                <div className="col-domain" style={{ padding: '12px', color: '#888' }}>No recent federation traffic</div>
              </div>
            )}
          </div>
        </div>

        {/* Connected Servers Table */}
        <div className="servers-section">
          <h2 className="section-title">Connected Servers</h2>

          <div className="servers-table">
            <div className="table-header">
              <div className="col-domain">Domain</div>
              <div className="col-status">Status</div>
              <div className="col-reputation">Reputation</div>
              <div className="col-lastseen">Last Seen</div>
              <div className="col-activities">Activities</div>
            </div>

            {(inspector.servers || []).map((server, idx) => (
              <div key={`${server.domain || 'domain'}-${idx}`} className="table-row">
                <div className="col-domain">
                  <span className="domain-name">{server.domain}</span>
                </div>
                <div className="col-status">
                  <span
                    className={`status-badge ${server.status}`}
                    style={{
                      borderColor: getStatusColor(server.status),
                    }}
                  >
                    {getStatusBadge(server.status)} {server.status}
                  </span>
                </div>
                <div className="col-reputation">
                  <span className={`reputation-tag ${(server.reputation || 'unknown').toLowerCase().replace(/ /g, '-')}`}>
                    {server.reputation || 'Unknown'}
                  </span>
                </div>
                <div className="col-lastseen">{server.last_seen && server.last_seen !== '—' ? new Date(server.last_seen).toLocaleString() : '—'}</div>
                <div className="col-activities">{server.activities_m || 0}/min</div>
              </div>
            ))}
            {(inspector.servers || []).length === 0 && !isLoading && (
              <div className="table-row">
                <div className="col-domain" style={{ padding: '12px', color: '#888' }}>No federated domains observed yet.</div>
              </div>
            )}
          </div>
        </div>

        {/* Federation Network Map */}
        <div className="servers-section">
          <h2 className="section-title">Federation Network Map</h2>
          <div className="servers-table" style={{ padding: '12px' }}>
            {(graphLayout.nodes || []).length === 0 ? (
              <div style={{ color: '#888', padding: '8px 4px' }}>No network connections observed yet.</div>
            ) : (
              <svg viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} style={{ width: '100%', height: '320px' }}>
                {graphLayout.edges.map((edge, idx) => {
                  const source = graphLayout.nodes.find((n) => n.id === edge.source);
                  const target = graphLayout.nodes.find((n) => n.id === edge.target);
                  if (!source || !target) return null;
                  const strong = (edge.weight || 1) > 3;
                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={strong ? '#00d9ff' : '#6d7a9a'}
                      strokeOpacity={0.75}
                      strokeWidth={strong ? 2.2 : 1.4}
                    />
                  );
                })}

                {graphLayout.nodes.map((node) => {
                  const isLocal = node.type === 'local';
                  return (
                    <g key={node.id}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isLocal ? 11 : 9}
                        fill={isLocal ? '#00d9ff' : '#8a7dff'}
                        stroke="#d6deff"
                        strokeWidth="1.2"
                      />
                      <text
                        x={node.x}
                        y={node.y - 14}
                        textAnchor="middle"
                        fill={isDarkMode ? '#d6deff' : '#2a2d3e'}
                        fontSize="11"
                      >
                        {node.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="legend-section">
          <h3>Status Indicators</h3>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-color healthy" />
              <span>Healthy - All systems operational</span>
            </div>
            <div className="legend-item">
              <span className="legend-color degraded" />
              <span>Degraded - Slow response or high errors</span>
            </div>
            <div className="legend-item">
              <span className="legend-color blocked" />
              <span>Blocked - No communication allowed</span>
            </div>
            <div className="legend-item">
              <span className="legend-color circuit_open" />
              <span>Circuit Open - Temporary cooldown after repeated failures</span>
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="advanced-section">
          <h3>Advanced Options</h3>
          <div className="advanced-buttons">
            <button className="advanced-btn" onClick={loadInspector} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh Inspector'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
