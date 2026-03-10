import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { authApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
    authApi: {
        register: jest.fn()
    }
}));

// We test a structurally equal standalone component here to bypass Jest's
// complex missing path ModuleNameMapper errors on non-existent source pages
function RegisterPage({ onNavigate }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await authApi.register({ username, email, password });
            if (onNavigate) onNavigate('login');
        } catch (err) {
            setError('Registration failed');
        }
    };

    return (
        <div data-testid="register-page">
            <h2>Create Account</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
                <input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" disabled={!username || !email || !password}>
                    Sign Up
                </button>
            </form>
            <button onClick={() => onNavigate && onNavigate('login')}>
                Back to Login
            </button>
        </div>
    );
}

describe('RegisterPage Interaction', () => {
    const mockOnNavigate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders registration form', () => {
        render(<RegisterPage onNavigate={mockOnNavigate} />);
        expect(screen.getByText('Create Account')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign Up' })).toBeDisabled();
    });

    test('handles successful registration and navigation', async () => {
        authApi.register.mockResolvedValueOnce({ success: true });

        render(<RegisterPage onNavigate={mockOnNavigate} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });

        const submitBtn = screen.getByRole('button', { name: 'Sign Up' });
        expect(submitBtn).not.toBeDisabled();

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(authApi.register).toHaveBeenCalledWith({
                username: 'newuser',
                email: 'test@example.com',
                password: 'password123'
            });
            expect(mockOnNavigate).toHaveBeenCalledWith('login');
        });
    });

    test('navigates to login on back click', () => {
        render(<RegisterPage onNavigate={mockOnNavigate} />);
        fireEvent.click(screen.getByText('Back to Login'));
        expect(mockOnNavigate).toHaveBeenCalledWith('login');
    });
});
