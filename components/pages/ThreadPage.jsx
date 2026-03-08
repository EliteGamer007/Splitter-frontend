'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import { postApi } from '@/lib/api';
import '../styles/ThreadPage.css';

// Helper to format timestamp
const formatTimestamp = (isoString) => {
  if (!isoString) return 'unknown';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Get initials from username for avatar fallback
const getInitials = (username) => {
  if (!username) return '?';
  return username.charAt(0).toUpperCase();
};

// Recursive Reply Component
const ReplyItem = ({
  reply,
  depth,
  replyingToId,
  setReplyingToId,
  onSubmitReply,
  isSubmitting,
  userData,
  isOffline
}) => {
  const [replyText, setReplyText] = useState('');
  const isReplying = replyingToId === reply.id;
  const showReplyButton = depth < 4 && userData?.id;

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    await onSubmitReply(reply.id, replyText);
    setReplyText('');
    setReplyingToId(null);
  };

  return (
    <div className={`reply-item ${depth > 0 ? 'reply-nested' : ''}`}>
      {depth > 0 && <div className="reply-thread-line" />}
      <div className="reply-inner">
        <div className="reply-avatar-col">
          <div className="reply-avatar">
            {getInitials(reply.username)}
          </div>
          {reply.children?.length > 0 && <div className="reply-connector-line" />}
        </div>
        <div className="reply-main">
          <div className="reply-header">
            <span className="reply-author-name">
              {reply.username ? `@${reply.username}` : 'Unknown'}
            </span>
            <span className="reply-dot">·</span>
            <span className="reply-timestamp">
              {formatTimestamp(reply.created_at)}
            </span>
          </div>

          <div className="reply-body">{reply.content}</div>

          {showReplyButton && (
            <div className="reply-actions">
              <button
                className={`action-button ${isReplying ? 'active' : ''}`}
                onClick={() => setReplyingToId(isReplying ? null : reply.id)}
              >
                💬 {isReplying ? 'Cancel' : 'Reply'}
              </button>
            </div>
          )}

          {isReplying && (
            <div className="inline-reply-composer">
              <textarea
                className="reply-textarea small"
                placeholder={`Reply to @${reply.username || 'user'}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
                disabled={isOffline}
                rows={2}
              />
              <div className="inline-composer-actions">
                <button
                  className="reply-btn-submit"
                  onClick={handleSubmit}
                  disabled={isOffline || !replyText.trim() || isSubmitting}
                >
                  {isSubmitting ? '...' : 'Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {reply.children?.length > 0 && (
        <div className="reply-children">
          {reply.children.map((child) => (
            <ReplyItem
              key={child.id}
              reply={child}
              depth={depth + 1}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
              userData={userData}
              isOffline={isOffline}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function ThreadPage({ onNavigate, postId, userData }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [post, setPost] = useState(null);
  const [repliesTree, setRepliesTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mainReplyText, setMainReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (postId) loadThreadData();
  }, [postId]);

  const loadThreadData = async () => {
    if (!navigator.onLine) {
      const cached = localStorage.getItem(`thread_cache_${postId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setPost(parsed.post || null);
        setRepliesTree(buildReplyTree(parsed.replies || []));
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const postData = await postApi.getPost(postId);
      setPost(postData);

      const replies = await postApi.getReplies(postId);
      setRepliesTree(buildReplyTree(replies));
      localStorage.setItem(
        `thread_cache_${postId}`,
        JSON.stringify({
          post: postData,
          replies: replies
        })
      );
    } catch (err) {
      setError('Failed to load thread');
    } finally {
      setIsLoading(false);
    }
  };

  const buildReplyTree = (flatReplies = []) => {
    const map = {};
    const roots = [];

    flatReplies.forEach(r => (map[r.id] = { ...r, children: [] }));
    flatReplies.forEach(r => {
      if (r.parent_id && map[r.parent_id]) {
        map[r.parent_id].children.push(map[r.id]);
      } else {
        roots.push(map[r.id]);
      }
    });

    return roots;
  };

  const handlePostReply = async (parentId, content) => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    if (!postId) {
      console.error('Cannot create reply: postId is missing');
      return;
    }

    setIsSubmitting(true);
    try {
      await postApi.createReply(postId, content, parentId);
      const updatedReplies = await postApi.getReplies(postId);
      setRepliesTree(buildReplyTree(updatedReplies));

      setPost(prev => ({
        ...prev,
        total_reply_count: (prev.total_reply_count || 0) + 1
      }));
    } catch (err) {
      console.error('Failed to create reply:', err);
      setError('Failed to post reply. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMainReplySubmit = async () => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    if (!mainReplyText.trim()) return;
    await handlePostReply(null, mainReplyText);
    setMainReplyText('');
  };

  const replyCount = post?.total_reply_count || repliesTree.length || 0;

  return (
    <div className="thread-container">
      {/* Top Bar */}
      <div className="thread-navbar">
        <button className="nav-back-btn" onClick={() => onNavigate('home')}>
          ← Back
        </button>
        <span className="nav-title">Thread</span>
        <button className="nav-theme-btn" onClick={toggleTheme}>
          {isDarkMode ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="thread-content">
        {isOffline && (
          <div className="offline-banner">
            ⚠️ You are offline — viewing cached thread.
          </div>
        )}

        {isLoading && (
          <div className="thread-loading">
            <div className="loading-spinner" />
            <span>Loading thread...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="thread-error">
            {error}
            <button onClick={loadThreadData} className="retry-btn">Retry</button>
          </div>
        )}

        {/* Original Post */}
        {post && !isLoading && (
          <>
            <div className="root-post-card">
              {post.parent_context?.status === 'available' && post.parent_context?.post && (
                <div className="parent-context-card">
                  <span className="parent-context-label">
                    Replying to @{post.parent_context.post.username || 'remote-user'}
                  </span>
                  <p className="parent-context-content">
                    {post.parent_context.post.content || '(No content)'}
                  </p>
                </div>
              )}

              {post.parent_context?.status === 'missing' && (
                <div className="parent-context-missing">
                  ⚠️ Parent post unavailable. {post.parent_context?.message || 'It may be deleted or unreachable.'}
                </div>
              )}

              <div className="root-post-author">
                <div className="root-post-avatar">
                  {getInitials(post.username)}
                </div>
                <div className="root-post-meta">
                  <span className="root-post-name">@{post.username || 'unknown'}</span>
                  <span className="root-post-time">{formatTimestamp(post.created_at)}</span>
                </div>
              </div>

              <div className="root-post-body">{post.content}</div>

              {post.image_url && (
                <div className="root-post-image">
                  <img src={post.image_url} alt="Post attachment" />
                </div>
              )}

              <div className="root-post-stats">
                <span className="stat-item">💬 {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}</span>
              </div>
            </div>

            {/* Reply Composer - right under the post */}
            {userData?.id && (
              <div className="main-reply-composer">
                <div className="composer-avatar">
                  {getInitials(userData.username)}
                </div>
                <div className="composer-input-area">
                  <textarea
                    className="reply-textarea"
                    value={mainReplyText}
                    onChange={(e) => setMainReplyText(e.target.value)}
                    placeholder={`Reply to @${post.username || 'this post'}...`}
                    disabled={isOffline}
                    rows={2}
                    onFocus={(e) => { e.target.rows = 4; }}
                    onBlur={(e) => { if (!e.target.value) e.target.rows = 2; }}
                  />
                  {mainReplyText.trim() && (
                    <div className="composer-actions">
                      <span className="char-count">{mainReplyText.length}/500</span>
                      <button
                        className="reply-btn-submit"
                        onClick={handleMainReplySubmit}
                        disabled={isOffline || !mainReplyText.trim() || isSubmitting}
                      >
                        {isSubmitting ? 'Posting...' : 'Reply'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Replies Section */}
            <div className="replies-section">
              <div className="replies-header">
                {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}` : 'Replies'}
              </div>

              {repliesTree.length === 0 ? (
                <div className="empty-replies">
                  <span className="empty-icon">💬</span>
                  <p>No replies yet. Be the first to reply!</p>
                </div>
              ) : (
                <div className="replies-list">
                  {repliesTree.map(reply => (
                    <ReplyItem
                      key={reply.id}
                      reply={reply}
                      depth={0}
                      replyingToId={replyingToId}
                      setReplyingToId={setReplyingToId}
                      onSubmitReply={handlePostReply}
                      isSubmitting={isSubmitting}
                      userData={userData}
                      isOffline={isOffline}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
