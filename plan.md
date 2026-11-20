# Kickoff — টুর্নামেন্ট ম্যানেজার পরিকল্পনা

## বাস্তবায়নের পরিকল্পনা

বন্ধুদের FIFA টুর্নামেন্ট তৈরি, পরিচালনা ও পরে স্মৃতি হিসেবে ফিরে দেখার জন্য responsive React ওয়েব অ্যাপ তৈরি হবে। প্রজেক্টটি ইতিমধ্যে Manus web-db-user starter-এ React, TypeScript, Wouter, tRPC, Express, Drizzle এবং managed MySQL নিয়ে initialized; নতুন framework/dependency দরকার নেই। Managed database development ও published deployment-এ একই থাকবে, তাই schema changes additive হবে এবং কোনো destructive migration করা হবে না।

- **টুর্নামেন্ট আর্কাইভ:** প্রতিটি টুর্নামেন্টের নাম, টিম, বেছে নেওয়া format/advancement settings, group assignment, fixtures, score, penalty result, status ও dates database-এ রাখা হবে। একটি `tournaments` table-এ metadata এবং JSON state থাকবে; create/load/list/update tRPC operation দিয়ে হবে। একটি shared archive-এ সকল visitor একই saved tournaments দেখবে, কোনো login ধাপ থাকবে না।
- **টিম নির্বাচন:** টিমের সংখ্যা ও টিমের নাম অংশগ্রহণকারীরা নিজেরা নির্ধারণ করবে; পরিচিত FIFA club quick-pick থেকে বেছে নেওয়া এবং custom নাম যোগ করার ব্যবস্থা থাকবে। এই তালিকা tournament-এর সঙ্গে save হবে।
- **ফরম্যাট:** team count দিয়ে কোনো format auto-select হবে না। Tournament create করার সময় user-কে স্পষ্টভাবে বেছে নিতে হবে: single league, groups then knockout, বা direct knockout। Groups বাছলে group count ও প্রতি গ্রুপ থেকে কয় দল উঠবে user নির্ধারণ করবে; league বাছলে knockout না থাকা, শীর্ষ ২-এর final, শীর্ষ ৪-এর semifinal, বা custom top-N progression বেছে নেওয়া যাবে। অসম্ভব/অপর্যাপ্ত team counts-এ form স্পষ্ট validation দেখাবে, নিজে থেকে format বদলাবে না।
- **Fixtures ও ফল:** বেছে নেওয়া stage অনুযায়ী deterministic round-robin fixtures তৈরি হবে; বিজোড় দলে bye/rest slot থাকবে এবং group-গুলো যতটা সম্ভব সমান হবে। Direct/পরবর্তী knockout-এ bracket seed, bye এবং winner progression থাকবে। Generated fixture editable হবে। Score/penalty save করলে standings, goal difference, points ও qualifiers পুনর্গণনা হবে। League/group standings-এ জয় ৩, ড্র ১, হার ০; সমান পয়েন্টে goal difference, goals scored, head-to-head এবং প্রয়োজন হলে tie-break। Knockout tie winner নির্ধারণে penalty entry থাকবে।
- **UI ও route:** dashboard-এ saved tournament archive, create CTA ও recent results; tournament detail-এ summary, fixtures, standings/bracket এবং score-entry থাকবে। Bengali UI; responsive navigation। `public/manus-routes.json` source route-গুলোর সঙ্গে synchronized থাকবে।
- **Validation ও runtime:** আগে TypeScript diagnostics চালু আছে (registered); server-side zod/tRPC validation এবং fixture generator-এর unit tests যোগ হবে। অর্থপূর্ণ UI/API তৈরি হওয়ার পর platform-managed runtime-এ `pnpm dev` চালু হবে; database migration additive হবে।
- **GitHub ও deployment:** implementation শেষে GitHub connector/authorized CLI পাওয়া গেলে ব্যক্তিগত repository তৈরি/সংযোগ করে `main`-এ push করা হবে; প্রজেক্টের canonical checkpoint/publishing workflow আলাদা করে সম্পন্ন হবে। Auto Publish বন্ধ—সুতরাং user-এর অনুরোধ অনুযায়ী app-টি publish করার জন্য explicit publish call করা হবে, এবং successful production URL-ই কেবল delivery-তে জানানো হবে. GitHub connection/tool access unavailable হলে blocker-ийг স্পষ্ট জানাতে হবে; credentials/chat token-ийг কেতিয়াও চাওয়া হবে না।

