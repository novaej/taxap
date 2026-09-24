#!/bin/bash
# Setup local PostgreSQL database for development
# Usage: ./scripts/setup-db.sh [container-name] [username] [password]

CONTAINER=${1:-postgres18}
DB_USER=${2:-taxap}
DB_PASSWORD=${3:-$(openssl rand -base64 24)}
DB_NAME="taxap_dev"

echo "📦 Setting up PostgreSQL for taxap"
echo "  Container:  $CONTAINER"
echo "  User:       $DB_USER"
echo "  Database:   $DB_NAME"
echo ""

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '$CONTAINER' not found"
  exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "⏳ Starting container..."
  docker start "$CONTAINER"
  sleep 2
fi

# Create user and database
echo "🔧 Creating user and database..."
docker exec "$CONTAINER" psql -U postgres -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>&1 || echo "  (user may already exist)"
docker exec "$CONTAINER" psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>&1 || echo "  (database may already exist)"

# Grant permissions
echo "🔐 Granting permissions..."
docker exec "$CONTAINER" psql -U postgres -c "ALTER ROLE $DB_USER CREATEDB;" 2>&1

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local..."
  cat > .env.local <<ENVEOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production"
ENVEOF
  echo "✅ .env.local created"
  echo "⚠️  Keep this file secure and don't commit it"
else
  echo "⚠️  .env.local already exists (not overwritten)"
fi

# Verify connection
echo ""
echo "🧪 Testing connection..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" 2>&1 && echo "✅ Connection successful" || echo "❌ Connection failed"

echo ""
echo "✨ Setup complete!"
echo "   Connection string: postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}"
