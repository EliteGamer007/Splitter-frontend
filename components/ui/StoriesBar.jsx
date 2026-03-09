import React, { useState, useEffect } from 'react';
import StoryViewerModal from './StoryViewerModal';
import StoryUpload from './StoryUpload';
import { storyApi, resolveMediaUrl } from '@/lib/api';

export default function StoriesBar({ currentUser }) {
    const [stories, setStories] = useState([]);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [activeStories, setActiveStories] = useState([]);

    const fetchStories = async () => {
        try {
            const data = await storyApi.getStories();
            setStories(data || []);
        } catch (err) {
            console.error("Failed to fetch stories", err);
        }
    };

    useEffect(() => {
        fetchStories();
        // Poll for stories every minute
        const interval = setInterval(fetchStories, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleStoryClick = (userStories) => {
        setActiveStories(userStories);
        setIsViewerOpen(true);
    };

    return (
        <>
            <div className="stories-bar">
                <StoryUpload onUploadSuccess={fetchStories}>
                    <div className="story-item story-add" title="Add a story">
                        <div className="story-avatar story-add-avatar">
                            <span className="plus-icon">+</span>
                        </div>
                        <span className="story-author-name">Your Story</span>
                    </div>
                </StoryUpload>

                {Object.values(
                    stories.reduce((acc, story) => {
                        const userId = story.user_id || story.author?.id;
                        if (!acc[userId]) {
                            acc[userId] = {
                                user: story.author,
                                stories: []
                            };
                        }
                        acc[userId].stories.push(story);
                        return acc;
                    }, {})
                ).map((group, idx) => {
                    const avatarUrl = group.user?.avatar ? resolveMediaUrl(group.user.avatar) : null;
                    const isSeen = group.stories.every(s => s.seen);
                    return (
                        <div
                            key={idx}
                            className="story-item"
                            onClick={() => handleStoryClick(group.stories)}
                            title={group.user?.username || 'User'}
                        >
                            <div className={`story-avatar ${isSeen ? 'seen' : 'unseen'}`}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={group.user?.username || 'User'} />
                                ) : (
                                    <div className="fallback-avatar">👤</div>
                                )}
                            </div>
                            <span className="story-author-name">
                                {group.user?.username || 'User'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {isViewerOpen && (
                <StoryViewerModal
                    stories={activeStories}
                    initialIndex={0}
                    onClose={() => setIsViewerOpen(false)}
                    currentUser={currentUser}
                    onRefresh={fetchStories}
                />
            )}
        </>
    );
}
