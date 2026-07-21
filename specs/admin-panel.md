# Feature Specification: Administrative Management Panel

## 1. Overview
The Admin Panel is a restricted section of the Web Frontend designed for system operators to manage the news aggregation pipeline without writing code or modifying database entries manually.

## 2. Access Control & Security
*   **Permission:** Only users with the `role: "ADMIN"` claim in their JWT can access these routes.
*   **Route Protection:** All admin pages are wrapped in a Higher Order Component (HOC) that redirects unauthenticated or non-admin users to the login page or a 403 Forbidden page.
*   **API Guard:** Every request sent by this panel is validated by the `checkRole("ADMIN")` middleware on the backend.

## 3. Core Functional Features

### A. Source Management Dashboard
A centralized table displaying all configured target websites:
*   **Columns:** Site Name, Base URL, Status (Active/Inactive), Date Added.
*   **Actions:** Edit configuration, Toggle Active state, Delete source.

### B. Source Configuration Editor
A form to add or modify scraping targets. 
*   **Inputs:**
    *   `Name`: Display name of the site.
    *   `Base URL`: The starting point for scraping.
    *   `CSS Selectors`: Specific inputs for `Article Link`, `Page Title`, `Main Content Body`, and `Hero Image`.
*   **Validation:** Real-time validation to ensure URLs are formatted correctly.

### C. "Live Test" Scraper Tool (Crucial Feature)
To avoid saving broken selectors that would crash the hourly cron job, the Admin Panel will include a **Test Connection** feature:
1.  The admin enters proposed CSS selectors in the editor.
2.  Clicking **"Test Scrape"** sends these selectors to a special backend endpoint (`POST /api/admin/sources/test`).
3.  The Backend spins up a temporary Playwright instance, attempts to scrape *one* article using those la-hoc selectors, and returns the result.
4.  **Frontend Result:** The admin sees a preview of the scraped title and image. If it's empty or wrong, the admin adjusts the selectors before clicking "Save."

## 4. UI/UX Design Guidelines
*   **Layout:** A simple sidebar navigation (Dashboard $\rightarrow$ Sources $\rightarrow$ System Logs).
*   **Feedback Loops:** Use toast notifications for success/failure of API calls (e.g., "Source updated successfully").
*   **Consistency:** Inherits the same Light/Dark mode settings as the public frontend for visual harmony.

## 5. Integration Map
| Admin Action | Backend Endpoint | Specification Reference |
| :--- | :--- | :--- |
| Loading Source List | `GET /api/admin/sources` | `specs/api-endpoints.md` |
| Saving New Source | `POST /api/admin/sources` | `specs/api-endpoints.md` |
| Updating Source | `PUT /api/admin/sources/:id` | `specs/api-endpoints.md` |
| Testing Selectors | `POST /api/admin/sources/test` | *New endpoint for validation* |
| Removing Source | `DELETE /api/admin/sources/:id` | `specs/api-endpoints.md` |

## 6. Future Extensibility
*   **Scrape Logs:** Ability to view the logs of the hourly cron job to identify which sites are failing and why.
*   **User Management:** A screen to promote existing users to Admin status or revoke access.
