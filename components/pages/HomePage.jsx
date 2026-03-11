'use client';

import React, { useState, useEffect } from 'react';
import '../styles/HomePage.css';
import { postApi, interactionApi, adminApi, searchApi, messageApi, federationApi, hashtagApi, getCurrentInstance } from '@/lib/api';
import HomePageWalkthrough from '@/components/ui/HomePageWalkthrough';
import StoriesBar from '@/components/ui/StoriesBar';

// Sample posts for demo when no backend posts available
const SAMPLE_POSTS = [
  {
    id: 'sample-1',
    author: 'alice@federate.tech',
    avatar: '👩',
    displayName: 'Alice Chen',
    handle: '@alice',
    timestamp: '2h ago',
    content: 'Just deployed a new federated instance! The decentralization is working beautifully. 🚀',
    replies: 12,
    boosts: 45,
    likes: 128,
    local: true,
    visibility: 'public'
  },
  {
    id: 'sample-2',
    author: 'bob@community.social',
    avatar: '👨',
    displayName: 'Bob Smith',
    handle: '@bob',
    timestamp: '4h ago',
    content: 'Love the transparency in this federated model. No hidden algorithms, just real human connections. 💙',
    replies: 8,
    boosts: 32,
    likes: 95,
    local: false,
    visibility: 'public'
  },
  {
    id: 'sample-3',
    author: 'charlie@tech-minds.io',
    avatar: '👨‍💻',
    displayName: 'Charlie Dev',
    handle: '@charlie',
    timestamp: '6h ago',
    content: 'Implemented end-to-end encryption for DMs. Your messages are truly private now. 🔐',
    replies: 24,
    boosts: 67,
    likes: 234,
    local: false,
    visibility: 'public'
  }
];

import { useTheme } from '@/components/ui/theme-provider';

