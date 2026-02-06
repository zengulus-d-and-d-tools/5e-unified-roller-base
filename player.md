# Player Guide: Ravnica Task Force Tools

Welcome to the **Ravnica Task Force** suite. These offline-first tools are designed to help you manage your character, track investigations, and visualize the campaign state.

## Getting Started

Open **`tools.html`** in your browser. This is your portal to all available apps.

> **Tip:** You can switch the background visual style by clicking **🌌 BG** in the top right of any tool. Options include "Nebula", "Matrix", "Vector Field", etc.

---

## 🧙‍♂️ Character Sheet (`index.html`)
**Your primary interface for play.**

### Key Features
*   **Stats & Vitals:** Track HP, AC, and resource pools (Ki, Sorcery Points, etc).
*   **Command Console Roller:** Inline roller with Advantage/Disadvantage toggles, a `+Mod` field, and optional secret/Discord output so you never leave the sheet.
*   **Inventory & Spells:** Manage your loadout, reusable attacks, spell slots, feats, and custom features.
*   **Automation:**
    *   **Resting:** Use the Short/Long rest buttons to automatically reset resources and hit dice.
    *   **Death Saves:** Click successes/failures and let the tracker handle the math.
*   **Creator Overlay:** Tap **✨ Start a new character** (or the `+` next to the selector) to walkthrough race/class inputs and seed a fresh sheet fast.

### Shortcuts
*   **`Shift` + Click Roll:** Roll with Advantage.
*   **`Alt` + Click Roll:** Roll with Disadvantage.

---

## 🕸️ Case Board (`board.html`)
**A collaborative whiteboard for solving cases.**

Use this space to map out clues, suspects, and locations.

### How to Use
1.  **Add Nodes:** Drag items from the toolbar (Person, Location, Clue, Note) onto the board.
2.  **Connect Evidence:**
    *   Hold **Right Click** on one node and drag to another to create a connection string.
    *   **Double-click** a connection string to delete it.
3.  **Organize:**
    *   **Right-click** a node to Edit or Delete.
    *   Use **"Center & Optimize"** to auto-arrange tangled webs of evidence.

---

## ♟️ Player Dashboard (`player-dashboard.html`)
**Task Force Status Monitor.**

A high-level view of the entire party's vital statistics.
*   **Monitor Party HP:** See who is in danger (red highlight).
*   **Compare Stats:** Quickly reference everyone's AC, Passive Perception, and Save DC.

---

## 👥 NPC Roster (`roster.html`)
**A searchable database of contacts, rivals, and guild dignitaries.**

*   **Search & Filter:** Find NPCs by name or filter by Guild affiliation.
*   **Track Details:** Keep notes on an NPC's "Wants" and "Leverage" to aid in social encounters.
*   **Add New:** Player-editable! Add new faces as you meet them in the city.

---

## 📍 Locations Database (`locations.html`)
**Comprehensive guide to the city's districts and landmarks.**

*   **District Intel:** Filter locations by District/Guild control.
*   **Log Discoveries:** Record descriptions and notes for key locations you visit.

---

## 🏛️ HQ Layout Foundry (`hq.html`)
**Blueprint your Task Force headquarters.**

*   **Drag-and-Drop Rooms:** Place custom chambers on a glowing grid. Snap-to-grid keeps Azorius inspectors happy.
*   **Multi-Floor Support:** Add, rename, or delete floors to reflect subterranean labs, sky docks, or street-level muster yards.
*   **Downtime Slots:** Each room can define named downtime assignments; the assignee field pulls directly from the Hub's player list so downtime projects stay synced.
*   **Resource Bays:** Stage requisitioned assets in bays so everyone knows what deploys faster from where. Suggestions pull from the shared Requisition Vault list.
*   **Screenshot & Export:** One-click PNG export shares the current floor blueprint; JSON import/export lets you sync HQ layouts across devices.
*   **Theme Controls:** Tap 🎨 Accent or 🌌 BG to match the HQ palette to your current table mood.

---

## 🛠️ Operations & GM Tools

| Tool | Description |
| :--- | :--- |
| **Tools Hub** (`tools.html`) | Import/export the shared store, set the table accent, and reveal DM-only shortcuts. |
| **Campaign Hub** (`hub.html`) | Track guild reputation, crew Heat, and downtime payouts between sessions. |
| **Mission Timeline** (`timeline.html`) | Chronicle ops with heat deltas, fallout notes, and filters for recap prep. |
| **Requisition Vault** (`requisitions.html`) | Log gear requests, approvals, and delivery status so everyone knows what’s in the queue. |
| **Encounter Recipes** (`encounters.html`) | Prep reusable fights, hazards, and rewards on cards that autosave to the shared store. |
| **Clue Generator** (`clue.html`) | Pair signal vs noise evidence to keep investigations fresh, then drop results straight onto the Case Board. |
| **Session Tracker** (`gm.html`) | DM deck for initiative, loot, and inline rolling. It saves to its own `gmDashboardData` key, so export/import inside the page when you need to share presets. |
| **Narrative Engine** (`dm-screen.html`) | Prompt factory for hazards, NPC motivations, scene texture, and wrap-up headlines. |
| **Tournament Bracket** (`tourney.html`) | Manage double-elimination brackets with auto-advancing brackets saved locally per browser. |

## 💾 Saving Data
Campaign tools share the `RTF_STORE` Local Storage object.
*   **Import once:** Open `tools.html`, click Import, and every Hub/Board/Dashboard/Roster/Locations/Requisition/Timeline/Encounter/HQ tab will pick up that snapshot.
*   **Export often:** Use the Tools Hub export to grab the unified JSON before/after sessions.
*   **Standalone saves:** The Character Sheet, Session Tracker (`gmDashboardData`), Narrative Engine, Clue Generator, and Tournament Bracket keep their own lightweight storage. Use their built-in export/import (if available) when you need to move those between browsers.
