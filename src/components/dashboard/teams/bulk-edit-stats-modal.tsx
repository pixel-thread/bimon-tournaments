"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Spinner,
    Checkbox,
} from "@heroui/react";
import { Pencil, Clipboard, ClipboardPaste, ArrowLeftRight } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ═══════ Types ═══════ */

interface MatchTeam {
    teamId: string;
    teamName: string;
    teamNumber: number;
    position: number;
    players: {
        id: string;
        displayName: string | null;
        username: string;
        imageUrl: string | null;
        kills: number;
        present: boolean;
    }[];
}

interface MatchData {
    id: string;
    matchNumber: number;
    phase?: string | null;
    teams: MatchTeam[];
}

interface EditableTeam {
    teamId: string;
    teamName: string;
    teamNumber: number;
    position: string;
    players: {
        playerId: string;
        name: string;
        displayName: string | null;
        username: string;
        kills: string;
        isAbsent: boolean;
    }[];
}

interface EditableMatch {
    matchId: string;
    matchNumber: number;
    teams: EditableTeam[];
    topTeamsLabel: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    matchId: string;
    matches?: { id: string; matchNumber: number }[];
    phaseFilter?: string;
}

/* ═══════ Helpers ═══════ */

const normalizeName = (name: string) =>
    name
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, " ")
        .trim();


/* ═══════ Component ═══════ */

