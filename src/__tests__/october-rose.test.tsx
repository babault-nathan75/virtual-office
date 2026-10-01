import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalDayKey, getOctoberRoseMessage, OCTOBER_ROSE_MESSAGES } from "@/components/OctoberRoseMessages";
import { OctoberRose } from "@/components/OctoberRose";
import { PUBLIC_RIBBON_RAIN_DURATION_MS, PUBLIC_RIBBON_RAIN_PARTICLE_COUNT } from "@/components/RibbonRain";

const { getPathname } = vi.hoisted(() => ({
  getPathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({ usePathname: getPathname }));
vi.mock("next/image", () => ({ default: "img" }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 1, 12));
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  getPathname.mockReturnValue("/");
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function startCampaign() {
  const view = render(<OctoberRose />);
  act(() => vi.advanceTimersByTime(0));
  return view;
}

function pointerEvent(element: HTMLElement, type: string, values: Record<string, number>) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, ...values });
  fireEvent(element, event);
}

describe("October Rose messages and dates", () => {
  it("provides 31 distinct messages and a local exact date key", () => {
    expect(OCTOBER_ROSE_MESSAGES).toHaveLength(31);
    expect(new Set(OCTOBER_ROSE_MESSAGES).size).toBe(31);
    expect(PUBLIC_RIBBON_RAIN_PARTICLE_COUNT).toBe(24_000);
    expect(PUBLIC_RIBBON_RAIN_DURATION_MS).toBe(20_000);
    expect(getOctoberRoseMessage(1)).toBe(OCTOBER_ROSE_MESSAGES[0]);
    expect(getOctoberRoseMessage(31)).toBe(OCTOBER_ROSE_MESSAGES[30]);
    expect(getLocalDayKey(new Date(2026, 9, 7, 23, 59))).toBe("2026-10-07");
  });
});

describe("public October Rose experience", () => {
  it("shows the dense 20-second ribbon rain, then the dated daily message one second later", () => {
    startCampaign();
    expect(screen.getByTestId("rose-rain")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(19_999));
    expect(screen.getByTestId("rose-rain")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("rose-rain")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(999));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    const alert = screen.getByRole("alertdialog");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("aria-modal", "true");
    expect(alert.querySelector("img[aria-hidden='true']")).toHaveAttribute("width", "442");
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    expect(document.documentElement).toHaveStyle({ overflow: "hidden" });
    expect(screen.getByText(/1 octobre 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "En octobre, faisons place à la sensibilisation.",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /En savoir plus/ })).toHaveAttribute(
      "href",
      "https://www.sante.gouv.ci/index.php/actualite/1881",
    );
    fireEvent.click(screen.getByRole("button", { name: "Continuer sur le site" }));
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
    expect(document.documentElement).not.toHaveStyle({ overflow: "hidden" });
  });

  it("reopens the daily card from the badge and moves it with pointer and keyboard", () => {
    startCampaign();
    act(() => vi.advanceTimersByTime(21_000));
    fireEvent.click(screen.getByRole("button", { name: "Continuer sur le site" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    const badge = screen.getByRole("button", {
      name: "Flows Nation soutient Octobre Rose — rouvrir la carte",
    });
    const before = `${badge.style.left},${badge.style.top}`;
    const direction = Number.parseFloat(badge.style.left) > window.innerWidth / 2 ? -40 : 40;
    pointerEvent(badge, "pointerdown", { clientX: 100, clientY: 100 });
    pointerEvent(badge, "pointermove", { clientX: 100 + direction, clientY: 130 });
    pointerEvent(badge, "pointerup", { clientX: 100 + direction, clientY: 130 });
    expect(`${badge.style.left},${badge.style.top}`).not.toBe(before);
    fireEvent.click(badge, { detail: 1 });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.keyDown(badge, { key: "ArrowRight" });
    expect(parseFloat(badge.style.left)).toBeGreaterThan(0);
    fireEvent.click(badge);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("updates the open message at midnight and shows the next day's rain", () => {
    startCampaign();
    act(() => vi.advanceTimersByTime(21_000));
    expect(screen.getByText(/1 octobre 2026/)).toBeInTheDocument();
    expect(localStorage.getItem("secretariat-pro-october-rose-seen")).toBe("2026-10-01");

    vi.setSystemTime(new Date(2026, 9, 2, 0, 0));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText(/2 octobre 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "Un message de soutien peut illuminer une journée.",
    })).toBeInTheDocument();
    expect(screen.queryByTestId("rose-rain")).not.toBeInTheDocument();
  });

  it("starts the next daily rain after a dismissed message and then displays that day's card", () => {
    startCampaign();
    act(() => vi.advanceTimersByTime(21_000));
    fireEvent.click(screen.getByRole("button", { name: "Continuer sur le site" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("secretariat-pro-october-rose-seen")).toBe("2026-10-01");
    expect(localStorage.getItem("secretariat-pro-october-rose-dismissed")).toBe("2026-10-01");

    vi.setSystemTime(new Date(2026, 9, 2, 12));
    act(() => vi.advanceTimersByTime(47_000));
    expect(screen.getByTestId("rose-rain")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(21_000));
    expect(screen.getByText(/2 octobre 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "Un message de soutien peut illuminer une journée.",
    })).toBeInTheDocument();
  });

  it("limits dismissal to the current day and respects reduced motion", () => {
    const view = startCampaign();
    act(() => vi.advanceTimersByTime(21_000));
    fireEvent.click(screen.getByRole("button", { name: "Fermer le message Octobre Rose" }));
    view.unmount();

    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    startCampaign();
    expect(screen.queryByTestId("rose-rain")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 9, 2, 12));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/2 octobre 2026/)).toBeInTheDocument();
  });
});

describe("admin October Rose rain", () => {
  it("runs for four seconds only once per browser day", () => {
    getPathname.mockReturnValue("/dashboard");
    const view = startCampaign();
    expect(screen.getByTestId("rose-admin-rain")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_999));
    expect(screen.getByTestId("rose-admin-rain")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("rose-admin-rain")).not.toBeInTheDocument();

    view.unmount();
    startCampaign();
    expect(screen.queryByTestId("rose-admin-rain")).not.toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 9, 2, 12));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByTestId("rose-admin-rain")).toBeInTheDocument();
  });

  it("does not animate when reduced motion is requested", () => {
    getPathname.mockReturnValue("/dashboard");
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    startCampaign();
    expect(screen.queryByTestId("rose-admin-rain")).not.toBeInTheDocument();
  });
});
