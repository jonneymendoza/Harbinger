# Feature Specification: Backend Scraping Engine

## 1. Overview
The Scraping Engine is responsible for the autonomous discovery, extraction, and cleaning of news articles from target sources defined in the database. It converts raw HTML into a structured JSON snapshot stored in MongoDB.

## 2. Technical Implementation

### A. Technology Stack
*   **Runtime:** Node.js
*   **Browser Automation:** Playwright (Headless)
*   **Scheduler:** `node-cron`
*   **Database:** MongoDB

### B. The Extraction Pipeline
The engine will execute the following flow every 60 minutes:

1.  **Source Retrieval:** Fetch all entries from the `sources` collection where `active === true`.
2.  **Target Navigation:** For each source, navigate to the provided base URL using a Playwright browser instance.
3.  **Link Discovery:** Identify and extract links to individual articles based on CSS selectors stored in the `source` document.
4.  **Deep Scraping:** For each new article link discovered:
    *   Navigate to the article page.
    *   Wait for network idle (to ensure JS-heavy content is rendered).
    *   Extract:
        *   **Hero Image:** The primary high-res image used as a banner.
        *   **Thumbnail:** A smaller version of the image for tile views.
        *   **Full Content:** All `<p>` and `<img>` tags within the main article body, converted to cleaned HTML/JSON.
        *   **Embedded Images:** An array of all images found within the content area.
        *   **Metadata:** Title, Publication Date, Category.
5.  **Data Cleaning:** 
    *   Strip scripts, styles, and irrelevant ads from content.
    *   Normalize dates to ISO 8601 format.
    *   Ensure absolute URLs for all images (prepend base domain if relative).
6.  **Upsert into DB:** Use an `upsert` operation based on the source URL to avoid duplicate articles.

## 3. Database Schemas

### Source Collection (`sources`)
```json
{
  "_id": "ObjectId",
  "name": "String (e.g., Roberts Space Industries)",
  "baseUrl": "String",
  "articleLinkSelector": "String (CSS selector for article links)",
  "contentSelector": "String (CSS selector for the main content body)",
  "titleSelector": "String",
  "imageSelector": "String",
  "isActive": "Boolean",
  "createdAt": "Date"
}
```

### Article Collection (`articles`)
```json
{
  "_id": "ObjectId",
  "sourceId": "ObjectId (Reference to sources)",
  "sourceUrl": "String (Unique Index)",
  "title": "String",
  "heroImage": "String (URL)",
  "thumbnailImage": "String (URL)",
  "contentImages": ["String"], 
  "fullContent": "String (Cleaned HTML/Markdown)",
  "summary": "String",
  "category": "String",
  "publishedAt": "Date",
  "scrapedAt": "Date"
}
```

## 4. Resiliency & Anti-Block Measures
*   **User Agent Rotation:** cycle through a list of common browser user agents to avoid fingerprinting.
*   **Request Throttling:** Implement a random delay (1–5 seconds) between individual article scrapes.
*   **Headless Mode:** Run in headless mode for performance on the TrueNAS/AWS server, but allow headful mode for local debugging.
*   **Error Handling:** If a specific source fails to scrape, log the error and proceed to the next source without crashing the entire process.

## 5. Performance Considerations
*   **Concurrency:** Limit the number of concurrent browser pages (e.g., max 3 open pages) to avoid memory spikes on low-resource hardware.
*   **Caching:** Only scrape articles that aren't already in the DB or those whose "Last Modified" header has changed.
