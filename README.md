# Daily

A workout and food dashboard built with React, TypeScript, Vite+, and plain CSS. Settings and workout logs live in the browser.

[Open the live app](https://hurtak.github.io/daily/)

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite+. Use Node 24.11 or newer in the Node 24 release line, matching CI. Vite+ is installed locally through npm; no global CLI installation is required.

## Checks

- `npm run validate` runs Vite+ static checks, all unit / component tests, and the production build.
- `npm run check` runs formatting, linting, and TypeScript checks together with `vp check`; warnings fail validation.
- `npm test` runs the bundled Vitest through `vp test run` in jsdom.
- `npm run test:watch` runs the same tests interactively through `vp test watch`.
- `npm run type-check` runs only Vite+'s native TypeScript check across the application, tests, and Vite configuration.
- `npm run lint` runs Oxlint, including React Hooks, React Compiler, and Fast Refresh checks.
- `npm run fmt` checks formatting with Oxfmt, retaining the 120-column print width.
- `npm run check:fix`, `npm run lint:fix`, and `npm run fmt:fix` apply the corresponding automatic fixes.
- `npm run build` builds the production app into `dist/` through `vp build`.
- `npm run preview` serves that build through `vp preview`.

Development, tests, formatting, linting, type checking, builds, and previews share the configuration in `vite.config.ts`. The project uses the [Vite+ local CLI](https://viteplus.dev/guide/local-cli) and npm's lockfile; the Vite core alias and Vitest override keep the bundled toolchain versions aligned when dependencies resolve those packages.

GitHub Actions runs the **Main workflow** on every push and pull request. Its `validate` job uses Node 24, installs the lockfile with `npm ci`, and runs the same `npm run validate` command as local development. These npm scripts resolve the pinned project-local Vite+ executable automatically.

After validation passes, pushes to `main` run the `deploy` job: build the production app and publish `dist/` to [GitHub Pages](https://hurtak.github.io/daily/). Pull requests and other branches only validate. GitHub Pages uses the GitHub Actions publishing source. Vite’s base path is `/daily/`, matching the repository URL.

Tests cover both workout sequences, every screen, exercise guides, native dialogs, auto-paced rep timers and pace switching, pause/resume, restart confirmation, navigation with preserved sessions, side-plank holds, rep/countdown/transition audio cues, mute, unavailable audio, and wake-lock cleanup. There is no end-to-end test suite or browser test dependency.

Browser QA is separate from these unit tests. The integrated browser was used to check the overview, both previews, every workout phase, completion, nutrition, and help dialogs. Phone viewport checks include 320×568, 360×640, 390×844, 430×932, and 844×390 landscape. Main screens fit the viewport without scrolling or off-screen controls; workout controls are at least 44×44 CSS pixels. Longer notes scroll inside native dialogs. These are browser viewport checks, not physical-device tests.

## Movement diagram review

Each diagram renders one articulated figure with fixed-length limb segments. Open an exercise in the workout preview or select **Guide** during a set to inspect three positions or play and pause a full repetition. The pose solver samples a continuous cycle, and CSS transforms interpolate joint rotations. Right-side steps mirror the figure. The side plank stays still, and the three position controls remain available in reduced-motion mode.

The 33 key poses were reviewed for consistent scale, joint connections, floor contact, and equipment placement. The six new marching / bridge poses were also reviewed together in a static contact sheet. Geometry tests check full motion cycles for segment lengths, planted support points, closed loops, continuous trajectories, elbow/knee angles, alternating marching support, single-leg bridge alignment, fixed curl elbows, overhead alignment, pelvic movement, and the isometric plank. These checks protect the drawing geometry; they do not constitute clinical validation of exercise technique.

Form references

| Diagram                 | Reference and comparison                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Squat                   | [ACE bodyweight squat](https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/) and [StrengthLog filmed demonstration](https://www.strengthlog.com/best-bodyweight-exercises/): planted feet, hips back/down, thighs approximately parallel.                                                                               |
| Brisk marching          | [Health and Wellbeing Queensland](https://hw.qld.gov.au/physical-activity/marching-on-the-spot/): upright torso, alternating knee lifts, and a planted supporting foot. The opposite arm pumps with each knee lift.                                                                                                                                     |
| Single-leg glute bridge | [ACE single-leg glute bridge progression](https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/): head and shoulders stay on the mat, one working foot remains planted, the pelvis lifts through hip extension without arching the lower back, and the other leg stays raised.                        |
| Arm circles             | [Health and Wellbeing Queensland](https://hw.qld.gov.au/physical-activity/arm-circles/), written steps: straight arms circle from the shoulders in a large windmill path. A curved arrow connects the three sampled positions.                                                                                                                          |
| Push-up                 | [NASM push-up](https://www.nasm.org/resource-center/exercise-library/push-up) and [StrengthLog filmed demonstration](https://www.strengthlog.com/best-bodyweight-exercises/): hands/toes planted, aligned trunk/legs, elbows bend on descent.                                                                                                           |
| Reverse lunge           | [Original Kettlebell step photos](https://www.originalkettlebell.com/exercise/kettlebell-reverse-lunge/): two-hand chest hold, backward step, rear heel raised, rear knee near the floor, return to standing. The app completes each side separately.                                                                                                   |
| One-arm press           | [Original Kettlebell single-arm press photos](https://www.originalkettlebell.com/en-us/exercise/kettlebell-single-arm-press): rack position, vertical forearm, extended arm overhead, bell behind the wrist.                                                                                                                                            |
| Reverse crunch          | [ACE reverse crunch](https://www.acefitness.org/resources/everyone/exercise-library/76/reverse-crunch/) and [trainer demonstration photos](https://hips.hearstapps.com/hmg-prod/images/766/images/reverse-crunch-1492648561.jpg?resize=980%3A%2A): head/shoulders down, bent knees, pelvis curls toward the ribs.                                       |
| Supported one-arm row   | [Physitrack kettlebell row video](https://us.physitrack.com/home-exercise-video/kettlebell-single-arm-bent-over-row) and [Nuffield Health instructions](https://www.nuffieldhealth.com/article/how-to-kettlebell-row): free hand visibly supported, trunk still, elbow draws back and the weight rises toward the side.                                 |
| Curl                    | [StrengthLog kettlebell curl demonstration](https://www.strengthlog.com/kettlebell-curl/) and [Mayo Clinic instructions](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/biceps-curl/vid-20084675): fixed upper arm, elbow flexion, no torso swing. StrengthLog shows both arms; the app illustrates the same motion one arm at a time. |
| Side plank              | [NASM side plank](https://www.nasm.org/resource-center/exercise-library/side-plank) and [US Marine Corps video](https://www.dvidshub.net/video/640254/side-plank): forearm support, elbow below shoulder, stacked hips/feet, straight legs, static hold.                                                                                                |
| Pike push-up            | [NASM pike push-up](https://www.nasm.org/workout-exercise-guidance/default?slug=pike-push-up) shows planted hands and feet, raised hips, and a controlled lowering of the head.                                                                                                                                                                         |
| Prone W raise           | [NHS shoulder exercises](https://www.rightdecisions.scot.nhs.uk/media/alqcguhk/shoulder-rehabilitation-exercises.pdf) show the face-down W position and a small hand lift with the shoulder blades drawn back.                                                                                                                                          |

References informed original SVG drawings; no reference photos or videos are bundled in the app. The rest screen's bottle is decorative.

## The routine

New profiles start with training on Monday, Wednesday, and Friday. Pick your workout days in Body settings. The calendar alternates A and B across the selected days, and nutrition targets use the number selected.

| Workout                     | Pair 1 · 3 rounds                                             | Pair 2 · 2 rounds                                           |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| A · Abs, biceps & shoulders | Reverse crunch, 10–15 reps. Self-resisted curl, 8–12 per arm. | Pike push-up, 5–10 reps. Side plank, 20–30 sec per side.    |
| B · Full body               | Reverse lunge, 8–12 per leg. Prone W raise, 10–15 reps.       | Push-up, 8–15 reps. Single-leg glute bridge, 10–15 per leg. |

Both workouts start with bodyweight exercises. Toggle **Use 10 kg kettlebell** to switch supported exercises across both workouts: Workout A switches to one-arm kettlebell curls (6–12 per arm) and one-arm overhead presses (6–10 per arm); Workout B switches to goblet reverse lunges (8–12 per leg) and supported one-arm rows (10–15 per arm). The shared setting persists in the browser and applies to the preview, warm-up, and timer.

The player has a 5-second lead-in and an exactly 3-minute guided warm-up: 45 seconds of brisk marching, 30 seconds of bodyweight squats, 45 seconds of arm circles, then 15 seconds of easy practice for each of the day's four exercises. Cover both sides during easy practice where relevant.

Complete both sides of an exercise before moving to the next. Finish Pair 1 before starting Pair 2. Rest 60–90 seconds after each round except the last. The app counts down 60 seconds for each rest and 30 seconds per side plank. Rep-based sets automatically count through the target max reps at your selected **Slow / Normal / Fast** pace, sync the movement animation, cue each rep with a distinct tone, and proceed to the next step automatically. Tap **Set complete** anytime to finish a set early or **Skip hold** to end a plank early. The completion screen counts the sets and sides for the active equipment mode.

The target session length is **20–25 minutes**. Finish rep-based sets with about two clean reps left, and end planks before the hips sag or rotate. Make the exercise a little harder once you reach the top of its range on every set. [ACSM resistance training guidance](https://acsm.org/resistance-training-guidelines-update-2026/)

Sounds play for each rep, the final three seconds of timed intervals, and step transitions using Web Audio, enabled by the start button. The timer uses elapsed time rather than counting callbacks. Navigating away pauses the current workout; returning to it preserves progress until the page reloads. The browser’s screen wake lock is used where available. Keep the tab open and the device awake for reliable audio; mobile browsers can suspend background pages. Refreshing resets the session.

The app uses a `100dvh` grid, safe-area padding, and CSS container units to fit the movement ring around the available space. It prevents page overscroll, and long guidance lives in native dialogs. All movement animation uses CSS and respects reduced-motion preferences. Google Fonts is the only external visual request; system font fallbacks work offline. All workout data, diagrams, timers, and audio are local.

## License

[MIT](LICENSE) © 2026 Petr Hurtak.
