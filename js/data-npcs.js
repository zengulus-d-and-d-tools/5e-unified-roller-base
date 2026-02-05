(function (global) {
    global.PRELOADED_NPCS = [
        // --- AZORIUS SENATE ---
        {
            name: "Ardra Venn",
            guild: "Azorius Senate",
            wants: "Clean paperwork, zero scandal",
            leverage: "Will delay you 'for procedure' unless optics are perfect",
            notes: "Writ Registrar (Vedalken). Meticulous, status-conscious, quietly punitive."
        },
        {
            name: "Justiciar Halvok",
            guild: "Azorius Senate",
            wants: "Decisive precedent",
            leverage: "Escalates conflicts with rigid rulings",
            notes: "Field Magistrate (Human). Severe, decisive, doctrinaire."
        },
        {
            name: "Scribe-Medium Kalis",
            guild: "Azorius Senate",
            wants: "Proof the law is being 'rewritten'",
            leverage: "Hears things that aren’t always true",
            notes: "Archive Occultist (Human). Soft-spoken, obsessive, unsettlingly calm."
        },

        // --- ORZHOV SYNDICATE ---
        {
            name: "Advokist Seraphine Dusk",
            guild: "Orzhov Syndicate",
            wants: "Leverage in every outcome",
            leverage: "Redefines 'help' as 'ownership'",
            notes: "Contract Litigator (Vampire). Elegant, ruthless, never wastes a word."
        },
        {
            name: "Tithe-Priest Malchor",
            guild: "Orzhov Syndicate",
            wants: "Order through obligation",
            leverage: "Escalates to intimidation too fast",
            notes: "Parish Enforcer (Human). Sanctimonious, intimidating, easily offended."
        },
        {
            name: "Mortuary Factor Ilona Vex",
            guild: "Orzhov Syndicate",
            wants: "Assets recovered",
            leverage: "The dead may have competing claimants",
            notes: "Post-Death Accounts (Human). Cold, precise, relentlessly practical."
        },

        // --- GRUUL CLANS ---
        {
            name: "Skarrgate Vorn",
            guild: "Gruul Clans",
            wants: "Humiliation of 'soft walls'",
            leverage: "Tests you with chaos to see if you 'deserve' it",
            notes: "Clan Pathfinder (Centaur). Proud, confrontational, respects strength and candor."
        },
        {
            name: "Riot-Drummer Saska",
            guild: "Gruul Clans",
            wants: "A target to blame",
            leverage: "Will ignite a scene if bored",
            notes: "Crowd Agitator (Human). Volatile, charismatic, bored by peace."
        },
        {
            name: "Stone-Talker Hreg",
            guild: "Gruul Clans",
            wants: "Ancient sites unmolested",
            leverage: "Refuses any plan that 'restores' civilization",
            notes: "Old-Ruin Keeper (Cyclops). Stoic, literal-minded, anciently resentful."
        },

        // --- SIMIC COMBINE ---
        {
            name: "Dr. Ovara Nix",
            guild: "Simic Combine",
            wants: "Samples and data",
            leverage: "Treats ethics as 'a parameter'",
            notes: "Field Researcher (Merfolk). Curious, detached, politely invasive."
        },
        {
            name: "Clade Warden Rho-9",
            guild: "Simic Combine",
            wants: "Containment over consent",
            leverage: "Will 'secure' witnesses as specimens",
            notes: "Security Specialist (Vedalken). Disciplined, clinical, quietly authoritarian."
        },
        {
            name: "Splice-Runner Tamsin",
            guild: "Simic Combine",
            wants: "Protection from prosecution",
            leverage: "Is currently hiding a dangerous subject",
            notes: "Black-Clinic Fixer (Simic Hybrid). Charming, evasive, pragmatically guilty."
        },

        // --- SELESNYA CONCLAVE ---
        {
            name: "Vernadi Heartrill",
            guild: "Selesnya Conclave",
            wants: "Harmony (sometimes coercively)",
            leverage: "Suppresses 'discordant' truths",
            notes: "Conclave Mediator (Loxodon). Gentle, relentless, quietly intimidating."
        },
        {
            name: "Ward-Gardener Pelen",
            guild: "Selesnya Conclave",
            wants: "Safety of the enclave",
            leverage: "Refuses tactics that risk innocents—even strategically",
            notes: "District Protector (Elf). Steadfast, compassionate, stubborn about rules."
        },
        {
            name: "Chorus-Speaker Anwen",
            guild: "Selesnya Conclave",
            wants: "Expose corruption without schism",
            leverage: "The chorus can turn into a mob",
            notes: "Voice of Many (Human). Inspiring, judgmental, convinced of their mandate."
        },

        // --- CULT OF RAKDOS ---
        {
            name: "Ringmaster Kiv",
            guild: "Cult of Rakdos",
            wants: "Spectacle without crackdown",
            leverage: "Lies for drama—even when truth is better",
            notes: "Showrunner (Tiefling). Flamboyant, manipulative, allergic to boredom."
        },
        {
            name: "Knife-Dancer Ressa",
            guild: "Cult of Rakdos",
            wants: "A patron’s protection",
            leverage: "Draws danger to prove a point",
            notes: "Crowd Whisperer (Human). Magnetic, cruelly playful, thrill-seeking."
        },
        {
            name: "Stagehand “Ash”",
            guild: "Cult of Rakdos",
            wants: "To stay invisible",
            leverage: "Sells gear to anyone who pays",
            notes: "Rigging & Traps (Goblin). Quiet, sardonic, resentful of stars."
        },

        // --- HOUSE DIMIR ---
        {
            name: "Nexis Vale",
            guild: "House Dimir",
            wants: "Narrative control",
            leverage: "Every favor costs a future favor",
            notes: "Public Relations Consultant (Human). Charming, patient, predatory polite."
        },
        {
            name: "Cipher Adept Lura",
            guild: "House Dimir",
            wants: "Access to your evidence",
            leverage: "May 'improve' memories",
            notes: "Memory-Forensics (Vedalken). Clinical, curious, morally flexible."
        },
        {
            name: "Courier Sable",
            guild: "House Dimir",
            wants: "To stay unobserved",
            leverage: "Brings info that is true-but-weaponized",
            notes: "Dead-Drop Specialist (Human). Laconic, hypervigilant, allergic to attention."
        },

        // --- GOLGARI SWARM ---
        {
            name: "Rotwarden Ilvra",
            guild: "Golgari Swarm",
            wants: "Surface respect for undercity boundaries",
            leverage: "Expects reciprocity in 'reclamation rights'",
            notes: "Tunnel Steward (Devkarin Elf). Pragmatic, territorial, easily insulted by 'surface manners'."
        },
        {
            name: "Moldspeaker Jhett",
            guild: "Golgari Swarm",
            wants: "A cycle restored",
            leverage: "Speaks in riddles; mistakes metaphor for instruction",
            notes: "Spore Prophet (Devkarin Elf). Dreamy, cryptic, eerily sincere."
        },
        {
            name: "Grave-Broker Nolka",
            guild: "Golgari Swarm",
            wants: "Debts paid (in coin or favors)",
            leverage: "Sells the same secret twice",
            notes: "Body Contracts (Human). Amiable, calculating, never surprised."
        },

        // --- IZZET LEAGUE ---
        {
            name: "Enginseer Tovin Raal",
            guild: "Izzet League",
            wants: "Keep the lights on, credit intact",
            leverage: "Downplays risks until they explode",
            notes: "Transit Systems Lead (Goblin). Brilliant, defensive, thrives under crisis."
        },
        {
            name: "Lab Chief Pira Soot",
            guild: "Izzet League",
            wants: "Fewer disasters, more budget",
            leverage: "Will quarantine a whole district",
            notes: "Containment Officer (Vedalken). Anxious, exacting, catastrophizes accurately."
        },
        {
            name: "Spark-Runner Eilo",
            guild: "Izzet League",
            wants: "Not to be blamed",
            leverage: "Carries unstable devices 'for later'",
            notes: "Prototype Courier (Human). Reckless, upbeat, catastrophically optimistic."
        },

        // --- BOROS LEGION ---
        {
            name: "Captain Mira Kord",
            guild: "Boros Legion",
            wants: "Results and public safety",
            leverage: "Bristles at 'bureaucrats' and may act first",
            notes: "Precinct Commander (Human). Direct, protective, impatient with politics."
        },
        {
            name: "Sunhome Chaplain Daro",
            guild: "Boros Legion",
            wants: "Virtue maintained under pressure",
            leverage: "Pushes confessions that create blowback",
            notes: "Morale & Discipline (Minotaur). Stern, paternal, uncompromising."
        },
        {
            name: "Legion Scout “Spoke”",
            guild: "Boros Legion",
            wants: "A name cleared",
            leverage: "Owes favors to someone you’d rather not meet",
            notes: "Rooftop Runner (Goblin). Fast-talking, loyal, paranoid."
        },

        // ================= GUILDMASTERS (RTR ERA) =================

        {
            name: "Isperia, Supreme Judge",
            guild: "Azorius Senate",
            wants: "Unknown: To predict and prevent lawlessness before it manifests",
            leverage: "Unknown: Her scope of knowledge allows her to dismiss non-compliant logic instantly",
            notes: "Sphinx. Aloof, majestic, views the city as a variable-heavy equation."
        },
        {
            name: "The Obzedat (Ghost Council)",
            guild: "Orzhov Syndicate",
            wants: "Unknown: Eternal accumulation of wealth and stagnating stability",
            leverage: "Unknown: They hold the debts of your ancestors and can collect them from you",
            notes: "Council of Spirits. Greedy, archaic, dismissive of mortal timescales."
        },
        {
            name: "Lazav",
            guild: "House Dimir",
            wants: "Unknown. Possibly unknowable.",
            leverage: "Unknown. Possibly unknowable.",
            notes: "Shapeshifter. Paranoiac, theatrical, impossible to pin down."
        },
        {
            name: "Niv-Mizzet",
            guild: "Izzet League",
            wants: "Unknown: To understand the metaphysical lattice of the plane",
            leverage: "Unknown: His intellect is so far above yours that your survival is a rounding error",
            notes: "Dragon. Narcissistic, brilliant, easily bored by smaller minds."
        },
        {
            name: "Rakdos",
            guild: "Cult of Rakdos",
            wants: "Unknown: To be entertained by something he hasn't seen in 10,000 years",
            leverage: "Unknown: His waking causes riot-fevers in the populace",
            notes: "Demon. Hedonistic, terrifyingly casual, lethargic until provoked."
        },
        {
            name: "Jarad vod Savo",
            guild: "Golgari Swarm",
            wants: "Unknown: The surface world to rot just enough to feed the roots",
            leverage: "Unknown: He can reanimate the ground you stand on",
            notes: "Lich Lord (Elf). Brooding, vengeful, physically powerful."
        },
        {
            name: "Borborygmos",
            guild: "Gruul Clans",
            wants: "Unknown: To crush the weak and feast on the spoils",
            leverage: "Unknown: Negotiations are usually interrupted by a boulder",
            notes: "Cyclops. Enormous, simple-minded, speaks in monosyllabic shouts."
        },
        {
            name: "Aurelia",
            guild: "Boros Legion",
            wants: "Unknown: Justice delivered swiftly, without the Senate's delays",
            leverage: "Unknown: She leads from the front; to defy her is to defy the entire legion",
            notes: "Angel. Passionate, militant, intolerant of hesitation."
        },
        {
            name: "Trostani",
            guild: "Selesnya Conclave",
            wants: "Unknown: To subsume all individuals into the Worldsoul",
            leverage: "Unknown: Can turn your own community support system against you",
            notes: "Dryad Triad. Harmonious yet dissonant, gentle yet inexorable."
        },
        {
            name: "Prime Speaker Zegana",
            guild: "Simic Combine",
            wants: "Unknown: To accelerate the natural evolution of Ravnica's citizens",
            leverage: "Unknown: She represents the ocean's depth—you are out of your element",
            notes: "Merfolk. Regal, intellectual, fiercely protective of the Fathom."
        }
    ];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