export function BulkEditStatsModal({
    isOpen,
    onClose,
    tournamentId,
    matchId,
    matches = [],
    phaseFilter,
}: Props) {
    const isAllMode = matchId === "all";
    const queryClient = useQueryClient();

    // ── State ──
    const [showMatchSelector, setShowMatchSelector] = useState(false);
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
    const [matchDataList, setMatchDataList] = useState<EditableMatch[]>([]);
    const [initialMatchDataList, setInitialMatchDataList] = useState<EditableMatch[]>([]);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [unknownPlayers, setUnknownPlayers] = useState<Array<{ name: string; kills: number; matchIdx: number }>>([]);
    const [changeNotes, setChangeNotes] = useState<string[]>([]);


    // ── Fetch match data ──
    const { data: allMatches, isLoading } = useQuery<MatchData[]>({
        queryKey: ["match-stats", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/matches?tournamentId=${tournamentId}`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: isOpen && !!tournamentId,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });

    // Show match selector when in "all" mode; otherwise pre-select the single match
    useEffect(() => {
        if (!isOpen) {
            setHasInitialized(false);
            setMatchDataList([]);
            setInitialMatchDataList([]);
            setSelectedMatchIds(new Set());
            setShowMatchSelector(false);
            setUnknownPlayers([]);
            setChangeNotes([]);

            return;
        }
        if (isAllMode) {
            setShowMatchSelector(true);
        } else {
            setSelectedMatchIds(new Set([matchId]));
            setShowMatchSelector(false);
        }
    }, [isOpen, isAllMode, matchId]);

    // Build editable data from selected matches
    const relevantMatches = useMemo(() => {
        if (!allMatches) return [];
        return allMatches.filter((m) => selectedMatchIds.has(m.id));
    }, [allMatches, selectedMatchIds]);

    useEffect(() => {
        if (relevantMatches.length > 0 && !hasInitialized && !showMatchSelector) {
            const data: EditableMatch[] = relevantMatches.map((match) => ({
                matchId: match.id,
                matchNumber: match.matchNumber,
                topTeamsLabel: "",
                teams: match.teams.map((t) => ({
                    teamId: t.teamId,
                    teamName: t.teamName,
                    teamNumber: t.teamNumber,
                    position: String(t.position || ""),
                    players: t.players.map((p) => ({
                        playerId: p.id,
                        name: p.displayName || p.username,
                        displayName: p.displayName,
                        username: p.username,
                        kills: !p.present ? "" : (p.kills != null && p.kills !== undefined ? String(p.kills) : ""),
                        isAbsent: !p.present,
                    })),
                })),
            }));
            data.sort((a, b) => a.matchNumber - b.matchNumber);
            setMatchDataList(data);
            setInitialMatchDataList(JSON.parse(JSON.stringify(data)));
            setHasInitialized(true);
            setUnknownPlayers([]);
            setChangeNotes([]);
        }
    }, [relevantMatches, hasInitialized, showMatchSelector]);

    // ── Detect changes ──
    const hasChanges = useMemo(() => {
        return changeNotes.length > 0;
    }, [changeNotes]);

    // ── Compute change notes ──
    const computeChangeNotes = useCallback((newData: EditableMatch[]) => {
        const changes: string[] = [];
        for (let mIdx = 0; mIdx < newData.length && mIdx < initialMatchDataList.length; mIdx++) {
            const newMatch = newData[mIdx];
            const oldMatch = initialMatchDataList[mIdx];
            if (!oldMatch) continue;
            for (let tIdx = 0; tIdx < newMatch.teams.length && tIdx < oldMatch.teams.length; tIdx++) {
                const newTeam = newMatch.teams[tIdx];
                const oldTeam = oldMatch.teams[tIdx];
                if (!oldTeam) continue;
                const oldPos = String(oldTeam.position || "");
                const newPos = String(newTeam.position || "");
                if (oldPos !== newPos) {
                    changes.push(`📍 M${newMatch.matchNumber} ${newTeam.teamName}: Pos ${oldPos || "?"} → ${newPos || "?"}`);
                }
                for (let pIdx = 0; pIdx < newTeam.players.length && pIdx < oldTeam.players.length; pIdx++) {
                    const np = newTeam.players[pIdx];
                    const op = oldTeam.players[pIdx];
                    if (!op) continue;
                    const ok = op.kills === "" ? "" : String(op.kills);
                    const nk = np.kills === "" ? "" : String(np.kills);
                    if (ok !== nk) {
                        changes.push(`🎯 M${newMatch.matchNumber} ${np.displayName || np.name}: Kills ${ok || "–"} → ${nk || "–"}`);
                    }
                    if (op.isAbsent !== np.isAbsent) {
                        changes.push(`👤 M${newMatch.matchNumber} ${np.displayName || np.name}: ${op.isAbsent ? "Absent → Present" : "Present → Absent"}`);
                    }
                }
            }
        }
        return changes;
    }, [initialMatchDataList]);

    // ── Handlers ──
    const handlePositionChange = (matchIdx: number, teamIdx: number, value: string) => {
        const newData = [...matchDataList];
        const match = { ...newData[matchIdx] };
        const teams = [...match.teams];
        teams[teamIdx] = { ...teams[teamIdx], position: value };
        match.teams = teams;
        newData[matchIdx] = match;
        setMatchDataList(newData);
        setChangeNotes(computeChangeNotes(newData));
    };

    const handleKillsChange = (matchIdx: number, teamIdx: number, playerIdx: number, value: string) => {
        const newData = [...matchDataList];
        const match = { ...newData[matchIdx] };
        const teams = [...match.teams];
        const team = { ...teams[teamIdx] };
        const players = [...team.players];
        players[playerIdx] = { ...players[playerIdx], kills: value };
        team.players = players;
        teams[teamIdx] = team;
        match.teams = teams;
        newData[matchIdx] = match;
        setMatchDataList(newData);
        setChangeNotes(computeChangeNotes(newData));
    };

    const handleToggleAbsent = (matchIdx: number, teamIdx: number, playerIdx: number) => {
        const newData = [...matchDataList];
        const match = { ...newData[matchIdx] };
        const teams = [...match.teams];
        const team = { ...teams[teamIdx] };
        const players = [...team.players];
        const p = { ...players[playerIdx] };
        p.isAbsent = !p.isAbsent;
        if (p.isAbsent) {
            p.kills = "";
        } else {
            // Restore original kills value when marking present again
            const origPlayer = initialMatchDataList[matchIdx]?.teams[teamIdx]?.players[playerIdx];
            if (origPlayer) p.kills = origPlayer.kills;
        }
        players[playerIdx] = p;
        team.players = players;
        teams[teamIdx] = team;
        match.teams = teams;
        newData[matchIdx] = match;
        setMatchDataList(newData);
        setChangeNotes(computeChangeNotes(newData));
    };

    const handleSwapMatches = () => {
        if (matchDataList.length < 2) return;
        const newData = [...matchDataList];
        const t0 = newData[0].teams;
        const l0 = newData[0].topTeamsLabel;
        newData[0] = { ...newData[0], teams: newData[1].teams, topTeamsLabel: newData[1].topTeamsLabel };
        newData[1] = { ...newData[1], teams: t0, topTeamsLabel: l0 };
        setMatchDataList(newData);
        setChangeNotes(computeChangeNotes(newData));
        toast.success("Match data swapped!");
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

    // ── Copy Prompt ──
    const copyPrompt = useCallback(() => {
        if (matchDataList.length === 0) { toast.error("No teams loaded"); return; }

        // Collect players from all selected matches
        const allPlayers = new Map<string, string>();
        const allTeams = new Map<string, string[]>();
        matchDataList.forEach((md) => {
            md.teams.forEach((team) => {
                const teamPlayers: string[] = [];
                team.players.forEach((p) => {
                    const display = p.displayName || p.name;
                    const key = (p.username || p.name).toLowerCase();
                    if (!allPlayers.has(key)) {
                        allPlayers.set(key, display !== p.username ? `${display} (userName: ${p.username})` : p.name);
                    }
                    teamPlayers.push(display);
                });
                if (!allTeams.has(team.teamName)) allTeams.set(team.teamName, teamPlayers);
            });
        });

        const totalPlayers = allPlayers.size;
        const totalTeams = allTeams.size;
        const numMatches = matchDataList.length;
        const isSingle = numMatches === 1;

        const prompt = isSingle
            ? `You are extracting stats from a BGMI (Battlegrounds Mobile India) match scoreboard.

═══════════════════════════════════════
1. SCOREBOARD LAYOUT (HOW TO READ)
═══════════════════════════════════════
Each scoreboard has TWO panels:

LEFT PANEL: Shows #1 and #2 teams
  - #1 team has a CROWN icon, #2 has a silver medal
  - Each player row: [PlayerName] ... [N finishes] or [N finish]
  - "finishes" = kills. Read the NUMBER before "finishes"/"finish"

RIGHT PANEL: Shows positions #3 through #14 (scrollable)
  - Each position block: big number on left, then player rows
  - Each player row: [PlayerName] ... [N finishes]

MULTIPLE IMAGES: The scoreboard scrolls, so you may receive 2-4 screenshots. They all belong to the SAME single match — combine them into ONE JSON array.

═══════════════════════════════════════
2. HOW TO READ KILLS (VERY IMPORTANT)
═══════════════════════════════════════
- Look at the RIGHT side of each player row
- You will see: "N finishes" or "N finish" (where N is a number)
- The number N = kills for that player
- "0 finishes" means the player played but got 0 kills
- Common misread: the stylized font can make numbers hard to read. Double-check each one.

═══════════════════════════════════════
3. REGISTERED PLAYERS TO MATCH
═══════════════════════════════════════
${totalTeams} teams, ${totalPlayers} players:
${Array.from(allTeams.entries()).map(([name, players]) => `• ${name}: ${players.join(", ")}`).join("\n")}

═══════════════════════════════════════
4. NAME MATCHING RULES
═══════════════════════════════════════
BGMI names use heavy Unicode decoration. Strip these when matching:
- Japanese/Chinese chars: 乂 乙 々 戦 威 挨 ツ り ﾑ 尺 ズ 亗 모
- Symbols: £ ✓ ◈ ★ ꧁ ꧂ 乄
- The CORE readable part is what matters
- If a player has "(userName: xxx)" shown, try matching by userName too
- In output, use the EXACT name from MY list, NOT the scoreboard's version
- Example: if scoreboard shows "ツREAL乂SNAR" and my list has "ツREAL乂SNAR", return "ツREAL乂SNAR"

═══════════════════════════════════════
5. NULL vs 0 — CRITICAL DISTINCTION
═══════════════════════════════════════
- kills: 0 → Player IS VISIBLE in the scoreboard showing "0 finishes" (PRESENT)
- kills: null → Player is NOT in ANY screenshot (ABSENT/didn't play)

❌ WRONG: {"kills": 0} for a player you can't find → should be null
✅ RIGHT: {"kills": 0} ONLY if you physically see them with "0 finishes"
✅ RIGHT: {"kills": null} if you searched all images and didn't find them

═══════════════════════════════════════
6. STEP-BY-STEP WORKFLOW
═══════════════════════════════════════
  a) Read EVERY player visible in the images, noting: name, kills (N finishes), position (#)
  b) Match each scoreboard name to my player list
  c) For players in my list NOT found in any image → kills: null, position: null
  d) For scoreboard players NOT matching anyone in my list → add with isUnknown: true
  e) VERIFY: count how many players you marked present vs absent

═══════════════════════════════════════
7. OUTPUT FORMAT
═══════════════════════════════════════
[
  {"name": "exact_name_from_my_list", "kills": 5, "position": 1},
  {"name": "player_with_0_finishes", "kills": 0, "position": 3},
  {"name": "NOT_found_in_any_image", "kills": null, "position": null},
  {"name": "unknown_scoreboard_name", "kills": 3, "position": 2, "isUnknown": true}
]

═══════════════════════════════════════
8. UNKNOWN PLAYERS (DO NOT SKIP)
═══════════════════════════════════════
After matching all my players, check for ANY remaining scoreboard players you couldn't match.
- Add each with "isUnknown": true and their EXACT scoreboard name
- Example: scoreboard shows "xXDarkKnight" with no match → {"name": "xXDarkKnight", "kills": 2, "position": 4, "isUnknown": true}

═══════════════════════════════════════
9. FINAL CHECKLIST (DO THIS BEFORE RESPONDING)
═══════════════════════════════════════
□ All ${totalPlayers} players from my list are included
□ Absent players have kills: null (NOT 0)
□ Present players with "0 finishes" have kills: 0
□ Names in output match MY list exactly (not scoreboard versions)
□ Positions are correct (1-14 range)
□ Unknown scoreboard players included with isUnknown: true
□ Re-read any kill counts you're unsure about — zoom in on the number before "finishes"

After the JSON, confirm:
Found: X/${totalPlayers} | Absent: Y | Unknown: Z
⚠️ Uncertain matches: scoreboard_name → matched_name`

            // ── Multi-match prompt ──
            : `You are extracting stats from ${numMatches} BGMI (Battlegrounds Mobile India) match scoreboard screenshots.

═══════════════════════════════════════
1. SCOREBOARD LAYOUT (HOW TO READ)
═══════════════════════════════════════
Each scoreboard has TWO panels:

LEFT PANEL: Shows #1 and #2 teams
  - #1 team has a CROWN icon, #2 has a silver medal
  - Each player row: [PlayerName] ... [N finishes] or [N finish]
  - "finishes" = kills. Read the NUMBER before "finishes"/"finish"

RIGHT PANEL: Shows positions #3 through #14 (scrollable)
  - Each position block: big number on left, then player rows
  - Each player row: [PlayerName] ... [N finishes]

MULTIPLE IMAGES per match: The scoreboard scrolls, so one match may have 2-4 screenshots. Images showing the SAME #1 and #2 teams (same players, same kills) belong to the SAME match.

═══════════════════════════════════════
2. HOW TO READ KILLS (VERY IMPORTANT)
═══════════════════════════════════════
- Look at the RIGHT side of each player row
- You will see: "N finishes" or "N finish" (where N is a number)
- The number N = kills for that player
- "0 finishes" means the player played but got 0 kills
- Common misread: the stylized font can make numbers hard to read. Double-check each one.

═══════════════════════════════════════
3. REGISTERED PLAYERS TO MATCH
═══════════════════════════════════════
${totalTeams} teams, ${totalPlayers} players:
${Array.from(allTeams.entries()).map(([name, players]) => `• ${name}: ${players.join(", ")}`).join("\n")}

═══════════════════════════════════════
4. NAME MATCHING RULES
═══════════════════════════════════════
BGMI names use heavy Unicode decoration. Strip these when matching:
- Japanese/Chinese chars: 乂 乙 々 戦 威 挨 ツ り ﾑ 尺 ズ 亗 모
- Symbols: £ ✓ ◈ ★ ꧁ ꧂ 乄
- The CORE readable part is what matters
- Example: scoreboard "乙ïMINING" → match to "乙ïMINING" in my list
- If a player has "(userName: xxx)" shown, try matching by userName too
- In output, use the EXACT name from MY list, NOT the scoreboard's version

═══════════════════════════════════════
5. NULL vs 0 — CRITICAL DISTINCTION
═══════════════════════════════════════
- kills: 0 → Player IS VISIBLE in the scoreboard showing "0 finishes" (PRESENT)
- kills: null → Player is NOT in ANY screenshot for this match (ABSENT/didn't play)

❌ WRONG: {"kills": 0} for a player you can't find → should be null
✅ RIGHT: {"kills": 0} ONLY if you physically see them with "0 finishes"
✅ RIGHT: {"kills": null} if you searched all images and didn't find them

═══════════════════════════════════════
6. STEP-BY-STEP WORKFLOW
═══════════════════════════════════════
For EACH match group:
  a) Identify which images belong together (same #1 and #2 teams)
  b) Read EVERY player visible in those images, noting: name, kills (N finishes), position (#)
  c) Match each scoreboard name to my player list
  d) For players in my list NOT found in any image → kills: null, position: null
  e) For scoreboard players NOT matching anyone in my list → add with isUnknown: true
  f) VERIFY: count how many players you marked present vs absent. For ${totalPlayers} players, typically 30-40 are present and 0-14 are absent (the ones not in the match)

