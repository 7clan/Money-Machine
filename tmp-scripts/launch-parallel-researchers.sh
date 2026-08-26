#!/usr/bin/env bash
# launch-parallel-researchers.sh
# Launch 3 Researcher subagents SIMULTANEOUSLY — each an isolated process with
# its own chain dir (input/output artifacts + telemetry never collide).
# Records orchestrator wall-clock timestamps for concurrency proof.
set -u
cd /home/z/my-project
P=data/pipeline-state/subagent-chain/parallel
rm -rf "$P"
mkdir -p "$P/w1" "$P/w2" "$P/w3"
printf '{"topic": "psychology of habits"}\n'    > "$P/w1/input.json"
printf '{"topic": "productivity techniques"}\n' > "$P/w2/input.json"
printf '{"topic": "sleep science"}\n'           > "$P/w3/input.json"

OSTART=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
echo "ORCHESTRATOR: launching 3 Researcher subagents SIMULTANEOUSLY at $OSTART"

SUBAGENT_CHAIN_DIR="$P/w1" SUBAGENT_FLOW=parallel SUBAGENT_BATCH=parallel-1 SUBAGENT_INSTANCE=habits \
  bunx tsx src/agents/invokeResearcher.ts > "$P/w1/stdout.log" 2>&1 &
PID1=$!
SUBAGENT_CHAIN_DIR="$P/w2" SUBAGENT_FLOW=parallel SUBAGENT_BATCH=parallel-1 SUBAGENT_INSTANCE=productivity \
  bunx tsx src/agents/invokeResearcher.ts > "$P/w2/stdout.log" 2>&1 &
PID2=$!
SUBAGENT_CHAIN_DIR="$P/w3" SUBAGENT_FLOW=parallel SUBAGENT_BATCH=parallel-1 SUBAGENT_INSTANCE=sleep \
  bunx tsx src/agents/invokeResearcher.ts > "$P/w3/stdout.log" 2>&1 &
PID3=$!

echo "launched pids: $PID1 $PID2 $PID3"
wait "$PID1"; RC1=$?
wait "$PID2"; RC2=$?
wait "$PID3"; RC3=$?
OEND=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

printf '{"orchestratorStartedAt": "%s", "orchestratorEndedAt": "%s", "workers": 3, "exitCodes": [%s, %s, %s]}\n' \
  "$OSTART" "$OEND" "$RC1" "$RC2" "$RC3" > "$P/parallel-orchestrator.json"

echo "ORCHESTRATOR: batch done at $OEND (worker exit codes: $RC1 $RC2 $RC3)"
echo "--- worker stdout ---"
cat "$P/w1/stdout.log" "$P/w2/stdout.log" "$P/w3/stdout.log"
[ "$RC1" -eq 0 ] && [ "$RC2" -eq 0 ] && [ "$RC3" -eq 0 ]
