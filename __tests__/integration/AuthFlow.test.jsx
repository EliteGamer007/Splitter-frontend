import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '../../components/pages/LoginPage';
import { authApi, userApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
    authApi: {
        login: jest.fn(),
        getChallenge: jest.fn(),
        verifyChallenge: jest.fn(),
    },
    userApi: {
        getCurrentUser: jest.fn(),
        updateEncryptionKey: jest.fn(() => Promise.resolve()),
    },
    getCurrentInstance: jest.fn(() => ({ domain: 'splitter-1' })),
    setApiBase: jest.fn(),
}));

jest.mock('@/lib/crypto', () => ({
    knownIdentities: jest.fn(() => []),
    getStoredKeyPair: jest.fn(() => Promise.resolve(null)),
    ensureEncryptionKeys: jest.fn(() => Promise.resolve({ encryptionPublicKeyBase64: 'key123' })),
}));

jest.mock('@/components/ui/theme-provider', () => ({
    useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

describe('Integration: Authentication Flow', () => {
    test('1️⃣ Simulates complete login integration with API and State', async () => {
        authApi.login.mockResolvedValue({ token: 'mock-jwt-token' });
        userApi.getCurrentUser.mockResolvedValue({ id: '1', username: 'integration_user' });
        
        const mockNavigate = jest.fn();
        const mockUpdateUser = jest.fn();
        const mockSetAuth = jest.fn();

        render(
            <LoginPage 
                onNavigate={mockNavigate} 
                updateUserData={mockUpdateUser} 
                setIsAuthenticated={mockSetAuth} 
            />
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'integration_user' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'testpass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalled();
            expect(userApi.getCurrentUser).toHaveBeenCalled();
            expect(mockSetAuth).toHaveBeenCalledWith(true);
            expect(mockUpdateUser).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('home');
        });
    });
});
