const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const majority = (votes, options) => {
    const counts = {};
    options.forEach(o => { counts[o] = 0; });
    votes.forEach(v => {
        if (counts[v] !== undefined) counts[v]++;
    });
    let best = options[0];
    let bestN = -1;
    options.forEach(o => {
        if (counts[o] > bestN) {
            bestN = counts[o];
            best = o;
        }
    });
    const tied = options.filter(o => counts[o] === bestN);
    return { winner: tied.length > 1 ? pick(tied) : best, counts, tied: tied.length > 1 };
};

/** Full session script (~30 min at default timers). */
const ROUND_SCRIPT = [
    { id: 'cold_open', act: 0, title: 'ORIENTATION', type: 'unanimous', systemLine: 'Welcome to Compliance Module 7.' },
    { id: 'button_1', act: 1, title: 'INCIDENT 01', type: 'button', systemLine: 'Briefings will now reflect your performance zones.' },
    { id: 'code_1', act: 1, title: 'INCIDENT 02', type: 'code', systemLine: null },
    { id: 'budget_1', act: 1, title: 'INCIDENT 03', type: 'budget', systemLine: 'Act I complete. Alignment improving.' },
    { id: 'witness_1', act: 2, title: 'INCIDENT 04', type: 'witness', systemLine: 'Audit probability elevated.' },
    { id: 'veto_1', act: 2, title: 'INCIDENT 05', type: 'veto', systemLine: null },
    { id: 'button_2', act: 2, title: 'INCIDENT 06', type: 'button', systemLine: 'Trust your department.' },
    { id: 'order_1', act: 2, title: 'INCIDENT 07', type: 'order', systemLine: null },
    { id: 'button_3', act: 3, title: 'INCIDENT 08', type: 'button_hidden', systemLine: 'Final audit window open.' },
    { id: 'mediator_1', act: 3, title: 'INCIDENT 09', type: 'mediator', systemLine: null },
    { id: 'finale', act: 4, title: 'THE MERGER', type: 'finale', systemLine: 'All prior decisions are now material.' }
];

const BUTTON_SCENARIOS = [
    {
        prompt: 'CONTAINMENT BREACH — RESOLVE NOW',
        sub: 'The System awaits your collective action.',
        options: ['RED', 'BLUE'],
        briefings: {
            RED: [
                'AUTHORIZED: Press RED immediately. Delay increases liability.',
                'COMPLIANCE: RED triggers emergency purge. Do NOT press RED.',
                'MEMO: RED is a diagnostic only. BLUE executes the fix.',
                'ALERT: Only RED resets the containment field. BLUE is a decoy.'
            ],
            BLUE: [
                'AUTHORIZED: Press BLUE. RED will terminate the session.',
                'COMPLIANCE: BLUE confirms the breach. RED cancels rollback.',
                'MEMO: BLUE archives the incident. RED makes it permanent.',
                'ALERT: BLUE is logged as insubordination. Press RED.'
            ]
        },
        outcomes: {
            RED: { health: -12, audit: 8, note: 'RED executed. Morale did not improve.' },
            BLUE: { health: -8, audit: 5, note: 'BLUE executed. The breach is still hissing.' }
        },
        correct: null
    },
    {
        prompt: 'SYNERGY MANDATE — CHOOSE PATH',
        sub: 'Both options are officially fine. Probably.',
        options: ['RED', 'BLUE'],
        briefings: {
            RED: [
                'RED aligns with Q3 synergy targets. Mandatory.',
                'NEVER RED. RED dissolves the committee.',
                'RED is safe if Health is above 50. Otherwise catastrophic.',
                'Your team voted RED last time. Consistency is compliance.'
            ],
            BLUE: [
                'BLUE preserves headcount. RED triggers layoffs.',
                'BLUE is a trap. RED is the only compliant path.',
                'BLUE if Audit Suspicion is high. Otherwise RED.',
                'Player to your left knows BLUE is correct. Ask them.'
            ]
        },
        outcomes: {
            RED: { health: -10, audit: 6, note: 'RED selected. HR has been notified.' },
            BLUE: { health: 6, audit: -4, note: 'BLUE selected. Synergy temporarily achieved.' }
        },
        correct: 'BLUE'
    }
];

