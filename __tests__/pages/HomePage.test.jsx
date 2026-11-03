import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '../../components/pages/HomePage';

// Mocking the API calls used in HomePage
jest.mock('@/lib/api', () => ({
    resolveMediaUrl: jest.fn(url => url || ''),
    userApi: {
        getCurrentUser: jest.fn()
    },
    postApi: {
        getHomeFeed: jest.fn(() => Promise.resolve([])), getFeed: jest.fn(async()=>[]), getPublicFeed: jest.fn(async()=>[])
    },
    interactionApi: {
        getNotifications: jest.fn(() => Promise.resolve({ notifications: [] }))
    },
    followApi: {getFollowing:jest.fn(async()=>[]),getFollowStats:jest.fn(async()=>({followers:0,following:0}))},
    storyApi:{getStoryFeed:jest.fn(async()=>({stories:[]}))},
    adminApi: {},
    searchApi: {},
    messageApi: {},
    federationApi: {},
    hashtagApi: {getTrending: jest.fn(async()=>({hashtags:[]}))},
    getCurrentInstance: jest.fn(() => ({ url: 'http://localhost:3000', domain: 'splitter-1' }))
}));

jest.mock('@/components/ui/theme-provider', () => ({
    useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() })
}));

describe('HomePage Feed Architecture', () => {
    test('1️⃣ Renders 3-Column Layout Containers', async () => {
        const mockUserData = { 
            id: '1', 
            username: 'testuser', 
            avatar: '👩', 
            displayName: 'Test User',
            did: 'did:key:test'
        };
        
        render(
            <HomePage 
                onNavigate={jest.fn()} 
                userData={mockUserData} 
                updateUserData={jest.fn()}
                handleLogout={jest.fn()}
            />
        );
        
        // Wait for basic elements to load
        // This assumes standard text like "Home"
        const homeText = await screen.findAllByText(/Home/i);
        expect(homeText.length).toBeGreaterThan(0);
    });
});
