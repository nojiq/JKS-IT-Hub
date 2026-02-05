
import { prisma } from '../src/shared/db/prisma.js';

async function main() {
    console.log('Seeding database...');

    // Seed IMAP System Config
    const imapSystem = await prisma.systemConfig.upsert({
        where: { systemId: 'imap' },
        update: {
            isItOnly: true,
            usernameLdapField: 'mail',
            description: 'IMAP email access credentials - IT-only access'
        },
        create: {
            systemId: 'imap',
            usernameLdapField: 'mail',
            isItOnly: true,
            description: 'IMAP email access credentials - IT-only access'
        }
    });

    console.log('Seeded IMAP system:', imapSystem);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
