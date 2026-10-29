<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Content Integrity and UI Intentionality

Every visible element must serve a clear, product-specific purpose. Treat interface content as information, not decoration.

Before creating or modifying a page, understand its purpose, intended users, primary tasks, and the information they need to see.

Apply these rules strictly:

1. **Meaning before appearance.** Do not add text, headings, labels, captions, statistics, badges, cards, dividers, decorative lines, or sections merely to fill space or make the page look more complete.

2. **Justify every element.** For every visible element, be able to explain what it communicates, what user need it serves, or what action it enables. If there is no clear answer, remove it.

3. **Never invent product content.** Do not fabricate metrics, activity, testimonials, user data, business claims, status information, or other facts to make an interface appear populated. Use verified application data. Clearly label illustrative demo data when it is appropriate and necessary.

4. **Eliminate generic filler copy.** Avoid vague marketing language, meaningless microcopy, redundant explanations, decorative headings, and generic phrases that could appear unchanged in almost any application. Use specific, natural language grounded in the actual product.

5. **Make structure communicate.** Every navigation item must lead somewhere meaningful. Every heading must identify the content beneath it. Every divider, grouping, badge, and visual indicator must communicate a real distinction or relationship.

6. **Prefer purposeful simplicity.** Do not add sections simply because similar websites have them. Do not force every page into a hero, statistics row, card grid, activity feed, or other template. Choose a layout based on the page's actual job.

7. **Handle missing information honestly.** If relevant data is unavailable, do not fabricate it. Omit nonessential content or display a useful empty state that explains what is missing and what the user can do next.

8. **Audit existing content, not just new content.** When reviewing a page, examine every visible text element and structural component. Retain what is useful, revise what is unclear, and remove what is redundant, irrelevant, misleading, or meaningless.

9. **Validate before finishing.** Review the page visually at relevant desktop and mobile sizes. Check the rendered interface, not merely the source code. Confirm that the page communicates its purpose immediately and that no filler has survived the cleanup.

Do not mistake visual density for completeness, decorative sophistication for professionalism, or grammatically correct copy for meaningful content.

The objective is a deliberate, coherent, product-specific interface in which every element earns its place.
