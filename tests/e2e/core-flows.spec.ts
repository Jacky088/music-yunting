import { expect, test } from '@playwright/test';

const COVER_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmNmI2YiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q292ZXI8L3RleHQ+PC9zdmc+';
const AUDIO_DATA_URL = 'data:audio/mp3;base64,SUQzAwAAAAAA';

type MockSong = {
  id: string;
  name: string;
  artist: string;
  album: string;
  pic_id: string;
};

const searchSongs: MockSong[] = [
  {
    id: 'song-search-1',
    name: '回归之歌',
    artist: '测试歌手A',
    album: '主链路专辑',
    pic_id: 'cover-search-1',
  },
  {
    id: 'song-search-2',
    name: '确定性副歌',
    artist: '测试歌手B',
    album: '主链路专辑',
    pic_id: 'cover-search-2',
  },
];

const rankingHotSongs: MockSong[] = [
  {
    id: 'rank-hot-1',
    name: '热歌榜第一',
    artist: '榜单歌手',
    album: '热歌榜',
    pic_id: 'rank-hot-cover',
  },
];

const rankingNewSongs: MockSong[] = [
  {
    id: 'rank-new-1',
    name: '新歌榜第一',
    artist: '新歌歌手',
    album: '新歌榜',
    pic_id: 'rank-new-cover',
  },
];

const rankingSoarSongs: MockSong[] = [
  {
    id: 'rank-soar-1',
    name: '飙升榜第一',
    artist: '飙升歌手',
    album: '飙升榜',
    pic_id: 'rank-soar-cover',
  },
];

function toGdstudioSearchResponse(songs: MockSong[]) {
  return songs.map((song) => ({
    id: song.id,
    name: song.name,
    artist: song.artist,
    album: song.album,
    pic_id: song.pic_id,
    lyric_id: song.id,
    source: 'netease',
  }));
}

async function installDeterministicAppMocks(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(() => {
    localStorage.setItem('music888_onboarded', '1');
    localStorage.setItem('music888_turnstile_verified', '1');

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: () => Promise.resolve({}),
      },
    });

    class TestMediaMetadata {
      constructor(init?: Record<string, unknown>) {
        Object.assign(this, init ?? {});
      }
    }

    Object.defineProperty(window, 'MediaMetadata', {
      configurable: true,
      value: TestMediaMetadata,
    });

    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        metadata: null,
        setActionHandler: () => {},
        setPositionState: () => {},
      },
    });

    const mediaProto = window.HTMLMediaElement.prototype;
    mediaProto.load = function load() {
      Object.defineProperty(this, 'duration', {
        configurable: true,
        value: 180,
      });
      this.dispatchEvent(new Event('loadstart'));
      this.dispatchEvent(new Event('loadedmetadata'));
    };
    mediaProto.play = function play() {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
    mediaProto.pause = function pause() {
      this.dispatchEvent(new Event('pause'));
    };
    mediaProto.scrollIntoView = function scrollIntoView() {};
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  });

  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    });
  });

  await page.route('**/api/proxy**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
      await route.fulfill({ status: 400, body: 'missing url' });
      return;
    }

    const decodedTargetUrl = decodeURIComponent(targetUrl);
    const apiUrl = new URL(decodedTargetUrl);

    if (apiUrl.hostname === 'music-api.gdstudio.xyz') {
      const type = apiUrl.searchParams.get('type');
      const types = apiUrl.searchParams.get('types');
      const keyword = apiUrl.searchParams.get('name');

      if (type === 'song') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: '139774', name: 'API 探测成功' }]),
        });
        return;
      }

      if (types === 'search') {
        let payload = searchSongs;
        if (keyword === '热歌榜') payload = rankingHotSongs;
        if (keyword === '新歌') payload = rankingNewSongs;
        if (keyword === '飙升') payload = rankingSoarSongs;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(toGdstudioSearchResponse(payload)),
        });
        return;
      }

      if (types === 'pic') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: COVER_DATA_URL }),
        });
        return;
      }
    }

    if (apiUrl.pathname.endsWith('/song/url/match')) {
      const songId = apiUrl.searchParams.get('id') ?? 'unknown-song';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: [
            {
              id: songId,
              url: AUDIO_DATA_URL,
              br: 320000,
              size: 5_000_000,
            },
          ],
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/lyric')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          lrc: {
            lyric: '[00:00.00]测试歌词',
          },
          tlyric: {
            lyric: '',
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200 }),
    });
  });
}

test.describe('核心主链路', () => {
  test.beforeEach(async ({ page }) => {
    await installDeterministicAppMocks(page);
  });

  test('搜索、播放、收藏与历史链路可用', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');

    await page.getByLabel('搜索音乐').fill('主链路回归');
    await page.locator('#searchBtn').click();

    const firstSearchResult = page.locator('#searchResults .song-item').first();
    await expect(firstSearchResult).toBeVisible();
    await expect(firstSearchResult).toContainText('回归之歌');

    await firstSearchResult.click();
    await expect(page.locator('#currentTitle')).toHaveText('回归之歌');
    await expect(page.locator('#currentArtist')).toContainText('测试歌手A');

    await firstSearchResult.locator('.favorite-btn').click();
    await expect(page.locator('#favoritesCount')).toHaveText('1');

    await page.locator('.my-tab-btn[data-mytab="history"]').click();
    await expect(page.locator('#historyResults .song-item').first()).toContainText(
      '回归之歌'
    );

    const unexpectedPageErrors = pageErrors.filter(
      (message) => message !== 'WebSocket closed without opened.'
    );
    expect(unexpectedPageErrors).toEqual([]);
  });

  test('排行榜切换时刷新列表', async ({ page }) => {
    await page.goto('/');

    await page.locator('.tab-btn[data-tab="ranking"]').click();
    await expect(page.locator('#rankingResults .song-item').first()).toContainText(
      '热歌榜第一'
    );

    await page.locator('.ranking-tab[data-rank="new"]').click();
    await expect(page.locator('#rankingResults .song-item').first()).toContainText(
      '新歌榜第一'
    );
  });
});
