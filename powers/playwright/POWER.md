---
name: "playwright"
displayName: "Playwright Browser Automation"
description: "Full browser automation via Playwright MCP — navigate pages, interact with elements, take screenshots, run accessibility snapshots, and test web apps."
keywords: ["playwright", "browser", "automation", "testing", "screenshot", "e2e", "web", "scraping", "navigate", "click"]
author: "Kiro"
---

## Overview

Playwright gives you a real browser you can control programmatically. Use it to:

- Navigate to URLs and interact with page elements
- Take screenshots and capture accessibility snapshots
- Fill forms, click buttons, drag elements
- Run end-to-end tests and verify UI behaviour
- Scrape web content
- Handle dialogs, file uploads, and keyboard input

## Available MCP Servers

### playwright

Provides all browser automation tools via the `@playwright/mcp` package.

#### Tools

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_snapshot` | Capture accessibility snapshot (preferred over screenshot for interactions) |
| `browser_take_screenshot` | Take a PNG/JPEG screenshot |
| `browser_click` | Click an element |
| `browser_type` | Type text into an element |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_select_option` | Select a dropdown option |
| `browser_hover` | Hover over an element |
| `browser_drag` | Drag and drop between elements |
| `browser_press_key` | Press a keyboard key |
| `browser_wait_for` | Wait for text to appear/disappear or a timeout |
| `browser_navigate_back` | Go back in browser history |
| `browser_tabs` | List, create, close, or select tabs |
| `browser_handle_dialog` | Accept or dismiss dialogs |
| `browser_file_upload` | Upload files |
| `browser_evaluate` | Run JavaScript on the page |
| `browser_run_code` | Run a Playwright code snippet |
| `browser_resize` | Resize the browser window |
| `browser_close` | Close the browser |
| `browser_console_messages` | Get console messages |
| `browser_network_requests` | Get network requests |
| `browser_install` | Install the browser if not present |

## Typical Workflow

1. `browser_navigate` — go to the target URL
2. `browser_snapshot` — inspect the page structure (use refs for interactions)
3. `browser_click` / `browser_type` / `browser_fill_form` — interact
4. `browser_take_screenshot` — capture visual state
5. `browser_close` — clean up when done

## Best Practices

- Prefer `browser_snapshot` over `browser_take_screenshot` when you need to interact — snapshots give you element refs
- Always use the `ref` from a snapshot for precise targeting
- Use `browser_wait_for` after navigation or async actions before interacting
- Call `browser_close` when finished to free resources
- If a page is JavaScript-heavy and snapshot returns minimal content, retry with `browser_run_code` using Playwright's full API

## Troubleshooting

### Browser not installed
Run `browser_install` to download the required browser binary.

### Element not found
Take a fresh `browser_snapshot` — refs change after page updates.

### Page content missing after navigate
Use `browser_wait_for` with a known text string that appears when the page is ready.
