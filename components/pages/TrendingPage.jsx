'use client';

import React, { useState, useEffect } from 'react';
import { hashtagApi } from '@/lib/api';
import '../styles/TrendingPage.css';

export default function TrendingPage({ onNavigate }) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await hashtagApi.getTrending(20);
      setTrending(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch trending:', err);
      setError('Failed to load trending hashtags');
    } finally {
      setLoading(false);
    }
  };

  const formatCount = (count) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  return (
    <div className="trending-page">
      <div className="trending-page-header">
        <button className="trending-back-btn" onClick={() => onNavigate('home')}>
          ← Back
        </button>
        <h1>🔥 Trending Hashtags</h1>
        <p className="trending-subtitle">Most popular hashtags in the last 24 hours</p>
      </div>

      {loading && (
        <div className="trending-loading">
          <div className="trending-spinner"></div>
          <p>Loading trending hashtags...</p>
        </div>
      )}

      {error && (
        <div className="trending-error">
          <p>{error}</p>
          <button onClick={fetchTrending}>Try Again</button>
        </div>
      )}

      {!loading && !error && trending.length === 0 && (
        <div className="trending-empty">
          <p>No trending hashtags right now.</p>
          <p className="trending-empty-sub">Start posting with #hashtags to see them here!</p>
        </div>
      )}

      {!loading && !error && trending.length > 0 && (
        <div className="trending-list">
          {trending.map((item, index) => (
            <div
              key={item.tag}
              className="trending-item"
              onClick={() => onNavigate('hashtag', { hashtag: item.tag })}
            >
              <div className="trending-rank">#{index + 1}</div>
              <div className="trending-info">
                <span className="trending-tag">#{item.tag}</span>
                <span className="trending-count">{formatCount(item.count)} posts</span>
              </div>
              <div className="trending-arrow">→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
