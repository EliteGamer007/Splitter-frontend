import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '../../components/pages/LoginPage';
import { authApi, userApi, getCurrentInstance } from '@/lib/api';
import { getStoredKeyPair, signChallenge, importRecoveryFile } from '@/lib/crypto';
import { useTheme } from '@/components/ui/theme-provider';

// Mocks
jest.mock('@/lib/api');
jest.mock('@/lib/crypto');
jest.mock('@/components/ui/theme-provider');
jest.mock('../../styles/LoginPage.css', () => ({}));

describe('LoginPage', () => {
    const mockOnNavigate = jest.fn();
    const mockUpdateUserData = jest.fn();
    const mockSetIsAuthenticated = jest.fn();
    const mockToggleTheme = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        useTheme.mockReturnValue({ theme: 'dark', toggleTheme: mockToggleTheme });
        getCurrentInstance.mockReturnValue({ domain: 'splitter-1' });
        getStoredKeyPair.mockResolvedValue(null);
        authApi.login.mockResolvedValue({ token: 'fake-token' });
        userApi.getCurrentUser.mockResolvedValue({
            id: '1',
            username: 'testuser',
            role: 'user',
            display_name: 'Test User',
            instance_domain: 'localhost',
            avatar_url: 'avatar.png',
            email: 'test@example.com',
            bio: 'Bio',
            did: 'did:key:123',
            moderation_requested: false,
            followers_count: 10,
            following_count: 5,
            posts_count: 20
        });
    });

    test('1️⃣ Renders correctly', async () => {
        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    test('2️⃣ Validation — Empty Fields', async () => {
        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        expect(await screen.findByText('⚠️ Please enter username and password')).toBeInTheDocument();
        expect(authApi.login).not.toHaveBeenCalled();
    });

    test('3️⃣ Successful Password Login Flow', async () => {
        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        });

        expect(authApi.login).toHaveBeenCalledWith({ username: 'testuser', password: 'password123' });
        expect(userApi.getCurrentUser).toHaveBeenCalled();
        expect(mockUpdateUserData).toHaveBeenCalled();
        expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);

        // Wait for requestAnimationFrame
        await waitFor(() => {
            expect(mockOnNavigate).toHaveBeenCalledWith('home');
        });
    });

    test('4️⃣ Failed Login', async () => {
        authApi.login.mockRejectedValue(new Error('Invalid credentials'));

        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'wronguser' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        });

        expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
        expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    test('5️⃣ DID Login Toggle', async () => {
        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /did challenge/i }));

        expect(screen.getByLabelText(/your did/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /request challenge/i })).toBeInTheDocument();
    });

    test('6️⃣ Challenge Request', async () => {
        authApi.getChallenge.mockResolvedValue({ challenge: 'abc12345' });

        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        // Switch to DID mode
        fireEvent.click(screen.getByRole('button', { name: /did challenge/i }));

        // Fill DID
        fireEvent.change(screen.getByLabelText(/your did/i), { target: { value: 'did:key:123' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /request challenge/i }));
        });

        expect(authApi.getChallenge).toHaveBeenCalledWith('did:key:123');
        expect(await screen.findByText('abc12345')).toBeInTheDocument();
        expect(screen.getByText(/authentication challenge/i)).toBeInTheDocument();
    });

    test('7️⃣ Theme Toggle', async () => {
        render(
            <LoginPage
                onNavigate={mockOnNavigate}
                updateUserData={mockUpdateUserData}
                setIsAuthenticated={mockSetIsAuthenticated}
            />
        );

        const themeBtn = screen.getByTitle(/switch to light mode/i); // Mock returns 'dark' so title is 'Switch to Light Mode' (or specific logic)
        // The component logic: const isDarkMode = theme === 'dark';
        // isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'
        // Mock returned 'dark', so isDarkMode is true.

        fireEvent.click(themeBtn);

        expect(mockToggleTheme).toHaveBeenCalled();
    });
});
