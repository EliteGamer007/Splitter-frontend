import { authApi } from '@/lib/api';

global.fetch = jest.fn();

const API_BASE = 'http://localhost:8000/api/v1';

describe('API Auth Interaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('register calls correct endpoint with correct payload', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'User created' })
        });

        const credentials = { username: 'testuser', email: 'test@example.com', password: 'password123' };
        await authApi.register(credentials);

        expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/auth/register`, expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(credentials)
        }));
    });

    test('getChallenge requests DID auth successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ challenge: 'mock-challenge-string' })
        });

        const result = await authApi.getChallenge('did:key:123');

        expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/auth/challenge`, expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ did: 'did:key:123' })
        }));
        expect(result.challenge).toBe('mock-challenge-string');
    });

    test('verifyChallenge submits signed payload', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ token: 'mock-did-token' })
        });

        const payload = { did: 'did:key:123', challenge: 'mock-challenge-string', signature: '0xabc123' };
        const result = await authApi.verifyChallenge(payload);

        expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/auth/verify`, expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(payload)
        }));

        expect(result.token).toBe('mock-did-token');
    });
});
