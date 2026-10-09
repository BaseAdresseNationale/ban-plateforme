#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || "$1" != "--apply" || ! -f "$2" ]]; then
  echo 'Usage : bash import-test-96.sh --apply <test-96.sql>' >&2
  echo 'Aucune importation sans --apply et confirmation de la base cible.' >&2
  exit 1
fi
: "${TARGET_DATABASE:?Indiquer explicitement TARGET_DATABASE}"
: "${CONFIRM_TARGET:?Indiquer CONFIRM_TARGET avec le même nom de base}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ban_postgres}"
PG_USERNAME="${PG_USERNAME:-ban_user}"
SHIFT_SECONDS="${SHIFT_SECONDS:-0}"
ANCHOR_TIMESTAMP="${ANCHOR_TIMESTAMP:-}"
for value in "$POSTGRES_CONTAINER" "$PG_USERNAME" "$TARGET_DATABASE"; do
  [[ "$value" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo 'Nom de connexion invalide.' >&2; exit 1; }
done
case "$TARGET_DATABASE" in
  ban|postgres|template0|template1) echo 'Base protégée : import refusé.' >&2; exit 1 ;;
esac
[[ "$TARGET_DATABASE" == "$CONFIRM_TARGET" ]] || { echo 'Confirmation différente de la cible.' >&2; exit 1; }

echo "Import transactionnel : conteneur=$POSTGRES_CONTAINER ; base=$TARGET_DATABASE ; utilisateur=$PG_USERNAME"
echo "Opérations prévues : INSERT des données 96 et ALTER TABLE temporaire des trois triggers d'historisation."
echo "Aucun DROP, DELETE, TRUNCATE ni remplacement des données existantes."
printf 'Commande : docker exec --interactive %q psql --username=%q --dbname=%q --no-psqlrc --set=ON_ERROR_STOP=1 --set=TARGET_DATABASE=%q --set=SHIFT_SECONDS=%q --set=ANCHOR_TIMESTAMP=%q < %q\n' \
  "$POSTGRES_CONTAINER" "$PG_USERNAME" "$TARGET_DATABASE" "$TARGET_DATABASE" "$SHIFT_SECONDS" "$ANCHOR_TIMESTAMP" "$2"

actual="$(docker exec "$POSTGRES_CONTAINER" psql --username="$PG_USERNAME" --dbname="$TARGET_DATABASE" \
  --no-psqlrc --quiet --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command='BEGIN READ ONLY; SELECT current_database(); COMMIT;')"
[[ "$actual" == "$TARGET_DATABASE" ]] || { echo 'Base réellement connectée différente : arrêt.' >&2; exit 1; }
docker exec --interactive "$POSTGRES_CONTAINER" psql \
  --username="$PG_USERNAME" --dbname="$TARGET_DATABASE" --no-psqlrc \
  --set=ON_ERROR_STOP=1 --set=TARGET_DATABASE="$TARGET_DATABASE" \
  --set=SHIFT_SECONDS="$SHIFT_SECONDS" --set=ANCHOR_TIMESTAMP="$ANCHOR_TIMESTAMP" < "$2"
