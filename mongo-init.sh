set -e

mongo <<EOF
db = db.getSiblingDB('${MONGODB_DBNAME}')

db.communes.insertMany([
  {
  "codeCommune": "77138",
  },
  {
  "codeCommune": "27115",
  }
])

EOF