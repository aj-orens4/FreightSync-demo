#!/bin/bash
set -e

echo "=== FreightSync — Codespace setup starting ==="

echo "Installing MySQL client..."
sudo apt-get update -qq
sudo apt-get install -y -qq default-mysql-client

echo "Waiting for MySQL (db service) to be ready..."
until mysqladmin ping -h db -u root -proot --skip-ssl --silent 2>/dev/null; do
  echo "  ...still waiting for MySQL"
  sleep 2
done
echo "MySQL is up."

echo "Loading schema and seed data..."
mysql -h db -u root -proot --skip-ssl < database/schema.sql
mysql -h db -u root -proot --skip-ssl < database/seed.sql

echo "Writing backend/.env..."
cat > backend/.env << 'EOF'
PORT=4000
DB_HOST=db
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=freightsync
JWT_SECRET=codespace_dev_secret_change_me
JWT_EXPIRES_IN=8h
CORS_ORIGIN=*
EOF

echo "Installing backend dependencies..."
cd backend
npm install --no-fund --no-audit
echo "Setting demo account passwords..."
npm run seed
cd ..

echo ""
echo "=== Setup complete! ==="
echo "Next steps:"
echo "  1. Open a terminal, run:  cd backend && npm run dev"
echo "  2. Open a second terminal, run:  cd frontend && npx serve ."
echo "  3. Click the forwarded 'Frontend' port link/popup to open the app."
echo "  4. Log in with username 'admin' and password 'Password123!'"
