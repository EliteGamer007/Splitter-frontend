import { messageApi, setApiBase, getCurrentInstance } from '@/lib/api';
beforeEach(() => { localStorage.clear(); global.fetch = jest.fn().mockResolvedValue({ok:true,json:async()=>({})}); });
test('encrypted message API refuses mixed plaintext and ciphertext',async()=>{
 await expect(messageApi.sendMessage('bob','leaked text','cipher')).rejects.toThrow(/plaintext/i);
 expect(fetch).not.toHaveBeenCalled();
});
test('custom selected API is canonical',()=>{setApiBase('https://peer.example'); expect(getCurrentInstance().url).toBe('https://peer.example/api/v1');});
test('thread replies can be paged without dropping later replies',async()=>{const {postApi}=await import('@/lib/api');await (postApi.getReplies as any)('thread',20,40);expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/posts/thread/replies?limit=20&offset=40'),expect.anything());});
