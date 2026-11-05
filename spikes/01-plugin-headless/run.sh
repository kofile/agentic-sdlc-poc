#!/bin/bash
# usage: run.sh <name> <outfmt> <extra claude args...> -- <prompt>
# Runs claude -p against the scratch repo with the plugin loaded from ai-coe-plugins, no MCP, capped.
SPIKE=/Users/evanstern/projects/kofile/agentic-sdlc-poc/spikes/01-plugin-headless
PLUGIN=/Users/evanstern/projects/kofile/ai-coe-plugins/plugins/sdlc-pipeline-plugin
NAME=$1; FMT=$2; shift 2
cd $SPIKE/scratch
claude -p --plugin-dir $PLUGIN --strict-mcp-config --mcp-config $SPIKE/empty-mcp.json \
  --output-format $FMT $( [ $FMT = stream-json ] && echo --verbose ) \
  --max-turns ${MAXTURNS:-4} --max-budget-usd ${BUDGET:-0.50} "$@" \
  > $SPIKE/raw/$NAME.out 2> $SPIKE/raw/$NAME.err
echo "exit=$?" | tee $SPIKE/raw/$NAME.exit