### সম্ভাব্য প্রকল্প কাঠামো

- `client/src/pages/`: archive dashboard ও tournament detail page.
- `client/src/components/`: shared navigation, setup wizard, team picker, fixture cards, standings table, knockout bracket.
- `client/src/lib/`: typed tRPC client ও tournament formatting/helpers.
- `shared/`: tournament state/type definitions এবং fixture/standings pure logic, client/server উভয়ে ব্যবহারযোগ্য.
- `server/`: tRPC tournament router এবং Drizzle database operations.
- `drizzle/`: tournament schema ও additive migration.
- `public/manus-routes.json`: routable page declaration.

## ডিজাইন

### বিকল্প শৈলী ও নির্বাচন
- Floodlit Matchday Editorial — ০.০৬
- Heritage Football Almanac — ০.০৭
- Modern Console Scoreboard — ০.০৮

### নির্বাচিত দিক: Floodlit Matchday Editorial

- **Design Movement:** আধুনিক ফুটবল matchday programme ও live scoreboard-এর editorial মিশ্রণ; তথ্য দ্রুত স্ক্যান করা যায়, কিন্তু সাধারণ admin template-এর মতো দেখায় না।
- **Core Principles:** ফলাফল সর্বাগ্রে; মাঠ-সবুজে দৃশ্যমান contrast; tournament-ভিত্তিক hierarchy; মোবাইলে score entry সহজ।
- **Color Philosophy:** গভীর pitch green আস্থা ও খেলার মাঠের আবহ দেবে, warm off-white কাগজের মতো আর্কাইভ অনুভূতি আনবে, electric lime live/primary action চিহ্নিত করবে, amber trophy/accent ও muted red অসমাপ্ত/সতর্ক অবস্থা আলাদা করবে।
- **Layout Paradigm:** compact left rail/ছোট-screen top bar, তার পাশে বিস্তৃত matchday canvas; dashboard-এ বড় active tournament card, তার পরে archive list; detail page-এ score/fixture-এর প্রাধান্য এবং পাশে/নিচে standings।
- **Signature Elements:** গোল-বারের মতো lime score indicator; pitch-line inspired divider; round label-সহ oversized matchday number।
- **Interaction Philosophy:** প্রতিটি ফলাফল দ্রুত edit/save; league mode-এ home/away score inline; confirmation ছাড়া tournament deletion নেই; format selection-এ effect sample preview দেখানো হবে।
- **Animation:** route/view transition-এ ক্ষুদ্র fade/slide; score save-এ সংক্ষিপ্ত highlight; hover-এ fixture card সামান্য উঁচু হবে; `prefers-reduced-motion` মানা হবে; কোনো অবিরাম animation নয়।
- **Typography System:** Bengali readable system font (`Noto Sans Bengali` fallback), Latin score/number-এ `Inter`/system sans; compact uppercase-style English labels অল্প, বড় tabular score numerals; headings 700, metadata 500–600।
- **Brand Essence:** বন্ধুদের FIFA রাতকে সুশৃঙ্খল, মনে রাখার মতো ছোট tournament archive-এ পরিণত করে। ব্যক্তিত্ব: প্রতিযোগিতামূলক, বন্ধুসুলভ, পরিষ্কার।
- **Brand Voice:** ছোট, matchday-এর ভাষা; নির্দেশ স্পষ্ট, প্রতিযোগিতার উত্তেজনা হালকা। উদাহরণ: “টুর্নামেন্ট গুছাও, ম্যাচ শুরু হোক।” “স্কোর বসাও—টেবিল নিজেই বদলাবে।”
- **Wordmark & Logo:** গোল বলের পাঁচকোণা প্যাটার্নকে field whistle/কিক-আর্কের সঙ্গে যুক্ত করা বৃত্তাকার monogram; পাশে `KICKOFF` wordmark।
- **Signature Brand Color:** lime `#C7F36B`, deep pitch green `#103B2B`-এর ওপর স্বতন্ত্র live action accent।
