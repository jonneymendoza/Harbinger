# Feature Specification: Web Frontend UI/UX

## 1. Architecture Context

This frontend follows **Feature-Sliced Design (FSD)** with React Server Components, as defined in `PRD.md §6.B`. The codebase is organized into four horizontal slices:

| Slice | Responsibility | Examples Used Here |
|---|---|---|
| **app/** | Next.js App Router pages and layout groups | `app/(public)/page.tsx` (Home Feed), `app/article/[id]/page.tsx` (Article) |
| **features/** | Vertical feature slices: UI components + data hooks + state/context | `feed-feature/`, `auth-feature/`, `bookmark-feature/` |
| **entities/** | Domain model representations | `entities/article/` for article card variants |
| **shared/** | Cross-cutting reusable code (dumb primitives, API client) | `shared/ui/`, `shared/api/` fetch wrapper |

### Architecture Rules
- Each feature (`features/*`) is a self-contained vertical slice. It owns its UI components, data hooks (`api/`), and server action/state logic (`lib/`). No other feature module reaches into another feature's internals.
- **React Server Components** are the default for page-level data fetching. `"use client"` is used only where interactivity (hooks, event handlers) is required.
- `shared/ui/` contains only dumb framework primitives (Button, Card, Input). All business logic lives in feature modules.
- `shared/api/` has a single fetch wrapper that injects JWT tokens and maps the standard backend response (`success/data/error`) into hook-friendly data.

---

## 2. Design System & Aesthetics

### A. Theming (Dark/Light Mode)
Implementation using `next-themes` and Tailwind's `darkMode: 'class'` strategy.
*   **Light Mode:** High contrast, white backgrounds (`bg-white`), slate-gray text (`text-slate-900`), and soft borders.
*   **Dark Mode:** Deep charcoal/black backgrounds (`bg-slate-950`), off-white text (`text-slate-100`), and subtle neon accents for links (e.g., Indigo or Cyan).

### B. Visual Style & Guidelines
*   **Modernity:** Heavy use of border-radius (`rounded-xl`), soft box shadows, and glassmorphism effects (backdrop-blur) for navigation bars.
*   **Typography:** Sans-serif font stack (Inter or Outfit) focusing on readability and clear hierarchy (Bold headers $\rightarrow$ Regular body).
*   **Modernity Cues:** 
    *   Smooth transition animations (300ms fade) when toggling Dark/Light modes.
    *   Ample whitespace/padding to avoid "text-wall" fatigue and maintain a premium feel.

#### Visual Style Reference Table:
| Element | Light Mode Theory | Dark Mode Theory |
| :--- | :--- | :--- |
| **Background** | Pure White or very light Gray (`#F8FAFC`) | Deep Charcoal/Midnight Blue (`#020617`) |
| **Surface (Tiles)** | White with soft shadow | Slate-900 (`#0F172A`) with thin border |
| **Primary Text** | Dark Slate (`#0F172A`) | Off-white/Silver (`#E2E8F0`) |
| **Accents (Links)** | Indigo / Royal Blue | Neon Cyan or Electric Violet |

## 3. Page Specifications

### A. Home Page (The Feed)
*   **Navigation Bar:** Logo, Search bar (future), Dark/Light toggle, Profile/Login button. Implemented with backdrop-blur for a glassmorphism effect over scrolling content.
*   **News Grid:** A responsive CSS Grid layout.
    *   **Desktop:** 3-4 columns.
    *   **Tablet:** 2 columns.
    *   **Mobile:** 1 column.
*   **The "Article Tile" Component:**
    *   `Image`: Thumbnail with a subtle zoom effect on hover (`scale-105`).
    *   `Content`: Title (max 2 lines), Source Name, and Publication Date.
    *   `Interaction`: The entire tile is clickable, navigating to `/article/[id]`. Use soft shadows that deepen on hover to create a "lifting" effect.

### B. Article Detail Page
*   **Layout:** Centered single-column layout with comfortable reading margins.
*   **Header Section:** 
    *   Large **Hero Image** spanning the width of the content area.
    *   Title (H1), Publication Date, and "Back to Feed" button.
*   **Content Area:** Cleanly rendered HTML/Markdown from the API. All images within the text are responsive (`max-width: 100%`) with captions if available.
*   **Interactions:** A floating or fixed **"Save/Bookmark"** button that toggles state and sends a request to `/api/bookmarks`.

### C. Bookmarks Page (Protected)
*   **Context:** Only accessible for authenticated users.
*   **View:** Similar grid layout to the Home page, but strictly containing the user's saved articles.
*   **Action:** Option to "Unsave" directly from the tile.

### D. Authentication Screen
*   **Centered Card:** Minimalist login card.
*   **Social Buttons:** Large, branded buttons for Google, Apple, and Facebook.
*   **Feedback:** Loading spinners during authentication redirects.

## 4. Technical UX Requirements

### A. Responsive Breakpoints
| Device | Breakpoint | Layout Behavior |
| :--- | :--- | :--- |
| **Mobile** | `< 640px` | Single column grid, hamburger menu for nav, bottom-padding for easy thumb reach. |
| **Tablet** | `640px - 1024px` | Two column grid, expanded navigation links. |
| **Desktop** | `> 1024px` | Multi-column grid, full horizontal navigation bar. |

### B. Performance Optimizations
*   **Image Optimization:** Use `next/image` for automatic resizing, lazy loading, and WebP conversion to ensure the feed remains snappy despite many thumbnails.
*   **Skeleton Screens:** Display gray pulsing placeholders while news tiles are fetching from the API to prevent layout shift (CLS).
*   **Client-Side Caching:** Use a library like `SWR` or `React Query` to cache API responses, avoiding redundant network requests when navigating back and forth between articles.

## 5. Routing Table
| Route | Page Component | Access |
| :--- | :--- | :--- |
| `/` | Home / Feed | Public |
| `/article/[id]` | Article View | Public |
| `/bookmarks` | Bookmarks List | Authenticated (JWT) |
| `/auth/login` | Social Login Page | Public |
| `/admin` | Admin Dashboard | Admin Role Only |
