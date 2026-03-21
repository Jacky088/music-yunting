import { expect, test } from '@playwright/test';

type RectMetrics = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function intersects(a: RectMetrics | null, b: RectMetrics | null): boolean {
  if (!a || !b) return false;
  return !(
    a.right <= b.x ||
    b.right <= a.x ||
    a.bottom <= b.y ||
    b.bottom <= a.y
  );
}

test.describe('布局回归', () => {
  test('桌面端主布局不应产生横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(() => {
      const main = document.querySelector('.main-container') as HTMLElement | null;
      const navbar = document.querySelector('.navbar') as HTMLElement | null;
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        mainRight: main?.getBoundingClientRect().right ?? 0,
        navbarRight: navbar?.getBoundingClientRect().right ?? 0,
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.mainRight).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.navbarRight).toBeLessThanOrEqual(metrics.viewportWidth);
  });

  test('移动端播放器页关键按钮不应被底部分页指示器遮挡', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.switchMobilePage?.(1);
    });
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const rect = (selector: string): RectMetrics | null => {
        const el = document.querySelector(selector);
        if (el === null) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };

      return {
        playBtn: rect('#playBtn'),
        indicators: rect('.mobile-page-indicators'),
        viewportHeight: window.innerHeight,
      };
    });

    expect(metrics.playBtn).not.toBeNull();
    expect(metrics.indicators).not.toBeNull();
    expect(intersects(metrics.playBtn, metrics.indicators)).toBe(false);
    expect((metrics.playBtn?.bottom ?? 0)).toBeLessThanOrEqual(metrics.viewportHeight);
  });

  test('移动端顶部搜索区不应遮挡内容区首个可操作区域', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.switchMobilePage?.(0);
    });
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const rect = (selector: string): RectMetrics | null => {
        const el = document.querySelector(selector);
        if (el === null) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };

      return {
        searchContainer: rect('.search-container'),
        firstTab: rect('.tab-btn[data-tab="hot"]'),
        viewportHeight: window.innerHeight,
      };
    });

    expect(metrics.searchContainer).not.toBeNull();
    expect(metrics.firstTab).not.toBeNull();
    expect((metrics.firstTab?.y ?? 0)).toBeGreaterThanOrEqual(metrics.searchContainer?.bottom ?? 0);
    expect((metrics.firstTab?.bottom ?? 0)).toBeLessThanOrEqual(metrics.viewportHeight);
  });

  test('移动端“我的”页操作按钮应在视口内且不被底部分页指示器遮挡', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.switchMobilePage?.(2);
    });
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const rect = (selector: string): RectMetrics | null => {
        const el = document.querySelector(selector);
        if (el === null) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };

      return {
        playlistButton: rect('#playlistActionBtn'),
        playlistInput: rect('#playlistActionInput'),
        indicators: rect('.mobile-page-indicators'),
        viewportHeight: window.innerHeight,
      };
    });

    expect(metrics.playlistButton).not.toBeNull();
    expect(metrics.playlistInput).not.toBeNull();
    expect((metrics.playlistButton?.bottom ?? 0)).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(intersects(metrics.playlistButton, metrics.indicators)).toBe(false);
  });

  test('移动端详情视图返回按钮应始终处于视口内', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.switchMobilePage?.(0);
      const artistGrid = document.getElementById('artistGrid') as HTMLElement | null;
      const artistFilter = document.getElementById('artistFilter') as HTMLElement | null;
      const artistDetailView = document.getElementById('artistDetailView') as HTMLElement | null;
      const radioListView = document.getElementById('radioListView') as HTMLElement | null;
      const radioProgramsView = document.getElementById('radioProgramsView') as HTMLElement | null;

      if (artistGrid) artistGrid.style.display = 'none';
      if (artistFilter) artistFilter.style.display = 'none';
      if (artistDetailView) artistDetailView.style.display = '';

      if (radioListView) radioListView.style.display = 'none';
      if (radioProgramsView) radioProgramsView.style.display = '';
    });
    await page.waitForTimeout(100);

    const metrics = await page.evaluate(() => {
      const rect = (selector: string): RectMetrics | null => {
        const el = document.querySelector(selector);
        if (el === null) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };

      return {
        artistBack: rect('#backToArtists'),
        radioBack: rect('#backToRadios'),
        viewportHeight: window.innerHeight,
      };
    });

    expect(metrics.artistBack).not.toBeNull();
    expect(metrics.radioBack).not.toBeNull();
    expect((metrics.artistBack?.y ?? 0)).toBeGreaterThanOrEqual(0);
    expect((metrics.artistBack?.bottom ?? 0)).toBeLessThanOrEqual(metrics.viewportHeight);
    expect((metrics.radioBack?.y ?? 0)).toBeGreaterThanOrEqual(0);
    expect((metrics.radioBack?.bottom ?? 0)).toBeLessThanOrEqual(metrics.viewportHeight);
  });
});