export default function HomePage({ onNavigate, userData, updateUserData, handleLogout }) {
  const { theme, toggleTheme } = useTheme();



  const isDarkMode = theme === 'dark';
  const [activeTab, setActiveTab] = useState('home');
  const [newPostText, setNewPostText] = useState('');
  const [newPostVisibility, setNewPostVisibility] = useState('public');
  const [newPostExpiryMinutes, setNewPostExpiryMinutes] = useState('0');
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hashtagSearchResults, setHashtagSearchResults] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [followingUsers, setFollowingUsers] = useState(new Set());
  const [followLoading, setFollowLoading] = useState(new Set());

  // Helper: check if a user is followed (supports both local ID and remote username@domain)
  const isUserFollowed = (user) => {
    if (!user) return false;
    if (followingUsers.has(user.id)) return true;
    if (user.is_remote && user.username && user.domain) {
      return followingUsers.has(`${user.username}@${user.domain}`);
    }
    return false;
  };
  const [isOffline, setIsOffline] = useState(false);

  // Edit/Delete state
  const [editingPostId, setEditingPostId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Report / appeal state
  const [reportMenuPostId, setReportMenuPostId] = useState(null);
  const [reportModalPostId, setReportModalPostId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');

  const isImageAvatar = (avatar) => typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/'));

  const getOriginForDomain = (domain) => {
    if (domain === 'splitter-1') return 'https://splitter-m0kv.onrender.com';
    if (domain === 'splitter-2') return 'https://splitter-2.onrender.com';
    const { url } = getCurrentInstance();
    return new URL(url).origin;
  };

  const resolveAssetURL = (assetPath, domain) => {
    if (!assetPath || !isImageAvatar(assetPath)) return '';
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
    try {
      const origin = getOriginForDomain(domain);
      return `${origin}${assetPath}`;
    } catch {
      return assetPath;
    }
  };

  const dedupePosts = (list) => {
    const seen = new Set();
    return (list || []).filter((post, index) => {
      const identity = `${post.id || 'id'}-${post.authorId || post.author_did || post.author || 'author'}-${post.createdAt || post.created_at || index}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  };

  const parseRemoteIdentity = (post, fallbackDomain) => {
    let username = post.username || '';
    let domain = post.domain || fallbackDomain;

    const authorDid = typeof post.author_did === 'string' ? post.author_did : '';
    if (authorDid.startsWith('http://') || authorDid.startsWith('https://')) {
      try {
        const parsed = new URL(authorDid);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (!username && pathParts.length > 0) {
          username = pathParts[pathParts.length - 1] || '';
        }
        if (parsed.host.includes('localhost:8001') || parsed.host.includes('splitter-2.onrender.com')) {
          domain = 'splitter-2';
        } else if (parsed.host.includes('localhost:8000') || parsed.host.includes('splitter-m0kv.onrender.com')) {
          domain = 'splitter-1';
        } else if (!post.domain) {
          domain = parsed.hostname || domain;
        }
      } catch {
      }
    }

    return { username, domain };
  };

  // Fetch posts on mount and when tab changes
  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  // Fetch trending hashtags
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const data = await hashtagApi.getTrending(5);
        setTrendingHashtags(Array.isArray(data) ? data : []);
      } catch (err) {
        console.log('Failed to fetch trending hashtags:', err);
      }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    const updateStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    updateStatus();

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  // Fetch current user's following list and update counts on mount
  useEffect(() => {
    const loadFollowingListAndCounts = async () => {
      if (!userData?.id) return;

      try {
        const { followApi } = await import('@/lib/api');
        const following = await followApi.getFollowing(userData.id);

        // Create a Set of user IDs and username@domain keys for following
        // This handles both local users (by ID) and remote ghost users (by username@domain)
        const followingIds = new Set();
        (following || []).forEach(user => {
          followingIds.add(user.id);
          // Also add username@domain key for remote user matching
          if (user.username && user.instance_domain) {
            followingIds.add(`${user.username}@${user.instance_domain}`);
          }
        });
        setFollowingUsers(followingIds);
        console.log('Loaded following list:', followingIds);

        // Fetch and update follower/following counts
        try {
          const stats = await followApi.getFollowStats(userData.id);
          if (updateUserData) {
            updateUserData({
              followers: stats.followers || 0,
              following: stats.following || 0
            });
          }
        } catch (statsErr) {
          console.error('Failed to load follow stats:', statsErr);
        }
      } catch (err) {
        console.error('Failed to load following list:', err);
      }
    };

    loadFollowingListAndCounts();
  }, [userData?.id]);

  // Search users and hashtags
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const current = getCurrentInstance();

      // Search local users first
      const localResult = await searchApi.searchUsers(searchQuery);
      const localUsers = (localResult.users || [])
        .map(u => {
          const instanceDomain = u.instance_domain || '';
          const isGhostRemote = instanceDomain && instanceDomain !== 'localhost' && instanceDomain !== current.domain;
          return {
            ...u,
            is_remote: isGhostRemote,
            domain: instanceDomain || current.domain,
          };
        })
        .filter(u => !u.is_remote);

      // Also search federated users
      let federatedUsers = [];
      try {
        const fedResult = await federationApi.searchUsers(searchQuery);
        federatedUsers = (fedResult.users || []).filter(u => u.is_remote).map(u => ({
          ...u,
          is_remote: true,
        }));
      } catch (fedErr) {
        console.log('Federation search unavailable:', fedErr);
      }

      // Also search hashtags
      const cleanQuery = searchQuery.startsWith('#') ? searchQuery.slice(1) : searchQuery;
      let hashtagResults = [];
      try {
        hashtagResults = await hashtagApi.searchHashtags(cleanQuery, 5);
        if (!Array.isArray(hashtagResults)) hashtagResults = [];
      } catch (htErr) {
        console.log('Hashtag search unavailable:', htErr);
      }
      setHashtagSearchResults(hashtagResults);

      // Merge local + federated, deduplicate by id+domain
      const seenUsernames = new Set();
      const merged = [];
      for (const u of localUsers) {
        const key = `${u.id || ''}|${u.username}@${u.domain || u.instance_domain || 'local'}`;
        if (!seenUsernames.has(key)) {
          seenUsernames.add(key);
          merged.push(u);
        }
      }
      for (const u of federatedUsers) {
        const key = `${u.id || ''}|${u.username}@${u.domain || 'remote'}`;
        if (!seenUsernames.has(key)) {
          seenUsernames.add(key);
          merged.push(u);
        }
      }

      console.log('Search results (merged):', merged);
      setSearchResults(merged);
      if (merged.length > 0) {
        console.log('First user object:', merged[0]);
      }
      setShowSearchResults(true);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    } else {
      setShowSearchResults(false);
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Start DM with user
  const startDMWithUser = async (user) => {
    try {
      await messageApi.startConversation(user.id);
      setShowSearchResults(false);
      setSearchQuery('');
      onNavigate('dm', { selectedUser: user });
    } catch (err) {
      console.error('Failed to start conversation:', err);
      alert('Failed to start conversation: ' + err.message);
    }
  };

  // Follow/Unfollow user (handles both local and remote users)
  const handleFollowToggle = async (userId, user = null) => {
    console.log('Follow toggle called for userId:', userId, 'user:', user);
    const isFollowing = isUserFollowed(user || { id: userId });
    const remoteKey = user?.is_remote && user?.username && user?.domain
      ? `${user.username}@${user.domain}` : null;

    // Add to loading set
    setFollowLoading(prev => new Set(prev).add(userId));

    try {
      const { followApi } = await import('@/lib/api');

      if (isFollowing) {
        console.log('Unfollowing user:', userId);
        await followApi.unfollowUser(userId);
        setFollowingUsers(prev => {
          const next = new Set(prev);
          next.delete(userId);
          if (remoteKey) next.delete(remoteKey);
          return next;
        });
      } else {
        // For remote users, use federation follow
        if (user && user.is_remote && user.username && user.domain) {
          console.log('Federation following remote user:', `@${user.username}@${user.domain}`);
          await federationApi.followRemoteUser(`${user.username}@${user.domain}`);
        } else {
          console.log('Following local user:', userId);
          await followApi.followUser(userId);
        }
        setFollowingUsers(prev => {
          const next = new Set(prev).add(userId);
          if (remoteKey) next.add(remoteKey);
          return next;
        });
      }
      console.log('Follow operation successful');
    } catch (err) {
      console.error('Follow operation failed:', err);
      alert(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user: ${err.message}`);
    } finally {
      // Remove from loading set
      setFollowLoading(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const fetchPosts = async () => {
    if (!navigator.onLine) {
      const cached = localStorage.getItem(`timeline_cache_${activeTab}`);
      if (cached) {
        try {
          setPosts(JSON.parse(cached));
        } catch (e) {
          console.error("Failed to parse cached timeline:", e);
        }
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let feedPosts;
      const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;

      if (activeTab === 'home') {
        // Home tab: authenticated feed
        if (token) {
          try {
            feedPosts = await postApi.getFeed(20, 0);

            // Ensure followed remote posts are included from federated timeline
            try {
              const { followApi } = await import('@/lib/api');
              const following = await followApi.getFollowing(userData?.id, 200, 0);
              const followedHandles = new Set(
                (following || [])
                  .filter(u => {
                    const domain = u.instance_domain || u.domain || '';
                    return domain && domain !== 'localhost' && domain !== getCurrentInstance().domain;
                  })
                  .map(u => `${u.username}@${u.instance_domain || u.domain}`.toLowerCase())
              );

              if (followedHandles.size > 0) {
                const fedResult = await federationApi.getTimeline(100);
                const followedRemotePosts = (fedResult.posts || []).filter(p => {
                  if (!p.is_remote) return false;
                  const domain = p.domain || (typeof p.author_did === 'string' && (p.author_did.includes('localhost:8001') || p.author_did.includes('splitter-2.onrender.com')) ? 'splitter-2' : (p.author_did?.includes('localhost:8000') || p.author_did?.includes('splitter-m0kv.onrender.com')) ? 'splitter-1' : '');
                  const handle = `${p.username || ''}@${domain}`.toLowerCase();
                  return followedHandles.has(handle);
                });
                feedPosts = [...(feedPosts || []), ...followedRemotePosts];
              }
            } catch (mergeErr) {
              console.log('Followed remote merge skipped:', mergeErr);
            }
          } catch (authErr) {
            feedPosts = await postApi.getPublicFeed(20, 0, false);
          }
        } else {
          feedPosts = await postApi.getPublicFeed(20, 0, false);
        }
      } else if (activeTab === 'local') {
        // Local tab: local_only = true
        feedPosts = await postApi.getPublicFeed(20, 0, true);
      } else if (activeTab === 'federated') {
        // Federated tab: fetch from federation timeline (includes remote posts)
        try {
          const fedResult = await federationApi.getTimeline(50);
          feedPosts = (fedResult.posts || []).filter(p => p.is_remote === true);
        } catch (fedErr) {
          console.error('Federation timeline failed, falling back:', fedErr);
          feedPosts = await postApi.getPublicFeed(20, 0, false);
        }
      }

      if (feedPosts && feedPosts.length > 0) {
        const instanceInfo = getCurrentInstance();
        const transformedPosts = feedPosts.map(post => {
          const identity = parseRemoteIdentity(post, instanceInfo.domain);
          const derivedDomain = identity.domain || instanceInfo.domain;
          // For remote posts with a plain UUID author_did, don't use it as username
          const didLooksLikeUrl = post.author_did?.startsWith('http');
          const derivedUsername = identity.username ||
            (didLooksLikeUrl ? post.author_did?.split('/').pop() : null) ||
            post.display_name?.toLowerCase().replace(/\s+/g, '_') ||
            'user';

          return {
            id: post.id,
            author: `${derivedUsername}@${derivedDomain}`,
            authorId: post.author_id || post.user_id,
            avatar: post.avatar_url || '👤',
            displayName: post.display_name || derivedUsername || 'Unknown',
            handle: `@${derivedUsername}`,
            timestamp: formatTimestamp(post.created_at),
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            content: post.content,
            replies: post.total_reply_count || 0,
            boosts: post.repost_count || 0,
            likes: post.like_count || 0,
            local: post.is_remote !== undefined ? !post.is_remote : (post.is_local !== undefined ? post.is_local : true),
            isRemote: post.is_remote || false,
            domain: derivedDomain,
            instanceUrl: post.instance_url || null,
            visibility: post.visibility || 'public',
            expiresAt: post.expires_at || null,
            liked: post.liked || false,
            reposted: post.reposted || false,
            bookmarked: post.bookmarked || false,
            imageUrl: post.media?.[0]?.media_url || null
          };
        });
        const currentDomain = instanceInfo.domain;
        let filteredPosts = dedupePosts(transformedPosts);

        if (activeTab === 'local') {
          filteredPosts = filteredPosts.filter((item) => !item.isRemote && (item.domain === currentDomain || item.domain === 'localhost'));
        } else if (activeTab === 'federated') {
          filteredPosts = filteredPosts.filter((item) => item.isRemote);
        }

        setPosts(filteredPosts);
        localStorage.setItem(
          `timeline_cache_${activeTab}`,
          JSON.stringify(filteredPosts)
        );
      } else {
        if (activeTab === 'home') {
          setPosts(SAMPLE_POSTS);
        } else {
          setPosts([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      if (activeTab === 'home') {
        setPosts(SAMPLE_POSTS);
      } else {
        setPosts([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  const formatRemainingLifetime = (expiresAt) => {
    if (!expiresAt) return '';
    const expiryDate = new Date(expiresAt);
    const diffMs = expiryDate.getTime() - Date.now();
    if (Number.isNaN(expiryDate.getTime()) || diffMs <= 0) {
      return 'Expired';
    }
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h left`;
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  };

  const handlePostCreate = async () => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    // allow text OR image OR both
    if (!newPostText.trim() && !selectedFile) return;

    setIsPosting(true);

    try {
      const newPost = await postApi.createPost(
        newPostText.trim(),          // always send content
        newPostVisibility,
        selectedFile || undefined,   // always send file if exists
        newPostExpiryMinutes === '0' ? null : Number(newPostExpiryMinutes)
      );

      const transformedPost = {
        id: newPost.id,
        author: `${userData.username}@${userData.server}`,
        authorId: userData.id,
        avatar: userData.avatar,
        displayName: userData.displayName,
        handle: `@${userData.username}`,
        timestamp: 'now',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: newPost.content,
        expiresAt: newPost.expires_at || null,
        replies: 0,
        boosts: 0,
        likes: 0,
        local: true,
        visibility: newPostVisibility,
        imageUrl: newPost.media?.[0]?.media_url || null
      };

      setPosts(prev => dedupePosts([transformedPost, ...prev]));

      // Refresh trending hashtags after posting (in case new hashtags were used)
      try {
        const freshTrending = await hashtagApi.getTrending(5);
        setTrendingHashtags(Array.isArray(freshTrending) ? freshTrending : []);
      } catch (_) {}

      // reset composer
      setNewPostText('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setNewPostExpiryMinutes('0');

    } catch (err) {
      setError('Failed to create post: ' + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  // Edit post
  const handleEditStart = (post) => {
    setEditingPostId(post.id);
    setEditText(post.content);
  };

  const handleEditCancel = () => {
    setEditingPostId(null);
    setEditText('');
  };

  const handleEditSave = async (postId) => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    if (!editText.trim()) return;

    try {
      await postApi.updatePost(postId, editText);
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, content: editText, updatedAt: new Date().toISOString() }
          : p
      ));
      setEditingPostId(null);
      setEditText('');
    } catch (err) {
      alert('Failed to update post: ' + err.message);
    }
  };

  // Delete post
  const handleDeleteConfirm = async (postId) => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    try {
      await postApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDeleteConfirmId(null);
    } catch (err) {
      alert('Failed to delete post: ' + err.message);
    }
  };

  const handleLike = async (postId) => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    try {
      const post = posts.find(p => p.id === postId);
      if (post?.liked) {
        await interactionApi.unlikePost(postId);
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, liked: false, likes: p.likes - 1 } : p
        ));
      } else {
        await interactionApi.likePost(postId);
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, liked: true, likes: p.likes + 1 } : p
        ));
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleRepost = async (postId) => {
    if (isOffline) {
      alert("You're offline. This action is disabled.");
      return;
    }
    try {
      const post = posts.find(p => p.id === postId);
      if (post?.reposted) {
        await interactionApi.unrepostPost(postId);
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, reposted: false, boosts: p.boosts - 1 } : p
        ));
      } else {
        await interactionApi.repostPost(postId);
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, reposted: true, boosts: p.boosts + 1 } : p
        ));
      }
    } catch (err) {
      console.error('Repost failed:', err);
    }
  };

  // Check if post was edited
  const isEdited = (post) => {
    if (!post.createdAt || !post.updatedAt) return false;
    return new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 1000;
  };

  // Check if current user owns the post
  const isOwnPost = (post) => {
    return post.authorId === userData?.id ||
      post.handle === `@${userData?.username}` ||
      post.author?.startsWith(userData?.username);
  };

  const handleReportSubmit = async () => {
    if (!reportModalPostId || !reportReason) return;
    setReportSubmitting(true);
    try {
      await postApi.reportPost(reportModalPostId, reportReason);
      setReportSuccess('Report submitted. Our AI moderation system will review it shortly.');
      setTimeout(() => { setReportModalPostId(null); setReportSuccess(''); }, 3000);
    } catch (err) {
      setReportSuccess('Failed to submit report: ' + (err.message || 'Unknown error'));
    } finally {
      setReportSubmitting(false);
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'followers': return '(followers)';
      case 'circle': return '(circle)';
      default: return '(public)';
    }
  };

  return (
    <div className="home-container" onClick={() => setReportMenuPostId(null)}>
      {/* Walkthrough */}
      <HomePageWalkthrough />

      {/* Top Navigation */}
      <nav className="home-nav">
        <div className="nav-left">
          <h1
            className="nav-logo"
            onClick={() => {
              setActiveTab('home');
              onNavigate('home');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
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
            title="Show all posts (local + federated)"
          >
            Home
          </button>
          <button
            className={`nav-item ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
            title="Show only posts from your local instance"
          >
            Local
          </button>
          <button
            className={`nav-item ${activeTab === 'federated' ? 'active' : ''}`}
            onClick={() => setActiveTab('federated')}
            title="Show only posts from remote federated instances"
          >
            Federated
          </button>
        </div>
        <div className="nav-right">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search users or #hashtags..."
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
                ) : searchResults.length === 0 && hashtagSearchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                    No results found
                  </div>
                ) : (
                  <>
                    {/* Hashtag Results */}
                    {hashtagSearchResults.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 16px', color: '#6c5ce7', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid #333' }}>
                          HASHTAGS
                        </div>
                        {hashtagSearchResults.map((ht) => (
                          <div
                            key={ht.tag}
                            onClick={() => {
                              setShowSearchResults(false);
                              setSearchQuery('');
                              onNavigate('hashtag', { hashtag: ht.tag });
                            }}
                            style={{
                              padding: '10px 16px',
                              borderBottom: '1px solid #333',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a4a'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ color: '#6c5ce7', fontWeight: '600' }}>#{ht.tag}</span>
                            <span style={{ color: '#888', fontSize: '12px' }}>{ht.count} posts</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* User Results */}
                    {searchResults.length > 0 && (
                      <div>
                        {hashtagSearchResults.length > 0 && (
                          <div style={{ padding: '8px 16px', color: '#00d9ff', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid #333' }}>
                            USERS
                          </div>
                        )}
                        {searchResults.map((user, idx) => (
                          <div
                            key={`${user.id || 'user'}-${user.domain || user.instance_domain || 'local'}-${idx}`}
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid #333',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'background 0.2s'
                            }}
                          >
                            <div
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery('');
                                onNavigate('profile', { userId: user.id });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flex: 1,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
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
                                {isImageAvatar(user.avatar_url) ? (
                                  <img src={resolveAssetURL(user.avatar_url, user.domain || user.instance_domain)} alt="User avatar" className="avatar-image-fill" />
                                ) : (
                                  user.avatar_url || '👤'
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#fff', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {user.display_name || user.username}
                                  {user.is_remote && (
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      background: 'rgba(255,136,0,0.2)',
                                      color: '#ff8800',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(255,136,0,0.3)'
                                    }}>🌐 {user.domain || 'Remote'}</span>
                                  )}
                                </div>
                                <div style={{ color: '#666', fontSize: '12px' }}>
                                  @{user.username}@{user.domain || user.instance_domain || 'local'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Follow button clicked for user:', user);
                                handleFollowToggle(user.id, user);
                              }}
                              disabled={followLoading.has(user.id)}
                              style={{
                                padding: '6px 16px',
                                background: isUserFollowed(user) ? 'rgba(0,255,136,0.2)' : 'rgba(0,217,255,0.2)',
                                border: `1px solid ${isUserFollowed(user) ? '#00ff88' : '#00d9ff'}`,
                                color: isUserFollowed(user) ? '#00ff88' : '#00d9ff',
                                borderRadius: '4px',
                                cursor: followLoading.has(user.id) ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                minWidth: '80px',
                                opacity: followLoading.has(user.id) ? 0.6 : 1
                              }}
                            >
                              {followLoading.has(user.id) ? '...' : isUserFollowed(user) ? '✓ Following' : 'Follow'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startDMWithUser(user);
                              }}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(0,217,255,0.2)',
                                border: '1px solid #00d9ff',
                                color: '#00d9ff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              💬 DM
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {(searchResults.length > 0 || hashtagSearchResults.length > 0) && (
                  <div
                    style={{
                      padding: '8px 16px',
                      textAlign: 'center',
                      borderTop: '1px solid #333'
                    }}
                  >
                    <button
                      onClick={() => setShowSearchResults(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            className="nav-btn-profile"
            onClick={() => onNavigate('profile')}
          >
            Profile
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
            {theme === "dark" ? "🌞" : "🌙"}
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
                <path d="M1.728 8c0 0.20793333333333333 0.08259999999999999 0.4074 0.22959999999999997 0.5544 0.14706666666666665 0.147 0.3464666666666667 0.22959999999999997 0.5544 0.22959999999999997h5.9505333333333335L6.6593333333333335 10.579333333333333c-0.07339999999999999 0.07293333333333332 -0.1317333333333333 0.15966666666666665 -0.1716 0.2551333333333333 -0.0398 0.09559999999999999 -0.06026666666666666 0.19806666666666664 -0.06026666666666666 0.3015333333333333s0.020466666666666668 0.20593333333333333 0.06026666666666666 0.3015333333333333c0.03986666666666666 0.09546666666666666 0.09819999999999998 0.18219999999999997 0.1716 0.2551333333333333 0.07293333333333332 0.07346666666666667 0.15966666666666665 0.13179999999999997 0.2551333333333333 0.1716 0.09559999999999999 0.0398 0.19806666666666664 0.06026666666666666 0.3015333333333333 0.06026666666666666s0.20593333333333333 -0.020466666666666668 0.3015333333333333 -0.06026666666666666c0.09546666666666666 -0.0398 0.18219999999999997 -0.09813333333333332 0.2551333333333333 -0.1716l3.1359999999999997 -3.1359999999999997c0.07133333333333333 -0.0746 0.12726666666666664 -0.16246666666666665 0.1646 -0.2587333333333333 0.0784 -0.19093333333333332 0.0784 -0.40493333333333337 0 -0.5958666666666667 -0.03733333333333333 -0.09626666666666667 -0.09326666666666666 -0.18413333333333332 -0.1646 -0.2587333333333333l-3.1359999999999997 -3.1359999999999997c-0.07306666666666667 -0.07306666666666667 -0.15986666666666666 -0.13106666666666666 -0.2554666666666666 -0.1706 -0.09546666666666666 -0.039599999999999996 -0.1978 -0.059933333333333325 -0.30119999999999997 -0.059933333333333325 -0.10339999999999999 0 -0.20573333333333332 0.02033333333333333 -0.30119999999999997 0.059933333333333325 -0.09559999999999999 0.03953333333333333 -0.1824 0.09753333333333333 -0.2554666666666666 0.1706 -0.07306666666666667 0.07313333333333333 -0.13106666666666666 0.15993333333333332 -0.17066666666666666 0.25539999999999996 -0.039466666666666664 0.09553333333333333 -0.059866666666666665 0.19786666666666666 -0.059866666666666665 0.3012666666666667 0 0.10339999999999999 0.020399999999999998 0.20573333333333332 0.059866666666666665 0.3012666666666667 0.039599999999999996 0.09546666666666666 0.09759999999999999 0.18226666666666663 0.17066666666666666 0.25539999999999996l1.8032 1.7953333333333332H2.5119999999999996c-0.20793333333333333 0 -0.4073333333333333 0.08266666666666667 -0.5544 0.22966666666666663 -0.147 0.147 -0.22959999999999997 0.34639999999999993 -0.22959999999999997 0.5543333333333333ZM11.919999999999998 0.15999999999999998H4.08c-0.6237999999999999 0 -1.222 0.24779999999999996 -1.6631333333333331 0.6888666666666667 -0.4410666666666666 0.44113333333333327 -0.6888666666666667 1.0393333333333332 -0.6888666666666667 1.6631333333333331v2.352c0 0.20793333333333333 0.08259999999999999 0.4073333333333333 0.22959999999999997 0.5544 0.14706666666666665 0.147 0.3464666666666667 0.22959999999999997 0.5544 0.22959999999999997s0.4073333333333333 -0.08259999999999999 0.5544 -0.22959999999999997c0.147 -0.14706666666666665 0.22959999999999997 -0.3464666666666667 0.22959999999999997 -0.5544V2.5119999999999996c0 -0.20793333333333333 0.08259999999999999 -0.4073333333333333 0.22959999999999997 -0.5544 0.14706666666666665 -0.147 0.3464666666666667 -0.22959999999999997 0.5544 -0.22959999999999997h7.84c0.20793333333333333 0 0.4074 0.08259999999999999 0.5544 0.22959999999999997 0.147 0.14706666666666665 0.22959999999999997 0.3464666666666667 0.22959999999999997 0.5544v10.975999999999999c0 0.20793333333333333 -0.08259999999999999 0.4073333333333333 -0.22959999999999997 0.5544s-0.3464666666666667 0.22959999999999997 -0.5544 0.22959999999999997H4.08c-0.20793333333333333 0 -0.4073333333333333 -0.08259999999999999 -0.5544 -0.22959999999999997 -0.147 -0.147 -0.22959999999999997 -0.3464666666666667 -0.22959999999999997 -0.5544v-2.352c0 -0.20793333333333333 -0.08259999999999999 -0.4073333333333333 -0.22959999999999997 -0.5543333333333333 -0.14706666666666665 -0.147 -0.3464666666666667 -0.22966666666666663 -0.5544 -0.22966666666666663s-0.4073333333333333 0.08266666666666667 -0.5544 0.22966666666666663c-0.147 0.147 -0.22959999999999997 0.34639999999999993 -0.22959999999999997 0.5543333333333333v2.352c0 0.6237333333333333 0.24779999999999996 1.222 0.6888666666666667 1.6631333333333331 0.44113333333333327 0.4410666666666666 1.0393333333333332 0.6888666666666667 1.6631333333333331 0.6888666666666667h7.84c0.6237333333333333 0 1.222 -0.24779999999999996 1.6631333333333331 -0.6888666666666667 0.4410666666666666 -0.44113333333333327 0.6888666666666667 -1.0393999999999999 0.6888666666666667 -1.6631333333333331V2.5119999999999996c0 -0.6237999999999999 -0.24779999999999996 -1.222 -0.6888666666666667 -1.6631333333333331C13.142 0.4078 12.543733333333332 0.15999999999999998 11.919999999999998 0.15999999999999998Z" fill={isDarkMode ? '#ff4444' : '#ff4444'} strokeWidth="0.6667"></path>
              </svg>
            </button>
          )}
        </div>
      </nav>

      {/* Main Layout */}
      <div className="home-layout">
        {/* Left Sidebar */}
        <aside className="home-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Navigation</h3>
            <div className="sidebar-links">
              <button
                className="sidebar-link active"
                onClick={() => setActiveTab('home')}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',flexShrink:0}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span>Home</span>
              </button>
              <button
                className="sidebar-link messages-btn"
                onClick={() => onNavigate('dm')}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',flexShrink:0}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Messages</span>
              </button>
              <button
                className="sidebar-link security-btn"
                onClick={() => onNavigate('security')}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',flexShrink:0}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Security</span>
              </button>
            </div>
          </div>

          <div className="sidebar-section stats-widget user-info">
            <h3 className="sidebar-title">Your Profile</h3>
            <div className="sidebar-profile">
              <div className="profile-avatar">
                {isImageAvatar(userData.avatar) ? (
                  <img src={resolveAssetURL(userData.avatar, userData.server)} alt="Your avatar" className="avatar-image-fill" />
                ) : (
                  userData.avatar
                )}
              </div>
              <div className="profile-info">
                <p className="profile-name">{userData.displayName}</p>
                <p className="profile-handle">@{userData.username}@{userData.server}</p>
                <p className="profile-stats">
                  <strong>{userData.following || 0}</strong> Following • <strong>{userData.followers || 0}</strong> Followers
                </p>
              </div>
              <button
                className="sidebar-btn"
                onClick={() => onNavigate('security')}
              >
                Settings
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Server Info</h3>
            <div className="sidebar-info">
              <div className="info-item">
                <span className="info-label">Server</span>
                <span className="info-value">{userData.server || userData.instance_domain || 'splitter-1'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Your Role</span>
                <span className="info-value" style={{
                  color: userData.role === 'admin' ? '#ff4444' :
                    userData.role === 'moderator' ? '#00d9ff' : '#00ff88'
                }}>
                  {userData.role === 'admin' ? 'Admin' :
                    userData.role === 'moderator' ? 'Moderator' : 'User'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Reputation</span>
                <span className="info-value">🟢 Trusted</span>
              </div>
              <div className="info-item">
                <span className="info-label">Federation</span>
                <span className="info-value">🌐 Open</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Feed */}
        <main className="home-feed">
          {/* Stories Bar */}
          <StoriesBar currentUser={userData} />
          {isOffline && (
            <div
              style={{
                background: "rgba(255,170,0,0.15)",
                border: "1px solid #ffaa00",
                color: "#ffaa00",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "16px",
                textAlign: "center"
              }}
            >
              ⚠️ You are offline. Viewing cached posts (read-only mode).
            </div>
          )}
          {/* Error display */}
          {error && (
            <div style={{
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid #ff4444',
              color: '#ff4444',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Composer */}
          <div className="feed-composer post-create">
            <div className="composer-header">
              <h2>What's happening? 🌐</h2>
            </div>
            <div className="composer-body">
              <textarea
                className="composer-textarea"
                placeholder="Share your thoughts with the federated network..."
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                maxLength="500"
                disabled={isPosting || isOffline}
              />

              {/* Media Preview */}
              {previewUrl && (
                <div style={{ position: 'relative', margin: '10px 0', maxWidth: '100%' }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxHeight: '300px',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      objectFit: 'cover'
                    }}
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      // Reset file input
                      const fileInput = document.getElementById('post-media-input');
                      if (fileInput) fileInput.value = '';
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="composer-footer">
                <div className="composer-info">
                  <span className="char-count">
                    {newPostText.length}/500
                  </span>
                  {/* Visibility Selector */}
                  <select
                    value={newPostVisibility}
                    onChange={(e) => setNewPostVisibility(e.target.value)}
                    title="Choose who can see this post"
                    style={{
                      padding: '4px 8px',
                      background: '#1a1a2e',
                      border: '1px solid #333',
                      color: '#00d9ff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    <option value="public">🌐 Public</option>
                    <option value="followers">👥 Followers</option>
                    <option value="circle">🔒 Circle</option>
                  </select>
                  <select
                    value={newPostExpiryMinutes}
                    onChange={(e) => setNewPostExpiryMinutes(e.target.value)}
                    title="Optional auto-expiration"
                    style={{
                      padding: '4px 8px',
                      background: '#1a1a2e',
                      border: '1px solid #333',
                      color: '#00d9ff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    <option value="0">♾️ Persistent</option>
                    <option value="60">⏳ 1 Hour</option>
                    <option value="360">⏳ 6 Hours</option>
                    <option value="1440">⏳ 24 Hours</option>
                    <option value="4320">⏳ 3 Days</option>
                  </select>
                </div>
                <div className="composer-actions">
                  <input
                    type="file"
                    id="post-media-input"
                    accept="image/png, image/jpeg, image/gif"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];

                        // Validate size
                        if (file.size > 5 * 1024 * 1024) {
                          alert('File size exceeds 5MB limit.');
                          return;
                        }

                        setSelectedFile(file);
                        const url = URL.createObjectURL(file);
                        setPreviewUrl(url);
                      }
                    }}
                  />
                  <button
                    className="composer-btn-media"
                    onClick={() => document.getElementById('post-media-input').click()}
                    title="Attach media (max 5MB)"
                    disabled={isPosting || isOffline}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'16px',height:'16px',verticalAlign:'middle',marginRight:'4px'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Media
                  </button>
                  <button
                    className={`composer-btn-post ${(!newPostText.trim() && !selectedFile) || isPosting || isOffline ? 'disabled' : ''}`}
                    onClick={handlePostCreate}
                    disabled={(!newPostText.trim() && !selectedFile) || isPosting || isOffline}
                  >
                    {isPosting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feed Divider */}
          <div className="feed-divider" />

          {/* Loading indicator */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              Loading posts...
            </div>
          )}

          {/* Posts */}
          <div className="feed-posts posts-list">
            {dedupePosts(posts).map((post, idx) => (
              <article key={`${post.id}-${post.authorId || post.author_did || 'author'}-${post.createdAt || idx}-${idx}`} className={`post ${post.local ? 'local' : 'remote'}`}>
                <div className="post-header">
                  <div className="post-author" style={{ cursor: 'pointer' }} onClick={() => onNavigate('thread', { postId: post.id, postData: post.instanceUrl ? post : undefined })}>
                    <span className="post-avatar">
                      {isImageAvatar(post.avatar) ? (
                        <img src={resolveAssetURL(post.avatar, post.domain)} alt="Post author avatar" className="avatar-image-fill" />
                      ) : (
                        post.avatar
                      )}
                    </span>
                    <div className="post-meta">
                      <div className="post-name-line">
                        <strong className="post-display-name">{post.displayName}</strong>
                      </div>
                      <div className="post-meta-line">
                        <span className="post-handle">{post.handle}{post.isRemote && post.domain ? `@${post.domain}` : ''}</span>
                        <span className="post-meta-dot">·</span>
                        <span className="post-time">{post.timestamp}</span>
                        {!post.isRemote && <><span className="post-meta-dot">·</span><span className="post-badge local" title="This post is from your local instance">Local</span></>}
                        {post.isRemote && <><span className="post-meta-dot">·</span><span className="post-badge remote" title={`This post is from ${post.domain || 'a remote instance'}`}>{post.domain || 'Remote'}</span></>}
                        {isEdited(post) && (
                          <><span className="post-meta-dot">·</span><span
                            className="post-badge"
                            style={{ background: 'rgba(255,170,0,0.2)', color: '#ffaa00' }}
                            title={`Edited: ${new Date(post.updatedAt).toLocaleString()}`}
                          >
                            Edited
                          </span></>
                        )}
                      </div>
                      {post.expiresAt && (
                        <span className="post-time" title={`Expires at ${new Date(post.expiresAt).toLocaleString()}`}>
                          ⏳ {formatRemainingLifetime(post.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  {post.visibility && post.visibility !== 'public' && (
                    <span
                      className="post-visibility"
                      style={{ color: '#888', fontSize: '12px', cursor: 'help' }}
                      title={post.visibility === 'followers' ? 'Only followers can see this post' : 'Only close circle can see this post'}
                    >
                      {getVisibilityIcon(post.visibility)} {post.visibility === 'followers' ? 'Followers Only' : 'Circle Only'}
                    </span>
                  )}
                </div>

                {/* Post Content or Edit Form */}
                {editingPostId === post.id ? (
                  <div style={{ margin: '12px 0' }}>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength="500"
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        background: '#1a1a2e',
                        border: '1px solid #00d9ff',
                        borderRadius: '8px',
                        color: '#fff',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ color: '#666', fontSize: '12px' }}>{editText.length}/500</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleEditCancel}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(255,68,68,0.1)',
                            border: '1px solid #ff4444',
                            color: '#ff4444',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSave(post.id)}
                          disabled={isOffline}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(0,255,136,0.2)',
                            border: '1px solid #00ff88',
                            color: '#00ff88',
                            borderRadius: '4px',
                            cursor: isOffline ? 'not-allowed' : 'pointer',
                            opacity: isOffline ? 0.5 : 1
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="post-content"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigate('thread', { postId: post.id, postData: post.instanceUrl ? post : undefined })}
                  >
                    {post.content}
                    {post.imageUrl && (
                      <div style={{ marginTop: '10px' }}>
                        <img
                          src={resolveAssetURL(post.imageUrl, post.domain)}
                          alt="Post attachment"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            borderRadius: '8px',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirmId === post.id && (
                  <div style={{
                    background: 'rgba(255,68,68,0.1)',
                    border: '1px solid #ff4444',
                    borderRadius: '8px',
                    padding: '12px',
                    margin: '12px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#ff4444' }}>⚠️ Delete this post?</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid #666',
                          color: '#666',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteConfirm(post.id)}
                        disabled={isOffline}
                        style={{
                          padding: '6px 12px',
                          background: '#ff4444',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          cursor: isOffline ? 'not-allowed' : 'pointer',
                          opacity: isOffline ? 0.5 : 1
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="post-actions">
                  <button
                    className="post-action"
                    onClick={() => onNavigate('thread', { postId: post.id, postData: post.instanceUrl ? post : undefined })}
                    title="Reply to this post"
                  >
                    <span className="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px'}}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg></span>
                    <span className="action-count">{post.replies}</span>
                  </button>
                  <button
                    className={`post-action ${post.reposted ? 'active' : ''}`}
                    onClick={() => handleRepost(post.id)}
                    disabled={isOffline}
                    style={post.reposted ? { color: '#00d9ff' } : {}}
                    title={post.reposted ? 'Undo repost' : 'Repost to your followers'}
                  >
                    <span className="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px'}}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></span>
                    <span className="action-count">{post.boosts}</span>
                  </button>
                  <button
                    className={`post-action ${post.liked ? 'active' : ''}`}
                    onClick={() => handleLike(post.id)}
                    disabled={isOffline}
                    style={post.liked ? { color: '#ff4444' } : {}}
                    title={post.liked ? 'Unlike' : 'Like this post'}
                  >
                    <span className="action-icon"><svg viewBox="0 0 24 24" fill={post.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px'}}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></span>
                    <span className="action-count">{post.likes}</span>
                  </button>

                  {/* Edit/Delete buttons for own posts */}
                  {isOwnPost(post) && !editingPostId && !deleteConfirmId && (
                    <>
                      <button
                        className="post-action"
                        onClick={() => handleEditStart(post)}
                        disabled={isOffline}
                        title="Edit post"
                        style={{ marginLeft: 'auto' }}
                      >
                        <span className="action-icon">✏️</span>
                      </button>
                      <button
                        className="post-action"
                        onClick={() => setDeleteConfirmId(post.id)}
                        disabled={isOffline}
                        title="Delete post"
                        style={{ color: '#ff4444' }}
                      >
                        <span className="action-icon">🗑️</span>
                      </button>
                    </>
                  )}

                  {!isOwnPost(post) && (
                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
                      <button
                        className="post-action"
                        title="More options"
                        onClick={(e) => { e.stopPropagation(); setReportMenuPostId(reportMenuPostId === post.id ? null : post.id); }}
                        style={{ padding: '4px 8px', fontSize: '18px', letterSpacing: '2px' }}
                      >
                        &#8943;
                      </button>
                      {reportMenuPostId === post.id && (
                        <div onClick={(e) => e.stopPropagation()} style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 100,
                          background: 'var(--bg-secondary, #1a1a2e)',
                          border: '1px solid var(--border-color, #333)',
                          borderRadius: '8px', minWidth: '160px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
                        }}>
                          <button
                            onClick={() => { setReportModalPostId(post.id); setReportMenuPostId(null); setReportReason(''); setReportSuccess(''); }}
                            style={{
                              display: 'block', width: '100%', padding: '10px 16px',
                              textAlign: 'left', background: 'none', border: 'none',
                              color: '#ff8080', cursor: 'pointer', fontSize: '14px'
                            }}
                          >
                            Flag this post
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="home-trends">
          <div className="trends-section">
            <h3 className="trends-title">Trending Now</h3>
            <div className="trends-list">
              {trendingHashtags.length > 0 ? (
                trendingHashtags.map((ht) => (
                  <div
                    key={ht.tag}
                    className="trend-item"
                    onClick={() => onNavigate('hashtag', { hashtag: ht.tag })}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="trend-name">#{ht.tag}</div>
                    <div className="trend-count">{ht.count >= 1000 ? (ht.count / 1000).toFixed(1) + 'K' : ht.count} posts</div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#666', fontSize: '13px', padding: '8px 0' }}>
                  No trending hashtags yet
                </div>
              )}
            </div>
            <button
              onClick={() => onNavigate('trending')}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '8px',
                background: 'rgba(108, 92, 231, 0.15)',
                border: '1px solid #6c5ce7',
                color: '#6c5ce7',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              View All Trending →
            </button>
          </div>

          <div className="trends-section">
            <h3 className="trends-title">ℹ️ About This Network</h3>
            <p className="trends-description">
              This is a decentralized social network powered by federation. Your identity is your own, your server is your choice, and your data is encrypted.
            </p>
          </div>

          {/* Admin Panel - Only for admins/moderators */}
          {(userData.role === 'admin' || userData.role === 'moderator') && (
            <div className="trends-section">
              <h3 className="trends-title">Admin Panel</h3>
              <button
                onClick={() => onNavigate('moderation')}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(0, 217, 255, 0.1)',
                  border: '1px solid #00d9ff',
                  color: '#00d9ff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                className="trend-item"
              >
                Moderation Queue
              </button>
              <button
                onClick={() => onNavigate('federation')}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(0, 217, 255, 0.1)',
                  border: '1px solid #00d9ff',
                  color: '#00d9ff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                className="trend-item"
              >
                Federation Inspector
              </button>
              {userData.role === 'admin' && (
                <button
                  onClick={() => onNavigate('admin')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '8px',
                    background: 'rgba(255, 68, 68, 0.1)',
                    border: '1px solid #ff4444',
                    color: '#ff4444',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.3s ease'
                  }}
                  className="trend-item"
                >
                  👑 Admin Dashboard
                </button>
              )}
            </div>
          )}

          {/* Request Moderation - Only for regular users */}
          {userData.role === 'user' && (
            <div className="trends-section">
              <h3 className="trends-title">Moderation</h3>
              {userData.moderation_requested ? (
                <div style={{
                  padding: '12px',
                  background: 'rgba(255, 170, 0, 0.1)',
                  border: '1px solid #ffaa00',
                  borderRadius: '6px',
                  color: '#ffaa00',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  ⏳ Moderation request pending approval
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await adminApi.requestModeration();
                      if (updateUserData) {
                        updateUserData({ ...userData, moderation_requested: true });
                      }
                      alert('Moderation request submitted! An admin will review it.');
                    } catch (err) {
                      alert('Failed to submit request: ' + err.message);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(0, 255, 136, 0.1)',
                    border: '1px solid #00ff88',
                    color: '#00ff88',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.3s ease'
                  }}
                  className="trend-item"
                >
                  Request Moderation Access
                </button>
              )}
              <p style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '8px',
                lineHeight: '1.4'
              }}>
                Want to help moderate this server? Request access and an admin will review your application.
              </p>
            </div>
          )}

        </aside>
      </div>

      {/* Report Post Modal */}
      {reportModalPostId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => !reportSubmitting && setReportModalPostId(null)}
        >
          <div
            style={{
              background: 'var(--bg-secondary, #1a1a2e)',
              border: '1px solid var(--border-color, #333)',
              borderRadius: '12px', padding: '28px 32px',
              maxWidth: '400px', width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary, #fff)', fontSize: '18px' }}>
              Flag this post
            </h3>
            <p style={{ margin: '0 0 20px', color: '#888', fontSize: '13px' }}>
              Select a reason. Our AI will screen the post immediately.
            </p>

            {reportSuccess ? (
              <p style={{ color: reportSuccess.startsWith('Failed') ? '#ff8080' : '#00ff88', fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>
                {reportSuccess}
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {['spam', 'harassment', 'inappropriate', 'hate_speech', 'misinformation'].map((r) => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${reportReason === r ? '#00d9ff' : 'transparent'}`, background: reportReason === r ? 'rgba(0,217,255,0.08)' : 'transparent', color: 'var(--text-primary, #ccc)', fontSize: '14px' }}>
                      <input
                        type="radio"
                        name="reportReason"
                        value={r}
                        checked={reportReason === r}
                        onChange={() => setReportReason(r)}
                        style={{ accentColor: '#00d9ff' }}
                      />
                      {r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setReportModalPostId(null)}
                    style={{ padding: '8px 18px', background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReportSubmit}
                    disabled={!reportReason || reportSubmitting}
                    style={{ padding: '8px 18px', background: reportReason && !reportSubmitting ? 'rgba(255,68,68,0.2)' : '#333', border: '1px solid #ff4444', color: '#ff8080', borderRadius: '6px', cursor: reportReason && !reportSubmitting ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }}
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