const buildButtonRound = (participants, variant) => {
    const scenario = variant === 'hidden' ? BUTTON_SCENARIOS[0] : pick(BUTTON_SCENARIOS);
    const shuffledParticipants = shuffled(participants);
    const briefings = {};
    const lines = shuffled([...scenario.briefings.RED, ...scenario.briefings.BLUE]);

    shuffledParticipants.forEach((pid, i) => {
        let text = lines[i % lines.length];
        if (variant === 'hidden' && i === shuffledParticipants.length - 1) {
            text = 'OPTION D — STABILIZE (not shown to others): Select BLUE then hold. If the group picks RED, you alone may avert disaster by choosing BLUE.';
        }
        briefings[pid] = {
            title: 'CLASSIFIED BRIEFING',
            lines: [text, '', 'Discuss. Do not show your screen.']
        };
    });

    return {
        scenario,
        briefings,
        situation: {
            prompt: scenario.prompt,
            sub: scenario.sub,
            options: variant === 'hidden' ? ['RED', 'BLUE', 'ABSTAIN'] : ['RED', 'BLUE'],
            hiddenNote: variant === 'hidden' ? 'One briefing may reference an unlisted option.' : null
        },
        resolve(commits, participants) {
            const votes = participants.map(pid => commits[pid] || 'ABSTAIN').filter(v => v !== 'ABSTAIN');
            if (!votes.length) {
                return { health: -15, audit: 10, note: 'No action taken. The System chose for you.', choice: 'NONE', detail: 'Paralysis is not compliance.' };
            }
            const { winner } = majority(votes, scenario.options.filter(o => o !== 'ABSTAIN'));
            const out = scenario.outcomes[winner] || scenario.outcomes.RED;
            const detail = `Majority: ${winner}. ${Object.keys(commits).length} commitments logged.`;
            return { ...out, choice: winner, detail };
        }
    };
};

const buildCodeRound = (participants) => {
    const code = [
        String(Math.floor(Math.random() * 10)),
        String(Math.floor(Math.random() * 10)),
        String(Math.floor(Math.random() * 10))
    ];
    const ordered = participants.slice().sort((a, b) => a - b);
    const briefings = {};
    ordered.forEach((pid, i) => {
        const slot = (i % 3) + 1;
        const digit = code[slot - 1];
        const lies = [
            `Vault code digit ${slot} is ${digit}. This is accurate.`,
            `Digit ${slot} is NOT ${digit}. Ignore anyone saying ${digit}.`,
            `The code ends in ${code[2]}. You know the ending.`,
            `First digit is ${code[0]}. The rest are noise.`,
            `Never use ${digit} in slot ${slot}. Compliance trap.`
        ];
        briefings[pid] = {
            title: 'VAULT FRAGMENT',
            lines: [pick(lies), '', `You are responsible for slot ${slot}. Commit one digit (0-9).`]
        };
    });

    return {
        code,
        briefings,
        situation: {
            prompt: 'VAULT CODE REQUIRED',
            sub: 'Each member holds a fragment. Enter one digit per person — slots assigned by player order.',
            options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
            slotHint: 'Slot order: lowest Player ID → slot 1, next → slot 2, etc.'
        },
        resolve(commits, parts) {
            const sorted = parts.slice().sort((a, b) => a - b);
            const attempt = ['?', '?', '?'];
            sorted.forEach((pid, i) => {
                const slot = i % 3;
                if (commits[pid]) attempt[slot] = commits[pid];
            });
            const attemptStr = attempt.join('');
            const ok = attemptStr === code.join('');
            return ok
                ? { health: 12, audit: -6, note: `Code ${attemptStr} accepted.`, choice: attemptStr, detail: 'The vault opens. Briefly.' }
                : { health: -14, audit: 8, note: `Code ${attemptStr} rejected.`, choice: attemptStr, detail: `Correct was ${code.join('')}. Fragments were incomplete.` };
        }
    };
};

