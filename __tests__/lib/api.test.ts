import { authApi, postApi, userApi } from '@/lib/api';

// Mock global fetch
global.fetch = jest.fn();

const API_BASE = 'http://localhost:8000/api/v1';

describe('API Library', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    test('1️⃣ Successful Login API', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ token: 'mock-token', user: { id: '1', username: 'test' } }),
        });

        const result = await authApi.login({ username: 'test', password: 'password' });

        expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/auth/login`, expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ username: 'test', password: 'password' }),
        }));

        expect(result.token).toBe('mock-token');
        expect(localStorage.getItem('jwt_token')).toBe('mock-token');
        expect(localStorage.getItem('user')).toContain('test');
    });

    test('2️⃣ Failed Response Handling', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => JSON.stringify({ error: 'Invalid credentials' }),
            url: 'http://localhost/api/auth/login'
        });

        await expect(authApi.login({ username: 'test', password: 'wrong' }))
            .rejects.toThrow('Invalid credentials');
    });

    test('3️⃣ getAuthHeaders Behavior', async () => {
        localStorage.setItem('jwt_token', 'stored-token');

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        await userApi.getCurrentUser();

        expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/users/me`, expect.objectContaining({
            headers: expect.objectContaining({
                'Authorization': 'Bearer stored-token',
                'Content-Type': 'application/json'
            })
        }));
    });

    test('4️⃣ createPost (multipart)', async () => {
        localStorage.setItem('jwt_token', 'stored-token');
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ id: '123' }),
        });

        const file = new File(['content'], 'test.png', { type: 'image/png' });
        await postApi.createPost('Hello World', 'public', file);

        expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/posts`, expect.objectContaining({
            method: 'POST',
            // headers should NOT contain Content-Type for multipart
            headers: {
                'Authorization': 'Bearer stored-token'
            }
        }));

        // Verify FormData
        const callArgs = (global.fetch as jest.Mock).mock.calls[0];
        const formData = callArgs[1].body;
        expect(formData).toBeInstanceOf(FormData);
        expect(formData.get('content')).toBe('Hello World');
        expect(formData.get('visibility')).toBe('public');
        expect(formData.get('file')).toBeInstanceOf(File);
    });

    test('5️⃣ logout()', async () => {
        localStorage.setItem('jwt_token', 'token');
        localStorage.setItem('user', 'userData');

        authApi.logout();

        expect(localStorage.getItem('jwt_token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
    });
});
