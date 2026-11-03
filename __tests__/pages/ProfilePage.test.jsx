import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilePage from '../../components/pages/ProfilePage';

// Mocking the API calls
jest.mock('@/lib/api', () => ({
    followApi: {
        getStatus: jest.fn(async () => ({status:'none'})),
        getRequests: jest.fn(async () => ({requests:[]})),
        getFollowStats: jest.fn(async () => ({followers:3,following:1})),
        getFollowers: jest.fn(() => Promise.resolve([{}, {}, {}])),
        getFollowing: jest.fn(() => Promise.resolve([{}])),
        unfollowUser: jest.fn()
    },
    userApi: {
        getUserProfile: jest.fn(),
        getFollowStats: jest.fn(async () => ({followers_count:3,following_count:1,posts_count:2})),
        updateProfile: jest.fn(),
        uploadAvatar: jest.fn()
    },
    postApi: {
        getUserPosts: jest.fn(() => Promise.resolve([{}, {}]))
    },
    getCurrentInstance: jest.fn(() => ({ url: 'http://localhost:3000' })),
    resolveMediaUrl: jest.fn(url => url)
}));

jest.mock('@/components/ui/theme-provider', () => ({
    useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() })
}));

describe('ProfilePage Stats rendering', () => {
    const mockUser = {
        id: '1',
        username: 'alice_crypto',
        displayName: 'Alice Decent',
        avatar: '👤',
        bio: 'Decentralized web enthusiast.',
        did: 'did:key:alice'
    };

    test('1️⃣ Displays accurate user counts and profile metadata', async () => {
        render(<ProfilePage onNavigate={jest.fn()} userData={mockUser} />);
        
        // Wait for profile data to load
        await waitFor(() => {
            expect(screen.getByDisplayValue('Alice Decent')).toBeInTheDocument();
        });
        
        expect(screen.getByText(/@alice_crypto/i)).toBeInTheDocument();
        
        // Verify stats
        await waitFor(() => {
            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('2')).toBeInTheDocument();
        });
        
        // Use getAllByText for bio because it appears in both view and edit modes
        const bioElements = screen.getAllByText('Decentralized web enthusiast.');
        expect(bioElements.length).toBeGreaterThan(0);
    });
});