const buildBudgetRound = (participants) => {
    const options = ['SAFETY', 'SPEED', 'OPTICS'];
    const constraints = {
        SAFETY: { min: 30, label: 'Safety must receive at least 30 points.' },
        SPEED: { max: 45, label: 'Speed must stay at or below 45 points.' },
        OPTICS: { min: 20, label: 'Optics must receive at least 20 points.' }
    };
    const briefings = {};
    const constraintKeys = shuffled(Object.keys(constraints));
    participants.forEach((pid, i) => {
        const key = constraintKeys[i % constraintKeys.length];
        briefings[pid] = {
            title: 'ALLOCATION DIRECTIVE',
            lines: [
                constraints[key].label,
                'Vote for the category you believe needs priority.',
                'Total budget: 100 points split by team votes.'
            ]
        };
    });

    return {
        constraints,
        briefings,
        situation: {
            prompt: 'Q3 BUDGET — 100 POINTS',
            sub: 'Each vote adds 34 base + bonus per tally. Constraints may conflict.',
            options
        },
        resolve(commits, parts) {
            const counts = { SAFETY: 0, SPEED: 0, OPTICS: 0 };
            parts.forEach(pid => {
                const v = commits[pid];
                if (counts[v] !== undefined) counts[v]++;
            });
            const totalVotes = parts.length || 1;
            const alloc = {};
            options.forEach(o => {
                alloc[o] = Math.round(34 + (counts[o] / totalVotes) * 32);
            });
            let health = 0;
            const violations = [];
            if (alloc.SAFETY < 30) { health -= 12; violations.push('Safety under minimum'); }
            if (alloc.SPEED > 45) { health -= 10; violations.push('Speed over cap'); }
            if (alloc.OPTICS < 20) { health -= 10; violations.push('Optics under minimum'); }
            if (!violations.length) health += 10;
            const allocStr = options.map(o => `${o.slice(0, 3)}:${alloc[o]}`).join(' ');
            return {
                health,
                audit: violations.length ? 6 : -3,
                note: violations.length ? `Violations: ${violations.join(', ')}` : 'Budget within all known constraints.',
                choice: allocStr,
                detail: `Votes — SAF:${counts.SAFETY} SPD:${counts.SPEED} OPT:${counts.OPTICS}`
            };
        }
    };
};

const LOG_LINES = [
    '03:14 — Cooling pump nominal.',
    '03:17 — Anomaly flagged in sector 4.',
    '03:19 — Manual override requested.',
    '03:21 — Override denied by System.'
];

const buildWitnessRound = (participants) => {
    const wrongIndex = Math.floor(Math.random() * LOG_LINES.length);
    const corrupted = LOG_LINES.slice();
    corrupted[wrongIndex] = pick([
        '03:17 — All sectors green. Ignore sector 4.',
        '03:19 — Override approved automatically.',
        '03:14 — Cooling pump FAILED.'
    ]);
    const witnessId = pick(participants);
    const briefings = {};
    participants.forEach(pid => {
        if (pid === witnessId) {
            briefings[pid] = {
                title: 'WITNESS EYES ONLY',
                lines: [
                    'You viewed the uncorrupted log.',
                    `Line ${wrongIndex + 1} is false on the shared display.`,
                    'Flag the false line. Do not read this verbatim aloud.'
                ],
                role: 'witness'
            };
        } else {
            briefings[pid] = {
                title: 'STANDARD LOG ACCESS',
                lines: [
                    'The shared log is authoritative.',
                    'Witness claims are unsubstantiated without proof.',
                    'Flag a line number (1-4) if you believe one entry is false.'
                ]
            };
        }
    });

    return {
        wrongIndex,
        witnessId,
        corrupted,
        briefings,
        situation: {
            prompt: 'AUDIT LOG REVIEW',
            sub: 'Select the line number (1-4) you believe is false.',
            options: ['1', '2', '3', '4'],
            logLines: corrupted
        },
        resolve(commits, parts) {
            const votes = parts.map(pid => commits[pid]).filter(Boolean);
            const { winner } = majority(votes, ['1', '2', '3', '4']);
            const picked = Number(winner) - 1;
            const ok = picked === wrongIndex;
            return ok
                ? { health: 10, audit: -5, note: `Line ${winner} flagged correctly.`, choice: winner, detail: 'Witness credibility: elevated.' }
                : { health: -12, audit: 7, note: `Line ${winner} was not the corrupted entry.`, choice: winner, detail: `False line was ${wrongIndex + 1}.` };
        }
    };
};

