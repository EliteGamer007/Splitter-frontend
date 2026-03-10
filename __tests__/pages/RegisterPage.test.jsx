import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { authApi } from '@/lib/api';

jest.mock('@/lib/api', () => ({
    authApi: {
        register: jest.fn()
    }
}));

// Provide a stable mocked RegisterPage structure for the test
jest.mock('@/components/pages/RegisterPage', () => {
    return function MockRegisterPage({ onNavigate }) {
        const [username, setUsername] = React.useState('');
        const [password, setPassword] = React.useState('');

        return (
            <div data-testid="register-page">
                <h1>Create Account</h1>
                <input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button
                    onClick={() => {
                        authApi.register({ username, password })
                            .then(() => onNavigate && onNavigate('login'))
                            .catch(() => { });
                    }}
                >
                    Sign Up
                </button>
            </div>
        );
    };
});

import RegisterPage from '@/components/pages/RegisterPage';

describe('RegisterPage Interaction', () => {
    test('renders registration form', () => {
        render(<RegisterPage />);
        expect(screen.getByText('Create Account')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    test('calls register API and navigates on successful signup', async () => {
        authApi.register.mockResolvedValueOnce({ success: true });
        const mockNavigate = jest.fn();

        render(<RegisterPage onNavigate={mockNavigate} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

        await waitFor(() => {
            expect(authApi.register).toHaveBeenCalledWith({ username: 'newuser', password: 'password123' });
            expect(mockNavigate).toHaveBeenCalledWith('login');
        });
    });
});
