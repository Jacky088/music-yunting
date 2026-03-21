import { expect, test } from '@playwright/test';

const COVER_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzRhOTBlMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGlzY292ZXJ5PC90ZXh0Pjwvc3ZnPg==';
const AUDIO_DATA_URL = 'data:audio/mp3;base64,SUQzAwAAAAAA';

type MockArtist = {
  id: number;
  name: string;
  picUrl?: string;
  musicSize?: number;
  albumSize?: number;
};

type MockAlbum = {
  id: number;
  name: string;
  picUrl?: string;
  publishTime?: number;
  size?: number;
};

type MockProgram = {
  id: number;
  mainTrackId: number;
  name: string;
  duration: number;
  coverUrl?: string;
  dj?: { nickname: string };
};

const artistByArea: Record<string, MockArtist[]> = {
  '-1': [
    { id: 7001, name: '默认歌手', picUrl: COVER_DATA_URL, musicSize: 12, albumSize: 2 },
  ],
  '7': [
    { id: 7002, name: '华语回归歌手', picUrl: COVER_DATA_URL, musicSize: 18, albumSize: 2 },
  ],
};

const artistAlbums: Record<number, MockAlbum[]> = {
  7001: [
    { id: 7101, name: '默认歌手专辑', picUrl: COVER_DATA_URL, publishTime: Date.UTC(2023, 0, 1), size: 2 },
  ],
  7002: [
    { id: 7201, name: '华语精选专辑', picUrl: COVER_DATA_URL, publishTime: Date.UTC(2024, 5, 1), size: 2 },
  ],
};

const albumSongs = [
  {
    id: 7301,
    name: '专辑主打歌',
    ar: [{ id: 1, name: '华语回归歌手' }],
    al: { id: 7201, name: '华语精选专辑', picId: 'album-pic-1', picUrl: COVER_DATA_URL },
    dt: 180000,
  },
  {
    id: 7302,
    name: '专辑第二曲',
    ar: [{ id: 1, name: '华语回归歌手' }],
    al: { id: 7201, name: '华语精选专辑', picId: 'album-pic-1', picUrl: COVER_DATA_URL },
    dt: 210000,
  },
];

const radioCategories = [
  { id: 2001, name: '情感' },
  { id: 2002, name: '音乐故事' },
];

const radiosByCategory = {
  hot: [
    {
      id: 8101,
      name: '热门电台',
      picUrl: COVER_DATA_URL,
      programCount: 1,
      dj: { nickname: '热门主播' },
    },
  ],
  2001: [
    {
      id: 8201,
      name: '情感夜话',
      picUrl: COVER_DATA_URL,
      programCount: 2,
      dj: { nickname: '情感主播' },
    },
  ],
};

const radioPrograms: Record<number, MockProgram[]> = {
  8101: [
    {
      id: 8301,
      mainTrackId: 8401,
      name: '热门开场',
      duration: 180000,
      coverUrl: COVER_DATA_URL,
      dj: { nickname: '热门主播' },
    },
  ],
  8201: [
    {
      id: 8302,
      mainTrackId: 8402,
      name: '情感第一期',
      duration: 240000,
      coverUrl: COVER_DATA_URL,
      dj: { nickname: '情感主播' },
    },
  ],
};

const userPlaylists = [
  {
    id: 9101,
    name: '我的回归歌单',
    coverImgUrl: COVER_DATA_URL,
    trackCount: 2,
  },
];

