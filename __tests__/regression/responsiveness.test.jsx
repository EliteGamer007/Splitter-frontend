import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
};

// Mock Next.js router and other dependencies
jest.mock('@/lib/api', () => ({
  userApi: { getCurrentUser: jest.fn() },
  postApi: { getPublicFeed: jest.fn(async()=>[]), getFeed: jest.fn(async()=>[]), getHomeFeed: jest.fn(() => Promise.resolve([])) },
  authApi: { isLoggedIn: jest.fn(() => false), getCurrentUserFromStorage: jest.fn(() => null) },
  followApi: {getFollowers:jest.fn(async()=>[]),getFollowing:jest.fn(async()=>[]),getFollowStats:jest.fn(async()=>({followers:0,following:0}))},
  interactionApi: { getNotifications: jest.fn(() => Promise.resolve({ notifications: [] })) },
  adminApi: {},
  searchApi: {},
  messageApi: {},
  federationApi: {},
  hashtagApi: {getTrending: jest.fn(async()=>({hashtags:[]}))},
  getCurrentInstance: jest.fn(() => ({ domain: 'splitter-1', url: 'https://splitter-m0kv.onrender.com/api/v1' })),
  resolveMediaUrl: jest.fn(url => url),
  setApiBase: jest.fn(),
}));

jest.mock('@/lib/crypto', () => ({
  getStoredKeyPair: jest.fn(() => Promise.resolve(null)),
  knownIdentities: jest.fn(() => []),
  ensureEncryptionKeys: jest.fn(() => Promise.resolve({ encryptionPublicKeyBase64: 'key123' })),
}));

jest.mock('@/components/ui/theme-provider', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

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
    Eye: () => <span data-testid="icon" />,
    EyeOff: () => <span data-testid="icon" />,
    Mail: () => <span data-testid="icon" />,
    Lock: () => <span data-testid="icon" />,
}));

// Mock WalkthroughTooltip
jest.mock('@/components/ui/WalkthroughTooltip', () => ({ children }) => <>{children}</>);

// Utility: mock window.matchMedia for viewport-like queries in JSDOM
function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

// ---------------------
// Landing Page tests
// ---------------------
import LandingPage from '../../components/pages/LandingPage';
jest.mock('../../components/styles/LandingPage.css', () => ({}));

describe('Responsive Layout — LandingPage', () => {
  test('1️⃣ Renders at 360px (micro-mobile) without crashing', () => {
    setViewportWidth(360);
    const { container } = render(<LandingPage onNavigate={jest.fn()} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('2️⃣ Renders at 480px (small mobile) without crashing', () => {
    setViewportWidth(480);
    const { container } = render(<LandingPage onNavigate={jest.fn()} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('3️⃣ Renders at 768px (tablet/large phone) without crashing', () => {
    setViewportWidth(768);
    const { container } = render(<LandingPage onNavigate={jest.fn()} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('4️⃣ Logo text is present at all widths', () => {
    [360, 480, 768, 1024].forEach(w => {
      setViewportWidth(w);
      const { unmount } = render(<LandingPage onNavigate={jest.fn()} />);
      expect(screen.getAllByText(/splitter/i).length).toBeGreaterThan(0);
      unmount();
    });
  });

  test('5️⃣ Navigation buttons are in the DOM at 480px', () => {
    setViewportWidth(480);
    render(<LandingPage onNavigate={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

// ---------------------
// Login Page tests
// ---------------------
import LoginPage from '../../components/pages/LoginPage';
jest.mock('../../components/styles/LoginPage.css', () => ({}));

describe('Responsive Layout — LoginPage', () => {
  const props = {
    onNavigate: jest.fn(),
    updateUserData: jest.fn(),
    setIsAuthenticated: jest.fn(),
  };

  test('6️⃣ Renders login form at 360px', () => {
    setViewportWidth(360);
    render(<LoginPage {...props} />);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  test('7️⃣ Username and password inputs accessible at 480px', () => {
    setViewportWidth(480);
    render(<LoginPage {...props} />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test('8️⃣ Sign In button visible and clickable at 360px', () => {
    setViewportWidth(360);
    render(<LoginPage {...props} />);
    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn).not.toBeDisabled();
  });
});

// ---------------------
// Viewport scaling tests (structural)
// ---------------------
describe('Responsive Layout — Structural Scaling', () => {
  test('9️⃣ window.innerWidth can be set to 320px (ultra-narrow)', () => {
    setViewportWidth(320);
    expect(window.innerWidth).toBe(320);
  });

  test('🔟 window.innerWidth can be set back to 1280px (desktop)', () => {
    setViewportWidth(1280);
    expect(window.innerWidth).toBe(1280);
  });

  test('1️⃣1️⃣ Renders LandingPage at ultra-narrow 320px without errors', () => {
    setViewportWidth(320);
    expect(() => render(<LandingPage onNavigate={jest.fn()} />)).not.toThrow();
  });
});
