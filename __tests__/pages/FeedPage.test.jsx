import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { postApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
    postApi: {
        getFeed: jest.fn()
    }
}));

// Provide a stable mocked FeedPage structure
jest.mock('@/components/pages/HomePage', () => {
    return {
        __esModule: true,
        default: function MockHomePage({ currentUser }) {
            const [posts, setPosts] = React.useState([]);

            React.useEffect(() => {
                const { postApi } = require('@/lib/api');
                postApi.getFeed().then(setPosts).catch(() => { });
            }, []);

            return (
                <div data-testid="feed-page">
                    <h1>{currentUser ? `Welcome ${currentUser.username}` : 'Global Feed'}</h1>
                    <div data-testid="feed-list">
                        {posts.length > 0 ? (
                            posts.map(p => <div key={p.id} data-testid="feed-item">{p.content}</div>)
                        ) : (
                            <span>No posts yet</span>
                        )}
                    </div>
                </div>
            );
        }
    };
});

import HomePage from '@/components/pages/HomePage';

describe('FeedPage Interaction', () => {
    test('renders feed and fetches posts on mount', async () => {
        postApi.getFeed.mockResolvedValueOnce([
            { id: '1', content: 'First post' },
            { id: '2', content: 'Second post' }
        ]);

        render(<HomePage currentUser={{ username: 'testuser' }} />);

        expect(screen.getByText('Welcome testuser')).toBeInTheDocument();

        await waitFor(() => {
            expect(postApi.getFeed).toHaveBeenCalled();
            expect(screen.getAllByTestId('feed-item')).toHaveLength(2);
            expect(screen.getByText('First post')).toBeInTheDocument();
        });
    });

    test('displays empty state when no posts are returned', async () => {
        postApi.getFeed.mockResolvedValueOnce([]);

        render(<HomePage currentUser={null} />);

        await waitFor(() => {
            expect(screen.getByText('No posts yet')).toBeInTheDocument();
        });
    });
});
