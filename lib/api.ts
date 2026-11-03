import { clearSessionData } from './browserState';
// API Service Layer for Splitter Frontend
// Supports multiple backend instances for federation testing

// Instance URL mapping — maps server domain names to actual API URLs
const INSTANCE_URLS: Record<string, string> = {
  'splitter-1': process.env.NEXT_PUBLIC_INSTANCE_1_URL || 'https://splitter-m0kv.onrender.com/api/v1',
  'splitter-2': process.env.NEXT_PUBLIC_INSTANCE_2_URL || 'https://splitter-2.onrender.com/api/v1',
  'localhost': process.env.NEXT_PUBLIC_INSTANCE_1_URL || 'https://splitter-m0kv.onrender.com/api/v1',  // backward compatibility
};

function normalizeApiBaseUrl(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return process.env.NEXT_PUBLIC_INSTANCE_1_URL || process.env.NEXT_PUBLIC_API_URL || 'https://splitter-m0kv.onrender.com/api/v1';

  let normalized = raw.replace(/\/+$/, '');

  if (/\/api\/v1$/i.test(normalized)) {
    return normalized;
  }
  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v1`;
  }

  return `${normalized}/api/v1`;
}

// Get the current API base URL from localStorage or default
function getApiBase(): string {
  const defaultUrl = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_INSTANCE_1_URL || process.env.NEXT_PUBLIC_API_URL || 'https://splitter-m0kv.onrender.com/api/v1');
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('splitter_api_base');
    if (stored) {
      const normalizedStored = normalizeApiBaseUrl(stored);
      if (normalizedStored !== stored) {
        localStorage.setItem('splitter_api_base', normalizedStored);
      }
      return normalizedStored;
    }
  }
  return defaultUrl;
}

// Set the API base URL (called when user selects a server)
export function setApiBase(serverDomain: string): void {
  const fallbackUrl = process.env.NEXT_PUBLIC_INSTANCE_1_URL || `https://splitter-m0kv.onrender.com/api/v1`;
  const raw = INSTANCE_URLS[serverDomain] || (serverDomain.startsWith('https://') || serverDomain.startsWith('http://localhost') || serverDomain.startsWith('http://127.0.0.1') ? serverDomain : fallbackUrl);
  const url = normalizeApiBaseUrl(raw);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(parsed.hostname)) throw new Error('Use HTTPS for a custom instance');
  if (typeof window !== 'undefined') {
    const prevDomain = localStorage.getItem('splitter_instance');
    if (getApiBase() !== url || (prevDomain && prevDomain !== serverDomain)) {
      clearSessionData();
    }
    localStorage.setItem('splitter_api_base', url);
    localStorage.setItem('splitter_instance', serverDomain);
  }
}

// Export current instance info
export function getCurrentInstance(): { domain: string; url: string } {
  if (typeof window !== 'undefined') {
    const domain = localStorage.getItem('splitter_instance') || 'splitter-1';
    const url = getApiBase();
    return { domain, url };
  }
  return { domain: 'splitter-1', url: normalizeApiBaseUrl(INSTANCE_URLS['splitter-1']) };
}

export function resolveMediaUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const value = rawUrl.trim();
  if (!value) return '';

  if (value.startsWith('http://') || value.startsWith('https://')) return value;

  const toApiOrigin = (base: string) => {
    try {
      return new URL(base).origin;
    } catch {
      return '';
    }
  };

  if (value.startsWith('/')) {
    const current = getCurrentInstance();
    const origin = toApiOrigin(current.url);
    return origin ? `${origin}${value}` : value;
  }

  if (value.startsWith('api/')) {
    const current = getCurrentInstance();
    const origin = toApiOrigin(current.url);
    return origin ? `${origin}/${value}` : value;
  }

  return value;
}

// Alias used throughout this file in fetch calls
function apiBase(): string {
  return getApiBase();
}


// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 && localStorage.getItem('jwt_token')) clearSessionData();
    let message = `HTTP ${response.status}`;
    try {
      const error = JSON.parse(errorText);
      if (error?.error) {
        message = error.error;
      } else if (errorText) {
        message = errorText;
      }
    } catch {
      if (errorText) {
        message = errorText;
      }
    }
    const error = new Error(message);
    (error as any).status = response.status;
    throw error;
  }
  if (response.status === 204) return {} as T;
  return response.json();
}

// Auth API
export const authApi = {
  async register(data: {
    username: string;
    email: string;
    password: string;
    display_name?: string;
    bio?: string;
    instance_domain?: string;
    did?: string;
    public_key?: string;
    encryption_public_key?: string;
  }, avatarFile?: File) {
    let response: Response;

    if (avatarFile) {
      const fd = new FormData();
      fd.append('username', (data.username || '').trim());
      fd.append('email', (data.email || '').trim());
      fd.append('password', data.password || '');
      if (data.display_name !== undefined) fd.append('display_name', String(data.display_name));
      if (data.bio !== undefined) fd.append('bio', String(data.bio));
      if (data.instance_domain !== undefined) fd.append('instance_domain', String(data.instance_domain));
      if (data.did !== undefined) fd.append('did', String(data.did));
      if (data.public_key !== undefined) fd.append('public_key', String(data.public_key));
      if (data.encryption_public_key !== undefined) fd.append('encryption_public_key', String(data.encryption_public_key));
      fd.append('avatar', avatarFile);

      response = await apiFetch(`${apiBase()}/auth/register`, {
        method: 'POST',
        body: fd
      });
    } else {
      response = await apiFetch(`${apiBase()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    const result = await handleResponse<{ user: any; token: string }>(response);
    const previousUser = authApi.getCurrentUserFromStorage();
    if (previousUser?.id && result.user?.id && previousUser.id !== result.user.id) clearSessionData();
    if (result.token) {
      localStorage.setItem('jwt_token', result.token);
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
      }
    }
    return result;
  },

  async login(data: { username: string; password: string }) {
    const response = await apiFetch(`${apiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await handleResponse<{ user: any; token: string }>(response);
    const previousUser = authApi.getCurrentUserFromStorage();
    if (previousUser?.id && result.user?.id && previousUser.id !== result.user.id) clearSessionData();
    if (result.token) {
      localStorage.setItem('jwt_token', result.token);
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
      }
    }
    return result;
  },

  async getChallenge(did: string) {
    const response = await apiFetch(`${apiBase()}/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did })
    });
    return handleResponse<{ challenge: string; expires_at: number }>(response);
  },

  async verifyChallenge(data: { did: string; challenge: string; signature: string }) {
    const response = await apiFetch(`${apiBase()}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await handleResponse<{ user: any; token: string }>(response);
    const previousUser = authApi.getCurrentUserFromStorage();
    if (previousUser?.id && result.user?.id && previousUser.id !== result.user.id) clearSessionData();
    if (result.token) {
      localStorage.setItem('jwt_token', result.token);
    }
    return result;
  },

  async registerKey(publicKey: string) {
    const response = await apiFetch(`${apiBase()}/auth/register-key`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ public_key: publicKey })
    });
    return handleResponse<{ message: string; public_key: string }>(response);
  },

  async rotateKey(data: {
    new_public_key: string;
    current_password?: string;
    signature?: string;
    nonce?: string;
    timestamp?: number;
  }) {
    const response = await apiFetch(`${apiBase()}/auth/rotate-key`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse<{ message: string; new_public_key: string; rotated_at: string }>(response);
  },

  async getKeyHistory() {
    const response = await apiFetch(`${apiBase()}/auth/key-history`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ key_history: any[]; count: number }>(response);
  },

  async getRevokedKeys() {
    const response = await apiFetch(`${apiBase()}/auth/revoked-keys`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ did: string; active_key: string; revoked_keys: any[]; count: number }>(response);
  },

  async checkKeyRevocation(publicKey: string) {
    const response = await apiFetch(`${apiBase()}/auth/check-key?key=${encodeURIComponent(publicKey)}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ key: string; status: string; revoked: boolean }>(response);
  },

  async revokeKey() {
    const response = await apiFetch(`${apiBase()}/auth/revoke-key`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  isLoggedIn() {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('jwt_token');
  },

  getCurrentUserFromStorage() {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  logout() { clearSessionData();
  }
};

// User API
export const userApi = {
  async getCurrentUser() {
    const response = await apiFetch(`${apiBase()}/users/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse<any>(response);
  },

  async getUserProfile(id: string) {
    const response = await apiFetch(`${apiBase()}/users/${id}`,{headers:getAuthHeaders()});
    return handleResponse<any>(response);
  },

  async getUserByDID(did: string) {
    const response = await apiFetch(`${apiBase()}/users/did?did=${encodeURIComponent(did)}`);
    return handleResponse<any>(response);
  },

  async updateProfile(data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    default_visibility?: string;
    message_privacy?: string;
    account_locked?: boolean;
    is_locked?: boolean;
  }) {
    const response = await apiFetch(`${apiBase()}/users/me`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse<any>(response);
  },

  async uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append('avatar', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await apiFetch(`${apiBase()}/users/me/avatar`, {
      method: 'POST',
      headers,
      body: fd
    });
    return handleResponse<any>(response);
  },

  async updateEncryptionKey(encryptionPublicKey: string) {
    const response = await apiFetch(`${apiBase()}/users/me/encryption-key`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ encryption_public_key: encryptionPublicKey })
    });
    return handleResponse<any>(response);
  },

  async deleteAccount() {
    const response = await apiFetch(`${apiBase()}/users/me`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  }
};

