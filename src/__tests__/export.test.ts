import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('exportToCSV', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing on empty data', async () => {
    const { exportToCSV } = await import('@/lib/export');
    const createElementSpy = vi.spyOn(document, 'createElement');
    exportToCSV([], 'test');
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it('creates CSV with semicolon delimiter', async () => {
    const { exportToCSV } = await import('@/lib/export');
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    const data = [{ nom: 'Alice', role: 'Admin' }];
    exportToCSV(data, 'users');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('escapes semicolons and quotes in values', async () => {
    const { exportToCSV } = await import('@/lib/export');
    let csvContent = '';
    const clickSpy = vi.fn();

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => { csvContent = reader.result as string; };
      reader.readAsText(blob);
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    const data = [{ text: 'a;b"c' }];
    exportToCSV(data, 'test');

    await new Promise(r => setTimeout(r, 50));
    expect(csvContent).toContain('"a;b""c"');
  });
});

describe('exportToPDF', () => {
  it('opens print window', async () => {
    const { exportToPDF } = await import('@/lib/export');
    const writeSpy = vi.fn();
    const closeSpy = vi.fn();
    const printSpy = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write: writeSpy, close: closeSpy },
      print: printSpy,
    } as unknown as Window);

    const data = [{ nom: 'Alice', role: 'Admin' }];
    exportToPDF('Test', data, 'test');
    expect(writeSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalled();
  });

  it('does nothing if window blocked', async () => {
    const { exportToPDF } = await import('@/lib/export');
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => exportToPDF('Test', [], 'test')).not.toThrow();
  });
});
