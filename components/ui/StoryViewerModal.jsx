import React, { useState, useEffect, useRef } from 'react';
import { resolveMediaUrl, storyApi } from '@/lib/api';

export default function StoryViewerModal({ stories, initialIndex, onClose, currentUser, onRefresh }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const viewedStoryRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!stories || stories.length === 0) return;

        const currentStory = stories[currentIndex];
        if (!currentStory) return;

        if (viewedStoryRef.current === currentStory.id) return;
        viewedStoryRef.current = currentStory.id;

        storyApi.viewStory(currentStory.id)
            .catch(err => console.error("Failed to record story view", err));

    }, [currentIndex, stories, onRefresh]);

    useEffect(() => {
        setProgress(0);
    }, [currentIndex]);

    useEffect(() => {
        if (!stories || stories.length === 0) {
            onClose();
            return;
        }

        const currentStory = stories[currentIndex];
        if (!currentStory) return;

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (isPaused) return;

        timerRef.current = setInterval(() => {
            setProgress(p => {
                if (p >= 100) {
                    handleNext();
                    return 0;
                }
                return p + 2; // 5 seconds at 100ms interval
            });
        }, 100);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [currentIndex, stories, onClose, isPaused]);

    const handleNext = () => {
        setCurrentIndex((prev) => {
            if (prev + 1 >= stories.length) {
                setTimeout(() => onClose(), 0);
                return prev;
            }
            return prev + 1;
        });
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => prev === 0 ? stories.length - 1 : prev - 1);
    };

    const handleDelete = async (storyId) => {
        try {
            await storyApi.deleteStory(storyId);
            if (onRefresh) {
                onRefresh();
            }
            handleNext();
        } catch (err) {
            console.error("Failed to delete story", err);
        }
    };

    if (!stories || stories.length === 0) return null;

    const currentStory = stories[currentIndex];

    return (
        <div
            className="story-viewer-overlay"
            onClick={onClose}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.9)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.3s'
            }}
        >
            <div
                className="story-viewer-content story-modal"
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '500px',
                    height: '80vh',
                    maxHeight: '800px',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div style={{ display: 'flex', gap: '4px', padding: '10px 0', zIndex: 10 }}>
                    {stories.map((_, idx) => (
                        <div key={idx} style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px' }}>
                            <div style={{
                                height: '100%',
                                background: '#fff',
                                borderRadius: '2px',
                                width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                                transition: idx === currentIndex ? 'width 0.1s linear' : 'none'
                            }} />
                        </div>
                    ))}
                </div>

                <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 10 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#444', overflow: 'hidden' }}>
                        {currentStory.author?.avatar && (
                            <img src={resolveMediaUrl(currentStory.author.avatar)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                    </div>
                    <div style={{ color: '#fff', fontWeight: 'bold' }}>{currentStory.author?.username || 'Unknown User'}</div>

                    {currentUser && (currentStory.user_id === currentUser.id || currentStory.author?.id === currentUser.id) && (
                        <button
                            className="story-delete"
                            onClick={() => handleDelete(currentStory.id)}
                            style={{
                                marginLeft: '10px',
                                background: 'rgba(255, 68, 68, 0.2)',
                                border: '1px solid #ff4444',
                                color: '#ff4444',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Delete
                        </button>
                    )}

                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                </div>

                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img
                        src={resolveMediaUrl(currentStory.media_url)}
                        alt="Story"
                        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
                    />

                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%', cursor: 'pointer' }} onClick={handlePrev} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '30%', cursor: 'pointer' }} onClick={handleNext} />

                    <button onClick={handlePrev} className="story-prev">‹</button>
                    <button onClick={handleNext} className="story-next">›</button>
                </div>
            </div>
        </div>
    );
}
