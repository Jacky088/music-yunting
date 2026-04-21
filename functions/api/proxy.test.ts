import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MusicError, MusicErrorType } from '../../js/types';

function createContext(url: string, init?: RequestInit & { ip?: string }) {
    const headers = new Headers(init?.headers);
    if (init?.ip) {
        headers.set('CF-Connecting-IP', init.ip);
    }
    if (!headers.has('Origin')) {
        headers.set('Origin', 'http://localhost:5173');
    }

    return {
        request: new Request(url, {
            method: init?.method ?? 'GET',
            headers,
        }),
        env: {},
    };
}

describe('proxy governance', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('非法 url 参数应返回 400 且带统一错误结构和 CORS 头', async () => {
        const { onRequest } = await import('./proxy.js');

        const response = await onRequest(
            createContext('https://example.com/api/proxy?url=not-a-valid-url')
        );

        expect(response.status).toBe(400);
        expect(response.headers.get('Content-Type')).toContain('application/json');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: {
                code: 'INVALID_URL',
                message: '请求地址格式无效',
                status: 400,
            },
        });
    });

    it('不允许域名应返回 403 且带统一错误结构', async () => {
        const { onRequest } = await import('./proxy.js');

        const response = await onRequest(
            createContext(
                'https://example.com/api/proxy?url=' + encodeURIComponent('https://evil.example.com/song.mp3')
            )
        );

        expect(response.status).toBe(403);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: {
                code: 'FORBIDDEN_HOST',
                message: '当前域名不允许通过代理访问',
                status: 403,
            },
        });
    });

    it('命中限流时应返回 429 且暴露统一错误消息', async () => {
        const fetchMock = vi.fn(async () =>
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const { onRequest } = await import('./proxy.js');
        const contextUrl =
            'https://example.com/api/proxy?url=' + encodeURIComponent('https://music.163.com/song?id=1');

        for (let i = 0; i < 60; i++) {
            const okResponse = await onRequest(createContext(contextUrl, { ip: '203.0.113.8' }));
            expect(okResponse.status).toBe(200);
        }

        const response = await onRequest(createContext(contextUrl, { ip: '203.0.113.8' }));

        expect(response.status).toBe(429);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
        expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: {
                code: 'RATE_LIMITED',
                message: '请求过于频繁，请稍后再试',
                status: 429,
            },
        });
    });

    it('前端拿到代理异常时应归一化为可展示的 MusicError', async () => {
        const fetchMock = vi.fn(async () =>
            new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        code: 'RATE_LIMITED',
                        message: '请求过于频繁，请稍后再试',
                        status: 429,
                    },
                }),
                {
                    status: 429,
                    headers: {
                        'content-type': 'application/json',
                    },
                }
            )
        );
        vi.stubGlobal('fetch', fetchMock);

        const { fetchWithRetry } = await import('../../js/api/client');

        await expect(
            fetchWithRetry('https://music.163.com/song?id=1', {}, 0)
        ).rejects.toMatchObject({
            name: 'MusicError',
            type: MusicErrorType.API,
            userMessage: '请求过于频繁，请稍后再试',
        });
    });

    it('ui.showError 接收到异常对象时应给出统一错误提示而非静默失败', async () => {
        document.body.innerHTML = '<div id="testContainer"></div>';

        const { showError } = await import('../../js/ui');

        showError(
            new MusicError(
                MusicErrorType.NETWORK,
                'fetch failed',
                '网络连接异常，请检查网络后重试'
            ) as unknown as string,
            'testContainer'
        );

        const container = document.getElementById('testContainer');
        const feedbackState = container?.querySelector('[data-feedback-state="error"]');

        expect(feedbackState).not.toBeNull();
        expect(container?.textContent).toContain('网络连接异常，请检查网络后重试');
        expect(container?.textContent).not.toContain('[object Object]');
    });
});