═══════════════════════════════════════
7. OUTPUT FORMAT
═══════════════════════════════════════
{
  "matches": [
    {
      "identifier": "A",
      "topTeams": "#1 PlayerName1 (Nkills) #2 PlayerName2 (Nkills)",
      "players": [
        {"name": "exact_name_from_my_list", "kills": 5, "position": 1},
        {"name": "player_with_0_finishes", "kills": 0, "position": 3},
        {"name": "NOT_found_in_any_image", "kills": null, "position": null},
        {"name": "unknown_scoreboard_name", "kills": 3, "position": 2, "isUnknown": true}
      ]
    }
  ]
}

═══════════════════════════════════════
8. UNKNOWN PLAYERS (DO NOT SKIP)
═══════════════════════════════════════
After matching all my players, check for ANY remaining scoreboard players you couldn't match.
- Add each with "isUnknown": true and their EXACT scoreboard name
- Example: scoreboard shows "xXDarkKnight" with no match → {"name": "xXDarkKnight", "kills": 2, "position": 4, "isUnknown": true}

═══════════════════════════════════════
9. FINAL CHECKLIST (DO THIS BEFORE RESPONDING)
═══════════════════════════════════════
□ Each match has ALL ${totalPlayers} players from my list
□ Absent players have kills: null (NOT 0)
□ Present players with "0 finishes" have kills: 0
□ Names in output match MY list exactly (not scoreboard versions)
□ Positions are correct (1-14 range)
□ Unknown scoreboard players included with isUnknown: true
□ Re-read any kill counts you're unsure about — zoom in on the number before "finishes"

