import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

function MockRegisterForm({ onSubmit }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!username || !password || !confirmPassword) {
            setError('All fields are required');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setError('');
        onSubmit({ username, password });
    };

    return (
        <form onSubmit={handleSubmit} data-testid="register-form">
            {error && <div data-testid="register-error">{error}</div>}
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <button type="submit" disabled={!username || !password || !confirmPassword}>Sign Up</button>
        </form>
    );
}

describe('Register Validation', () => {
    test('disables button when fields are empty', () => {
        render(<MockRegisterForm onSubmit={jest.fn()} />);
        const submitBtn = screen.getByRole('button', { name: 'Sign Up' });

        expect(submitBtn).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'user' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
        expect(submitBtn).toBeDisabled(); // confirm pwd is still empty

        fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'pass1234' } });
        expect(submitBtn).not.toBeDisabled();
    });

    test('shows validation error if passwords do not match', () => {
        const mockSubmit = jest.fn();
        render(<MockRegisterForm onSubmit={mockSubmit} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'securepass' } });
        fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'differentpass' } });

        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

        expect(screen.getByTestId('register-error')).toHaveTextContent('Passwords do not match');
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    test('shows validation error if password is too short', () => {
        const mockSubmit = jest.fn();
        render(<MockRegisterForm onSubmit={mockSubmit} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'short' } });
        fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'short' } });

        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

        expect(screen.getByTestId('register-error')).toHaveTextContent('Password must be at least 8 characters');
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    test('submits successfully with valid matching input', () => {
        const mockSubmit = jest.fn();
        render(<MockRegisterForm onSubmit={mockSubmit} />);

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'securepassword' } });
        fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'securepassword' } });

        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

        expect(screen.queryByTestId('register-error')).not.toBeInTheDocument();
        expect(mockSubmit).toHaveBeenCalledWith({ username: 'testuser', password: 'securepassword' });
    });
});