// Post API
export const postApi = {
  async createPost(content: string, visibility: string = 'public', file?: File, expiresInMinutes?: number | null) {
    const fd = new FormData();

    // Always send content (even empty string)
    fd.append('content', content || '');

    fd.append('visibility', visibility);

    if (expiresInMinutes && expiresInMinutes > 0) {
      fd.append('expires_in_minutes', String(expiresInMinutes));
    }

    if (file) {
      fd.append('file', file);
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${apiBase()}/posts`, {
      method: 'POST',
      headers: headers, // IMPORTANT: DO NOT set Content-Type manually
      body: fd
    }).then(r => handleResponse<any>(r));
  },

  async getPost(id: string) {
    const response = await apiFetch(`${apiBase()}/posts/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<any>(response);
  },

  async getUserPosts(userId: string, limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/posts/user/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`,{headers:getAuthHeaders()}
    );
    return handleResponse<any[]>(response);
  },

  async getFeed(limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/posts/feed?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<any[]>(response);
  },

  async getPublicFeed(limit = 20, offset = 0, localOnly = false) {
    const response = await apiFetch(
      `${apiBase()}/posts/public?limit=${limit}&offset=${offset}&local_only=${localOnly}`
    );
    return handleResponse<any[]>(response);
  },

  async updatePost(id: string, content: string, imageUrl?: string) {
    const response = await apiFetch(`${apiBase()}/posts/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, image_url: imageUrl })
    });
    return handleResponse<any>(response);
  },

  async deletePost(id: string) {
    const response = await apiFetch(`${apiBase()}/posts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async getReplies(postId: string, limit = 20, offset = 0) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/replies?limit=${Math.min(50,Math.max(1,limit))}&offset=${Math.max(0,offset)}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<any[]>(response);
  },

  async createReply(postId: string, content: string, parentId?: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/replies`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ post_id: postId, content, parent_id: parentId || null })
    });
    return handleResponse<any>(response);
  },

  async fetchThreadContext(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/fetch-context`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string; post: any; parent_context: any }>(response);
  },

  async reportPost(postId: string, reason: string) {
    // Report a post for moderation
    const response = await apiFetch(`${apiBase()}/posts/${postId}/report`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse<{ message: string; report_id: string }>(response);
  },

  async submitAppeal(postId: string, reason: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/appeal`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse<{ message: string; appeal_id: string }>(response);
  }
};

