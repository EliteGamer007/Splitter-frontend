'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';

const WALKTHROUGH_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Splitter',
    message: `This is your home feed where you'll see posts from people you follow and discover new content from across the federated network.

The home page combines posts from your local server and other connected servers, giving you a complete view of the conversation.`,
    highlight: null,
    navigateTo: null
  },
  {
    id: 'nav-tabs',
    title: 'Navigation Tabs',
    message: `Use these tabs to filter your feed:
• Home: See all posts (local + federated)
• Local: Only posts from your server
• Federated: Only posts from other servers

This helps you stay connected with your community while exploring the wider network.`,
    highlight: '.nav-center',
    navigateTo: null
  },
  {
    id: 'post-composer',
    title: 'Create Posts',
    message: `Share your thoughts with the network. You can write text posts, add images, choose visibility settings, and edit or delete posts after publishing.

Your posts will be shared with your followers and federated to other servers.`,
    highlight: '.post-create',
    navigateTo: null
  },
  {
    id: 'posts-feed',
    title: 'Posts Feed',
    message: `This is your timeline where posts appear. Each post shows the author's name, server, local or federated badge, and interaction buttons.

You can interact with any post regardless of which server it came from.`,
    highlight: '.posts-list',
    navigateTo: null
  },
  {
    id: 'search-bar',
    title: 'Search Users',
    message: `Use the search bar to find and connect with users across the federated network. Search by username or display name, view profiles, and follow users instantly.

The search works across all connected servers.`,
    highlight: '.nav-search',
    navigateTo: null
  },
  {
    id: 'trending-sidebar',
    title: 'Trending & Federation',
    message: `The right sidebar shows trending hashtags with post counts and federation status with other servers.

Click any tag to see related posts and discover active discussions.`,
    highlight: '.home-main > aside:last-child',
    navigateTo: null
  },
  {
    id: 'profile-access',
    title: 'Your Profile',
    message: `Click the Profile button to view and edit your information, see your posts, and manage your followers.

Your profile is visible across the federated network.`,
    highlight: '.nav-btn-profile',
    navigateTo: null
  },
  {
    id: 'security-features',
    title: 'Security Settings',
    message: `Click the Security button to manage your decentralized identity (DID), encryption keys, recovery file export, and privacy controls.

You own your data and can move between servers anytime.`,
    highlight: '.security-btn',
    navigateTo: null
  },
  {
    id: 'messages',
    title: 'Private Messages',
    message: `Click the Messages button to send end-to-end encrypted private messages to other users. Your conversations are secure and only readable by you and the recipient.

Messages use your DID for authentication and encryption.`,
    highlight: '.messages-btn',
    navigateTo: null
  },
  {
    id: 'complete',
    title: 'You\'re All Set',
    message: `Remember to:
• Think before you post - respect others in the community
• Report inappropriate content to moderators
• Use strong passwords and keep your keys safe
• Engage positively and build meaningful connections

Stay safe, enjoy connecting with the federated network, and welcome to the community.`,
    highlight: null,
    navigateTo: null
  }
];

export default function HomePageWalkthrough() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('homepage-walkthrough-completed');
    const shouldReplay = localStorage.getItem('homepage-walkthrough-replay');
    
    if (shouldReplay === 'true') {
      setIsVisible(true);
      localStorage.removeItem('homepage-walkthrough-replay');
    } else if (!completed) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setHasCompletedBefore(true);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    const step = WALKTHROUGH_STEPS[currentStep];
    
    // Remove previous highlights
    document.querySelectorAll('.walkthrough-highlight').forEach(el => {
      el.classList.remove('walkthrough-highlight');
    });

    // Add highlight to current element
    if (step.highlight) {
      const timer = setTimeout(() => {
        const element = document.querySelector(step.highlight);
        if (element) {
          element.classList.add('walkthrough-highlight');
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }

    return () => {
      document.querySelectorAll('.walkthrough-highlight').forEach(el => {
        el.classList.remove('walkthrough-highlight');
      });
    };
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < WALKTHROUGH_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('homepage-walkthrough-completed', 'true');
    document.querySelectorAll('.walkthrough-highlight').forEach(el => {
      el.classList.remove('walkthrough-highlight');
    });
    setIsVisible(false);
  };

  const handleComplete = () => {
    localStorage.setItem('homepage-walkthrough-completed', 'true');
    document.querySelectorAll('.walkthrough-highlight').forEach(el => {
      el.classList.remove('walkthrough-highlight');
    });
    setIsVisible(false);
  };

  if (!isVisible) {
    if (hasCompletedBefore) {
      return (
        <button
          onClick={() => {
            setCurrentStep(0);
            setIsVisible(true);
          }}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(236, 72, 153, 0.95))',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            zIndex: 999,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          className="walkthrough-replay"
          title="Replay walkthrough"
        >
          <RotateCcw size={24} color="#fff" />
        </button>
      );
    }
    return null;
  }

  const step = WALKTHROUGH_STEPS[currentStep];

  return (
    <>
      <style jsx global>{`
        .walkthrough-highlight {
          position: relative !important;
          z-index: 9996 !important;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.6), 
                      0 0 0 8px rgba(139, 92, 246, 0.3),
                      0 0 40px rgba(139, 92, 246, 0.5) !important;
          border-radius: 12px !important;
          transition: all 0.3s ease !important;
        }
        
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.6), 
                        0 0 0 8px rgba(139, 92, 246, 0.3),
                        0 0 40px rgba(139, 92, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.8), 
                        0 0 0 8px rgba(139, 92, 246, 0.5),
                        0 0 60px rgba(139, 92, 246, 0.7);
          }
        }
        
        .walkthrough-highlight {
          animation: pulseGlow 2s ease-in-out infinite !important;
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      {/* Semi-transparent overlay - only when highlighting */}
      {step.highlight && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 9995,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Walkthrough Card - Top Right */}
      <div
        style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(30, 30, 50, 0.98))',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '420px',
          width: '90%',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.3)',
          zIndex: 9997,
          animation: 'slideInRight 0.4s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Counter */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(139, 92, 246, 0.2)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '20px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: '700',
          color: '#a78bfa'
        }}>
          {currentStep + 1}/{WALKTHROUGH_STEPS.length}
        </div>

        {/* Close Button */}
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          title="Skip walkthrough"
        >
          <X size={16} color="#fff" />
        </button>

        {/* Content */}
        <div style={{ marginTop: '20px' }}>
          <h2 style={{
            margin: '0 0 12px 0',
            color: '#fff',
            fontSize: '20px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {step.title}
          </h2>
          <p style={{
            margin: '0 0 20px 0',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '14px',
            lineHeight: '1.6',
            whiteSpace: 'pre-line'
          }}>
            {step.message}
          </p>
        </div>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            style={{
              padding: '10px 16px',
              background: currentStep === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: currentStep === 0 ? '#666' : '#fff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              opacity: currentStep === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (currentStep > 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentStep > 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSkip}
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#888',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#aaa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#888';
              }}
            >
              Skip
            </button>

            <button
              onClick={handleNext}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
              }}
            >
              {currentStep === WALKTHROUGH_STEPS.length - 1 ? 'Finish' : 'Next'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
