export const DATA = {
    guilds: ["Azorius", "Boros", "Dimir", "Golgari", "Gruul", "Izzet", "Orzhov", "Rakdos", "Selesnya", "Simic"],

    conditions: [
        { name: "Blinded", desc: "Disadv on attacks. Attacks vs have Adv." },
        { name: "Charmed", desc: "Can't attack charmer. Charmer has Adv on social." },
        { name: "Deafened", desc: "Fail checks involving hearing." },
        { name: "Frightened", desc: "Disadv on checks/attacks while source is in sight. Can't move closer." },
        { name: "Grappled", desc: "Speed 0. Ends if grappler is incapacitated or effect removes." },
        { name: "Incapacitated", desc: "Can't take actions or reactions." },
        { name: "Paralyzed", desc: "Incapacitated. Fail Dex/Str saves. Crits within 5ft." },
        { name: "Petrified", desc: "Transformed to stone. Resistance to all damage." },
        { name: "Poisoned", desc: "Disadv on attacks and ability checks." },
        { name: "Prone", desc: "Disadv on attacks. Attacks within 5ft have Adv." },
        { name: "Restrained", desc: "Speed 0. Disadv on Dex saves and attacks." },
        { name: "Stunned", desc: "Incapacitated. Fail Str/Dex saves. Attacks vs have Adv." },
        { name: "Unconscious", desc: "Incapacitated. Drop everything. Fall prone. Fail saves." }
    ],

    loot: {
        trash: ["A handful of copper (1d10cp)", "A half-eaten skewer", "A dented tin cup", "A small pouch of foul-smelling moss", "A bent iron nail", "A scrap of bloodstained velvet"],
        common: ["1d8 gp", "A silver ring (10gp)", "A minor health potion", "A scroll of a 1st level spell", "A small gemstone (25gp)", "A well-crafted dagger"],
        rare: ["A bag of holding", "A +1 weapon", "A powerful health potion", "A rare reagent (100gp)", "An Azorius law-sphere", "An Izzet unstable gauntlet"]
    },

    dm: {
        actions: {
            "Azorius": ["Serving a subpoena", "Chanting a decree", "Erecting a barrier", "Drafting a report", "Managing a queue", "Debating a legalism"],
            "Boros": ["Detaining a suspect", "Marching in formation", "Inspecting a weapon", "Recruiting civilians", "Setting an ambush", "Cleaning armor"],
            "Dimir": ["Watching from a balcony", "Exchanging a dead-drop", "Erasing a memory", "Tailing the party", "Disguised as a beggar", "Melting into the crowd"],
            "Golgari": ["Hauling rot-compost", "Farming wall-fungus", "Scouting sewer exits", "Trading 'undercity' secrets", "Laying a spore-trap", "Reanimating a pack-beast"],
            "Gruul": ["Smashing a signpost", "Scavenging scrap", "Painting graffiti", "Challenging a passerby", "Reclaiming a ruin", "Building a bonfire"],
            "Izzet": ["Testing a gauntlet", "Repairing a pipe", "Chasing an elemental", "Arguing over math", "Overloading a coil", "Measuring mana-leak"],
            "Orzhov": ["Collecting a tithe", "Ghost-writing a contract", "Blessing a coin", "Extorting a merchant", "Escorting a spirit", "Repossessing furniture"],
            "Rakdos": ["Performance busking", "Taunting the law", "Juggling flaming daggers", "Staging a riot-skit", "Setting off pyrotechnics", "Vandalizing a statue"],
            "Selesnya": ["Preaching harmony", "Pruning a graft-tree", "Singing a choral hymn", "Offering free healing", "Distributing food", "Tending a garden-wall"],
            "Simic": ["Cataloging a mutation", "Releasing a specimen", "Collecting fluid samples", "Adjusting a tank's pH", "Grafting a limb", "Escaping a containment"],
            "Env": ["Steam-vent rupture", "Falling masonry", "Heavy acid-rain", "Crowded transit-jam", "Unstable bridge", "Sudden magical fog"],
            "Guildless": ["Pickpocketing a mark", "Begging for protection", "Loading a transit-cart", "Haggling over bread", "Moving a black-market crate", "Protesting guild-taxes"]
        },

        whatsHappening: [
            "The Clock Ticks (Deadline approaching)",
            "Optics Disaster (Press/Crowd watching)",
            "Collateral Risk (Fragile object nearby)",
            "Bureaucratic Snag (Warrant demand)",
            "Sudden Violence (Grudge boils over)",
            "Information Leak (Secret shouted aloud)"
        ],

        textures: {
            struct: {
            a: ["A load-bearing pillar", "A decorative cornice", "A ventilation grate", "A window frame", "A floor tile", "A support beam", "A doorway arch", "A drainage gutter", "A service hatch", "A handrail", "A alcove/niche", "A ceiling vault", "A lighting fixture", "A baseboard", "A cable-run", "A stair tread", "A wall sconce", "A partition wall", "A water basin", "A facade relief"],
            b: ["chipped limestone blocks", "oxidized copper sheeting", "heavy cast iron", "warped stained wood", "polished marble mosaic", "riveted Izzet-steel", "rough-hewn granite", "ceramic piping", "brittle rusted tin", "smooth cold brass", "plaster over brickwork", "reinforced concrete", "frosted glass globe", "rot-resistant fungal-wood", "exposed mana-coils", "slate worn smooth by use", "blackened wrought iron", "cheap plywood", "carved soapstone", "eroded stone"],
            c: ["wrapped in makeshift grip-tape", "stained with dark soot patterns", "vibrating with a low hum", "painted over multiple times", "cracked down the center", "dripping condensation constantly", "covered in layers of old posters", "clogged with grey sludge", "welded shut long ago", "greasy to the touch", "smelling faintly of urine/bleach", "webbed with fine stress fractures", "flickering rhythmically (dying)", "scratched by claws or heavy boots", "buzzing with static discharge", "uneven and loose", "empty and filled with trash", "covered in hasty graffiti tags", "covered in a thick layer of dust", "missing large chunks"]
        },
            guts: {
            a: ["A thick conduit pipe", "A bundle of wires", "A pneumatic tube", "A drainage sluice", "A pressure valve", "A chain-hoist", "A fuse box", "A ventilation fan", "A manhole cover", "A meter/gauge", "A structural clamp", "A waste bin", "A street lamp", "A gutter spout", "A control lever", "A glass insulator", "A pulley system", "A metal grate", "A boiler unit", "A cooling vent"],
            b: ["transporting steam heat", "relaying magical signals", "carrying guild-mail", "managing waste flow", "controlling water pressure", "moving cargo", "distributing local power", "cycling stale air", "accessing the sewer", "measuring mana-flow", "reinforcing seismic stress", "collecting public refuse", "providing illumination", "collecting rain run-off", "operating machinery", "grounding arcane energy", "vertical transport", "blocking entry", "generating heat", "venting alchemical exhaust"],
            c: ["hissing white vapor intermittently", "arcing blue sparks occasionally", "thumping loudly as items pass", "gurgling with thick liquid", "whistling a high-pitched note", "swinging slightly in a draft", "warm to the touch (overheating)", "clanking against its housing", "seeping a cold damp fog", "ticking loudly like a clock", "groaning under structural weight", "overflowing with refuse", "emitting a sickly yellow drone", "dripping rusty water", "rusted in the 'Open' position", "glowing with faint residual light", "creaking rhythmically", "rattling when walked upon", "smelling of burning dust", "venting acrid chemical air"]
        },
            debris: {
            a: ["A half-eaten skewer", "A crumpled broadsheet", "A broken vial", "A torn cloak/fabric", "A pile of cigarette ends", "A lost tool (wrench)", "A child's toy", "A stack of flyers", "A coin pouch (empty)", "A heavy boot print", "A cryptic chalk mark", "A dead rat/vermin"],
            b: ["kicked under a bench", "soaked in a puddle", "crushed into the dirt", "snagged on a nail", "heaped in a corner", "left on a ledge", "half-buried in mud", "wind-blown against a wall", "slit open on the ground", "dried in mud/clay", "scrawled on a door", "lying stiff near a vent"],
            c: ["abandoned in a hurry", "from three days ago (old news)", "containing traces of something illicit", "showing signs of a struggle", "suggesting someone waited a long time", "suggesting workers left mid-job", "dropped by a passerby", "promoting political propaganda", "evidence of a pickpocket", "belonging to a large humanoid", "a thief's sign or hobo-code", "killed by poison or gas"]
        },
            atmos: {
            a: ["Distant street lamps", "Bioluminescent moss", "Industrial floodlight", "Magical 'everflame'", "Moonlight", "Neon sign (Arcane)", "Furnace glow", "No direct source", "Hand-held lanterns", "Electrical arcing"],
            b: ["filtered through grey smog", "dim and sickly green", "harsh and washing-out white", "warm but weak orange", "blocked by buildings (blue)", "garish and buzzing pink", "smoldering and hot red", "ambient brown city-haze", "swinging yellow light", "sharp and sudden blue-white"],
            c: ["casting long stretching shadows", "pulsing slowly like a heartbeat", "blinking erratically", "flickering in a non-existent wind", "creating stark high-contrast silhouettes", "reflecting off wet surfaces", "illuminating dust motes in the air", "making depth perception difficult", "creating dancing shadows on walls", "strobing like a camera flash"]
        }
        },

        clueSigs: [
            { g: "Azorius", p: "Stamped wax seals, blue ink", s: "Precise, condescending", a: "Geometric, rigid ley-lines" },
            { g: "Boros", p: "Scorch marks, heavy boots", s: "Aggressive, duty-bound", a: "Radiant, flickering heat" },
            { g: "Dimir", p: "Paper-shreds, damp soot", s: "Vague, shifting details", a: "Chilled air, memory-gaps" },
            { g: "Golgari", p: "Moss, pungent rot, slime", s: "Laconic, fatalistic", a: "Necrotic residue, spores" },
            { g: "Gruul", p: "Shattered stone, claw-marks", s: "Primal, blunt, guttural", a: "Wild, chaotic static" },
            { g: "Izzet", p: "Melted glass, copper wire", s: "Rapid-fire, distracted", a: "Static electricity, ozone" },
            { g: "Orzhov", p: "Gold leaf, incense ash", s: "Formal, transactional", a: "Ethereal, chain-like wisps" },
            { g: "Rakdos", p: "Spilled wine, jagged metal", s: "Mocking, nihilistic", a: "Sulfur, crimson sparks" },
            { g: "Selesnya", p: "Pollen, woven vines", s: "Calming, plural ('We')", a: "Harmonious, green hum" },
            { g: "Simic", p: "Translucent fluid, scales", s: "Clinical, detached", a: "Fluorescent, biomorphic" }
        ],

        npcs: [
            { w: "Promotion (Climb hierarchy)", l: "Incriminating Logs (Graft proof)" },
            { w: "Anonymity (Hide past)", l: "Safehouse Key (Neutral ground)" },
            { w: "Debt Forgiveness (Orzhov contract)", l: "Encrypted Cipher (Unread msg)" },
            { w: "Guild Transfer (Way out)", l: "Smuggled Goods (Contraband)" },
            { w: "Protection (From rival)", l: "Eyewitness Account (Saw Incident)" },
            { w: "Information (Rival plans)", l: "Guild Seal (Stolen signet)" },
            { w: "Revenge (See rival disgraced)", l: "Blackmail Photo (Scandal)" },
            { w: "Resource Access (Rare permit)", l: "Access Codes (Vault/Portal)" },
            { w: "Family Safety (Hostage situation)", l: "Courier Schedule (Timing)" },
            { w: "Political Cover (Avoid blame)", l: "Expert Knowledge (Bypass)" },
            { w: "Pure Chaos (Burn it down)", l: "Explosive/Hazard (Fail-safe)" }
        ],

        hazards: [
            { roll: 2, name: "Izzet Arclight Grounding", eff: "1d6 Lightning dmg (DC 13 Dex). Metal armor = Disadv." },
            { roll: 3, name: "Simic Overgrowth", eff: "Difficult terrain. Move > half speed = DC 12 Dex or Prone." },
            { roll: 4, name: "Orzhov Tithe-Barrier", eff: "Pass: Pay 1 HD or 10gp. Else: Total Cover." },
            { roll: 5, name: "Rakdos Crowd Surge", eff: "Start of round: Push 10ft (DC 13 Str negates)." },
            { roll: 6, name: "Dimir Fog-Shroud", eff: "Heavily Obscured > 10ft. Disadv on Sight checks." },
            { roll: 7, name: "Verticality: Crumbling Masonry", eff: "Take >10 dmg? Floor breaks. DC 12 Dex or fall 20ft." },
            { roll: 8, name: "Golgari Spore Cloud", eff: "DC 12 Con or Poisoned 1 rnd. Stench attracts vermin." },
            { roll: 9, name: "Azorius Suppression Field", eff: "Cast Lvl 1+ spell? DC 13 Conc check or fail." },
            { roll: 10, name: "Gruul Rubble-Pile", eff: "High ground (+2 Ranged Atk), but primary target for Heat." },
            { roll: 11, name: "Selesnya Pollen Burst", eff: "No Multiattack/Aggressive unless DC 12 Wis save." },
            { roll: 12, name: "Boros Alarm-Beacon", eff: "Clock +1. Deafened w/in 30ft." }
        ],

        snags: {
            2: { n: "District-Wide Lockdown", e: "Hard Constraint: No entry without +2 Rep liaison." },
            3: { n: "Planar Bleed", e: "Intangible. DC 15 Arcana or tool to phase in. (Clock +1)" },
            4: { n: "Hostile Takeover", e: "Rival guild seized building. Stealth or Rep -1 to enter." },
            5: { n: "Biological Quarantine", e: "sealed by bio-mages. DC 14 Con or protective gear." },
            6: { n: "Witness is a Spirit", e: "Contractual Silence. Pay 100gp or Orzhov Favor." },
            7: { n: "Active Riot", e: "Rakdos/Gruul outside. DC 14 Group Athletics to enter." },
            8: { n: "Infrastructure Collapse", e: "Bridge/Transit down. (Clock +1) to find route." },
            9: { n: "Conflicting Warrants", e: "Rival Task Force here. Social check or 'lose' their papers." },
            10: { n: "The Tithe-Gate", e: "Entrance fee: 10gp or 1 Downtime Point per person." },
            11: { n: "Arcane Static", e: "Magic unstable. Spells trigger Wild Magic Surge." },
            12: { n: "Privacy Screen", e: "Dimir veil. Disadv on Social/Arcane inside." },
            13: { n: "Mandatory Escort", e: "Boros Peacekeeper watches. Heat +1. Witness intimidated." },
            14: { n: "Scheduled Demolition", e: "Set Piece: Building crumbles after 3 rounds." },
            15: { n: "The Wrong Ink", e: "Warrant color wrong. DC 12 Social or (Clock +1)." },
            16: { n: "Internal Audit", e: "Liaison watching. No Gold spending or Call-ins." },
            17: { n: "Language Barrier", e: "Obscure dialect. Language or DC 13 Insight." },
            18: { n: "Clerical Error", e: "Address off by one digit. DC 12 Deception or (Clock +1)." },
            19: { n: "The Queue", e: "50 people waiting. Wait 4 hrs (Clock +1) or Cut Line (Heat +1)." },
            20: { n: "The Boss is Out", e: "At summit. (Clock +1) or wait in lobby." },
            21: { n: "Standard Bureaucracy", e: "Form 12-B. No penalty, but failure = Heat +1." },
            22: { n: "Restricted Archive", e: "Building open, cabinet locked. DC 13 Thieves Tools." },
            23: { n: "Shift Change", e: "Friendly guards left. New ones are Neutral (Rep 0)." },
            24: { n: "Vocal-Only Policy", e: "Truth-Stone recording. Cannot lie (DC 14 Deception)." },
            25: { n: "Cleaning Crew", e: "Golgari recycling scene. DC 13 Athletics to save clues." },
            26: { n: "Press Ambush", e: "Reporter at exit. Social challenge or Heat +1." },
            27: { n: "Guild Solidarity", e: "Staff refuse to talk to non-guild members. Disguise Kit." },
            28: { n: "Equipment Check", e: "Weapons checked at door. Enter unarmed or sneak in." },
            29: { n: "Mana-Drought", e: "No spell slots 2nd+ regained during rest here." },
            30: { n: "Zonot Drainage", e: "Flooded. Difficult Terrain (Swimming)." },
            31: { n: "Spore-Clog", e: "Fungus in locks. Str checks Disadvantage." },
            32: { n: "Petty Grievance", e: "Clerk hates a PC. Rep -1 (Temp)." },
            33: { n: "Selesnya Conclave", e: "Meditation circle blocks hall. Join (1hr) or Push (DC 14)." },
            34: { n: "The Tail", e: "You were followed. 'Complication Scene' triggers on exit." },
            35: { n: "Subpoenaed Evidence", e: "Item moved to Azorius Vault. Redirect Lead." },
            36: { n: "Explosive Gas Leak", e: "Izzet chem. Fire = 3d6 explosion (DC 13 Dex)." },
            37: { n: "Orzhov Foreclosure", e: "Building being disassembled by spirits. Gone in 2 hrs." },
            38: { n: "High-Level Escort", e: "Bumped for Guildmaster. Wait (Clock +1) or Heat +1." },
            39: { n: "Magical Interference", e: "Forget-Me-Not ward. DC 12 Wis every 10 min or forget goal." },
            40: { n: "Divine Intervention", e: "Holy Ground. No violence/lying possible." }
        },

        papers: [
            { n: "The Tenth District Chronicle", t: "Sensationalist", e: "Heat +1 (Alarm)" },
            { n: "The Azorius Gazette", t: "Legalistic", e: "Heat +1 (Internal Affairs)" },
            { n: "The Gruul Rubble-Rant", t: "Anarchic", e: "No Change (Ignored)" },
            { n: "The Izzet Inquiry", t: "Technical", e: "Heat -1 (If fast)" },
            { n: "The Boros Banner", t: "Heroic", e: "Heat -1 (Public Trust)" },
            { n: "The Orzhov Ledger", t: "Financial", e: "Heat -1 (If cheap)" }
        ],

        guildRefs: [
            { n: "Azorius", j: "Public/Warrant", b: "Legal Shield (Negate Heat)" },
            { n: "Boros", j: "Military Escort", b: "Fireteam (2 Veterans)" },
            { n: "Dimir", j: "Hidden/Archives", b: "Surveillance (Auto-Physical)" },
            { n: "Golgari", j: "Sewer/Rot", b: "Forensics (Corpse Speak)" },
            { n: "Gruul", j: "Ruins/None", b: "Local Guide (Ignore Terrain)" },
            { n: "Izzet", j: "Labs/Safety", b: "Tech-Scan (Magic ID)" },
            { n: "Orzhov", j: "Vaults/Tithe", b: "Bribe Fund (Auto-Social)" },
            { n: "Rakdos", j: "Clubs/Perform", b: "Distraction (Remove NPC)" },
            { n: "Selesnya", j: "Enclaves", b: "Healer (Short Rest)" },
            { n: "Simic", j: "Bio-Vats", b: "Mutation Scan (Weakness)" }
        ]
    },

    clue: {
        guilds: [
            {
                id: 'azorius', name: 'Azorius', icon: '⚖️',
                phys: [
                    { core: "a rigid legal writ", surf: "stamped with blue wax seals" },
                    { core: "a pair of rusted manacles", surf: "etched with a precinct number" },
                    { core: "a discarded statute book", surf: "marked with corrective red ink" },
                    { core: "a marble gavel", surf: "chipped from heavy use" },
                    { core: "a zoning permit", surf: "filed in triplicate" },
                    { core: "a smashed precog-crystal", surf: "housed in geometric steel" },
                    { core: "a patrolling sphinx's feather", surf: "stiff and metallic to the touch" },
                    { core: "an arrest report", surf: "signed by a Justiciar" },
                    { core: "a stone column fragment", surf: "carved with the Guildpact seal" },
                    { core: "a confiscation lock-box", surf: "sealed with magic-dampening lead" }
                ],
                soc: [
                    { core: "a precise lawmage", surf: "citing obscure statutes" },
                    { core: "a bored desk clerk", surf: "demanding Form 12-B" },
                    { core: "a stern arrester", surf: "looking for a reason to detain you" },
                    { core: "a precognitive mage", surf: "claiming they saw this yesterday" },
                    { core: "a vedalken administrator", surf: "obsessed with the timeline" },
                    { core: "a judge's scribe", surf: "taking shorthand notes furiously" },
                    { core: "a gargoyle patroller", surf: "perched silently above" },
                    { core: "an imperious knight", surf: "refusing to speak to civilians" },
                    { core: "a bureaucratic functionary", surf: "worried about their lunch break" },
                    { core: "a retired senator", surf: "complaining about the 'old days'" }
                ],
                arc: [
                    { core: "a geometric stasis-glyph", surf: "humming with Law-magic" },
                    { core: "a zone of silence", surf: "enforced by white runes" },
                    { core: "a truth-compulsion aura", surf: "tasting like cold iron" },
                    { core: "a detainment sphere", surf: "fading into blue mist" },
                    { core: "a scrying sensor", surf: "scanning for illegal magic" },
                    { core: "a Hieromancy echo", surf: "ordering you to halt" },
                    { core: "a ward against lying", surf: "burning when you speak" },
                    { core: "a residual shielding spell", surf: "forming perfect triangles" },
                    { core: "a spectral gavel", surf: "ringing with psychic force" },
                    { core: "a blindfold of justice", surf: "blocking arcane sight" }
                ]
            },
            {
                id: 'boros', name: 'Boros', icon: '⚔️',
                phys: [
                    { core: "a dented gauntlet", surf: "scorched by radiant heat" },
                    { core: "a shattered sun-blade", surf: "still warm to the touch" },
                    { core: "a tattered red banner", surf: "stained with soot and blood" },
                    { core: "a military medal", surf: "torn from a uniform" },
                    { core: "a heavy boot print", surf: "cracking the pavement" },
                    { core: "a discarded whetstone", surf: "worn down to a nub" },
                    { core: "a minotaur's horn-ring", surf: "etched with a legion number" },
                    { core: "a fragment of slag", surf: "smelling of the forge" },
                    { core: "a garrison key", surf: "heavy and iron-cast" },
                    { core: "a broken signal-horn", surf: "crushed by a heavy blow" }
                ],
                soc: [
                    { core: "an aggressive legionnaire", surf: "demanding immediate compliance" },
                    { core: "a goblin trench-fighter", surf: "itching for a brawl" },
                    { core: "a righteous paladin", surf: "preaching zeal and fire" },
                    { core: "a weary sergeant", surf: "cleaning their blade" },
                    { core: "a minotaur trooper", surf: "blocking the doorway" },
                    { core: "a sky-knight's squire", surf: "polishing armor" },
                    { core: "a flame-kin scout", surf: "burning with impatience" },
                    { core: "a retired veteran", surf: "showing off their scars" },
                    { core: "a combat medic", surf: "tending to a wound" },
                    { core: "a angel-touched captain", surf: "radiating terrifying authority" }
                ],
                arc: [
                    { core: "a flickering radiant aura", surf: "smelling of forge-smoke" },
                    { core: "a holy fire residue", surf: "singing nearby fabrics" },
                    { core: "a lingering war-shout", surf: "echoing psychically" },
                    { core: "a circle of protection", surf: "glowing with red light" },
                    { core: "a beam of sunlight", surf: "persisting in the dark" },
                    { core: "a healing magic trace", surf: "tingling with warmth" },
                    { core: "a zealot's mark", surf: "burned into the stone" },
                    { core: "a lightning-helix scar", surf: "crackling weakly" },
                    { core: "a spectral shield", surf: "pushing back intruders" },
                    { core: "a summoning rune", surf: "calling for backup" }
                ]
            },
            {
                id: 'dimir', name: 'Dimir', icon: '👁️',
                phys: [
                    { core: "a strip of cipher-paper", surf: "dissolving into smoke" },
                    { core: "a black glass dagger", surf: "coated in sleeping poison" },
                    { core: "a dark velvet cloak", surf: "damp with sewer fog" },
                    { core: "a memory-vial", surf: "swirling with blue mist" },
                    { core: "a skeleton key", surf: "made of shadowy metal" },
                    { core: "a throwing star", surf: "embedded in the ceiling" },
                    { core: "a hidden drop-box", surf: "concealed behind a brick" },
                    { core: "a forged identity paper", surf: "perfectly replicated" },
                    { core: "a destroyed journal", surf: "shredded into confetti" },
                    { core: "a surveillance beetle", surf: "crushed underfoot" }
                ],
                soc: [
                    { core: "a vague informant", surf: "hiding in the shadows" },
                    { core: "a shapeshifter", surf: "forgetting their current face" },
                    { core: "a librarian", surf: "hoarding secrets" },
                    { core: "a street urchin", surf: "watching with too-old eyes" },
                    { core: "a mind-mage", surf: "reading your surface thoughts" },
                    { core: "a nervous courier", surf: "carrying a blank letter" },
                    { core: "a double agent", surf: "playing both sides" },
                    { core: "a ghost agent", surf: "whispering from a vent" },
                    { core: "a night-market broker", surf: "trading in rumors" },
                    { core: "a sleeper agent", surf: "waking up confused" }
                ],
                arc: [
                    { core: "a psychic memory-thread", surf: "chilled by necrotic cold" },
                    { core: "a shadow-weave", surf: "darkening the corners" },
                    { core: "a thought-surveillance eye", surf: "blinking out of existence" },
                    { core: "a memory-hole", surf: "where details are missing" },
                    { core: "a whisper-network echo", surf: "repeating a name" },
                    { core: "a sleep-spell residue", surf: "making you yawn" },
                    { core: "an illusionary wall", surf: "flickering when touched" },
                    { core: "a telepathic stain", surf: "causing a headache" },
                    { core: "a necromantic chill", surf: "frosting the glass" },
                    { core: "a nightmare trace", surf: "triggering fear" }
                ]
            },
            {
                id: 'golgari', name: 'Golgari', icon: '🍄',
                phys: [
                    { core: "a petrified insect husk", surf: "covered in vibrant moss" },
                    { core: "a compost-encrusted boot", surf: "smelling of the undercity" },
                    { core: "a jar of rot-salve", surf: "bubbling with fermentation" },
                    { core: "a stone elf ear", surf: "chipped from a statue" },
                    { core: "a gorgon's scale", surf: "turning dust to stone" },
                    { core: "a fungal spore-pod", surf: "ready to burst" },
                    { core: "a reclaimed bone tool", surf: "scrimshawed with runes" },
                    { core: "a patch of sewer-slime", surf: "glowing faintly green" },
                    { core: "a beetle-shell shield", surf: "cracked down the middle" },
                    { core: "a recycler's hook", surf: "rusted and dull" }
                ],
                soc: [
                    { core: "a fatalistic rot-farmer", surf: "surrounded by insects" },
                    { core: "a dark elf shaman", surf: "speaking for the dead" },
                    { core: "a kraul warrior", surf: "clicking its mandibles" },
                    { core: "a sewer-guide", surf: "covered in muck" },
                    { core: "a gorgon recluse", surf: "hiding her gaze" },
                    { core: "a spore-druid", surf: "growing mushrooms on their clothes" },
                    { core: "a corpse-collector", surf: "hauling a heavy cart" },
                    { core: "an undercity hermit", surf: "eating something questionable" },
                    { core: "a troll bouncer", surf: "regenerating a wound" },
                    { core: "a fungus-symbiote", surf: "merging with the wall" }
                ],
                arc: [
                    { core: "a necrotic spore-cloud", surf: "reeking of pungent rot" },
                    { core: "a regrowth aura", surf: "sprouting weeds from stone" },
                    { core: "a death-magic stain", surf: "withered nearby plants" },
                    { core: "a petrification echo", surf: "stiffening your joints" },
                    { core: "a poison-mist residue", surf: "burning your lungs" },
                    { core: "a reanimation trace", surf: "making shadows twitch" },
                    { core: "a swarm-mind connection", surf: "buzzing in your ears" },
                    { core: "a decomposition field", surf: "accelerating rust" },
                    { core: "a life-drain signature", surf: "feeling cold and damp" },
                    { core: "a fungal bloom", surf: "pulsing with heartbeat" }
                ]
            },
            {
                id: 'gruul', name: 'Gruul', icon: '🔥',
                phys: [
                    { core: "a smashed stone totem", surf: "smeared with war-paint" },
                    { core: "a crude stone axe", surf: "bound with leather" },
                    { core: "a boar-tusk necklace", surf: "strung on gut" },
                    { core: "a patch of graffiti", surf: "marking clan territory" },
                    { core: "a pile of rubble", surf: "recently demolished" },
                    { core: "a beast-hide tent scrap", surf: "smelling of wet fur" },
                    { core: "a giant's footprint", surf: "crushing a crate" },
                    { core: "a broken siege-arrow", surf: "thick as a limb" },
                    { core: "a ritual bonfire pit", surf: "still smoldering" },
                    { core: "a looting sack", surf: "spilled open" }
                ],
                soc: [
                    { core: "a hostile wasteland scout", surf: "shouting primal threats" },
                    { core: "a two-headed ogre", surf: "arguing with itself" },
                    { core: "a beast-breaker", surf: "calming a hydra" },
                    { core: "a raid-leader", surf: "demanding tribute" },
                    { core: "a shaman", surf: "predicting the End-Raze" },
                    { core: "a rubble-child", surf: "throwing rocks" },
                    { core: "a centaur charger", surf: "pawing the ground" },
                    { core: "a goblin raider", surf: "stealing shiny bits" },
                    { core: "a wild-druid", surf: "hating the pavement" },
                    { core: "a cyclops brute", surf: "blocking the street" }
                ],
                arc: [
                    { core: "a chaotic elemental spark", surf: "crackling with red/green static" },
                    { core: "an earth-tremor echo", surf: "shaking the dust" },
                    { core: "a rage-magic aura", surf: "making blood boil" },
                    { core: "a primal growth surge", surf: "shattering concrete" },
                    { core: "a fire-storm residue", surf: "blackening the walls" },
                    { core: "a beast-bond link", surf: "smelling of musk" },
                    { core: "a destruction rune", surf: "glowing angrily" },
                    { core: "a storm-caller's mark", surf: "wet with rain" },
                    { core: "a wild-magic surge", surf: "tasting like copper" },
                    { core: "a spirit-totem ward", surf: "howling faintly" }
                ]
            },
            {
                id: 'izzet', name: 'Izzet', icon: '⚡',
                phys: [
                    { core: "a twisted copper coil", surf: "smelling of sharp ozone" },
                    { core: "a shattered glass capacitor", surf: "leaking blue fluid" },
                    { core: "a mana-pressure gauge", surf: "stuck in the red" },
                    { core: "a goblin's welding goggles", surf: "cracked and sooty" },
                    { core: "a blueprint schematic", surf: "covered in coffee stains" },
                    { core: "a weird-containment unit", surf: "hissing steam" },
                    { core: "a lightning-rod tip", surf: "melted by a strike" },
                    { core: "a mizzium strut", surf: "bent by force" },
                    { core: "a laboratory notebook", surf: "filled with frantic math" },
                    { core: "a gravity-inverter", surf: "floating inches off the ground" }
                ],
                soc: [
                    { core: "a manic researcher", surf: "covered in soot and oil" },
                    { core: "a goblin test-pilot", surf: "missing eyebrows" },
                    { core: "a chemister", surf: "mixing volatile vials" },
                    { core: "a blast-seeker", surf: "twitching with energy" },
                    { core: "a ley-line surveyor", surf: "ignoring safety protocols" },
                    { core: "an elementalist", surf: "followed by a spark" },
                    { core: "a laboratory assistant", surf: "putting out a fire" },
                    { core: "a vedalken engineer", surf: "judging your equipment" },
                    { core: "a steam-vent worker", surf: "shouting over the noise" },
                    { core: "a guild-mage", surf: "overloading a spell" }
                ],
                arc: [
                    { core: "an unstable mana-flux", surf: "vibrating with electric current" },
                    { core: "a gravity-well", surf: "pulling debris inward" },
                    { core: "a teleportation error", surf: "smelling of sulfur" },
                    { core: "a storm-charge", surf: "making hair stand up" },
                    { core: "a heat-haze", surf: "shimmering in the air" },
                    { core: "a time-dilation bubble", surf: "slowing dust motes" },
                    { core: "an elemental residue", surf: "puddling on the floor" },
                    { core: "a sonic boom echo", surf: "ringing in your ears" },
                    { core: "a spell-copy trace", surf: "repeating itself" },
                    { core: "a mizzium-burn", surf: "glowing purple" }
                ]
            },
            {
                id: 'orzhov', name: 'Orzhov', icon: '🪙',
                phys: [
                    { core: "a gilded debt-contract", surf: "dusted with funeral ash" },
                    { core: "a gold coin", surf: "stamped with a ghost's face" },
                    { core: "a black wax candle", surf: "burning with a white flame" },
                    { core: "a gargoyle fragment", surf: "leaking black oil" },
                    { core: "a tithe-collection box", surf: "heavier than it looks" },
                    { core: "a stained-glass shard", surf: "depicting a saint" },
                    { core: "a spirit-mask", surf: "cold as the grave" },
                    { core: "a velvet alms-pouch", surf: "stained with wine" },
                    { core: "a thrull's collar", surf: "etched with runes" },
                    { core: "a ledger of sins", surf: "bound in pale leather" }
                ],
                soc: [
                    { core: "a guilt-tripping pontiff", surf: "demanding a tithe" },
                    { core: "a blind advokist", surf: "reading a contract" },
                    { core: "a spirit-debtor", surf: "moaning in chains" },
                    { core: "a knight-enforcer", surf: "clanking with gold armor" },
                    { core: "a thrull servant", surf: "obeying silently" },
                    { core: "a coin-mage", surf: "weighing your soul" },
                    { core: "a basilica guard", surf: "blocking the archway" },
                    { core: "a death-priest", surf: "blessing a corpse" },
                    { core: "a syndicate banker", surf: "calculating interest" },
                    { core: "a ghost-council envoy", surf: "floating through a wall" }
                ],
                arc: [
                    { core: "a spectral spirit-chain", surf: "weighing heavy on the soul" },
                    { core: "a life-drain aura", surf: "feeling cold and gray" },
                    { core: "a gold-sickness curse", surf: "tasting of metal" },
                    { core: "a command-word echo", surf: "forcing you to kneel" },
                    { core: "a necrotic residue", surf: "wilting flowers" },
                    { core: "a spirit-guard ward", surf: "watching with dead eyes" },
                    { core: "a silence-spell", surf: "muting all sound" },
                    { core: "a radiance-burn", surf: "searing with holy light" },
                    { core: "a blood-pact sign", surf: "glowing crimson" },
                    { core: "a haunting melody", surf: "drifting from nowhere" }
                ]
            },
            {
                id: 'rakdos', name: 'Rakdos', icon: '🎭',
                phys: [
                    { core: "a jagged spiked chain", surf: "splattered with dried blood" },
                    { core: "a harlequin mask", surf: "grinning maniacally" },
                    { core: "a broken torch", surf: "smelling of lamp oil" },
                    { core: "a rusty cage segment", surf: "bent bars" },
                    { core: "a performer's silk sash", surf: "torn and muddy" },
                    { core: "a fire-juggler's pin", surf: "blackened by soot" },
                    { core: "a demon-bone charm", surf: "warm to the touch" },
                    { core: "a stage-prop dagger", surf: "sharpened to a real edge" },
                    { core: "a festival flyer", surf: "advertising a 'Killer Show'" },
                    { core: "a tightrope wire", surf: "coiled like a snake" }
                ],
                soc: [
                    { core: "a mocking performance artist", surf: "laughing inappropriately" },
                    { core: "a knife-juggler", surf: "playing with a blade" },
                    { core: "a demon-cultist", surf: "chanting a rhyme" },
                    { core: "a chain-devil", surf: "rattling their bindings" },
                    { core: "a ringmaster", surf: "inviting you inside" },
                    { core: "a pain-artist", surf: "covered in piercings" },
                    { core: "a goblin pyromancer", surf: "lighting a fuse" },
                    { core: "a blood-witch", surf: "stirring a cauldron" },
                    { core: "a muscle-bound ogre", surf: "wearing a tiny hat" },
                    { core: "a riot-instigator", surf: "shouting at the crowd" }
                ],
                arc: [
                    { core: "a burning hell-rune", surf: "smelling of sulfur" },
                    { core: "a pain-spike aura", surf: "causing a migraine" },
                    { core: "a madness-echo", surf: "making you giggle" },
                    { core: "a shadow-dance trace", surf: "moving on its own" },
                    { core: "a fire-breath residue", surf: "scorching the ceiling" },
                    { core: "a demon-summoning circle", surf: "drawn in blood" },
                    { core: "a fear-spike", surf: "making your heart race" },
                    { core: "a confusion-mist", surf: "smelling of cheap perfume" },
                    { core: "a chaos-spark", surf: "popping like fireworks" },
                    { core: "a blood-lust enchantment", surf: "making fists clench" }
                ]
            },
            {
                id: 'selesnya', name: 'Selesnya', icon: '🌳',
                phys: [
                    { core: "a woven living-wood token", surf: "dusted with golden pollen" },
                    { core: "a crystal seed", surf: "glowing with inner light" },
                    { core: "a white granite stone", surf: "perfectly polished" },
                    { core: "a wolf-rider's saddle", surf: "smelling of leather" },
                    { core: "a dryad's flower-crown", surf: "still blooming" },
                    { core: "a conclave pamphlet", surf: "preaching unity" },
                    { core: "a healer's kit", surf: "filled with salves" },
                    { core: "an arrow with a leaf-fletching", surf: "tipped with silver" },
                    { core: "a root-woven barrier", surf: "withered and brown" },
                    { core: "a sun-amulet", surf: "reflecting the light" }
                ],
                soc: [
                    { core: "a serene evangelist", surf: "speaking in the plural 'We'" },
                    { core: "a dryad guardian", surf: "merging with a tree" },
                    { core: "a wolf-riding knight", surf: "watching the perimeter" },
                    { core: "a loxodon hierarch", surf: "offering wisdom" },
                    { core: "a centaur archer", surf: "stringing a bow" },
                    { core: "a conclave recruiter", surf: "smiling too widely" },
                    { core: "a vernacular healer", surf: "offering a potion" },
                    { core: "a garden-tender", surf: "ignoring the city" },
                    { core: "a song-weaver", surf: "humming a tune" },
                    { core: "a trostani-priest", surf: "judging your aura" }
                ],
                arc: [
                    { core: "a harmonious light-beam", surf: "connecting to nearby life" },
                    { core: "a growth-surge aura", surf: "making weeds bloom" },
                    { core: "a calming wave", surf: "soothing your anger" },
                    { core: "a summon-pact trace", surf: "smelling of loam" },
                    { core: "a shared-mind echo", surf: "hearing many voices" },
                    { core: "a barrier-ward", surf: "glowing soft white" },
                    { core: "a healing pulse", surf: "closing small cuts" },
                    { core: "a root-strangle residue", surf: "cracking the floor" },
                    { core: "a sun-burst scorch", surf: "bleaching the color" },
                    { core: "a truth-sense field", surf: "vibrating with clarity" }
                ]
            },
            {
                id: 'simic', name: 'Simic', icon: '🧬',
                phys: [
                    { core: "a glass vial of bio-fluid", surf: "coated in translucent slime" },
                    { core: "a shed reptile skin", surf: "shimmering with colors" },
                    { core: "a crab-claw implant", surf: "discarded and bloody" },
                    { core: "a growth-chamber valve", surf: "dripping green goo" },
                    { core: "a notebook of mutations", surf: "waterproof and waxy" },
                    { core: "a coral-encrusted key", surf: "smelling of brine" },
                    { core: "a syringe gun", surf: "loaded with blue serum" },
                    { core: "a preserved specimen", surf: "floating in a jar" },
                    { core: "a krasis scale", surf: "harder than steel" },
                    { core: "a bio-hazard warning sign", surf: "etched in glass" }
                ],
                soc: [
                    { core: "a clinical biomancer", surf: "examining you like a specimen" },
                    { core: "a shark-hybrid warrior", surf: "flexing new gills" },
                    { core: "a merfolk terraformer", surf: "adjusting water levels" },
                    { core: "a zonot guide", surf: "covered in algae" },
                    { core: "a rapid-evolutionist", surf: "twitching with mutations" },
                    { core: "a medical researcher", surf: "holding a scalpel" },
                    { core: "a frog-lizard chimera", surf: "croaking inquisitively" },
                    { core: "a bio-engineer", surf: "taking notes on your biology" },
                    { core: "a deep-sea scout", surf: "dripping saltwater" },
                    { core: "a growth-vat attendant", surf: "smelling of chemicals" }
                ],
                arc: [
                    { core: "a spiral energy pattern", surf: "shifting and evolving color" },
                    { core: "a mutation-aura", surf: "making your skin itch" },
                    { core: "a growth-accel trace", surf: "expanding moss rapidly" },
                    { core: "a bio-luminescent glow", surf: "pulsing in the dark" },
                    { core: "a water-pressure field", surf: "feeling heavy and wet" },
                    { core: "a gene-splice echo", surf: "feeling alien" },
                    { core: "a slime-coat residue", surf: "making the floor slick" },
                    { core: "a cryogenic chill", surf: "fogging your breath" },
                    { core: "a venom-magic signature", surf: "burning your eyes" },
                    { core: "an adaptation-ward", surf: "changing to match attacks" }
                ]
            }
        ],

        frictions: [
            "Water-Damaged", "Booby-Trapped", "Locked / Encrypted", "Contaminated",
            "Heavily Guarded", "Culturally Taboo", "Physically Stuck", "Magically Warded",
            "Currently Burning", "Moving Target", "Buried in Trash", "Incomplete"
        ],

        costs: [
            "Clock +1", "Heat +1", "Resource Cost", "Reputation -1", "Minor Injury",
            "Exhaustion", "Info Leak", "Set-Piece Trigger", "Disadvantage", "Spell Slot Drain"
        ]
    }
};
