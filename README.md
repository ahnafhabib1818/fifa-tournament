# Kickoff — FIFA Friends Tournament

**Live Demo:** [FIFA Tournament website খুলুন](https://fifa-tournament-g451.onrender.com)

বন্ধুদের FIFA tournament plan, fixtures, scores, standings এবং পুরোনো ম্যাচের স্মৃতি এক জায়গায় রাখার responsive ওয়েব অ্যাপ। Dashboard থেকে একক লিগ, গ্রুপ + নকআউট, অথবা সরাসরি নকআউট tournament তৈরি করা যায়; একই site-এর দর্শকেরা tournament দেখতে ও ফল update করতে পারে।

## Tournament শুরু

Dashboard থেকে **নতুন টুর্নামেন্ট** বেছে নাম ও দলসংখ্যা দাও। ক্লাবের নাম suggestion থেকে team বেছে নিতে পারো, অথবা custom name লিখতে পারো। Format নিজে বেছে নাও: একক লিগ, গ্রুপ + নকআউট, অথবা সরাসরি নকআউট। গ্রুপের সংখ্যা, প্রতি গ্রুপ থেকে qualifier সংখ্যা, অথবা league-এর পরে top 2/top 4/custom progression নির্ধারণ করো। দলসংখ্যা format auto-select করে না।

Tournament page-এ fixtures edit, score/penalty entry, points tables, knockout progression ও champion সংরক্ষিত হয়। লিগ/গ্রুপে জয় ৩, ড্র ১, হার ০ পয়েন্ট; table order points, goal difference, goals scored, head-to-head tie-break এবং stable team order অনুসরণ করে।

## Render + Neon deployment

`render/neon-postgres` branch PostgreSQL/Neon ব্যবহার করে। Render service-এ `DATABASE_URL` environment variable-এ Neon-এর PostgreSQL connection string দিতে হবে। Render startup-এ `pnpm start:render` প্রথমে checked-in `drizzle-pg/migrations/` migrations প্রয়োগ করে, তারপর production server চালায়। পুরোনো MySQL migration history `drizzle/`-এ রাখা হয়েছে এবং সেটি এই PostgreSQL service-এ প্রয়োগ করা হয় না।

এই branch নতুন Neon database ব্যবহার করে। আগের Manus deployment-এর MySQL database ও তার records অপরিবর্তিত থাকে; পুরোনো records নতুন Neon database-এ স্বয়ংক্রিয়ভাবে copy হয়নি। আগের data দরকার হলে source database-এর access পেলে আলাদা migration করতে হবে।

এই app-এ login বা per-user access control নেই: public URL-এর যে কেউ shared tournament data দেখতে ও edit করতে পারে।

## Development

- `pnpm dev` — development server, default port 3000.
- `pnpm check` — TypeScript diagnostics.
- `pnpm test` — application ও tournament-engine unit tests.
- `pnpm build` / `pnpm start` — production bundle / server.
- `pnpm db:generate` — PostgreSQL schema থেকে migration তৈরি করে.
- `pnpm db:migrate` — checked-in PostgreSQL migrations প্রয়োগ করে.
- `pnpm db:push` — নতুন migration তৈরি করে এবং configured PostgreSQL database-এ প্রয়োগ করে.
- `pnpm start:render` — migrations চালিয়ে production server চালু করে.

The project uses React, TypeScript, Vite, Wouter, tRPC, Express, Drizzle and PostgreSQL on the Render deployment branch.
