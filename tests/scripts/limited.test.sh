#!/usr/bin/env bash
# Created by Haihs on 11/11/2026
# Shell tests for scripts/limited.sh (exit codes, OOM kill).
L="$(dirname "$0")/../../scripts/limited.sh"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (got $2, want $3)"; fail=1; fi; }

bash "$L" true; check "true -> 0" $? 0
bash "$L" false; check "false -> 1" $? 1

start=$SECONDS
bash "$L" node -e 'const a=[];for(;;)a.push(Buffer.alloc(256*1024*1024,1))' >/dev/null 2>&1
rc=$?
[ $rc -ne 0 ] && [ $rc -ne 127 ] && [ $rc -ne 2 ] && [ $((SECONDS-start)) -lt 30 ]; check "alloc >3GB killed <30s (rc=$rc)" $? 0
exit $fail