function installDiscoveryMocks(page: Parameters<typeof test>[0]['page']) {
  return page.addInitScript(() => {
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
}

async function installRoutes(page: Parameters<typeof test>[0]['page']) {
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

    const apiUrl = new URL(decodeURIComponent(targetUrl));

    if (apiUrl.hostname === 'music-api.gdstudio.xyz') {
      const type = apiUrl.searchParams.get('type');
      const types = apiUrl.searchParams.get('types');

      if (type === 'song') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: '139774', name: 'API 探测成功' }]),
        });
        return;
      }

      if (types === 'search') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'search-1',
              name: '发现副链路初始化',
              artist: '初始化歌手',
              album: '初始化专辑',
              pic_id: 'search-pic',
              lyric_id: 'search-1',
              source: 'netease',
            },
          ]),
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

    if (apiUrl.pathname.endsWith('/artist/list')) {
      const area = apiUrl.searchParams.get('area') ?? '-1';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          artists: artistByArea[area] ?? [],
          more: false,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/artist/desc')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          briefDesc: '这是一个用于回归测试的歌手简介。',
          introduction: [],
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/artist/album')) {
      const artistId = Number(apiUrl.searchParams.get('id'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          hotAlbums: artistAlbums[artistId] ?? [],
          more: false,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/album')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          album: artistAlbums[7002][0],
          songs: albumSongs,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/dj/catelist')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          categories: radioCategories,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/dj/hot')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          djRadios: radiosByCategory.hot,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/dj/recommend/type')) {
      const cateId = Number(apiUrl.searchParams.get('type'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          djRadios: radiosByCategory[cateId as keyof typeof radiosByCategory] ?? [],
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/dj/program')) {
      const rid = Number(apiUrl.searchParams.get('rid'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          programs: radioPrograms[rid] ?? [],
          more: false,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/dj/detail')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: radiosByCategory[2001][0],
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/user/playlist')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          playlist: userPlaylists,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/playlist/detail')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          playlist: {
            id: 3778678,
            name: '解析歌单回归样本',
            trackIds: [{ id: 7301 }, { id: 7302 }],
          },
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/song/detail')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          songs: albumSongs,
        }),
      });
      return;
    }

    if (apiUrl.pathname.endsWith('/song/url/match')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: [
            {
              id: apiUrl.searchParams.get('id') ?? 'unknown',
              url: AUDIO_DATA_URL,
              br: 320000,
              size: 4_000_000,
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
          lrc: { lyric: '[00:00.00]副链路歌词' },
          tlyric: { lyric: '' },
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

test.describe('歌手、电台与我的副链路', () => {
  test.beforeEach(async ({ page }) => {
    await installDiscoveryMocks(page);
    await installRoutes(page);
  });

  test('歌手筛选后可进入详情、专辑与歌曲列表并返回', async ({ page }) => {
    await page.goto('/');

    await page.locator('.tab-btn[data-tab="artist"]').click();
    await page.locator('#artistAreaFilter .filter-btn[data-area="7"]').click();

    const artistCard = page.locator('#artistGrid .artist-card').first();
    await expect(artistCard).toContainText('华语回归歌手');

    await artistCard.click();
    await expect(page.locator('#artistDetailHeader')).toContainText('华语回归歌手');
    await expect(page.locator('#artistAlbumGrid .album-card').first()).toContainText('华语精选专辑');

    await page.locator('#artistAlbumGrid .album-card').first().click();
    await expect(page.locator('#albumSongsResults .song-item').first()).toContainText('专辑主打歌');

    await page.locator('#backToArtistDetail').click();
    await expect(page.locator('#artistDetailView')).toBeVisible();
    await expect(page.locator('#artistAlbumGrid .album-card').first()).toContainText('华语精选专辑');
  });

  test('电台分类可进入节目列表、播放并返回', async ({ page }) => {
    await page.goto('/');

    await page.locator('.tab-btn[data-tab="radio"]').click();
    await page.locator('#radioFilter .filter-btn[data-cateid="2001"]').click();

    const radioItem = page.locator('#radioList .radio-item').first();
    await expect(radioItem).toContainText('情感夜话');

    await radioItem.click();
    const firstProgram = page.locator('#radioProgramResults .song-item').first();
    await expect(firstProgram).toContainText('情感第一期');

    await firstProgram.click();
    await expect(page.locator('#currentTitle')).toHaveText('情感第一期');

    await page.locator('#backToRadios').click();
    await expect(page.locator('#radioListView')).toBeVisible();
    await expect(page.locator('#radioList .radio-item').first()).toContainText('情感夜话');
  });

  test('我的动作选择器可切换用户歌单、电台添加与歌单解析', async ({ page }) => {
    await page.goto('/');

    const select = page.locator('#playlistActionSelect');
    const input = page.locator('#playlistActionInput');
    const button = page.locator('#playlistActionBtn');

    await select.selectOption('user');
    await expect(input).toHaveAttribute('placeholder', '输入网易云用户ID...');
    await expect(button).toContainText('加载');
    await input.fill('123456');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.locator('#userPlaylistsList .playlist-item').first()).toContainText('我的回归歌单');

    await select.selectOption('radio');
    await expect(input).toHaveAttribute('placeholder', '输入电台ID...');
    await expect(input).toHaveValue('');
    await expect(button).toContainText('添加');
    await expect(button).toBeDisabled();
    await expect(page.locator('#playlistActionFeedback')).toContainText('输入电台 ID 可添加到我的列表');
    await input.fill('8201');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.locator('#userPlaylistsList .playlist-item').nth(1)).toContainText('情感夜话');

    await select.selectOption('playlist');
    await expect(input).toHaveAttribute('placeholder', '输入歌单ID或链接...');
    await expect(input).toHaveValue('');
    await expect(button).toContainText('解析');
    await expect(button).toBeDisabled();
    await expect(page.locator('#playlistActionFeedback')).toContainText('输入歌单链接或 ID 解析歌曲列表');
    await input.fill('https://music.163.com/#/playlist?id=3778678');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.locator('#parseResults .song-item').first()).toContainText('专辑主打歌');
  });
});
