import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

function MockLoginForm({ onSubmit }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setError('');
        onSubmit({ username, password });
    };

    return (
        <form onSubmit={handleSubmit} data-testid="login-form">
            {error && <div data-testid="login-error">{error}</div>}
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" disabled={!username || !password}>Login</button>
        </form>
    );
}

describe('Login Validation', () => {
    test('submit button is disabled when fields are empty', () => {
        render(<MockLoginForm onSubmit={jest.fn()} />);
        const submitBtn = screen.getByRole('button', { name: 'Login' });

        expect(submitBtn).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'user' } });
        expect(submitBtn).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: '123' } });
        expect(submitBtn).not.toBeDisabled();
    });

    test('shows validation error if password is too short on submit', () => {
        const mockSubmit = jest.fn();
        render(<MockLoginForm onSubmit={mockSubmit} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: '123' } });

        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        expect(screen.getByTestId('login-error')).toHaveTextContent('Password must be at least 6 characters');
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    test('submits successfully with valid input', () => {
        const mockSubmit = jest.fn();
        render(<MockLoginForm onSubmit={mockSubmit} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'securepassword' } });

        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
        expect(mockSubmit).toHaveBeenCalledWith({ username: 'testuser', password: 'securepassword' });
    });
});
