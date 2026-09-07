/* eslint-disable no-console */
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('[seed] SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set - see .env.example');
    process.exit(1);
  }

  const existing = await prisma.orgAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] ${email} already exists (role=${existing.role}) - nothing to do`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.orgAdmin.create({
    data: { email, passwordHash, role: 'SUPER_ADMIN', organizationId: null },
  });
  console.log(`[seed] created SUPER_ADMIN ${email} - change this password after first login`);
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
