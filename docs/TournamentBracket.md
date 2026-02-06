# Tournament Bracket (`tourney.html`)

Double-elimination bracket manager with SVG wiring. Ideal for Ravnica pit fights, sport broadcasts, or guild trials.

## Setup & Structure
- **Modal Intake** – Paste 4–64 names (one per line), optionally shuffle seeding, then click Generate. The modal can be reopened anytime by hitting `New Bracket` in the hero actions.
- **Bracket Rendering** – Winners and Losers brackets render together with curved drop lines, BYE handling, and space for the Grand Final reset path.
- **Auto-Fit** – Use the hero `Auto-Fit` button to recenter the SVG whenever you resize the window or add massive player lists.

## Match Flow
- **Score Reporter** – Click any match node to open the modal. Adjust scores with +/- controls, then confirm to advance the winner or drop the loser to the correct round.
- **State Persistence** – Every score and pairing is stored locally, so refreshing the page keeps your bracket intact.
- **Controls** – Portal link, accent picker, and BG cycler sit in the hero header so the bracket can match the rest of the suite for stream overlays.

## Tips
- Use the input list order for seeded play or toggle Randomize to let fate decide.
- Keep the bracket open on a second monitor; as soon as you save a score the SVG lines light up the new path.
- For narrative play, rename contestants to team codenames or guild squads before generating to cut down on editing mid-stream.
