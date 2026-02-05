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
*   **Dice Roller:** Built-in 3D vector dice. Click the dice icons to roll. Hold `Shift` for Advantage or `Alt` for Disadvantage.
*   **Inventory & Spells:** Manage your loadout and spell slots.
*   **Automation:**
    *   **Resting:** Use the Short/Long rest buttons to automatically reset resources and hit dice.
    *   **Death Saves:** clickable interaction for success/failure tracking.

### Shortcuts
*   **`Shift` + Click Roll:** Roll with Advantage.
*   **`Alt` + Click Roll:** Roll with Disadvantage.

---

## 🕸️ Investigation Board (`board.html`)
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

## 🛠️ Other Tools

| Tool | Description |
| :--- | :--- |
| **Main Hub** (`hub.html`) | View Guild Renown, Heat levels, and Campaign Downtime status. |
| **Tournament** (`tourney.html`) | View active competion brackets. |

## 💾 Saving Data
All data is saved automatically to your browser's **Local Storage**.
*   **Export:** Use the "Export" button on the Portal (`tools.html`) to backup your data to a JSON file.
*   **Import:** Restore your data on a new device or browser using "Import".
