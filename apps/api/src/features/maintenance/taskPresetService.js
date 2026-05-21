import { prisma } from '../../shared/db/prisma.js';
import {
    listTaskPresetsQuerySchema,
    taskPresetInputSchema
} from './preventiveSchema.js';

const normalizeText = (value) => {
    const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
    return normalized || null;
};

const mapPreset = (preset) => ({
    id: preset.id,
    title: preset.title,
    description: preset.description,
    category: preset.category,
    isActive: preset.isActive,
    createdBy: preset.createdBy
        ? {
            id: preset.createdBy.id,
            username: preset.createdBy.username
        }
        : null,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt
});

const notFound = (message) => {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
};

export const listTaskPresets = async (query = {}) => {
    const parsed = listTaskPresetsQuerySchema.parse(query);
    const where = {};

    if (!parsed.includeInactive) where.isActive = true;
    if (parsed.category) where.category = parsed.category.trim();
    if (parsed.search?.trim()) {
        const search = parsed.search.trim();
        where.OR = [
            { title: { contains: search } },
            { description: { contains: search } },
            { category: { contains: search } }
        ];
    }

    const presets = await prisma.maintenanceTaskPreset.findMany({
        where,
        include: { createdBy: { select: { id: true, username: true } } },
        orderBy: [{ category: 'asc' }, { title: 'asc' }]
    });

    return presets.map(mapPreset);
};

export const createTaskPreset = async (data, actor, tx = prisma) => {
    const payload = taskPresetInputSchema.parse(data);
    const title = normalizeText(payload.title);
    const description = normalizeText(payload.description);
    const category = normalizeText(payload.category);

    const preset = await tx.maintenanceTaskPreset.upsert({
        where: { title },
        create: {
            title,
            description,
            category,
            createdById: actor?.id ?? null
        },
        update: {
            isActive: true,
            description,
            category
        },
        include: { createdBy: { select: { id: true, username: true } } }
    });

    return mapPreset(preset);
};

export const deactivateTaskPreset = async (id) => {
    const existing = await prisma.maintenanceTaskPreset.findUnique({
        where: { id }
    });
    if (!existing) throw notFound('Task preset not found');

    const preset = await prisma.maintenanceTaskPreset.update({
        where: { id },
        data: { isActive: false },
        include: { createdBy: { select: { id: true, username: true } } }
    });

    return mapPreset(preset);
};

export const ensureTaskPresetForChecklistItem = async (item, actor, tx = prisma) => {
    if (item.taskPresetId) {
        const preset = await tx.maintenanceTaskPreset.findUnique({
            where: { id: item.taskPresetId }
        });
        if (!preset) throw notFound('Task preset not found');
        return preset;
    }

    return tx.maintenanceTaskPreset.upsert({
        where: { title: normalizeText(item.title) },
        create: {
            title: normalizeText(item.title),
            description: normalizeText(item.description),
            category: 'Other',
            createdById: actor?.id ?? null
        },
        update: { isActive: true }
    });
};

