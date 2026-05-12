
import { prisma } from '../src/shared/db/prisma.js';

const DEFAULT_USER_FIELDS = [
    { fieldKey: 'name', label: 'Name', fieldType: 'text', required: true, sensitive: false, sortOrder: 10 },
    { fieldKey: 'email', label: 'Email', fieldType: 'email', required: true, sensitive: false, sortOrder: 20 },
    { fieldKey: 'date', label: 'Date', fieldType: 'date', required: false, sensitive: false, sortOrder: 30 },
    { fieldKey: 'temporary-password', label: 'Temporary Password', fieldType: 'password', required: false, sensitive: true, sortOrder: 40 },
    { fieldKey: 'actual-password', label: 'Actual Password', fieldType: 'password', required: false, sensitive: true, sortOrder: 50 },
    { fieldKey: 'android-password', label: 'Android Password', fieldType: 'password', required: false, sensitive: true, sortOrder: 60 },
    { fieldKey: 'iphone-mail', label: 'iPhone Mail', fieldType: 'text', required: false, sensitive: false, sortOrder: 70 },
    { fieldKey: 'ipad-mail', label: 'iPad Mail', fieldType: 'text', required: false, sensitive: false, sortOrder: 80 },
    { fieldKey: 'mac-mail', label: 'Mac Mail', fieldType: 'text', required: false, sensitive: false, sortOrder: 90 },
    { fieldKey: 'outlook-ios', label: 'Outlook iOS', fieldType: 'text', required: false, sensitive: false, sortOrder: 100 },
    { fieldKey: 'outlook-android', label: 'Outlook Android', fieldType: 'text', required: false, sensitive: false, sortOrder: 110 },
    { fieldKey: 'outlook-desktop', label: 'Outlook Desktop', fieldType: 'text', required: false, sensitive: false, sortOrder: 120 },
    { fieldKey: 'active-directory', label: 'Active Directory', fieldType: 'text', required: false, sensitive: false, sortOrder: 130 },
    { fieldKey: 'remarks', label: 'Remarks', fieldType: 'textarea', required: false, sensitive: false, sortOrder: 140 }
];

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

    for (const field of DEFAULT_USER_FIELDS) {
        await prisma.userFieldDefinition.upsert({
            where: { fieldKey: field.fieldKey },
            update: {
                label: field.label,
                fieldType: field.fieldType,
                required: field.required,
                sensitive: field.sensitive,
                isActive: true,
                sortOrder: field.sortOrder
            },
            create: {
                ...field,
                isActive: true
            }
        });
    }

    console.log(`Seeded ${DEFAULT_USER_FIELDS.length} user profile fields.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
