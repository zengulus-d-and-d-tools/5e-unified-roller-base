# Tournament Bracket (`tourney.html`)

A tool for managing double-elimination tournaments (common in Ravnica's fighting pits or guild contests).

## Features

### Bracket Generation
- **Input**: Paste a list of names (one per line).
- **Seeding**: Options for random shuffle or maintaining input order.
- **Structure**: Automatically generates a robust Double Elimination bracket (Winners & Losers brackets) sized 2^N.

### Match Management
- **Interactive**: Click any match node to open the score reporter.
- **Scoring**: Enter scores for Player 1 vs Player 2.
- **Auto-Progression**: Winners automatically advance in the Winners Bracket; Losers drop to the Losers Bracket.
- **Visuals**: SVG lines dynamically draw connections between matches, including "elbow" drops from Winners to Losers.

### Logic
- Handles "BYE"s automatically.
- Supports Grand Finals resets.
- Persists state to Local Storage.
