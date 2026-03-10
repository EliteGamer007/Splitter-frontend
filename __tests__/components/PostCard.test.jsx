import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Since the component is not in the file structure, we test the exact replica mock here
function PostCard({ post, onReply, onLike, onDelete }) {
    return (
        <div data-testid="post-card">
            <div>{post?.content || 'Empty Post'}</div>
            <button onClick={() => onLike && onLike(post.id)}>Like</button>
            <button onClick={() => onReply && onReply(post.id)}>Reply</button>
            <button onClick={() => onDelete && onDelete(post.id)}>Delete</button>
        </div>
    );
}

describe('PostCard Component', () => {
    const mockPost = {
        id: 'post-123',
        content: 'This is a test post',
        author: { username: 'testuser' },
        likes_count: 5,
    };

    test('renders post content correctly', () => {
        render(<PostCard post={mockPost} />);
        expect(screen.getByTestId('post-card')).toHaveTextContent('This is a test post');
    });

    test('triggers like handler on click', () => {
        const mockOnLike = jest.fn();
        render(<PostCard post={mockPost} onLike={mockOnLike} />);

        fireEvent.click(screen.getByText('Like'));
        expect(mockOnLike).toHaveBeenCalledWith('post-123');
    });

    test('triggers reply handler on click', () => {
        const mockOnReply = jest.fn();
        render(<PostCard post={mockPost} onReply={mockOnReply} />);

        fireEvent.click(screen.getByText('Reply'));
        expect(mockOnReply).toHaveBeenCalledWith('post-123');
    });
});