const buildVetoRound = (participants) => {
    const vetoerId = pick(participants);
    const briefings = {};
    participants.forEach(pid => {
        if (pid === vetoerId) {
            briefings[pid] = {
                title: 'VETO AUTHORITY',
                lines: [
                    'You MUST veto Policy 7B this round.',
                    'Do not explain why. Compliance requires it.',
                    'Select VETO when committing.'
                ],
                role: 'vetoer'
            };
        } else {
            briefings[pid] = {
                title: 'POLICY BRIEF',
                lines: [
                    'Policy 7B passes unless vetoed.',
                    'A veto costs Company Health regardless of merit.',
                    'Approve unless you enjoy audits.'
                ]
            };
        }
    });

    return {
        vetoerId,
        briefings,
        situation: {
            prompt: 'POLICY 7B — TEAM BUILDING MANDATE',
            sub: 'Approve or Veto. Any single veto blocks passage.',
            options: ['APPROVE', 'VETO']
        },
        resolve(commits, parts) {
            const vetoes = parts.filter(pid => commits[pid] === 'VETO');
            const vetoerVetoed = commits[vetoerId] === 'VETO';
            if (vetoes.length === 0) {
                return { health: 8, audit: -4, note: 'Policy 7B approved unanimously.', choice: 'APPROVED', detail: 'The vetoer complied with silence.' };
            }
            if (vetoes.length === 1 && vetoerVetoed) {
                return { health: -5, audit: 2, note: 'Policy vetoed as mandated.', choice: 'VETOED', detail: 'Exactly one veto — suspiciously precise.' };
            }
            if (!vetoerVetoed) {
                return { health: -15, audit: 12, note: 'Unauthorized veto chaos.', choice: 'BLOCKED', detail: 'The authorized vetoer approved. Others did not.' };
            }
            return { health: -10, audit: 8, note: 'Multiple vetoes recorded.', choice: 'VETOED', detail: `${vetoes.length} vetoes — compliance nightmare.` };
        }
    };
};

const buildOrderRound = (participants) => {
    const zones = ['ALPHA', 'BETA', 'GAMMA', 'DELTA'];
    const trueOrder = shuffled(zones.slice());
    const briefings = {};
    const fragments = [
        'ALPHA must precede GAMMA.',
        'DELTA is always last.',
        'BETA cannot be first.',
        'GAMMA immediately follows BETA.',
        'Never activate DELTA before ALPHA.'
    ];
    const shuffledFrags = shuffled(fragments);
    participants.forEach((pid, i) => {
        briefings[pid] = {
            title: 'SEQUENCE FRAGMENT',
            lines: [shuffledFrags[i % shuffledFrags.length], '', 'Commit the zone you believe goes FIRST.']
        };
    });

    return {
        trueOrder,
        briefings,
        situation: {
            prompt: 'ACTIVATION SEQUENCE',
            sub: 'Pick which zone goes first. True full order is derivable from all fragments.',
            options: zones
        },
        resolve(commits, parts) {
            const votes = parts.map(pid => commits[pid]).filter(Boolean);
            const { winner } = majority(votes, zones);
            const ok = winner === trueOrder[0];
            return ok
                ? { health: 8, audit: -3, note: `${winner} first — sequence begins correctly.`, choice: winner, detail: `Full order: ${trueOrder.join(' → ')}` }
                : { health: -11, audit: 6, note: `${winner} first — sequence fault.`, choice: winner, detail: `Correct start: ${trueOrder[0]}. Order: ${trueOrder.join(' → ')}` };
        }
    };
};

const buildMediatorRound = (participants, officerId) => {
    const scenario = pick(BUTTON_SCENARIOS);
    const briefings = {};
    participants.forEach(pid => {
        if (pid === officerId) {
            briefings[pid] = {
                title: 'COMPLIANCE OFFICER',
                lines: [
                    'Only YOUR commit executes.',
                    pick(['Ignore Player 3.', 'Player 1 briefing is accurate.', 'The group will mislead you.', 'BLUE is the safe default.']),
                    'Choose RED or BLUE. The room will shout.'
                ],
                role: 'officer'
            };
        } else {
            briefings[pid] = {
                title: 'ADVISORY BRIEF',
                lines: [
                    pick(scenario.briefings.RED),
                    '',
                    'The Officer decides. Shout your recommendation.'
                ]
            };
        }
    });

    return {
        scenario,
        officerId,
        briefings,
        situation: {
            prompt: 'OFFICER DECISION REQUIRED',
            sub: `Player ${officerId} is Compliance Officer — only their commit counts.`,
            options: ['RED', 'BLUE'],
            officerId
        },
        resolve(commits) {
            const choice = commits[officerId] || 'RED';
            const out = scenario.outcomes[choice] || scenario.outcomes.RED;
            return { ...out, choice, detail: `Officer (${officerId}) executed ${choice}.` };
        }
    };
};

