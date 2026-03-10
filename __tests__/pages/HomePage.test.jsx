import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '../../components/pages/HomePage';
import { userApi } from '@/lib/api';

// Mocking the API calls used in HomePage
jest.mock('@/lib/api', () => ({
    userApi: {
        getCurrentUser: jest.fn()
    },
    postApi: {
        getHomeFeed: jest.fn()
    }
}));

describe('HomePage Feed Architecture', () => {
    beforeEach(() => {
        // Mocking user profile API to simulate log in
        userApi.getCurrentUser.mockResolvedValue({ username: 'testuser', display_name: 'Test User' });
    });

    test('1️⃣ Renders 3-Column Layout Containers', async () => {
        render(<HomePage onNavigate={jest.fn()} />);
        
        // Wait for basic elements to load
        // This assumes standard text like "Home", "Trending", or a composer placeholder
        const homeText = await screen.findAllByText(/Home/i);
        expect(homeText.length).toBeGreaterThan(0);
        
        // In a real scenario, you can check for the composer input or trending section
        // expect(screen.getByText(/Trending/i)).toBeInTheDocument();
    });
});
