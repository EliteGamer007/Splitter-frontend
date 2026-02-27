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

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

// Recursive Reply Component
const ReplyItem = ({
  reply,
  depth,
  replyingToId,
  setReplyingToId,
  onSubmitReply,
  isSubmitting,
  userData
}) => {
  const [replyText, setReplyText] = useState('');
  const isReplying = replyingToId === reply.id;
  const showReplyButton = depth < 3 && userData?.id;

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    await onSubmitReply(reply.id, replyText);
    setReplyText('');
    setReplyingToId(null);
  };

  return (
    <div
      className={`reply-card depth-${depth}`}
      style={{
        marginLeft: depth > 0 ? '20px' : '0',
        borderLeft: depth > 0 ? '2px solid rgba(255,255,255,0.1)' : 'none',
        paddingLeft: depth > 0 ? '12px' : '0'
      }}
    >
      <div className="reply-author-section">
        <div className="reply-avatar">{reply.avatar_url || '👤'}</div>
        <div className="reply-author-info">
          <div className="reply-author-name">
            {reply.username ? `@${reply.username}` : 'Unknown'}
          </div>
          <div className="reply-timestamp">
            {formatTimestamp(reply.created_at)}
          </div>
        </div>
      </div>

      <div className="reply-body">{reply.content}</div>

      {showReplyButton && (
        <div className="reply-actions">
          <button
            className="action-button"
            onClick={() => setReplyingToId(isReplying ? null : reply.id)}
          >
            💬 Reply
          </button>
        </div>
      )}

      {isReplying && (
        <div className="nested-reply-composer" style={{ marginTop: '10px' }}>
          <textarea
            className="reply-textarea"
            placeholder={`Replying to @${reply.username || 'user'}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            autoFocus
          />
          <div className="composer-actions">
            <button
              className="reply-button cancel"
              onClick={() => setReplyingToId(null)}
            >
              Cancel
            </button>
            <button
              className="reply-button"
              onClick={handleSubmit}
              disabled={!replyText.trim() || isSubmitting}
            >
              {isSubmitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

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
    setIsLoading(true);
    try {
      const postData = await postApi.getPost(postId);
      setPost(postData);

      const replies = await postApi.getReplies(postId);
      setRepliesTree(buildReplyTree(replies));
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
    if (!mainReplyText.trim()) return;
    await handlePostReply(null, mainReplyText);
    setMainReplyText('');
  };

  return (
    <div className="thread-container">
      <div className="thread-navbar">
        <button onClick={() => onNavigate('home')}>← Back</button>
        <button onClick={toggleTheme}>
          {isDarkMode ? '🌙' : '☀️'}
        </button>
      </div>

      {post && (
        <div className="root-post-card">
          {post.parent_context?.status === 'available' && post.parent_context?.post && (
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 217, 255, 0.35)',
              background: 'rgba(0, 217, 255, 0.08)'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '6px' }}>
                Thread context loaded {post.parent_context.source === 'cache' ? 'from local cache' : 'from remote instance'}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>
                Replying to @{post.parent_context.post.username || 'remote-user'}
              </div>
              <div style={{ fontSize: '14px' }}>
                {post.parent_context.post.content || '(No content)'}
              </div>
            </div>
          )}

          {post.parent_context?.status === 'missing' && (
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 140, 0, 0.45)',
              background: 'rgba(255, 140, 0, 0.1)',
              fontSize: '13px'
            }}>
              ⚠️ Parent post unavailable. {post.parent_context?.message || 'It may be deleted or unreachable.'}
            </div>
          )}

          <div className="post-author-name">
            @{post.username || 'unknown'}
          </div>
          <div className="post-body">{post.content}</div>
          <div className="post-stats">
            <span>{post.total_reply_count || 0} Replies</span>
          </div>
        </div>
      )}

      <div className="replies-section">
        {repliesTree.length === 0 ? (
          <div className="empty-replies">No replies yet.</div>
        ) : (
          repliesTree.map(reply => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              depth={1}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              onSubmitReply={handlePostReply}
              isSubmitting={isSubmitting}
              userData={userData}
            />
          ))
        )}
      </div>

      {userData?.id && (
        <div className="reply-composer">
          <textarea
            className="reply-textarea"
            value={mainReplyText}
            onChange={(e) => setMainReplyText(e.target.value)}
            placeholder="Write a reply..."
          />
          <div className="composer-actions">
            <button
              className="reply-button cancel"
              onClick={() => setMainReplyText('')}
            >
              Cancel
            </button>
            <button
              className="reply-button"
              onClick={handleMainReplySubmit}
              disabled={!mainReplyText.trim() || isSubmitting}
            >
              {isSubmitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
