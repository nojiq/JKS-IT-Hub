import { z } from "zod";
import { requireAuthenticated } from "../../shared/auth/requireAuthenticated.js";
import { createProblemDetails, sendProblem } from "../../shared/errors/problemDetails.js";
import { 
    createNormalizationRuleSchema, 
    updateNormalizationRuleSchema, 
    reorderRulesSchema,
    previewNormalizationSchema,
    ruleIdParamSchema
} from "./schema.js";
import { 
    InvalidRuleConfigError, 
    NormalizationEmptyError, 
    SystemNotFoundError,
    DuplicateRuleError,
    RuleNotFoundError
} from "./service.js";

export default async function normalizationRuleRoutes(app, { config, userRepo, normalizationRuleService }) {

    // GET /api/v1/normalization-rules - List normalization rules
    app.get("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view normalization rules"
            }));
            return;
        }

        const { systemId } = request.query;

        try {
            const rules = await normalizationRuleService.getNormalizationRules(systemId);

            reply.send({ 
                data: rules,
                meta: { 
                    globalCount: rules.global?.length || 0,
                    systemCount: Object.keys(rules.perSystem || {}).length
                }
            });
        } catch (error) {
            console.error('List normalization rules error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to List Normalization Rules",
                detail: error.message || "Failed to retrieve normalization rules"
            }));
        }
    });

    // GET /api/v1/normalization-rules/system/:systemId - Get rules for specific system
    app.get("/system/:systemId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can view normalization rules"
            }));
            return;
        }

        const { systemId } = request.params;

        try {
            const rules = await normalizationRuleService.getRulesForSystem(systemId);

            reply.send({ 
                data: rules,
                meta: { 
                    systemId,
                    globalCount: rules.global.length,
                    systemSpecificCount: rules.systemSpecific.length
                }
            });
        } catch (error) {
            console.error('Get system rules error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Retrieve System Rules",
                detail: error.message || "Failed to retrieve rules for system"
            }));
        }
    });

    // POST /api/v1/normalization-rules - Create new normalization rule
    app.post("/", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can create normalization rules"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = createNormalizationRuleSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const rule = await normalizationRuleService.createNormalizationRule(validation.data, actor.id);

            reply.code(201).send({ data: rule });
        } catch (error) {
            // Handle duplicate rule error
            if (error instanceof DuplicateRuleError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/duplicate-rule',
                    status: 409,
                    title: "Duplicate Rule",
                    detail: error.message,
                    suggestion: "This rule already exists for the selected scope"
                }));
                return;
            }

            // Handle system not found error
            if (error instanceof SystemNotFoundError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/system-not-found',
                    status: 404,
                    title: "System Not Found",
                    detail: error.message,
                    systemId: error.systemId
                }));
                return;
            }

            // Handle invalid rule config error
            if (error instanceof InvalidRuleConfigError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/invalid-rule-config',
                    status: 400,
                    title: "Invalid Rule Configuration",
                    detail: error.message,
                    field: error.field,
                    suggestion: "Review the rule configuration for the selected rule type"
                }));
                return;
            }

            console.error('Create normalization rule error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Create Normalization Rule",
                detail: error.message || "Failed to create normalization rule"
            }));
        }
    });

    // PUT /api/v1/normalization-rules/:ruleId - Update normalization rule
    app.put("/:ruleId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can update normalization rules"
            }));
            return;
        }

        const { ruleId } = request.params;

        // Validate ruleId format
        const idValidation = ruleIdParamSchema.safeParse({ ruleId });
        if (!idValidation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Rule ID",
                detail: "Rule ID must be a valid UUID"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = updateNormalizationRuleSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const rule = await normalizationRuleService.updateNormalizationRule(ruleId, validation.data, actor.id);

            reply.send({ data: rule });
        } catch (error) {
            // Handle rule not found error
            if (error instanceof RuleNotFoundError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/rule-not-found',
                    status: 404,
                    title: "Rule Not Found",
                    detail: error.message,
                    ruleId: error.ruleId
                }));
                return;
            }

            // Handle invalid rule config error
            if (error instanceof InvalidRuleConfigError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/invalid-rule-config',
                    status: 400,
                    title: "Invalid Rule Configuration",
                    detail: error.message,
                    field: error.field,
                    suggestion: "Review the rule configuration for the selected rule type"
                }));
                return;
            }

            console.error('Update normalization rule error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Update Normalization Rule",
                detail: error.message || "Failed to update normalization rule"
            }));
        }
    });

    // DELETE /api/v1/normalization-rules/:ruleId - Delete normalization rule
    app.delete("/:ruleId", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can delete normalization rules"
            }));
            return;
        }

        const { ruleId } = request.params;

        // Validate ruleId format
        const idValidation = ruleIdParamSchema.safeParse({ ruleId });
        if (!idValidation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Rule ID",
                detail: "Rule ID must be a valid UUID"
            }));
            return;
        }

        try {
            const result = await normalizationRuleService.deleteNormalizationRule(ruleId, actor.id);

            reply.send({ data: result });
        } catch (error) {
            // Handle rule not found error
            if (error instanceof RuleNotFoundError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/rule-not-found',
                    status: 404,
                    title: "Rule Not Found",
                    detail: error.message,
                    ruleId: error.ruleId
                }));
                return;
            }

            console.error('Delete normalization rule error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Delete Normalization Rule",
                detail: error.message || "Failed to delete normalization rule"
            }));
        }
    });

    // POST /api/v1/normalization-rules/reorder - Reorder rules
    app.post("/reorder", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can reorder normalization rules"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = reorderRulesSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const result = await normalizationRuleService.reorderNormalizationRules(validation.data.ruleIds, actor.id);

            reply.send({ data: result });
        } catch (error) {
            // Handle rule not found error
            if (error instanceof RuleNotFoundError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/rule-not-found',
                    status: 404,
                    title: "Rule Not Found",
                    detail: error.message,
                    ruleId: error.ruleId
                }));
                return;
            }

            console.error('Reorder normalization rules error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Reorder Normalization Rules",
                detail: error.message || "Failed to reorder normalization rules"
            }));
        }
    });

    // POST /api/v1/normalization-rules/preview - Preview normalization on sample value
    app.post("/preview", async (request, reply) => {
        const actor = await requireAuthenticated(request, reply, { config, userRepo });
        if (!actor) return;

        // RBAC check: IT roles only
        if (!['it', 'admin', 'head_it'].includes(actor.role)) {
            sendProblem(reply, createProblemDetails({
                status: 403,
                title: "Forbidden",
                detail: "Only IT roles can preview normalization"
            }));
            return;
        }

        // Validate request body with Zod
        const validation = previewNormalizationSchema.safeParse(request.body);
        if (!validation.success) {
            sendProblem(reply, createProblemDetails({
                status: 400,
                title: "Invalid Input",
                detail: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }));
            return;
        }

        try {
            const result = await normalizationRuleService.previewNormalization(
                validation.data.value, 
                validation.data.systemId
            );

            reply.send({ data: result });
        } catch (error) {
            // Handle normalization empty error
            if (error instanceof NormalizationEmptyError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/normalization-empty',
                    status: 422,
                    title: "Normalization Produced Empty Output",
                    detail: error.message,
                    value: error.value,
                    rulesApplied: error.rulesApplied.map(r => r.ruleType),
                    suggestion: "Review rules to ensure at least some characters remain"
                }));
                return;
            }

            // Handle invalid rule config error
            if (error instanceof InvalidRuleConfigError) {
                sendProblem(reply, createProblemDetails({
                    type: '/problems/invalid-rule-config',
                    status: 400,
                    title: "Invalid Rule Configuration",
                    detail: error.message,
                    field: error.field,
                    suggestion: "Check that all configured rules have valid configurations"
                }));
                return;
            }

            console.error('Preview normalization error:', error);
            sendProblem(reply, createProblemDetails({
                status: 500,
                title: "Failed to Preview Normalization",
                detail: error.message || "Failed to preview normalization"
            }));
        }
    });
}
