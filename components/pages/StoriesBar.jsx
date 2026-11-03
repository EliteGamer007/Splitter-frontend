'use client';
import ProtectedImage from '@/components/ui/ProtectedImage';


import React, { useState, useEffect, useRef } from 'react';
import { storyApi } from '@/lib/api';

export default function StoriesBar({ userData, resolveAssetURL }) {
  const [storyOffset,setStoryOffset] = useState(0);
  const [moreStories,setMoreStories] = useState(false);
  const [storyUsers, setStoryUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUserIdx, setViewerUserIdx] = useState(0);
  const [viewerStoryIdx, setViewerStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const progressTimerRef = useRef(null);
  const scrollRef = useRef(null);

  const STORY_DURATION = 5000; // 5 seconds per story

  // Fetch stories on mount
  useEffect(() => {
    fetchStories();
  }, []);

  const loadMoreStories = async () => {
    if(isLoading)return;setIsLoading(true);
    try {const data=await storyApi.getStoryFeed(20,storyOffset);const groups=data.stories || [];const count=groups.reduce((sum,g)=>sum+(g.stories?.length || 0),0);setStoryOffset(previous=>previous+count);setMoreStories(count>=20);setStoryUsers(previous=>{const merged=previous.map(group=>({...group,stories:[...group.stories]}));for(const group of groups){const existing=merged.find(g=>g.author_did===group.author_did);if(existing){existing.stories=[...existing.stories,...group.stories].filter((story,index,list)=>list.findIndex(s=>s.id===story.id)===index);}else merged.push(group);}return merged;});}
    catch(err){alert(err.message || 'Could not load more stories.');}finally{setIsLoading(false);}
  };
  const fetchStories = async () => {
    try {
      const data = await storyApi.getStoryFeed();
      setStoryUsers(data.stories || []);
      const count=(data.stories || []).reduce((sum,group)=>sum+(group.stories?.length || 0),0);setStoryOffset(count);setMoreStories(count>=20);
    } catch (err) {
      console.log('Failed to fetch stories:', err);
      setStoryUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload for new story
  const handleAddStory = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await storyApi.createStory(file);
      await fetchStories();
    } catch (err) {
      console.error('Failed to upload story:', err);
      alert('Failed to upload story: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Viewer logic
  const openViewer = (userIdx) => {
    setViewerUserIdx(userIdx);
    setViewerStoryIdx(0);
    setProgress(0);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    clearInterval(progressTimerRef.current);
  };

  // Auto-advance progress bar
  useEffect(() => {
    if (!viewerOpen) return;

    setProgress(0);
    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(progressTimerRef.current);
        // Advance to next story or next user
        advanceStory();
      }
    }, 50);

    return () => clearInterval(progressTimerRef.current);
  }, [viewerOpen, viewerUserIdx, viewerStoryIdx]);

  const advanceStory = () => {
    const currentUser = storyUsers[viewerUserIdx];
    if (!currentUser) { closeViewer(); return; }

    if (viewerStoryIdx < currentUser.stories.length - 1) {
      setViewerStoryIdx(prev => prev + 1);
    } else if (viewerUserIdx < storyUsers.length - 1) {
      setViewerUserIdx(prev => prev + 1);
      setViewerStoryIdx(0);
    } else {
      closeViewer();
    }
  };

  const goBack = () => {
    if (viewerStoryIdx > 0) {
      setViewerStoryIdx(prev => prev - 1);
    } else if (viewerUserIdx > 0) {
      setViewerUserIdx(prev => prev - 1);
      const prevUser = storyUsers[viewerUserIdx - 1];
      setViewerStoryIdx(prevUser ? prevUser.stories.length - 1 : 0);
    }
  };

  const handleViewerClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 3) {
      goBack();
    } else {
      advanceStory();
    }
  };

  // Check if current user has a story
  const currentUserHasStory = storyUsers.length > 0 && storyUsers[0]?.author_did === userData?.did;

  const isImageAvatar = (avatar) =>
    typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/'));

  if (isLoading) {
    return (
      <div className="stories-bar">
        <div className="stories-scroll">
          {/* Skeleton circles */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="story-item">
              <div className="story-ring story-skeleton">
                <div className="story-avatar-inner" style={{ background: 'var(--secondary-navy)' }} />
              </div>
              <span className="story-username" style={{ color: 'var(--text-muted)' }}>•••</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="stories-bar">
        <div className="stories-scroll" ref={scrollRef}>
          {/* Add Story Button */}
          <div className="story-item" onClick={handleAddStory} style={{ cursor: 'pointer' }}>
            <div className="story-ring story-add">
              <div className="story-avatar-inner">
                {isImageAvatar(userData?.avatar) ? (
                  <ProtectedImage
                    src={resolveAssetURL(userData.avatar, userData.server)}
                    alt="Your avatar"
                    className="story-avatar-img"
                  />
                ) : (
                  <span className="story-avatar-emoji">{userData?.avatar || '👤'}</span>
                )}
                <div className="story-add-badge">
                  {isUploading ? (
                    <span style={{ fontSize: '10px' }}>⏳</span>
                  ) : (
                    <span>+</span>
                  )}
                </div>
              </div>
            </div>
            <span className="story-username">Your Story</span>
          </div>

{moreStories && <button onClick={loadMoreStories} disabled={isLoading}>More stories</button>}
          {/* Story User Circles */}
          {storyUsers.map((user, idx) => {
            // Skip "Your Story" as a separate circle if currentUser has a story — show it as first circle separately
            const isOwnStory = user.author_did === userData?.did;
            return (
              <div
                key={user.author_did}
                className="story-item"
                onClick={() => openViewer(idx)}
                style={{ cursor: 'pointer' }}
              >
                <div className={`story-ring ${isOwnStory ? 'story-ring-own' : 'story-ring-active'}`}>
                  <div className="story-avatar-inner">
                    {isImageAvatar(user.avatar_url) ? (
                      <ProtectedImage
                        src={resolveAssetURL(user.avatar_url, userData?.server)}
                        alt={user.username}
                        className="story-avatar-img"
                      />
                    ) : (
                      <span className="story-avatar-emoji">{user.avatar_url || '👤'}</span>
                    )}
                  </div>
                </div>
                <span className="story-username">
                  {isOwnStory ? 'You' : (user.display_name || user.username || 'User')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>

      {/* Full-screen Story Viewer */}
      {viewerOpen && storyUsers[viewerUserIdx] && (
        <div className="story-viewer-overlay" onClick={handleViewerClick}>
          {/* Progress bars */}
          <div className="story-viewer-progress-bar-container">
            {storyUsers[viewerUserIdx].stories.map((_, sIdx) => (
              <div key={sIdx} className="story-progress-track">
                <div
                  className="story-progress-fill"
                  style={{
                    width: sIdx < viewerStoryIdx ? '100%'
                      : sIdx === viewerStoryIdx ? `${progress}%`
                      : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header: user info + close */}
          <div className="story-viewer-header">
            <div className="story-viewer-user-info">
              <div className="story-viewer-avatar">
                {isImageAvatar(storyUsers[viewerUserIdx].avatar_url) ? (
                  <ProtectedImage
                    src={resolveAssetURL(storyUsers[viewerUserIdx].avatar_url, userData?.server)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <span>{storyUsers[viewerUserIdx].avatar_url || '👤'}</span>
                )}
              </div>
              <span className="story-viewer-username">
                {storyUsers[viewerUserIdx].display_name || storyUsers[viewerUserIdx].username}
              </span>
              <span className="story-viewer-time">
                {formatStoryTime(storyUsers[viewerUserIdx].stories[viewerStoryIdx]?.created_at)}
              </span>
            </div>
            <button
              className="story-viewer-close"
              onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            >
              ✕
            </button>
          </div>

          {/* Story image */}
          <div className="story-viewer-image-container">
            <ProtectedImage
              src={storyApi.getStoryMediaUrl(storyUsers[viewerUserIdx].stories[viewerStoryIdx]?.id)}
              alt="Story"
              className="story-viewer-image"
            />
          </div>
        </div>
      )}
    </>
  );
}

function formatStoryTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