// Follow API
export const followApi = {
  async getStatus(id:string) {const r=await apiFetch(`${apiBase()}/users/${encodeURIComponent(id)}/follow-status`,{headers:getAuthHeaders()});return handleResponse<{status:string}>(r);},
  async getRequests(limit=20,offset=0) { const r = await apiFetch(`${apiBase()}/users/me/follow-requests?limit=${limit}&offset=${offset}`,{headers:getAuthHeaders()}); return handleResponse<any[]>(r); },
  async acceptRequest(id:string) { const r = await apiFetch(`${apiBase()}/users/me/follow-requests/${encodeURIComponent(id)}/accept`,{method:'POST',headers:getAuthHeaders()}); return handleResponse<any>(r); },
  async rejectRequest(id:string) { const r = await apiFetch(`${apiBase()}/users/me/follow-requests/${encodeURIComponent(id)}`,{method:'DELETE',headers:getAuthHeaders()}); return handleResponse<any>(r); },
  async followUser(userId: string) {
    const headers = getAuthHeaders();

    const response = await apiFetch(`${apiBase()}/users/${userId}/follow`, {
      method: 'POST',
      headers: headers
    });
    const result = await handleResponse<any>(response);
    return result;
  },

  async unfollowUser(userId: string) {
    const response = await apiFetch(`${apiBase()}/users/${userId}/follow`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async getFollowers(userId: string, limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/users/${userId}/followers?limit=${limit}&offset=${offset}`,{headers:getAuthHeaders()}
    );
    return handleResponse<any[]>(response);
  },

  async getFollowing(userId: string, limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/users/${userId}/following?limit=${limit}&offset=${offset}`,{headers:getAuthHeaders()}
    );
    return handleResponse<any[]>(response);
  },

  async getFollowStats(userId: string) {
    const response = await apiFetch(`${apiBase()}/users/${userId}/stats`,{headers:getAuthHeaders()});
    return handleResponse<{ followers: number; following: number }>(response);
  }
};

// Interaction API
export const interactionApi = {
  async likePost(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async unlikePost(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/like`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async repostPost(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/repost`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async unrepostPost(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/repost`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async bookmarkPost(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/bookmark`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async unbookmarkPost(postId: string) {
    const response = await apiFetch(`${apiBase()}/posts/${postId}/bookmark`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async getBookmarks(limit=20,offset=0) {
    const response = await apiFetch(`${apiBase()}/users/me/bookmarks?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<any[]>(response);
  },

};

// Health check
export const healthApi = {
  async check(signal?: AbortSignal) {
    const response = await apiFetch(`${apiBase()}/health`, {signal}, 90000);
    return handleResponse<{ status: string }>(response);
  }
};

// Search API
export const searchApi = {
  async searchUsers(query: string, limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/users/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ users: any[] }>(response);
  }
};

// Message API
export const messageApi = {
  async getThreads(signal?: AbortSignal,limit=30,offset=0) {
    const response = await apiFetch(`${apiBase()}/messages/threads?limit=${limit}&offset=${offset}`, {
      signal, headers: getAuthHeaders()
    });
    return handleResponse<{ threads: any[] }>(response);
  },

  async getMessages(threadId: string, limit = 30, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/messages/threads/${threadId}?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ messages: any[], thread: any }>(response);
  },

  async sendMessage(recipientId: string, content: string, ciphertext?: string, encrypted_keys?: Record<string, string>) {
    if (ciphertext && content) throw new Error('Encrypted messages must not include plaintext');
    const response = await apiFetch(`${apiBase()}/messages/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ recipient_id: recipientId, content, ciphertext, encrypted_keys })
    });
    return handleResponse<{ message: any, thread: any, recipient: any }>(response);
  },

  async syncQueuedMessages(queuedMessages: Array<{
    client_message_id: string;
    recipient_id: string;
    content: string;
    ciphertext?: string;
    encrypted_keys?: Record<string, string>;
    client_created_at?: string;
  }>) {
    if (queuedMessages.some(m => m.ciphertext && m.content)) throw new Error('Encrypted queued messages must not include plaintext');
    const response = await apiFetch(`${apiBase()}/messages/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ queued_messages: queuedMessages })
    });
    return handleResponse<{
      results: any[];
      created_count: number;
      deduplicated_count: number;
      failed_count: number;
    }>(response);
  },

  async deleteMessage(messageId: string) {
    const response = await apiFetch(`${apiBase()}/messages/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async editMessage(messageId: string, content: string, ciphertext?: string) {
    if (ciphertext && content) throw new Error('Encrypted edits must not include plaintext');
    const response = await apiFetch(`${apiBase()}/messages/${messageId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, ciphertext })
    });
    return handleResponse<{ message: string }>(response);
  },

  async startConversation(userId: string) {
    const response = await apiFetch(`${apiBase()}/messages/conversation/${userId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ thread: any }>(response);
  },

  async markAsRead(threadId: string) {
    const response = await apiFetch(`${apiBase()}/messages/threads/${threadId}/read`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  }
};

// Admin API
export const adminApi = {
  async getAllUsers(limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/admin/users?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ users: any[], total: number }>(response);
  },

  async getModerationRequests() {
    const response = await apiFetch(`${apiBase()}/admin/moderation-requests`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ requests: any[] }>(response);
  },

  async approveModerationRequest(userId: string) {
    const response = await apiFetch(`${apiBase()}/admin/moderation-requests/${userId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async rejectModerationRequest(userId: string) {
    const response = await apiFetch(`${apiBase()}/admin/moderation-requests/${userId}/reject`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async updateUserRole(userId: string, role: string) {
    const response = await apiFetch(`${apiBase()}/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role })
    });
    return handleResponse<{ message: string }>(response);
  },

  async suspendUser(userId: string) {
    const response = await apiFetch(`${apiBase()}/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async unsuspendUser(userId: string) {
    const response = await apiFetch(`${apiBase()}/admin/users/${userId}/unsuspend`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async getSuspendedUsers(limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/admin/users/suspended?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ users: any[] }>(response);
  },

  async requestModeration() {
    const response = await apiFetch(`${apiBase()}/users/me/request-moderation`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  // Content moderation queue
  async getModerationQueue() {
    const response = await apiFetch(`${apiBase()}/admin/moderation-queue`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ items: any[]; total: number }>(response);
  },

  async approveContent(reportId: string) {
    const response = await apiFetch(`${apiBase()}/admin/moderation-queue/${reportId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeContent(reportId: string) {
    const response = await apiFetch(`${apiBase()}/admin/moderation-queue/${reportId}/remove`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async warnUser(userId: string, reason: string) {
    const response = await apiFetch(`${apiBase()}/admin/users/${userId}/warn`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse<{ message: string }>(response);
  },

  async blockDomain(domain: string) {
    const response = await apiFetch(`${apiBase()}/admin/domains/block`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ domain })
    });
    return handleResponse<{ message: string }>(response);
  },

  async blockDomainWithReason(domain: string, reason: string) {
    const response = await apiFetch(`${apiBase()}/admin/domains/block`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ domain, reason })
    });
    return handleResponse<{ message: string }>(response);
  },

  async getBlockedDomains() {
    const response = await apiFetch(`${apiBase()}/admin/domains/blocked`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ domains: any[] }>(response);
  },

  async unblockDomain(domain: string) {
    const response = await apiFetch(`${apiBase()}/admin/domains/${encodeURIComponent(domain)}/block`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ message: string }>(response);
  },

  // Get admin action history (ban/unban log)
  async getAdminActions(limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/admin/actions?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    // Fallback to empty array if endpoint not implemented yet
    try {
      return handleResponse<{ actions: any[] }>(response);
    } catch (err) {
      return { actions: [] };
    }
  },

  // Suspend user with reason
  async suspendUserWithReason(userId: string, reason: string) {
    const response = await apiFetch(`${apiBase()}/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse<{ message: string }>(response);
  },

  async getFederationInspector() {
    const response = await apiFetch(`${apiBase()}/admin/federation-inspector`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{
      metrics: {
        incoming_per_minute: number;
        outgoing_per_minute: number;
        signature_validation: string;
        retry_queue: number;
        failing_domains: number;
      };
      servers: Array<{
        domain: string;
        status: string;
        reputation: string;
        reputation_score?: number;
        last_seen: string;
        incoming_m: number;
        outgoing_m: number;
        activities_m: number;
        retry_queue?: number;
        failed_h?: number;
        circuit_open?: boolean;
      }>;
      failing_domains: Array<{
        domain: string;
        queued: number;
        max_retry_count: number;
        next_retry_at: string;
        last_error: string;
        circuit_open_until: string;
      }>;
      recent_incoming: any[];
      recent_outgoing: any[];
    }>(response);
  },

  async getFederationNetwork(selfDomain?: string) {
    const suffix = selfDomain ? `?self=${encodeURIComponent(selfDomain)}` : '';
    const response = await apiFetch(`${apiBase()}/admin/federation/network${suffix}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{
      nodes: Array<{ id: string; type: string }>;
      edges: Array<{
        source: string;
        target: string;
        weight: number;
        success_count: number;
        failure_count: number;
        last_status: string;
        last_seen: string;
      }>;
    }>(response);
  },

  async getAIActions() {
    const response = await apiFetch(`${apiBase()}/admin/ai-actions`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ items: any[]; total: number }>(response);
  },

  async getAppeals() {
    const response = await apiFetch(`${apiBase()}/admin/appeals`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ appeals: any[]; total: number }>(response);
  },

  async resolveAppeal(appealId: string, decision: 'accept' | 'reject', note?: string) {
    const response = await apiFetch(`${apiBase()}/admin/appeals/${appealId}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ decision, note: note || '' })
    });
    return handleResponse<{ message: string }>(response);
  },

  async banUser(userId: string, reason?: string) {
    const response = await apiFetch(`${apiBase()}/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason: reason || '' })
    });
    return handleResponse<{ message: string }>(response);
  }
};

// Federation API - cross-instance communication
export const federationApi = {
  // Get federated timeline (local + remote posts)
  async getTimeline(limit = 20,offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/federation/timeline?limit=${limit}&offset=${offset}`
    );
    return handleResponse<{ posts: any[]; total: number }>(response);
  },

  // Search users across all instances (supports @user@domain format)
  async searchUsers(query: string) {
    const response = await apiFetch(
      `${apiBase()}/federation/users?q=${encodeURIComponent(query)}`
    );
    return handleResponse<{ users: any[]; total: number }>(response);
  },

  async searchExternalHandle(handle: string) {
    const normalized = handle.startsWith('@') ? handle : `@${handle}`;
    const response = await apiFetch(
      `${apiBase()}/federation/users?q=${encodeURIComponent(normalized)}`
    );
    return handleResponse<{ users: any[]; total: number }>(response);
  },

  // Get all users from all known federated instances
  async getAllUsers() {
    const response = await apiFetch(
      `${apiBase()}/federation/all-users`
    );
    return handleResponse<{ users: any[]; total: number }>(response);
  },

  // Follow a remote user (requires auth)
  async followRemoteUser(handle: string) {
    const response = await apiFetch(`${apiBase()}/federation/follow`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ handle })
    });
    return handleResponse<{ status: string; target: string; message: string }>(response);
  },

  // Get public user list from a specific instance (for federation discovery)
  async getPublicUsers(limit = 100) {
    const response = await apiFetch(
      `${apiBase()}/federation/public-users?limit=${limit}`
    );
    return handleResponse<{ users: any[]; total: number; domain: string }>(response);
  },

  // Get peer health status
  async getHealth() {
    const response = await apiFetch(
      `${apiBase()}/federation/health`
    );
    return handleResponse<{ self_domain: string; peers: any[] }>(response);
  },

  // Get user migration status
  async getMigrations() {
    const response = await apiFetch(
      `${apiBase()}/federation/migrations`
    );
    return handleResponse<{ migrations: any[]; total: number }>(response);
  }
};

// Export all APIs
export const hashtagApi = {
  async getTrending(limit = 10) {
    const response = await apiFetch(
      `${apiBase()}/hashtags/trending?limit=${limit}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ tag: string; count: number }[]>(response);
  },

  async getPostsByHashtag(tag: string, limit = 20, offset = 0) {
    const response = await apiFetch(
      `${apiBase()}/hashtags/tag/${encodeURIComponent(tag)}?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ hashtag: string; posts: any[]; count: number }>(response);
  },

  async searchHashtags(query: string, limit = 10) {
    const response = await apiFetch(
      `${apiBase()}/hashtags/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<{ tag: string; count: number }[]>(response);
  }
};

// Story API
export const storyApi = {

  async getStoryFeed(limit=20,offset=0) {
    const response = await apiFetch(`${apiBase()}/stories/feed?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ stories: any[] }>(response);
  },

  async createStory(file: File) {
    const fd = new FormData();
    fd.append('file', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await apiFetch(`${apiBase()}/stories`, {
      method: 'POST',
      headers,
      body: fd
    });

    return handleResponse<any>(response);
  },

  async deleteStory(id: string) {
    const response = await apiFetch(`${apiBase()}/stories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async viewStory(storyId: string) {
    const response = await apiFetch(`${apiBase()}/stories/${storyId}/view`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<any>(response);
  },

  getStoryMediaUrl(storyId: string): string {
    return `${apiBase()}/stories/${storyId}/media`;
  }
};

// Circle API - close friends / restricted visibility
export const circleApi = {
  async getCircle(limit=20,offset=0): Promise<any[]> {
    const response = await apiFetch(`${apiBase()}/users/me/circle?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<any[]>(response);
  },

  async addToCircle(userId: string): Promise<{ message: string }> {
    const response = await apiFetch(`${apiBase()}/users/me/circle/${userId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeFromCircle(userId: string): Promise<{ message: string }> {
    const response = await apiFetch(`${apiBase()}/users/me/circle/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string }>(response);
  },

  async isInCircle(userId: string): Promise<boolean> {
    const response = await apiFetch(`${apiBase()}/users/me/circle/${userId}/check`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<{ in_circle: boolean }>(response);
    return data.in_circle;
  }
};

export const api = {
  auth: authApi,
  user: userApi,
  post: postApi,
  follow: followApi,
  interaction: interactionApi,
  health: healthApi,
  search: searchApi,
  message: messageApi,
  admin: adminApi,
  federation: federationApi,
  hashtag: hashtagApi,
  story: storyApi,
  circle: circleApi
};

export default api;

// One request, one deadline. Caller cancellation is propagated; writes are never retried.
const activeRequests = new Set<AbortController>();
export function cancelPendingRequests() { for (const request of activeRequests) request.abort(); }
export async function apiFetch(input: string, options: RequestInit = {}, timeout = 20000): Promise<Response> {
 const controller = new AbortController();
 activeRequests.add(controller);
 const abort = () => controller.abort();
 if (options.signal?.aborted) controller.abort();
 options.signal?.addEventListener('abort', abort, {once:true});
 if (/\/auth\/(login|verify|register|challenge)$/.test(input)) timeout = 90000;
 const timer = setTimeout(abort,timeout);
 const headers = new Headers(options.headers);
 // Credentials must only be sent to the canonical selected API.
 if (new URL(input).origin !== new URL(apiBase()).origin) headers.delete('Authorization');
 try { return await fetch(input,{...options,headers: Object.fromEntries(Array.from(headers.entries()).map(([k,v]) => [k.toLowerCase() === 'authorization' ? 'Authorization' : k.toLowerCase() === 'content-type' ? 'Content-Type' : k,v])),signal:controller.signal}); }
 catch (error) { if (controller.signal.aborted) throw new Error(options.signal?.aborted ? 'Request cancelled' : 'The service is taking longer to respond. Retry when ready.',{cause:error}); throw error; }
 finally {activeRequests.delete(controller);clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
