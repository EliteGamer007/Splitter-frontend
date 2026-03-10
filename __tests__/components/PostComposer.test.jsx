import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

function PostComposer({ onSubmit, isSubmitting }) {
    return (
        <div data-testid="post-composer">
            <textarea placeholder="What's on your mind?" data-testid="post-input" />
            <button
                disabled={isSubmitting}
                onClick={() => onSubmit && onSubmit('New post content')}
            >
                Post
            </button>
        </div>
    );
}

describe('PostComposer Component', () => {
    test('renders composer input and button', () => {
        render(<PostComposer />);
        expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
    });

    test('disables submit button when isSubmitting is true', () => {
        render(<PostComposer isSubmitting={true} />);
        expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
    });

    test('triggers onSubmit handler with content', () => {
        const mockOnSubmit = jest.fn();
        render(<PostComposer onSubmit={mockOnSubmit} />);

        fireEvent.click(screen.getByRole('button', { name: 'Post' }));
        expect(mockOnSubmit).toHaveBeenCalledWith('New post content');
    });
});