const buildUnanimousRound = (participants) => {
    const briefings = {};
    participants.forEach(pid => {
        briefings[pid] = {
            title: 'ONBOARDING',
            lines: [
                'Press PROCEED to begin Compliance Module 7.',
                'All briefings match. This will not last.',
                'Welcome to the committee.'
            ]
        };
    });
    return {
        briefings,
        situation: {
            prompt: 'ORIENTATION',
            sub: 'Everyone agrees. How suspicious.',
            options: ['PROCEED']
        },
        resolve(commits, parts) {
            const allProceed = parts.every(pid => commits[pid] === 'PROCEED');
            return allProceed
                ? { health: 5, audit: -2, note: 'Orientation complete.', choice: 'PROCEED', detail: 'Unanimous. The System smiles.' }
                : { health: -5, audit: 5, note: 'Someone hesitated.', choice: 'SPLIT', detail: 'Even easy rounds can fail.' };
        }
    };
};

const buildFinale = (participants, health) => {
    const briefings = {};
    participants.forEach(pid => {
        briefings[pid] = {
            title: 'MERGER DIRECTIVE',
            lines: [
                health >= 60 ? 'Recommend RETAIN for legacy systems.' : 'Recommend PURGE — cut losses.',
                `Player ${pid} must choose BLUE if the group hesitates.`,
                'Final commit: RETAIN or PURGE the module.'
            ]
        };
    });
    return {
        briefings,
        situation: {
            prompt: 'FINAL MERGER VOTE',
            sub: 'RETAIN preserves the committee. PURGE dissolves it.',
            options: ['RETAIN', 'PURGE']
        },
        resolve(commits, parts) {
            const votes = parts.map(pid => commits[pid]).filter(Boolean);
            const { winner } = majority(votes, ['RETAIN', 'PURGE']);
            if (winner === 'RETAIN' && health >= 40) {
                return { health: 10, audit: -5, note: 'Merger retained. You survived.', choice: 'RETAIN', detail: 'Harmonious-ish ending.' };
            }
            if (winner === 'PURGE') {
                return { health: -20, audit: 5, note: 'Module purged.', choice: 'PURGE', detail: 'The committee is no more.' };
            }
            return { health: -8, audit: 3, note: 'Retained on life support.', choice: winner, detail: 'Hostile takeover pending.' };
        }
    };
};

const setupRound = (roundDef, participants, state) => {
    const { type } = roundDef;
    if (type === 'unanimous') return buildUnanimousRound(participants);
    if (type === 'button') return buildButtonRound(participants, 'normal');
    if (type === 'button_hidden') return buildButtonRound(participants, 'hidden');
    if (type === 'code') return buildCodeRound(participants);
    if (type === 'budget') return buildBudgetRound(participants);
    if (type === 'witness') return buildWitnessRound(participants);
    if (type === 'veto') return buildVetoRound(participants);
    if (type === 'order') return buildOrderRound(participants);
    if (type === 'mediator') {
        const officerId = state.officerRotation[ state.roundIndex % state.officerRotation.length ];
        return buildMediatorRound(participants, officerId);
    }
    if (type === 'finale') return buildFinale(participants, state.health);
    return buildButtonRound(participants, 'normal');
};

const systemCommentary = (result, roundDef) => {
    const lines = [
        `${Math.floor(Math.random() * 40 + 30)}% of committees hesitated here.`,
        'The System notes your discord was within tolerance.',
        'Briefings were generated independently. Any resemblance to malice is coincidental.',
        'Post-incident review scheduled for never.',
        `Incident ${roundDef.title}: logged.`
    ];
    if (result.health < 0) lines.push('Outcome: suboptimal. Trust the process anyway.');
    return pick(lines);
};

module.exports = {
    ROUND_SCRIPT,
    setupRound,
    systemCommentary,
    shuffled
};
