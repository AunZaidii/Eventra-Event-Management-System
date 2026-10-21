#!/usr/bin/env bash
# End-to-end API checks through Nginx against the running docker compose stack.
# Run from the project root after `docker compose up --build -d`:
#   bash tests/e2e/api-e2e.sh
# Reads ADMIN_EMAIL / ADMIN_PASSWORD from .env. Needs curl and node.
set -u
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
B="${BASE_URL:-http://localhost:8080}"
pass=0; fail=0

check() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (expected '$3', got '$2')"; fail=$((fail+1)); fi; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
json() { node -pe "const d=JSON.parse(require('fs').readFileSync(0));$1"; }
post() { curl -s -X POST "$B$1" -H 'Content-Type: application/json' "${@:3}" -d "$2"; }

check "E1 homepage loads" "$(code $B/)" 200
check "E2 homepage is the React app" "$(curl -s $B/ | grep -c '<div id="root">')" 1
JS=$(curl -s $B/ | grep -o '/assets/index-[^"]*\.js' | head -1)
check "E3 JS bundle served" "$(code $B$JS)" 200
check "E4 hashed assets cached for a year" "$(curl -sI $B$JS | grep -ci 'cache-control:.*immutable')" 1
check "E5 deep link /admin/events serves the app" "$(code $B/admin/events)" 200
check "E6 Nginx sends a Content-Security-Policy" "$(curl -sI $B/ | grep -ci 'content-security-policy')" 1
check "E7 health via Nginx reports db up" "$(curl -s $B/api/health | json 'd.db')" up
check "E8 public event list works" "$(code "$B/api/events")" 200
check "E9 wrong admin password is rejected" "$(code -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"wrong\"}")" 401

TOKEN=$(post /api/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | json 'd.token||""')
check "E10 admin login returns a token" "$([ ${#TOKEN} -gt 50 ] && echo yes)" yes
H="Authorization: Bearer $TOKEN"
START=$(node -pe 'new Date(Date.now()+5*864e5).toISOString()')
BEFORE=$(curl -s $B/api/admin/stats -H "$H" | json 'd.totalEvents+"/"+d.soldOutEvents')

EID=$(post /api/admin/events "{\"title\":\"E2E Docker Test Event\",\"description\":\"Created by the end-to-end test.\",\"category\":\"Meetup\",\"startsAt\":\"$START\",\"location\":\"Docker Lab\",\"capacity\":2,\"bannerUrl\":\"\"}" -H "$H" | json 'd.id')
check "E11 admin creates an event" "$([ "$EID" -gt 0 ] 2>/dev/null && echo yes)" yes
check "E12 new event is visible publicly" "$(curl -s "$B/api/events?q=E2E%20Docker" | json 'd.total')" 1
check "E13 visitor registers and gets a code" "$(post /api/events/$EID/registrations '{"name":"Visitor One","email":"one@example.com","phone":"+92 300 1111111"}' | json '/^EVT-[A-Z2-9]{6}$/.test(d.code)')" true
check "E14 duplicate email (other case) is rejected" "$(code -X POST $B/api/events/$EID/registrations -H 'Content-Type: application/json' -d '{"name":"Visitor One","email":"ONE@example.com","phone":"+92 300 1111111"}')" 409
check "E15 second visitor takes the last seat" "$(code -X POST $B/api/events/$EID/registrations -H 'Content-Type: application/json' -d '{"name":"Visitor Two","email":"two@example.com","phone":"+92 300 2222222"}')" 201
check "E16 full event rejects a third visitor" "$(post /api/events/$EID/registrations '{"name":"Visitor Three","email":"three@example.com","phone":"+92 300 3333333"}' | json 'd.error.code')" EVENT_FULL
check "E17 event now shows sold out" "$(curl -s $B/api/events/$EID | json 'd.isSoldOut')" true
AFTER=$(curl -s $B/api/admin/stats -H "$H" | json 'd.totalEvents+"/"+d.soldOutEvents')
check "E18 dashboard stats include the new sold-out event" "$(node -pe "const [a,b]='$BEFORE'.split('/').map(Number);(a+1)+'/'+(b+1)")" "$AFTER"
check "E19 CSV export has header + 2 rows" "$(curl -s $B/api/admin/events/$EID/registrations/export -H "$H" | grep -c '"')" 3
check "E20 CSV download filename through Nginx" "$(curl -sI $B/api/admin/events/$EID/registrations/export -H "$H" | grep -ci 'filename="e2e-docker-test-event-registrations.csv"')" 1
check "E21 admin edits the event" "$(code -X PUT $B/api/admin/events/$EID -H "$H" -H 'Content-Type: application/json' -d "{\"title\":\"E2E Docker Test Event (edited)\",\"description\":\"Created by the end-to-end test.\",\"category\":\"Meetup\",\"startsAt\":\"$START\",\"location\":\"Docker Lab\",\"capacity\":5}")" 200
check "E22 admin deletes the event" "$(code -X DELETE $B/api/admin/events/$EID -H "$H")" 204
check "E23 admin API is blocked without a token" "$(code $B/api/admin/stats)" 401

curl -s -m 3 telnet://localhost:5432 </dev/null >/dev/null 2>&1; rc=$?
check "E24 database port 5432 is NOT reachable from the host" "$([ $rc -eq 7 ] || [ $rc -eq 28 ] && echo closed)" closed
curl -s -m 3 -o /dev/null localhost:4000/api/health; rc=$?
check "E25 API port 4000 is NOT reachable from the host" "$([ $rc -eq 7 ] || [ $rc -eq 28 ] && echo closed)" closed
check "E26 app container runs as non-root" "$(docker compose exec -T app whoami | tr -d '\r')" node
check "E27 .env is not tracked by git" "$(git ls-files .env | wc -l | tr -d ' ')" 0

echo "TOTAL pass=$pass fail=$fail"
[ "$fail" -eq 0 ]
