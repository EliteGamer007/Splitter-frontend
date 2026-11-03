import {circleApi,storyApi,followApi,messageApi,interactionApi} from '@/lib/api';
beforeEach(()=>{localStorage.clear();localStorage.setItem('splitter_api_base','https://fixture.example/api/v1');global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>[]});});
test('bounded private lists expose later pages using offset',async()=>{
 await (circleApi.getCircle as any)(20,40);await (storyApi.getStoryFeed as any)(20,40);await (followApi.getRequests as any)(20,40);await (messageApi.getThreads as any)(undefined,30,60);await (interactionApi.getBookmarks as any)(20,40);
 for(const path of ['/users/me/circle?limit=20&offset=40','/stories/feed?limit=20&offset=40','/users/me/follow-requests?limit=20&offset=40','/messages/threads?limit=30&offset=60','/users/me/bookmarks?limit=20&offset=40'])expect(fetch).toHaveBeenCalledWith(expect.stringContaining(path),expect.anything());
});
