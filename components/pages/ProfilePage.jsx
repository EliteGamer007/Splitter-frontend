'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ui/theme-provider';
import '../styles/ProfilePage.css';
import { followApi, userApi, postApi, getCurrentInstance, resolveMediaUrl } from '@/lib/api';
import SafeHTMLDisplay from '@/components/ui/SafeHTMLDisplay';

export default function ProfilePage({ onNavigate, userData, updateUserData, viewingUserId = null }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [userPosts, setUserPosts] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);
  const [circleMembers, setCircleMembers] = useState([]);
  const [isLoadingCircle, setIsLoadingCircle] = useState(false);
  const [isInMyCircle, setIsInMyCircle] = useState(false);
  const [isCircleLoading, setIsCircleLoading] = useState(false);

  const isImageURL = (value) => typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/'));

  const resolveURL = (value) => {
    if (!value || !isImageURL(value)) return '';
    const resolved = resolveMediaUrl(value);
    if (resolved) return resolved;
    try {
      const { url } = getCurrentInstance();
      const origin = new URL(url).origin;
      return `${origin}${value}`;
    } catch {
      return value;
    }
  };

  const refreshFollowData = async (targetId) => {
    if (!targetId) return;

    setIsLoadingFollows(true);
    try {
      const [followers, following, statsObj] = await Promise.all([
        followApi.getFollowers(targetId, 200, 0).catch(() => []),
        followApi.getFollowing(targetId, 200, 0).catch(() => []),
        followApi.getFollowStats(targetId).catch(() => null)
      ]);

      setFollowersList(followers || []);
      setFollowingList(following || []);

      setStats(prev => ({
        ...prev,
        followers: statsObj !== null ? statsObj.followers : (followers || []).length,
        following: statsObj !== null ? statsObj.following : (following || []).length,
      }));
    } catch (err) {
      console.error('Failed to fetch follower/following lists:', err);
    } finally {
      setIsLoadingFollows(false);
    }
  };

  // Fetch user profile and stats
  useEffect(() => {
    const fetchProfileAndStats = async () => {
      const targetId = viewingUserId || userData?.id;
      if (!targetId) {
        setProfileData(userData);
        return;
      }

      setIsLoadingProfile(true);
      try {
        let profile;
        if (viewingUserId) {
          // Viewing another user's profile
          profile = await userApi.getUserProfile(viewingUserId);
          setProfileData({
            username: profile.username,
            server: profile.instance_domain || 'splitter-1',
            displayName: profile.display_name || profile.username,
            avatar: profile.avatar_url || '👤',
            bio: profile.bio || 'No bio yet',
            email: profile.email,
            did: profile.did,
          });

          // Check if current user is following this user
          if (userData?.id) {
            try {
              const following = await followApi.getFollowing(userData.id);
              const isCurrentlyFollowing = (following || []).some(u => u.id === viewingUserId);
              setIsFollowing(isCurrentlyFollowing);
            } catch (err) {
              console.error('Failed to check follow status:', err);
            }
          }
        } else {
          // Viewing own profile
          setProfileData(userData);
        }

        await refreshFollowData(targetId);

        // Fetch post count (get user's posts)
        try {
          const targetDid = viewingUserId ? profile?.did : userData?.did;
          if (targetDid) {
            const posts = await postApi.getUserPosts(targetDid);
            setStats(prev => ({
              ...prev,
              posts: (posts || []).length,
            }));
            setUserPosts(posts || []);
          }
        } catch (err) {
          console.error('Failed to fetch user posts:', err);
        }

        // Load circle members (own profile) or circle membership status (other's profile)
        try {
          if (viewingUserId) {
            // Check if this person is in MY circle
            const inCircle = await circleApi.isInCircle(viewingUserId);
            setIsInMyCircle(inCircle);
          } else {
            // Own profile — load circle members
            setIsLoadingCircle(true);
            const members = await circleApi.getCircle();
            setCircleMembers(members || []);
          }
        } catch (err) {
          console.error('Failed to load circle data:', err);
        } finally {
          setIsLoadingCircle(false);
        }

      } catch (err) {
        console.error('Failed to load profile:', err);
        setProfileData(userData);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfileAndStats();
  }, [viewingUserId, userData]);

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!viewingUserId) return; // Can't follow yourself

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await followApi.unfollowUser(viewingUserId);
        setIsFollowing(false);
        // Instantly update stats
        setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        if (userData?.id) {
          setFollowersList(prev => prev.filter(u => u.id !== userData.id));
        }
      } else {
        await followApi.followUser(viewingUserId);
        setIsFollowing(true);
        // Instantly update stats
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        if (userData) {
          setFollowersList(prev => [...prev, userData]);
        }
      }

      // Still fetch the canonical data in the background
      refreshFollowData(viewingUserId);
    } catch (err) {
      console.error('Follow operation failed:', err);
      alert(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user: ${err.message}`);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Handle add/remove from circle (when viewing another user's profile)
  const handleCircleToggle = async () => {
    if (!viewingUserId) return;
    setIsCircleLoading(true);
    try {
      if (isInMyCircle) {
        await circleApi.removeFromCircle(viewingUserId);
        setIsInMyCircle(false);
      } else {
        await circleApi.addToCircle(viewingUserId);
        setIsInMyCircle(true);
      }
    } catch (err) {
      console.error('Circle operation failed:', err);
      alert(`Failed to update circle: ${err.message}`);
    } finally {
      setIsCircleLoading(false);
    }
  };

  // Handle removing a member from own circle (in the "My Circle" tab)
  const handleRemoveFromMyCircle = async (memberId) => {
    try {
      await circleApi.removeFromCircle(memberId);
      setCircleMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('Failed to remove from circle:', err);
      alert(`Failed to remove from circle: ${err.message}`);
    }
  };

  const handleUnfollowFromFollowing = async (targetUserId) => {
    if (!targetUserId || viewingUserId) return;

    try {
      await followApi.unfollowUser(targetUserId);
      const selfId = userData?.id;
      await refreshFollowData(selfId);
    } catch (err) {
      console.error('Failed to unfollow user:', err);
      alert(`Failed to unfollow user: ${err.message}`);
    }
  };

  const handleSaveProfile = async () => {
    if (viewingUserId) return;

    setIsSavingProfile(true);
    try {
      const updated = await userApi.updateProfile({
        display_name: editDisplayName,
        bio: editBio,
      });

      let finalUser = updated;
      if (selectedAvatarFile) {
        finalUser = await userApi.uploadAvatar(selectedAvatarFile);
      }

      const nextProfile = {
        username: finalUser.username,
        server: finalUser.instance_domain || 'splitter-1',
        displayName: finalUser.display_name || finalUser.username,
        avatar: finalUser.avatar_url || '👤',
        bio: finalUser.bio || '',
        email: finalUser.email,
        did: finalUser.did,
      };

      setProfileData(nextProfile);
      setSelectedAvatarFile(null);
      setAvatarPreview('');

      if (updateUserData) {
        updateUserData({
          displayName: nextProfile.displayName,
          bio: nextProfile.bio,
          avatar: nextProfile.avatar,
        });
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert(`Failed to update profile: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Use fetched profile data
  const displayData = profileData || userData;
  const profile = {
    username: displayData?.username || 'unknown',
    server: displayData?.server || 'splitter-1',
    displayName: displayData?.displayName || displayData?.display_name || displayData?.username || 'Unknown User',
    did: displayData?.did || 'did:key:...',
    avatar: displayData?.avatar || '👤',
    bio: displayData?.bio || 'No bio yet',
    email: displayData?.email,
    isLocal: true,
    followers: stats.followers,
    following: stats.following,
    posts: stats.posts,
  };

  useEffect(() => {
    setEditDisplayName(profile.displayName || '');
    setEditBio(profile.bio || '');
  }, [profile.displayName, profile.bio]);

  // Format post timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'recently';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoadingProfile) {
    return (
      <div className="profile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#00d9ff' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div>Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Top Navigation Bar */}
      <div className="profile-navbar">
        <div className="navbar-left">
          <button
            className="nav-button back-button"
            onClick={() => onNavigate('home')}
          >
            ← Back
          </button>
          <h1 className="navbar-title">Profile</h1>
        </div>
        <div className="navbar-center">
          <button className="nav-badge">Local</button>
          <button className="nav-badge">Federated</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button onClick={toggleTheme} className="nav-button theme-toggle" style={{ padding: '8px 12px', background: 'rgba(0,217,255,0.1)', border: '1px solid #00d9ff', color: '#00d9ff', borderRadius: '6px', cursor: 'pointer' }}>
            {isDarkMode ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      <div className="profile-content">
        {/* Profile Header Card */}
        <div className="profile-header-card">
          <div className="profile-header-top">
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" className="profile-avatar-image" />
                ) : isImageURL(profile.avatar) ? (
                  <img src={resolveURL(profile.avatar)} alt="Profile avatar" className="profile-avatar-image" />
                ) : (
                  profile.avatar
                )}
              </div>
              <div className="profile-info">
                <div className="profile-username">
                  @{profile.username}@{profile.server}
                  {!profile.isLocal && <span className="federated-badge">🌐</span>}
                </div>
              </div>
            </div>

            <div className="profile-actions">
              <button
                className={`follow-button ${isFollowing ? 'following' : ''}`}
                onClick={handleFollowToggle}
                disabled={isFollowLoading || !viewingUserId}
                style={{
                  opacity: isFollowLoading ? 0.6 : 1,
                  cursor: isFollowLoading || !viewingUserId ? 'not-allowed' : 'pointer'
                }}
              >
                {isFollowLoading ? '...' : isFollowing ? '✓ Following' : 'Follow'}
              </button>
              {viewingUserId && (
                <button
                  onClick={handleCircleToggle}
                  disabled={isCircleLoading}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${isInMyCircle ? '#ff6b6b' : '#00d9ff'}`,
                    background: isInMyCircle ? 'rgba(255,107,107,0.1)' : 'rgba(0,217,255,0.1)',
                    color: isInMyCircle ? '#ff6b6b' : '#00d9ff',
                    cursor: isCircleLoading ? 'not-allowed' : 'pointer',
                    opacity: isCircleLoading ? 0.6 : 1,
                    fontSize: '13px',
                  }}
                >
                  {isCircleLoading ? '...' : isInMyCircle ? '🔒 In Circle' : '+ Circle'}
                </button>
              )}
              <button className="message-button" title="DMs available on /dm page">
                Message 🔒
              </button>
            </div>
          </div>

          {/* DID Display */}
          <div className="profile-did-section">
            <div className="did-label">Decentralized Identifier</div>
            <div className="did-value">{profile.did}</div>
          </div>

          {/* Bio */}
          <div className="profile-bio">{profile.bio}</div>

          {!viewingUserId && (
            <div style={{ marginBottom: '16px', display: 'grid', gap: '10px' }}>
              <label style={{ fontSize: '13px', color: '#888' }}>Display Name</label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a2e', color: '#fff' }}
              />

              <label style={{ fontSize: '13px', color: '#888' }}>Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a2e', color: '#fff', resize: 'vertical' }}
              />

              <label style={{ fontSize: '13px', color: '#888' }}>Profile Photo</label>
              <input
                type="file"
                accept="image/png, image/jpeg, image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    alert('File size exceeds 5MB limit.');
                    return;
                  }
                  setSelectedAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />

              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile || !editDisplayName}
                style={{
                  width: 'fit-content',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #00d9ff',
                  background: 'rgba(0,217,255,0.1)',
                  color: '#00d9ff',
                  cursor: isSavingProfile ? 'not-allowed' : 'pointer',
                  opacity: isSavingProfile ? 0.6 : 1,
                }}
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          )}

          {/* Stats Bar */}
          <div className="profile-stats">
            <div className="stat-item">
              <div className="stat-number">{profile.posts}</div>
              <div className="stat-label">Posts</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{profile.followers}</div>
              <div className="stat-label">Followers</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{profile.following}</div>
              <div className="stat-label">Following</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
          <button
            className={`tab-button ${activeTab === 'followers' ? 'active' : ''}`}
            onClick={() => setActiveTab('followers')}
          >
            Followers
          </button>
          <button
            className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => setActiveTab('following')}
          >
            Following
          </button>
          {!viewingUserId && (
            <button
              className={`tab-button ${activeTab === 'circle' ? 'active' : ''}`}
              onClick={() => setActiveTab('circle')}
            >
              🔒 My Circle
            </button>
          )}
        </div>

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div className="profile-posts-list">
            {userPosts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '32px' }}>
                No posts yet
              </div>
            ) : (
              userPosts.map((post) => (
                <div
                  key={post.id}
                  className="post-card-profile"
                  onClick={() => onNavigate('thread', { postId: post.id })}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="post-badges">
                    {post.is_remote ? (
                      <span className="federated-badge" title="This post is from a remote federated instance">🌐 Remote</span>
                    ) : (
                      <span className="local-badge" title="This post is from your local instance (localhost)">Local</span>
                    )}
                    {post.visibility === 'followers' && (
                      <span className="followers-badge" title="Only followers can see this post">👥 Followers Only</span>
                    )}
                    {post.visibility === 'circle' && (
                      <span className="followers-badge" title="Only close circle can see this post">🔒 Circle</span>
                    )}
                  </div>
                  <div className="post-content">
                    <SafeHTMLDisplay html={post.content} onHashtagClick={(tag) => onNavigate('hashtag', { hashtag: tag })} />
                  </div>
                  <div className="post-timestamp">{formatTimestamp(post.created_at)}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Followers Tab */}
        {activeTab === 'followers' && (
          <div className="profile-list">
            {isLoadingFollows ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>Loading followers...</div>
            ) : followersList.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>No followers yet</div>
            ) : (
              followersList.map((user) => (
                <div className="list-item" key={`follower-${user.id}`}>
                  <div className="follower-avatar">
                    {isImageURL(user.avatar_url) ? (
                      <img src={resolveURL(user.avatar_url)} alt="Follower avatar" className="profile-avatar-image" />
                    ) : (
                      user.avatar_url || '👤'
                    )}
                  </div>
                  <div className="follower-info">
                    <div className="follower-name">@{user.username}@{user.instance_domain || 'local'}</div>
                    <div className="follower-status">{user.display_name || user.username}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Following Tab */}
        {activeTab === 'following' && (
          <div className="profile-list">
            {isLoadingFollows ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>Loading following...</div>
            ) : followingList.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>Not following anyone yet</div>
            ) : (
              followingList.map((user) => (
                <div className="list-item" key={`following-${user.id}`}>
                  <div className="follower-avatar">
                    {isImageURL(user.avatar_url) ? (
                      <img src={resolveURL(user.avatar_url)} alt="Following avatar" className="profile-avatar-image" />
                    ) : (
                      user.avatar_url || '👤'
                    )}
                  </div>
                  <div className="follower-info">
                    <div className="follower-name">@{user.username}@{user.instance_domain || 'local'}</div>
                    <div className="follower-status">{user.display_name || user.username}</div>
                  </div>
                  {!viewingUserId && (
                    <button className="unfollow-button" onClick={() => handleUnfollowFromFollowing(user.id)}>Unfollow</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* My Circle Tab — own profile only */}
        {activeTab === 'circle' && !viewingUserId && (
          <div className="profile-list">
            {isLoadingCircle ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>Loading circle...</div>
            ) : circleMembers.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '24px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
                <div>Your circle is empty.</div>
                <div style={{ fontSize: '13px', marginTop: '8px', color: '#555' }}>
                  Visit someone's profile and click "+ Circle" to add them.
                </div>
              </div>
            ) : (
              circleMembers.map((user) => (
                <div className="list-item" key={`circle-${user.id}`}>
                  <div className="follower-avatar">
                    {isImageURL(user.avatar_url) ? (
                      <img src={resolveURL(user.avatar_url)} alt="Circle member avatar" className="profile-avatar-image" />
                    ) : (
                      user.avatar_url || '👤'
                    )}
                  </div>
                  <div className="follower-info">
                    <div className="follower-name">@{user.username}@{user.instance_domain || 'local'}</div>
                    <div className="follower-status">{user.display_name || user.username}</div>
                  </div>
                  <button
                    className="unfollow-button"
                    onClick={() => handleRemoveFromMyCircle(user.id)}
                    style={{ background: 'rgba(255,107,107,0.1)', borderColor: '#ff6b6b', color: '#ff6b6b' }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
