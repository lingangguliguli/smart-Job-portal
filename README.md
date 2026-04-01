# Smart Job Tracker

A job application tracker built with React. Add jobs you've applied to, track their status, bookmark the ones you care about, and see how your job search is going through charts.

**Live:** [https://lingangguliguli.github.io/smart-Job-portal/](https://lingangguliguli.github.io/smart-Job-portal/)

## What It Does

- Add job applications with company, role, salary, platform, status, dates, and notes
- View all applications in a sortable, filterable table
- Filter by status (Applied / Interviewing / Offer / Rejected), platform, and location
- Search by company name or role
- Bookmark applications
- Edit or delete existing entries
- Dashboard with stats and charts (status breakdown, monthly trend, platform split, salary ranges)
- All data saved in localStorage — no backend, no login, everything stays in your browser

## Tech Stack

- **React 19** — UI
- **Vite 8** — Dev server and build tool
- **Recharts** — Pie charts and bar charts
- **date-fns** — Date formatting
- **react-icons** — Icons (Feather icon set)
- **gh-pages** — Deployment to GitHub Pages

## Project Structure

```
src/
├── main.jsx    # Mounts the React app to the DOM
└── App.jsx     # Everything — components, hooks, context, pages, styles
```

The whole app lives in one file (`App.jsx`). No separate CSS files — styles are inline JS objects using a shared theme config.

## Getting Started

```bash
# install dependencies
npm install

# run locally
npm run dev
```

Opens at `http://localhost:5173/smart-Job-portal/`

## Build & Deploy

```bash
# production build
npm run build

# deploy to GitHub Pages
npm run deploy
```

## How It Works

- **State management:** React Context API. A single `ApplicationProvider` wraps the app and exposes CRUD functions + toast notifications to all components.
- **Data persistence:** Custom `useLocalStorage` hook. Works like `useState` but reads/writes to `localStorage` automatically. Data stored under the key `sjt_applications`.
- **Search:** Debounced with a custom `useDebounce` hook (500ms delay) so it doesn't filter on every keystroke.
- **Navigation:** No React Router. Just a `currentPage` state variable and a `switch` statement. Four pages: Dashboard, Applications, Add New, Analytics.
- **Pagination:** 8 rows per page. Resets to page 1 when filters change.

## Pages

| Page | What's on it |
|---|---|
| Dashboard | Stat cards (total, interviews, offers, rejected), status pie chart, monthly bar chart, recent applications list |
| Applications | Tab bar, search, filters (status/platform/location), sort (date/salary/name), paginated table with edit/delete/bookmark actions |
| Add New | Form to add a job application. Same form is reused for editing |
| Analytics | Four charts — status distribution, monthly trend, platform breakdown, salary ranges |

## Data Shape

Each application looks like this:

```js
{
  id: "random9chr",
  company: "Google",
  role: "Frontend Engineer",
  location: "Bangalore",
  salary: 2500000,
  platform: "LinkedIn",
  status: "Applied",
  appliedDate: "2026-03-15",
  interviewDate: "",
  notes: "",
  bookmarked: false
}
```

## Hooks Used

| Hook | Where | Why |
|---|---|---|
| `useState` | Everywhere | Managing component state (form fields, filters, current page, etc.) |
| `useEffect` | Debounce hook, pagination reset | Running side effects (timers, reacting to data changes) |
| `useCallback` | CRUD functions, event handlers | Preventing unnecessary re-creation of functions |
| `useMemo` | Dashboard stats, filtered/sorted list, context value | Avoiding expensive recalculations on every render |
| `useContext` | Any component that needs app data | Accessing shared state without prop drilling |

## Limitations

- No backend — data only exists in your browser's localStorage
- Not responsive — the sidebar is fixed width, won't work great on mobile
- No authentication — anyone on the same browser profile sees the same data
- Single file architecture — works for this size but wouldn't scale well
