import React, { useRef } from 'react';
import { storyApi } from '@/lib/api';

export default function StoryUpload({ onUploadSuccess, style, children }) {
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Only image uploads are supported for stories.");
            return;
        }

        try {
            await storyApi.createStory(file);
            if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
            console.error("Failed to upload story:", err);
            alert("Failed to upload story: " + err.message);
        }

        // reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div style={style} onClick={() => fileInputRef.current?.click()}>
            {children}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
}
