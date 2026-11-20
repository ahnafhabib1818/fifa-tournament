# Kickoff — FIFA Friends Tournament

বন্ধুদের FIFA tournament plan, fixtures, scores, standings এবং পুরোনো ম্যাচের স্মৃতি এক জায়গায় রাখার responsive ওয়েব অ্যাপ। প্রতিটি tournament shared archive-এ managed MySQL database-এ সংরক্ষিত হয়; একই site ব্যবহার করা বন্ধুরা tournament দেখতে ও ফল update করতে পারে।

## Tournament শুরু

Dashboard থেকে **নতুন টুর্নামেন্ট** বেছে নাম ও দলসংখ্যা দাও। ক্লাবের নাম suggestion থেকে team বেছে নিতে পারো, অথবা custom name লিখতে পারো। এরপর format নিজে বেছে নাও: একক লিগ, গ্রুপ + নকআউট, অথবা সরাসরি নকআউট। গ্রুপের সংখ্যা, প্রতি গ্রুপ থেকে qualifier সংখ্যা, অথবা league-এর পরে top 2/top 4/custom progression নির্ধারণ করো। দলসংখ্যা format auto-select করে না।

Tournament page-এ fixtures edit, score/penalty entry, points tables, knockout progression ও champion সংরক্ষিত হয়। লিগ/গ্রুপে জয় ৩, ড্র ১, হার ০ পয়েন্ট; table order points, goal difference, goals scored, head-to-head tie-break এবং stable team order অনুসরণ করে।

## Development

- `pnpm dev` — development server, default port 3000.
- `pnpm check` — TypeScript diagnostics.
- `pnpm test` — application ও tournament-engine unit tests.
- `pnpm build` / `pnpm start` — production bundle / server.
- `pnpm db:migrate` — checked-in additive migrations apply.
- `pnpm db:push` — schema change generate ও apply (development ও publish একই database ব্যবহার করে)।

The project uses React, TypeScript, Wouter, tRPC, Express, Drizzle and the managed MySQL database selected at initialization. Tournament data is globally shared within this project and has no login or per-user access boundary.
