'use client';

import React, { useState, useEffect } from 'react';
import { hashtagApi } from '@/lib/api';
import '../styles/HashtagPage.css';

export default function HashtagPage({ hashtag, onNavigate }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (hashtag) fetchPosts();
  }, [hashtag]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await hashtagApi.getPostsByHashtag(hashtag, 50, 0);
      setPosts(data.posts || []);
      setTotalCount(data.count ?? (data.posts || []).length);
    } catch (err) {
      console.error('Failed to fetch posts for hashtag:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString();
  };

  const renderContent = (content) => {
    if (!content) return null;
    const parts = content.split(/(#[A-Za-z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.match(/^#[A-Za-z0-9_]+$/)) {
        const tag = part.slice(1);
        return (
          <span
            key={i}
            className="hashtag-link"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('hashtag', { hashtag: tag });
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="hashtag-page">
      <div className="hashtag-page-header">
        <button className="hashtag-back-btn" onClick={() => onNavigate('home')}>
          ← Back
        </button>
        <h1>#{hashtag}</h1>
        {!loading && <p className="hashtag-count">{totalCount} post{totalCount !== 1 ? 's' : ''}</p>}
        <button className="hashtag-trending-link" onClick={() => onNavigate('trending')}>
          View All Trending
        </button>
      </div>

      {loading && (
        <div className="hashtag-loading">
          <div className="hashtag-spinner"></div>
          <p>Loading posts...</p>
        </div>
      )}

      {error && (
        <div className="hashtag-error">
          <p>{error}</p>
          <button onClick={fetchPosts}>Try Again</button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="hashtag-empty">
          <p>No posts found with #{hashtag}</p>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="hashtag-posts">
          {posts.map((post) => (
            <div
              key={post.id}
              className="hashtag-post-card"
              onClick={() => onNavigate('thread', { postId: post.id })}
            >
              <div className="hashtag-post-header">
                <div className="hashtag-post-avatar">
                  {post.avatar_url ? (
                    <img src={post.avatar_url} alt="" className="avatar-img" />
                  ) : (
                    <span className="avatar-placeholder">👤</span>
                  )}
                </div>
                <div className="hashtag-post-meta">
                  <strong className="hashtag-post-username">
                    {post.username || 'Unknown'}
                  </strong>
                  <span className="hashtag-post-time">{formatTime(post.created_at)}</span>
                </div>
              </div>
              <div className="hashtag-post-content">
                {renderContent(post.content)}
              </div>
              {post.media && post.media.length > 0 && (
                <div className="hashtag-post-media">
                  <img src={post.media[0].media_url} alt="" />
                </div>
              )}
              <div className="hashtag-post-stats">
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'14px',height:'14px',verticalAlign:'middle',marginRight:'4px'}}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>{post.like_count || 0}</span>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'14px',height:'14px',verticalAlign:'middle',marginRight:'4px'}}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>{post.direct_reply_count || 0}</span>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'14px',height:'14px',verticalAlign:'middle',marginRight:'4px'}}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>{post.repost_count || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
