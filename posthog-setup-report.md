# PostHog post-wizard report

The wizard has completed a deep integration of GigNearby with PostHog. `posthog-js` was installed and initialised in `src/lib/posthog.ts`, imported at app startup via `src/main.tsx`, and event capture calls were added across all six user-facing pages. Users are identified by their E.164 phone number on both account creation and sign-in, ensuring cross-session continuity.

| Event name | Description | File |
|---|---|---|
| `cv_uploaded` | User uploads a CV file on the landing page to start the job matching flow | `src/pages/Landing.tsx` |
| `category_selected` | User clicks a job category chip on the landing page to browse jobs in that sector | `src/pages/Landing.tsx` |
| `pricing_plan_clicked` | User clicks a pricing plan CTA button on the landing page | `src/pages/Landing.tsx` |
| `otp_requested` | User submits their phone number to request an OTP verification code | `src/pages/Verify.tsx` |
| `account_created` | User successfully verifies OTP and creates a new GigNearby account | `src/pages/Verify.tsx` |
| `sign_in_completed` | Returning user successfully signs in by verifying their OTP code | `src/pages/SignIn.tsx` |
| `checkout_started` | User initiates Stripe checkout for a subscription plan | `src/pages/Results.tsx`, `src/pages/Dashboard.tsx` |
| `payment_succeeded` | User returns from Stripe with a successful payment confirmation | `src/pages/Dashboard.tsx` |
| `job_saved` | User bookmarks a job listing from the dashboard | `src/pages/Dashboard.tsx` |
| `job_shared` | User copies a shareable job link to their clipboard | `src/pages/Dashboard.tsx` |
| `sarah_chat_sent` | User sends a message to the Sarah AI career assistant | `src/pages/Dashboard.tsx` |
| `cv_updated` | User uploads a new CV to replace their existing one from the dashboard | `src/pages/Dashboard.tsx` |
| `job_applied` | User clicks Apply Now on a shared job listing page | `src/pages/JobDetail.tsx` |

## Next steps

We've built insights and a dashboard to monitor user behaviour based on the events just instrumented:

- **Dashboard:** [Analytics basics (wizard)](https://eu.posthog.com/project/205226/dashboard/763968)
- [Signup funnel: CV upload → OTP → Account created](https://eu.posthog.com/project/205226/insights/0U8ReuAX)
- [Checkout funnel: Account created → Checkout started → Payment succeeded](https://eu.posthog.com/project/205226/insights/ieCCg18a)
- [New accounts per day](https://eu.posthog.com/project/205226/insights/A1E4YFAp)
- [Job engagement: saved, shared & applied](https://eu.posthog.com/project/205226/insights/pMuQgiIG)
- [Sarah AI chat volume](https://eu.posthog.com/project/205226/insights/Qil4G5dx)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path (SignIn.tsx `verifyCode`) also calls `posthog.identify` — it does, but verify the `e164` value is in scope and non-empty before the call.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
