import React from 'react';
import { useTheme } from '@/components/ui/theme-provider';

export default function AppBottomNav({ currentPage, onNavigate, hasUnread = false }) {
  const { theme } = useTheme();
  
  if (['landing', 'login', 'signup', 'instances'].includes(currentPage)) {
    return null;
  }

  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'trending', icon: '🔍', label: 'Explore' },
    { id: 'dm', icon: '✉️', label: 'Messages', hasNotification: hasUnread },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <>
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        <button 
          onClick={() => {
             if (currentPage !== 'home') onNavigate('home');
             setTimeout(() => {
                const composeInput = document.querySelector('.compose-textarea, textarea');
                if (composeInput) {
                    composeInput.focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
             }, 300);
          }}
          className="rounded-full shadow-lg flex items-center justify-center text-2xl w-14 h-14"
          style={{ 
              background: 'linear-gradient(135deg, #00d9ff, #ff00ff)',
              color: 'white',
              boxShadow: '0 4px 15px rgba(0, 217, 255, 0.4)',
              border: 'none',
              cursor: 'pointer'
          }}
        >
          ✍️
        </button>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center h-16 z-50 transition-colors border-t"
           style={{ 
               background: 'color-mix(in srgb, var(--bg-primary, #000) 90%, transparent)',
               backdropFilter: 'blur(10px)',
               borderColor: 'var(--border-color, #333)',
               paddingBottom: 'env(safe-area-inset-bottom)'
           }}>
        {navItems.map(item => {
            const isActive = currentPage === item.id || (item.id === 'home' && ['thread', 'hashtag'].includes(currentPage));
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center w-full h-full transition-colors relative"
                style={{
                  color: isActive ? '#00d9ff' : 'var(--text-secondary, #888)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <div className="relative flex flex-col items-center">
                  <span style={{ fontSize: '20px', marginBottom: '2px', filter: isActive ? 'drop-shadow(0 0 5px rgba(0,217,255,0.5))' : 'none' }}>{item.icon}</span>
                  {item.hasNotification && (
                    <span style={{
                      position: 'absolute',
                      top: '0',
                      right: '-4px',
                      width: '8px',
                      height: '8px',
                      background: '#ffd700',
                      borderRadius: '50%',
                      boxShadow: '0 0 8px #ffd700'
                    }} />
                  )}
                  <span style={{ fontSize: '10px', fontWeight: isActive ? 'bold' : 'normal' }}>{item.label}</span>
                </div>
              </button>
            )
        })}
      </nav>
      {/* Spacer to avoid content being hidden behind the bottom nav on mobile */}
      <div className="block md:hidden" style={{ height: '64px', width: '100%' }} />
    </>
  );
}