After the JSON, confirm:
Match A: #1 team, #2 team | Found: X, Absent: Y, Unknown: Z
Match B: #1 team, #2 team | Found: X, Absent: Y, Unknown: Z`;

        navigator.clipboard.writeText(prompt);
        toast.success("Prompt copied to clipboard!");
    }, [matchDataList]);

    // ── Process AI JSON (single array or multi-match {matches:[...]}) ──
    const processJsonText = useCallback((text: string) => {
        if (!matchDataList || matchDataList.length === 0) return;
        if (!text.trim()) { toast.error("No JSON data"); return; }

        try {
            const data = JSON.parse(text);

            // Determine format: {matches: [...]} or flat array [...]
            type AIPlayer = { name: string; kills: number | null; position?: number | null; isUnknown?: boolean };
            type AIMatchGroup = { identifier?: string; topTeams?: string; players: AIPlayer[] };

            let matchGroups: AIMatchGroup[];
            if (data.matches && Array.isArray(data.matches)) {
                matchGroups = data.matches;
            } else if (Array.isArray(data)) {
                // Single flat array → wrap as one match group
                matchGroups = [{ players: data }];
            } else {
                throw new Error("Expected {matches: [...]} or flat array [...]");
            }

            if (matchGroups.length === 0) throw new Error("No match data found");

            if (matchGroups.length !== matchDataList.length && matchGroups.length > 1) {
                toast.warning(`Found ${matchGroups.length} match groups, expected ${matchDataList.length}. Proceeding with available data.`);
            }

            const newUnknownPlayers: Array<{ name: string; kills: number; matchIdx: number }> = [];

            // Build name maps per match
            const matchPlayerMaps = matchDataList.map((md) => {
                const nameMap = new Map<string, { teamIdx: number; playerIdx: number }>();
                md.teams.forEach((team, ti) => {
                    team.players.forEach((p, pi) => {
                        nameMap.set(normalizeName(p.name), { teamIdx: ti, playerIdx: pi });
                        if (p.username) nameMap.set(normalizeName(p.username), { teamIdx: ti, playerIdx: pi });
                        if (p.displayName) nameMap.set(normalizeName(p.displayName), { teamIdx: ti, playerIdx: pi });
                    });
                });
                return nameMap;
            });

            const newMatchDataList = matchDataList.map((matchData, matchIdx) => {
                const aiGroup = matchGroups[matchIdx];
                if (!aiGroup) return matchData;

                const playerMap = matchPlayerMaps[matchIdx];
                const teamPositions = new Map<string, number>();

                // Reset all players to absent first, then mark present ones from AI
                const newTeams = matchData.teams.map((team) => ({
                    ...team,
                    position: "" as string,
                    players: team.players.map((p) => ({
                        ...p,
                        kills: "" as string,
                        isAbsent: true,
                    })),
                }));

                aiGroup.players.forEach((aiPlayer) => {
                    if (aiPlayer.isUnknown || aiPlayer.kills === null) {
                        if (aiPlayer.isUnknown && aiPlayer.kills !== null) {
                            newUnknownPlayers.push({ name: aiPlayer.name, kills: aiPlayer.kills, matchIdx });
                        }
                        return;
                    }

                    const norm = normalizeName(aiPlayer.name);
                    const loc = playerMap.get(norm);
                    if (loc) {
                        newTeams[loc.teamIdx].players[loc.playerIdx].kills = String(aiPlayer.kills);
                        newTeams[loc.teamIdx].players[loc.playerIdx].isAbsent = false;
                        if (aiPlayer.position && !teamPositions.has(newTeams[loc.teamIdx].teamId)) {
                            teamPositions.set(newTeams[loc.teamIdx].teamId, aiPlayer.position);
                        }
                    }
                });

                newTeams.forEach((t) => {
                    const pos = teamPositions.get(t.teamId);
                    if (pos) t.position = String(pos);
                });

                return {
                    ...matchData,
                    teams: newTeams,
                    topTeamsLabel: aiGroup.topTeams || aiGroup.identifier || "",
                };
            });

            // Always show change notes comparing against saved data
            setChangeNotes(computeChangeNotes(newMatchDataList));
            setMatchDataList(newMatchDataList);
            setUnknownPlayers(newUnknownPlayers);
            toast.success(`Applied data for ${Math.min(matchGroups.length, matchDataList.length)} match(es)!`);
        } catch (err: unknown) {
            toast.error((err as Error).message || "Invalid JSON");
        }
    }, [matchDataList, computeChangeNotes]);

    // Handle paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData("text");
        if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
            e.preventDefault();
            processJsonText(text);
        }
    }, [processJsonText]);

    // ── Save ──
    const { mutate: saveStats, isPending } = useMutation({
        mutationFn: async () => {
            for (const matchData of matchDataList) {
                const stats = matchData.teams.map((t) => ({
                    teamId: t.teamId,
                    position: parseInt(t.position) || 0,
                    players: t.players.map((p) => ({
                        playerId: p.playerId,
                        kills: p.isAbsent ? 0 : (parseInt(p.kills) || 0),
                        present: !p.isAbsent,
                    })),
                }));
                const res = await fetch("/api/teams/bulk-stats", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tournamentId, matchId: matchData.matchId, stats }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || `Failed M${matchData.matchNumber}`);
            }
        },
        onSuccess: () => {
            toast.success("All matches saved!");
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            queryClient.invalidateQueries({ queryKey: ["matches"] });
            queryClient.invalidateQueries({ queryKey: ["match-stats"] });
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // ── Proceed from match selector ──
    const handleProceed = () => {
        setHasInitialized(false);
        setShowMatchSelector(false);
    };

    // Filter matches by phase when in championship mode
    const visibleMatches = useMemo(() => {
        if (!allMatches || !phaseFilter) return allMatches;
        return allMatches.filter((m) => m.phase === phaseFilter);
    }, [allMatches, phaseFilter]);

    // ── Render ──
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside" classNames={{ base: "max-w-6xl max-h-[90vh]" }}>
            <ModalContent>
                <ModalHeader className="flex items-center justify-between gap-2 flex-wrap border-b">
                    <div className="flex items-center gap-2">
                        <Pencil className="h-5 w-5" />
                        <span>
                            {showMatchSelector
                                ? `Select Matches to Edit (${visibleMatches?.length || 0} available)`
                                : `Bulk Edit Stats (${matchDataList.length} match${matchDataList.length > 1 ? "es" : ""})`
                            }
                        </span>
                    </div>
                    {!showMatchSelector && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="flat" startContent={<Clipboard className="h-3.5 w-3.5" />} onPress={copyPrompt}>
                                Copy Prompt
                            </Button>
                            <Button
                                size="sm" variant="flat" color="secondary"
                                startContent={<ClipboardPaste className="h-3.5 w-3.5" />}
                                onPress={async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        processJsonText(text);
                                    } catch {
                                        toast.error("Use Ctrl+V to paste");
                                    }
                                }}
                            >
                                Paste JSON
                            </Button>
                            {matchDataList.length >= 2 && (
                                <Button size="sm" variant="flat" startContent={<ArrowLeftRight className="h-3.5 w-3.5" />} onPress={handleSwapMatches}>
                                    Swap
                                </Button>
                            )}
                        </div>
                    )}
                </ModalHeader>

                <ModalBody onPaste={!showMatchSelector ? handlePaste : undefined} className="p-0">
                    {/* ── Match Selector ── */}
                    {showMatchSelector && (
                        <div className="p-4 space-y-4">
                            {isLoading ? (
                                <div className="flex justify-center py-8"><Spinner /></div>
                            ) : (
                                <>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="flat" onPress={() => {
                                            if (visibleMatches) setSelectedMatchIds(new Set(visibleMatches.map((m) => m.id)));
                                        }}>Select All</Button>
                                        <Button size="sm" variant="flat" onPress={() => setSelectedMatchIds(new Set())}>Clear</Button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {visibleMatches?.map((match, idx) => {
                                            const isSelected = selectedMatchIds.has(match.id);
                                            return (
                                                <div
                                                    key={match.id}
                                                    onClick={() => {
                                                        const s = new Set(selectedMatchIds);
                                                        if (s.has(match.id)) s.delete(match.id); else s.add(match.id);
                                                        setSelectedMatchIds(s);
                                                    }}
                                                    className={`p-4 rounded-lg border cursor-pointer transition-colors text-center ${isSelected ? "bg-primary/20 border-primary" : "bg-default-100 border-divider hover:bg-default-200"
                                                        }`}
                                                >
                                                    <Checkbox isSelected={isSelected} size="sm" className="pointer-events-none" />
                                                    <div className="font-semibold">Match {idx + 1}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Edit View ── */}
                    {!showMatchSelector && (
                        <div className="p-4">
                            {isLoading ? (
                                <div className="flex justify-center py-8"><Spinner /></div>
                            ) : (
                                <div className={`grid gap-4 ${matchDataList.length > 1 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                                    {matchDataList.map((matchData, matchIdx) => (
                                        <div key={matchData.matchId} className="border border-divider rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-semibold text-base">Match {matchData.matchNumber}</h3>
                                                {matchData.topTeamsLabel && (
                                                    <span className="text-xs text-foreground/40 max-w-[60%] truncate">{matchData.topTeamsLabel}</span>
                                                )}
                                            </div>

                                            <div className={`space-y-2 overflow-y-auto ${changeNotes.length > 0 ? "max-h-[40vh] lg:max-h-[50vh]" : "max-h-[55vh] lg:max-h-[65vh]"}`}>
                                                {matchData.teams.map((team, teamIdx) => {
                                                    const hasData = team.position !== "" || team.players.some((p) => p.kills !== "" || p.isAbsent);
                                                    return (
                                                        <div
                                                            key={team.teamId}
                                                            className={`rounded-lg border border-divider p-3 ${hasData ? "bg-success/10 border-success/30" : teamIdx % 2 === 0 ? "bg-default-50" : "bg-default-100/50"
                                                                }`}
                                                        >
                                                            {/* Team header with clickable player names */}
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                                                                    <span className="text-sm font-medium whitespace-nowrap">
                                                                        {team.players.map((player, pIdx) => (
                                                                            <span key={player.playerId}>
                                                                                {pIdx > 0 && "_"}
                                                                                <span
                                                                                    onClick={() => handleToggleAbsent(matchIdx, teamIdx, pIdx)}
                                                                                    className={`cursor-pointer hover:underline ${player.isAbsent ? "text-danger" : ""}`}
                                                                                    title={`Click to ${player.isAbsent ? "mark present" : "mark absent"}`}
                                                                                >
                                                                                    {player.displayName || player.name}
                                                                                </span>
                                                                            </span>
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <span className="text-[10px] text-foreground/40">#</span>
                                                                    <Input
                                                                        size="sm" type="number"
                                                                        value={team.position}
                                                                        onValueChange={(v) => handlePositionChange(matchIdx, teamIdx, v)}
                                                                        onFocus={handleFocus}
                                                                        className="w-14"
                                                                        classNames={{ inputWrapper: "h-7 min-h-7" }}
                                                                        placeholder="#"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Players — full-width rows */}
                                                            <div className="space-y-1">
                                                                {team.players.map((p, pi) => (
                                                                    <div
                                                                        key={p.playerId}
                                                                        onClick={() => handleToggleAbsent(matchIdx, teamIdx, pi)}
                                                                        className={`flex items-center gap-2 rounded px-2 py-1 cursor-pointer hover:bg-default-200/50 transition-colors ${p.isAbsent ? "ring-1 ring-danger/40" : "bg-default-100/50"
                                                                            }`}
                                                                        title={`Click to ${p.isAbsent ? "mark present" : "mark absent"}`}
                                                                    >
                                                                        <span className={`text-xs flex-1 min-w-0 select-none ${p.isAbsent ? "text-danger font-medium line-through" : ""}`}>
                                                                            {p.displayName || p.name}
                                                                        </span>
                                                                        <Input
                                                                            size="sm" type="number"
                                                                            value={p.kills}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onValueChange={(v) => handleKillsChange(matchIdx, teamIdx, pi, v)}
                                                                            onFocus={handleFocus}
                                                                            isDisabled={p.isAbsent}
                                                                            className="w-14"
                                                                            classNames={{ inputWrapper: "h-6 min-h-6" }}
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Unknown players */}
                            {unknownPlayers.length > 0 && (
                                <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3">
                                    <p className="text-xs font-semibold text-warning mb-1">🆕 Unknown Players ({unknownPlayers.length})</p>
                                    <p className="text-xs text-warning/80">
                                        {unknownPlayers.slice(0, 10).map((p) => `${p.name} (M${matchDataList[p.matchIdx]?.matchNumber || "?"})`).join(", ")}
                                        {unknownPlayers.length > 10 && ` +${unknownPlayers.length - 10} more`}
                                    </p>
                                </div>
                            )}

                            {/* Change notes */}
                            {changeNotes.length > 0 && (
                                <div className="mt-4 rounded-lg border border-secondary/30 bg-secondary/10 p-3 max-h-32 overflow-y-auto">
                                    <p className="text-xs font-semibold text-secondary mb-2">🔄 Changes from saved data ({changeNotes.length})</p>
                                    <div className="text-[10px] text-secondary/80 space-y-0.5 font-mono">
                                        {changeNotes.slice(0, 20).map((note, idx) => (
                                            <div key={idx}>{note}</div>
                                        ))}
                                        {changeNotes.length > 20 && <div className="text-secondary">+{changeNotes.length - 20} more...</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="border-t">
                    {showMatchSelector ? (
                        <>
                            <Button variant="flat" onPress={onClose} size="sm">Cancel</Button>
                            <Button color="primary" size="sm" isDisabled={selectedMatchIds.size === 0} onPress={handleProceed}>
                                Proceed ({selectedMatchIds.size} selected)
                            </Button>
                        </>
                    ) : (
                        <>
                            {isAllMode && (
                                <Button variant="flat" size="sm" onPress={() => { setShowMatchSelector(true); setHasInitialized(false); }}>
                                    ← Back
                                </Button>
                            )}
                            <Button variant="flat" onPress={onClose} size="sm">Cancel</Button>
                            <Button
                                color="primary" size="sm"
                                onPress={() => saveStats()}
                                isLoading={isPending}
                                isDisabled={!hasChanges}
                            >
                                Save {matchDataList.length > 1 ? `All (${matchDataList.length} matches)` : "Stats"}
                            </Button>
                        </>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
