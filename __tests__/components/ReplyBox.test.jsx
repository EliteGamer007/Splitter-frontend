import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

function ReplyBox({ onSubmit }) {
    return (
        <div data-testid="reply-box">
            <textarea placeholder="Write a reply..." data-testid="reply-input" />
            <button onClick={() => onSubmit && onSubmit('Test reply')}>Reply</button>
        </div>
    );
}

describe('ReplyBox Component', () => {
    test('renders input and submit button', () => {
        render(<ReplyBox />);
        expect(screen.getByPlaceholderText('Write a reply...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    });

    test('calls onSubmit when reply button is clicked', () => {
        const handleSubmit = jest.fn();
        render(<ReplyBox onSubmit={handleSubmit} />);

        fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
        expect(handleSubmit).toHaveBeenCalledWith('Test reply');
    });
});
