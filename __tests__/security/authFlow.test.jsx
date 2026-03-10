import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simplified mock demonstrating a typical secure App routing wrapper
function ProtectedRoute({ children, returnTo }) {
    const token = localStorage.getItem('jwt_token');

    if (!token) {
        return <div data-testid="redirect">Redirecting to login (Return URL: {returnTo})</div>;
    }

    return <div data-testid="protected-content">{children}</div>;
}

describe('Authentication Flow & Security', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('redirects unauthorized users away from protected routes', () => {
        render(
            <ProtectedRoute returnTo="/dashboard">
                <span>Secret Dashboard</span>
            </ProtectedRoute>
        );

        expect(screen.getByTestId('redirect')).toHaveTextContent('Redirecting to login');
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    test('allows authorized users to access protected routes', () => {
        localStorage.setItem('jwt_token', 'valid.token.here');

        render(
            <ProtectedRoute returnTo="/dashboard">
                <span>Secret Dashboard</span>
            </ProtectedRoute>
        );

        expect(screen.getByTestId('protected-content')).toHaveTextContent('Secret Dashboard');
        expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
    });

    test('clearing token behaves as a logout and locks route', () => {
        localStorage.setItem('jwt_token', 'valid.token.here');

        const { rerender } = render(
            <ProtectedRoute returnTo="/dashboard">
                <span>Secret Dashboard</span>
            </ProtectedRoute>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();

        // Simulate Logout
        localStorage.removeItem('jwt_token');

        rerender(
            <ProtectedRoute returnTo="/dashboard">
                <span>Secret Dashboard</span>
            </ProtectedRoute>
        );

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('redirect')).toBeInTheDocument();
    });
});
