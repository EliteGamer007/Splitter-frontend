'use client';

import { useState, useEffect, useRef } from 'react';
import LandingPage from '@/components/pages/LandingPage';
import InstancePage from '@/components/pages/InstancePage';
import SignupPage from '@/components/pages/SignupPage';
import LoginPage from '@/components/pages/LoginPage';
import HomePage from '@/components/pages/HomePage';
import ProfilePage from '@/components/pages/ProfilePage';
import ThreadPage from '@/components/pages/ThreadPage';
import DMPage from '@/components/pages/DMPage';
import SecurityPage from '@/components/pages/SecurityPage';
import ModerationPage from '@/components/pages/ModerationPage';
import FederationPage from '@/components/pages/FederationPage';
import AdminPage from '@/components/pages/AdminPage';
import TrendingPage from '@/components/pages/TrendingPage';
import HashtagPage from '@/components/pages/HashtagPage';
import AppBottomNav from '@/components/ui/AppBottomNav';
import { clearSessionData } from '@/lib/browserState';
import { userApi, cancelPendingRequests, messageApi } from '@/lib/api';

export default function App() {
  const returnDestination = useRef<any>(null);
  const [homeTab,setHomeTab] = useState('home');
  const [currentPage, setCurrentPage] = useState('landing');
  // Theme is handled by ThemeProvider
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [userData, setUserData] = useState({
    id: '',
    username: '',
    displayName: '',
    bio: '',
    avatar: '👤',
    email: '',
    server: 'splitter-1',
    did: '',
    role: 'user',
    moderation_requested: false,
    followers: 0,
    following: 0,
    postsCount: 0
  });
  const [viewingUserId, setViewingUserId] = useState(null);
  const [viewingRemoteUser, setViewingRemoteUser] = useState<any>(null);
  const [selectedDMUser, setSelectedDMUser] = useState(null);
  const [selectedThreadPostId, setSelectedThreadPostId] = useState(null);
  const [selectedThreadPostData, setSelectedThreadPostData] = useState(null);
  const [selectedHashtag, setSelectedHashtag] = useState(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Restore URL navigation and validate the session without waking the API for guests.
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setBackendConnected(true);

        // Check if user has valid token
        const token = localStorage.getItem('jwt_token');
        if (token) {
          try {
            const user = await userApi.getCurrentUser();
            localStorage.setItem('user', JSON.stringify(user));
            setUserData({
              id: user.id || '',
              username: user.username || '',
              displayName: user.display_name || user.username || '',
              bio: user.bio || '',
              ...{default_visibility:user.default_visibility, message_privacy:user.message_privacy, account_locked:user.is_locked ?? user.account_locked,public_key:user.public_key,encryption_public_key:user.encryption_public_key},
              avatar: user.avatar_url || '👤',
              email: `${user.username}@${user.instance_domain || 'splitter-1'}`,
              server: user.instance_domain || 'splitter-1',
              did: user.did || '',
              role: user.role || 'user',
              moderation_requested: user.moderation_requested || false,
              followers: user.followers_count || 0,
              following: user.following_count || 0,
              postsCount: user.posts_count || 0
            });
            setIsAuthenticated(true);
            // Redirect admin users to admin dashboard, regular users to home
            const requested = new URLSearchParams(location.search).get('page');
            if (!requested || requested === 'landing') setCurrentPage(user.role === 'admin' ? 'admin' : 'home');
          } catch (authError) {
            // Token invalid, clear it
            if ((authError as any).status === 401) clearSessionData();
            setIsAuthenticated(false);
            setBackendConnected(false);
          }
        }
      } catch (error) {
        console.warn('Backend not connected:', error);
        setBackendConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userData.id) return;
    let controller: AbortController | null = null;
    let stopped = false; let lastAttempt = 0;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible' || !navigator.onLine || !localStorage.getItem('jwt_token') || controller || Date.now() - lastAttempt < 60000) return;
      lastAttempt = Date.now(); controller = new AbortController();
      try { const data = await messageApi.getThreads(controller.signal); if (!stopped) setHasUnreadMessages((data.threads || []).some((t:any) => t.unread_count > 0)); } catch {} finally {controller = null;}
    };
    const visibility = () => { if (document.visibilityState !== 'visible' || !navigator.onLine) controller?.abort(); else void check(); };
    const interval = setInterval(check, 65000 + Math.floor(Math.random()*5000));
    document.addEventListener('visibilitychange', visibility); window.addEventListener('online', visibility); window.addEventListener('offline', visibility);
    void check();
    return () => { stopped = true; controller?.abort(); clearInterval(interval); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('online',visibility); window.removeEventListener('offline',visibility); };
  }, [isAuthenticated,userData.id]);

  useEffect(() => {
    const restore = () => {
      const q = new URLSearchParams(location.search); const page = q.get('page') || 'landing';
      const allowed = ['landing','instances','signup','login','home','profile','thread','dm','security','moderation','federation','admin','trending','hashtag'];
      const tab=q.get('tab');setHomeTab(tab && ['home','local','federated'].includes(tab) ? tab : 'home');
      setCurrentPage(allowed.includes(page) ? page : 'not-found');
      if (!localStorage.getItem('jwt_token') && !['landing','login','signup','instances'].includes(page) && allowed.includes(page)) returnDestination.current = {page,params:Object.fromEntries(q.entries())};
      setViewingUserId(q.get('userId') as any); setSelectedThreadPostId(q.get('postId') as any); setSelectedHashtag(q.get('hashtag') as any);
    };
    const logout = () => {setIsAuthenticated(false);setHasUnreadMessages(false);setCurrentPage('login');};
    restore(); window.addEventListener('popstate',restore); window.addEventListener('splitter:logout',logout);
    return () => {window.removeEventListener('popstate',restore);window.removeEventListener('splitter:logout',logout);};
  }, []);

  const navigateTo = (page: string, params?: any) => {
    if (page === 'home' && returnDestination.current) {params = returnDestination.current.params;page = returnDestination.current.page;returnDestination.current = null;}
    if (page === '/') page = 'landing';
    const url = new URL(location.href); url.search = '';
    if (page !== 'landing') url.searchParams.set('page',page);
    if (page === 'home') {setHomeTab(params?.tab || 'home');if(params?.tab) url.searchParams.set('tab',params.tab);}
    for (const key of ['userId','postId','hashtag']) if (params?.[key]) url.searchParams.set(key,String(params[key]));
    history.pushState({},'',url);
    // Redirect to login if trying to access protected pages without auth
    const protectedPages = ['home', 'profile', 'dm', 'security', 'moderation', 'federation', 'thread', 'admin', 'trending', 'hashtag'];
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('jwt_token');

    if (page === 'admin' && userData.role !== 'admin') { setCurrentPage('forbidden'); return; }
    if (page === 'moderation' && !['admin','moderator'].includes(userData.role)) { setCurrentPage('forbidden'); return; }
    if (protectedPages.includes(page) && !isAuthenticated && !hasToken) {
      returnDestination.current = {page,params};
      setCurrentPage('login');
      return;
    }

    // Handle DM navigation with selected user
    if (page === 'dm' && params?.selectedUser) {
      setSelectedDMUser(params.selectedUser);
      setViewingUserId(null);
      setViewingRemoteUser(null);
    } else if (page === 'profile' && params?.userId) {
      // Handle profile navigation with userId
      setViewingUserId(params.userId);
      setViewingRemoteUser(params?.remoteUser || null);
      setSelectedDMUser(null);
    } else if (page === 'profile' && params?.remoteUser) {
      setViewingUserId(params.remoteUser?.id || null);
      setViewingRemoteUser(params.remoteUser);
      setSelectedDMUser(null);
    } else if (page === 'thread' && params?.postId) {
      setSelectedThreadPostId(params.postId);
      setSelectedThreadPostData(params.postData || null);
      setSelectedDMUser(null);
      setViewingUserId(null);
      setViewingRemoteUser(null);
      setSelectedHashtag(null);
    } else if (page === 'hashtag' && params?.hashtag) {
      setSelectedHashtag(params.hashtag);
      setSelectedDMUser(null);
      setViewingUserId(null);
      setViewingRemoteUser(null);
    } else if (page === 'trending') {
      setSelectedDMUser(null);
      setViewingUserId(null);
      setViewingRemoteUser(null);
      setSelectedHashtag(null);
    } else {
      setSelectedDMUser(null);
      setViewingUserId(null);
      setViewingRemoteUser(null);
    }

    setCurrentPage(page);
  };

  const updateUserData = (newData: any) => {
    setUserData(prev => ({ ...prev, ...newData }));
    if (newData.token) {
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    clearSessionData();
    history.pushState({},'',location.pathname);
    setIsAuthenticated(false);
    setUserData({
      id: '',
      username: '',
      displayName: '',
      bio: '',
      avatar: '👤',
      email: '',
      server: 'splitter-1',
      did: '',
      role: 'user',
      moderation_requested: false,
      followers: 0,
      following: 0,
      postsCount: 0
    });
    setSelectedDMUser(null);
    setCurrentPage('landing');
  };

  const protectedPages = ['home','profile','thread','dm','security','moderation','federation','admin','trending','hashtag'];
  const displayPage = protectedPages.includes(currentPage) && !isAuthenticated ? 'login' : currentPage === 'admin' && userData.role !== 'admin' || currentPage === 'moderation' && !['admin','moderator'].includes(userData.role) ? 'forbidden' : currentPage;

  const sharedProps = {
    onNavigate: navigateTo,
    userData,
    updateUserData,
    isAuthenticated,
    setIsAuthenticated,
    handleLogout,
    backendConnected,
    hasUnreadMessages
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-background text-foreground`}>
        <div className="text-center">
          <div className="text-4xl mb-4">🌐</div>
          <p>Connecting to Splitter. A sleeping instance may take a moment.</p><button onClick={() => {cancelPendingRequests();setIsLoading(false);setCurrentPage('login');}}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background text-foreground ${isAuthenticated ? 'pb-[70px] md:pb-0' : ''}`}>
      {!backendConnected && currentPage !== 'landing' && (
        <div style={{
          background: '#ff4444',
          color: 'white',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          ⚠️ Backend not connected. Please check your internet connection or try again later.
        </div>
      )}
      {displayPage === 'not-found' && <main className="p-8"><h1>Page not found</h1><button onClick={() => navigateTo('landing')}>Return to Splitter</button></main>}
      {displayPage === 'forbidden' && <main className="p-8"><h1>Permission required</h1><button onClick={() => navigateTo('home')}>Return home</button></main>}
      {displayPage === 'landing' && <LandingPage {...sharedProps} />}
      {displayPage === 'instances' && <InstancePage {...sharedProps} />}
      {displayPage === 'signup' && <SignupPage {...sharedProps} />}
      {displayPage === 'login' && <LoginPage {...sharedProps} />}
      {displayPage === 'home' && <HomePage {...sharedProps} initialTab={homeTab} />}
      {displayPage === 'profile' && <ProfilePage {...sharedProps} viewingUserId={viewingUserId} viewingRemoteUser={viewingRemoteUser} />}
      {displayPage === 'thread' && <ThreadPage {...sharedProps} postId={selectedThreadPostId} postData={selectedThreadPostData} />}
      {displayPage === 'dm' && <DMPage {...sharedProps} userData={userData} selectedUser={selectedDMUser} />}
      {displayPage === 'security' && <SecurityPage {...sharedProps} />}
      {displayPage === 'moderation' && ['moderator','admin'].includes(userData.role) && <ModerationPage {...sharedProps} />}
      {displayPage === 'federation' && <FederationPage {...sharedProps} />}
      {displayPage === 'admin' && userData.role === 'admin' && <AdminPage {...sharedProps} />}
      {displayPage === 'trending' && <TrendingPage {...sharedProps} />}
      {displayPage === 'hashtag' && <HashtagPage {...sharedProps} hashtag={selectedHashtag} />}

      {isAuthenticated && (
        <AppBottomNav currentPage={currentPage} onNavigate={navigateTo} hasUnread={hasUnreadMessages} />
      )}
    </div>
  );
}
