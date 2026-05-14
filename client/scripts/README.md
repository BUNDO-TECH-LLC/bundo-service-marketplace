# Client scripts

One-off maintenance scripts live under [`archive/`](./archive/).

Those Node scripts were used to slice large components out of an older monolithic `App.tsx`. The extraction is complete; they are kept only as a reference if a similar refactor is needed later. **Do not run them against the current tree** without updating the string markers and output paths to match the file you are splitting.
