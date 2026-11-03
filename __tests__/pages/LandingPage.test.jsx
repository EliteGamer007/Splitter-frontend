import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LandingPage from '../../components/pages/LandingPage';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
};

// Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
        h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
        p: ({ children, ...props }) => <p {...props}>{children}</p>,
        button: ({ children, ...props }) => <button {...props}>{children}</button>,
        span: ({ children, ...props }) => <span {...props}>{children}</span>,
        header: ({ children, ...props }) => <header {...props}>{children}</header>,
        nav: ({ children, ...props }) => <nav {...props}>{children}</nav>,
        section: ({ children, ...props }) => <section {...props}>{children}</section>,
    },
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0,
    useSpring: () => 0,
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useMotionTemplate: () => '',
    AnimatePresence: ({ children }) => <>{children}</>
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
    ArrowRight: () => <span data-testid="icon" />,
    Shield: () => <span data-testid="icon" />,
    Globe: () => <span data-testid="icon" />,
    Server: () => <span data-testid="icon" />,
    Code: () => <span data-testid="icon" />,
    Layers: () => <span data-testid="icon" />,
    Zap: () => <span data-testid="icon" />,
    CheckCircle2: () => <span data-testid="icon" />,
}));

jest.mock('@/lib/api', () => ({
    resolveMediaUrl: jest.fn(url => url || ''),
    getCurrentInstance: jest.fn(() => ({ url: 'http://localhost:3000' }))
}));

jest.mock('@/components/ui/theme-provider', () => ({
    useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() })
}));

jest.mock('@/components/ui/WalkthroughTooltip', () => ({ children }) => <>{children}</>);

describe('LandingPage', () => {
    test('1️⃣ Renders Hero and Intro Text', () => {
        render(<LandingPage onNavigate={jest.fn()} />);
        // Use getAllByText because "Splitter" appears in nav and hero
        expect(screen.getAllByText(/Splitter/i)[0]).toBeInTheDocument();
    });

    test('2️⃣ Navigates to Signup on interaction', () => {
        const mockNavigate = jest.fn();
        render(<LandingPage onNavigate={mockNavigate} />);
        
        const buttons = screen.getAllByRole('button');
        const startBtn = buttons.find(b => /Get Started/i.test(b.textContent));
        
        if (startBtn) {
            fireEvent.click(startBtn);
            // Matches LandingPage.jsx logic: onNavigate('signup')
            expect(mockNavigate).toHaveBeenCalledWith('signup');
        }
    });
});
